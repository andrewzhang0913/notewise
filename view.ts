import { ItemView, WorkspaceLeaf, ButtonComponent, Notice, MarkdownView, setIcon, DropdownComponent, requestUrl } from "obsidian";
import { DifyService } from "./dify_service";

export const VIEW_TYPE_HOMENET = "homenet-view";

interface VADConfig {
    silenceThreshold: number; // Volume threshold (0-255 or decibel)
    silenceDuration: number;  // ms to trigger cut
    maxDuration: number;      // ms to force cut
    minDuration: number;      // ms to allow cut
}
// --- Audio Visualizer ---
class AudioVisualizer {
    canvas: HTMLCanvasElement;
    canvasCtx: CanvasRenderingContext2D;
    analyser: AnalyserNode;
    bufferLength: number;
    dataArray: Uint8Array;
    animationId: number;

    constructor(container: HTMLElement, analyser: AnalyserNode) {
        this.analyser = analyser;
        this.analyser.fftSize = 256;
        this.bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);

        // Create Canvas
        const wrapper = container.createDiv({ cls: "homenet-visualizer-container" });
        this.canvas = wrapper.createEl("canvas", { cls: "homenet-visualizer-canvas" });

        // Resize observer to handle container resizing
        new ResizeObserver(() => this.resize()).observe(wrapper);
        this.resize();

        this.canvasCtx = this.canvas.getContext("2d")!;
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    setVisible(visible: boolean) {
        if (visible) {
            this.canvas.parentElement?.addClass("is-visible");
            this.draw();
        } else {
            this.canvas.parentElement?.removeClass("is-visible");
            cancelAnimationFrame(this.animationId);
            this.clear();
        }
    }

    draw() {
        this.animationId = requestAnimationFrame(() => this.draw());

        this.analyser.getByteFrequencyData(this.dataArray);

        const width = this.canvas.width;
        const height = this.canvas.height;
        const barWidth = (width / this.bufferLength) * 2.5;
        let x = 0;

        // Deep Space Background Gradient
        const bgGradient = this.canvasCtx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#0a0e27');
        bgGradient.addColorStop(1, '#1a1a2e');
        this.canvasCtx.fillStyle = bgGradient;
        this.canvasCtx.fillRect(0, 0, width, height);

        // Draw Symmetric Spectrum with Glow
        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.dataArray[i] / 255) * (height / 2) * 0.9;

            // Frequency-based Color: Cyan (180) -> Green (120) -> Purple (280)
            const normalizedFreq = i / this.bufferLength;
            let hue = 180 + normalizedFreq * 100; // 180 -> 280

            // Glow Effect
            this.canvasCtx.shadowBlur = 15;
            this.canvasCtx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            this.canvasCtx.fillStyle = `hsl(${hue}, 100%, 65%)`;

            // Mirror Effect - Top Half
            this.canvasCtx.fillRect(x, height / 2 - barHeight, barWidth, barHeight);
            // Mirror Effect - Bottom Half
            this.canvasCtx.fillRect(x, height / 2, barWidth, barHeight);

            x += barWidth + 1;
        }

        // Reset shadow for next frame
        this.canvasCtx.shadowBlur = 0;
    }

    clear() {
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

export class HomeNetView extends ItemView {
    difyService: DifyService;
    visualizer: AudioVisualizer | null = null;
    visualizerContainer: HTMLElement;

    // Audio Components
    mediaRecorder: MediaRecorder | null = null;
    audioContext: AudioContext | null = null;
    analyser: AnalyserNode | null = null;
    audioChunks: Blob[] = [];

    // VAD State
    isRecording = false;
    isPaused = false;
    currentVolume = 0;
    silenceStart: number | null = null;
    recordingStart: number = 0;

    // Logic Loop
    animationFrameId: number | null = null;

    // Context
    lastTranscription = "";

    // Modes
    refineMode: 'journal' | 'meeting' | 'list' = 'journal';
    isTranslationMode = false;

    // Config
    vadConfig: VADConfig = {
        silenceThreshold: 10, // low volume floor
        silenceDuration: 800, // 0.8s silence
        maxDuration: 15000,   // 15s max
        minDuration: 5000     // 5s min
    };

    // UI Elements
    statusEl: HTMLElement;
    contentArea: HTMLElement;
    inputArea: HTMLTextAreaElement;
    recordBtnEl: HTMLElement;
    searchBar: HTMLInputElement;

    // Long Press Logic
    pressTimer: any = null;
    isLongPress = false;

    // Advanced State
    translateBtn: ButtonComponent;

    constructor(leaf: WorkspaceLeaf, difyService: DifyService) {
        super(leaf);
        this.difyService = difyService;
    }

    getViewType() { return VIEW_TYPE_HOMENET; }
    getDisplayText() { return "NoteWise (智记)"; }
    getIcon() { return "audio-waveform"; }

    async onOpen() {
        // Add Header Actions
        // Clear existing actions (hacky but needed if re-running onOpen)
        // Actually, ItemView actions are usually managed by the leaf. 
        // Let's just add it if it doesn't exist? 
        // Ideally, we shouldn't add it here if it persists.
        // But for "Reload" button logic specifically requested to avoid restart:

        // We will just add the button once. 
        // Note: standard `addAction` appends to the header.
        if (this.containerEl.querySelectorAll('.view-action.reload-btn').length === 0) {
            this.addAction("refresh-cw", "Reload View", () => {
                this.onOpen();
                new Notice("Reloaded Plugin View");
            }).addClass("reload-btn");
        }

        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("homenet-container");

        // 1. Header & Search
        const header = container.createDiv({ cls: "homenet-header" });
        this.searchBar = header.createEl("input", {
            cls: "homenet-search-bar",
            attr: { type: "text", placeholder: "🔍 Search transcripts..." }
        });

        // Visualizer Container (Below Search)
        this.visualizerContainer = header.createDiv();

        // Search Logic
        this.searchBar.addEventListener("input", (e) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase();
            this.contentArea.querySelectorAll(".homenet-message").forEach((msg: HTMLElement) => {
                const text = msg.innerText.toLowerCase();
                if (text.includes(query)) {
                    msg.style.display = "flex";
                } else {
                    msg.style.display = "none";
                }
            });
        });

        // 2. Content Area (Chat Style)
        this.contentArea = container.createDiv({ cls: "homenet-content-area" });
        this.addSystemMessage("👋 Ready to listen. Contextual AI active.");

        // 3. Bottom Controls
        const bottomContainer = container.createDiv({ cls: "homenet-bottom-container" });

        // Input wrapper
        const inputWrapper = bottomContainer.createDiv({ cls: "homenet-input-wrapper" });

        // Text Area
        this.inputArea = inputWrapper.createEl("textarea", {
            cls: "homenet-input-area",
            attr: { placeholder: "Type or record... Use @ for mentions." }
        });

        // Controls Toolbar (Inside Input Wrapper)
        const controls = inputWrapper.createDiv({ cls: "homenet-input-controls" });

        // Left Controls (Mode)
        const leftControls = controls.createDiv({ cls: "homenet-left-controls" });

        const refineModeDropdown = new DropdownComponent(leftControls)
            .addOption("journal", "📝 Journal")
            .addOption("meeting", "👥 Meeting")
            .addOption("list", "✅ List")
            .setValue(this.refineMode)
            .onChange((value) => {
                this.refineMode = value as "journal" | "meeting" | "list";
                this.updateStatus(`Mode: ${value}`);
            });

        // Translation Toggle (Globe)
        const transBtn = new ButtonComponent(leftControls)
            .setIcon("globe")
            .setTooltip("Smart Swap Translation (CN<->EN)")
            .onClick(() => {
                this.isTranslationMode = !this.isTranslationMode;
                if (this.isTranslationMode) {
                    transBtn.buttonEl.addClass("is-active-toggle");
                    new Notice("🌐 Smart Swap: ON");
                } else {
                    transBtn.buttonEl.removeClass("is-active-toggle");
                    new Notice("Smart Swap: OFF (Keep Original)");
                }
            });

        // Right Controls (Actions)
        const rightControls = controls.createDiv({ cls: "homenet-right-controls" });

        // Record Button
        const recordBtn = rightControls.createEl("button", { cls: "homenet-record-btn" });
        setIcon(recordBtn, "mic");
        this.recordBtnEl = recordBtn; // CRITICAL: Assign to class property!

        recordBtn.onclick = async () => {
            this.toggleRecordingState();
        };

        // Refine Button (Magic Wand)
        new ButtonComponent(rightControls)
            .setIcon("wand")
            .setTooltip("Refine Text")
            .onClick(async () => {
                await this.refineText();
                this.autoResizeInput(); // Trigger resize after refine
            });

        // Insert Button (Arrow/PaperPlane)
        new ButtonComponent(rightControls)
            .setIcon("arrow-up-circle") // Or 'paper-plane'
            .setTooltip("Insert to Note")
            .onClick(() => this.insertToActiveNote());

        // --- Auto-Resize Logic ---
        this.inputArea.addEventListener("input", () => this.autoResizeInput());

        // Status Bar
        this.statusEl = bottomContainer.createDiv({ cls: "homenet-status-bar" });
        this.updateStatus("Ready");
    }

    toggleTranslationMode() {
        this.isTranslationMode = !this.isTranslationMode;
        this.updateTranslateBtnVisual();
        new Notice(`Translation Mode: ${this.isTranslationMode ? "ON" : "OFF"}`);
    }

    updateTranslateBtnVisual() {
        if (this.translateBtn && this.translateBtn.buttonEl) {
            if (this.isTranslationMode) {
                this.translateBtn.buttonEl.addClass("is-active-toggle");
            } else {
                this.translateBtn.buttonEl.removeClass("is-active-toggle");
            }
        }
    }

    // --- Interaction Handlers ---

    handleBtnDown(e: Event) {
        e.preventDefault(); // Prevent focus loss
        this.isLongPress = false;

        // If we are recording, holding might mean STOP
        if (this.isRecording) {
            this.pressTimer = setTimeout(() => {
                this.isLongPress = true;
                this.stopRecording(true); // True = Force Stop
                this.updateBtnVisuals("stop");
            }, 800); // 800ms long press
        }
    }

    handleBtnUp(e: Event) {
        if (this.pressTimer) clearTimeout(this.pressTimer);

        if (this.isLongPress) {
            // Already handled by timeout
            this.isLongPress = false;
            return;
        }

        // Short click logic
        this.toggleRecordingState();
    }

    async toggleRecordingState() {
        if (!this.isRecording) {
            // Idle -> Start
            await this.startRecording();
        } else {
            // Recording -> Stop & Transcribe
            await this.stopRecording(true);
        }
    }



    autoResizeInput() {
        this.inputArea.style.height = 'auto'; // Reset to shrink if needed
        this.inputArea.style.height = this.inputArea.scrollHeight + 'px';
    }

    updateBtnVisuals(state: 'idle' | 'recording' | 'paused' | 'stop') {
        this.recordBtnEl.removeClass("is-recording", "is-paused", "is-stopping");

        if (state === 'idle') {
            setIcon(this.recordBtnEl, "microphone");
            this.updateStatus("Ready");
        } else if (state === 'recording') {
            this.recordBtnEl.addClass("is-recording");
            setIcon(this.recordBtnEl, "waveform"); // or mic
            this.updateStatus("Listening...", "var(--text-error)");
        } else if (state === 'paused') {
            this.recordBtnEl.addClass("is-paused");
            setIcon(this.recordBtnEl, "pause");
            this.updateStatus("Paused (Click to Resume)", "var(--text-muted)");
        } else if (state === 'stop') {
            this.recordBtnEl.addClass("is-stopping");
            setTimeout(() => this.recordBtnEl.removeClass("is-stopping"), 200);
            this.updateStatus("Processing...", "var(--text-accent)");
        }
    }

    // --- Recording Core with Auto-Slice ---

    sliceIntervalId: ReturnType<typeof setInterval> | null = null;
    sliceIntervalMs = 10000; // 10 seconds per slice (configurable)
    pendingSlice = false; // Flag to trigger processing from ondataavailable

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Visualizer Setup (Optional, safe to fail)
            try {
                this.audioContext = new AudioContext();
                const source = this.audioContext.createMediaStreamSource(stream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                source.connect(this.analyser);

                if (!this.visualizer) {
                    this.visualizer = new AudioVisualizer(this.visualizerContainer, this.analyser);
                } else {
                    this.visualizer.analyser = this.analyser;
                }
                this.visualizer.setVisible(true);
            } catch (vErr) {
                console.warn("Visualizer failed to init:", vErr);
            }

            // Recorder Setup
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }

                // Check if we should process now (triggered by auto-slice timer)
                if (this.pendingSlice && this.audioChunks.length > 0) {
                    this.pendingSlice = false;
                    new Notice(`Auto-slice: Processing ${this.audioChunks.length} chunks...`);
                    this.processAudioChunk(false); // false = not final, keep recording
                }
            };

            // Handle Stop Event (Final cleanup)
            this.mediaRecorder.onstop = () => {
                // Clear interval
                if (this.sliceIntervalId) {
                    clearInterval(this.sliceIntervalId);
                    this.sliceIntervalId = null;
                }

                // Process remaining chunks
                if (this.audioChunks.length > 0) {
                    new Notice("Processing final slice...");
                    this.processAudioChunk(true);
                }

                // Cleanup tracks
                stream.getTracks().forEach(track => track.stop());

                if (this.visualizer) this.visualizer.setVisible(false);
                if (this.audioContext) {
                    this.audioContext.close();
                    this.audioContext = null;
                }
                this.mediaRecorder = null;
                this.updateBtnVisuals('idle');
            };

            this.mediaRecorder.start(100); // 100ms slices for safety
            this.isRecording = true;
            this.isPaused = false;

            this.updateBtnVisuals('recording');
            new Notice("Microphone Active 🎙️ (Auto-slice: 10s)");

            // --- Auto-Slice Timer ---
            this.sliceIntervalId = setInterval(() => {
                if (this.isRecording && !this.isPaused && this.mediaRecorder?.state === 'recording') {
                    // Set flag and request data - processing happens in ondataavailable
                    this.pendingSlice = true;
                    this.mediaRecorder.requestData();
                }
            }, this.sliceIntervalMs);

        } catch (error) {
            console.error("Mic Error:", error);
            new Notice("Failed to access microphone. Check permissions.");
            this.isRecording = false;
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.updateBtnVisuals('paused');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.updateBtnVisuals('recording');
        }
    }

    async stopRecording(completely = true) {
        if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") return;

        this.isRecording = false;
        this.pendingSlice = false; // Clear any pending slice
        this.updateBtnVisuals('stop');

        // This triggers onstop() which handles cleanup and final processing
        this.mediaRecorder.stop();
    }

    // Legacy stubs
    monitorAudio() { }
    cutAndTranscribe() { }

    // --- Processing ---

    async processAudioChunk(isFinal: boolean) {
        if (this.audioChunks.length === 0) {
            new Notice("⚠️ No audio data captured.");
            return;
        }

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        // Debug: Show processing status
        new Notice(`Processing Audio (${(blob.size / 1024).toFixed(1)} KB)...`);

        // Check Setting: Save File?
        // @ts-ignore
        const saveFile = this.app.plugins.getPlugin('homenet-sync').settings.saveAudioFiles;
        if (saveFile) {
            this.saveAudioToVault(blob);
        }

        const file = new File([blob], "recording.webm", { type: 'audio/webm' });

        // Clear chunks if we are done with this segment
        this.audioChunks = [];

        this.updateStatus("Transcribing...");

        try {
            // Pass Context (lastTranscription)
            const prompt = this.lastTranscription.slice(-500); // Last 500 chars as context

            // Debug: Start Request
            // new Notice("Sending to Dify...");
            const text = await this.difyService.transcribeAudio(file, prompt);

            if (text && text.trim().length > 0) {
                this.lastTranscription += text + " ";
                // Append to UI
                this.streamTextToInput(text + " ");
                this.addUserMessage(text, blob);

                // Show success
                new Notice("✅ Transcribed");
                this.autoResizeInput(); // Expand inputs
            } else {
                new Notice("⚠️ Transcription returned empty text.");
            }
        } catch (e) {
            console.error("Transcribe Error:", e);
            new Notice("❌ Transcription Failed: " + e.message);
        }

        this.updateStatus(this.isRecording ? "Listening..." : "Ready", this.isRecording ? "var(--text-error)" : "");
    }

    async saveAudioToVault(blob: Blob) {
        // Simple implementation: Save to root
        const buffer = await blob.arrayBuffer();
        const filename = `Voice Note ${window.moment().format("YYYY-MM-DD HH-mm-ss")}.webm`;
        try {
            await this.app.vault.createBinary(filename, buffer);
            new Notice(`Audio saved: ${filename}`);
        } catch (e) {
            console.error("Failed to save audio", e);
        }
    }

    // --- UI Modifiers ---

    streamTextToInput(text: string) {
        // Simple append for now, can be improved to ease-in
        this.inputArea.value += text;
        this.inputArea.scrollTop = this.inputArea.scrollHeight;
    }

    addUserMessage(text: string, audioBlob?: Blob) {
        const msg = this.contentArea.createDiv({ cls: "homenet-message user" });

        // 1. Audio Player
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioContainer = msg.createDiv({ cls: "homenet-audio-player" });
            const audio = audioContainer.createEl("audio", {
                attr: { controls: "true", src: audioUrl }
            });
            // Inline styles for immediate visibility
            audio.style.width = "100%";
            audio.style.height = "30px";
            audio.style.marginBottom = "6px";
        }

        // 2. Editable Text with Typewriter Effect
        const textEl = msg.createDiv({ cls: "homenet-message-text is-typing" });
        textEl.contentEditable = "true";
        textEl.setText(text);

        // Remove animation class after completion to allow re-triggering
        setTimeout(() => {
            textEl.removeClass("is-typing");
        }, 800); // Match CSS animation duration

        this.scrollToBottom();
    }

    addSystemMessage(text: string) {
        const msg = this.contentArea.createDiv({ cls: "homenet-message system" });
        msg.setText(text);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.contentArea.scrollTop = this.contentArea.scrollHeight;
    }

    updateStatus(text: string, color: string = "") {
        this.statusEl.setText(text);
        if (color) this.statusEl.style.color = color;
        else this.statusEl.style.removeProperty("color");
    }

    // --- Other Actions ---

    insertToActiveNote() {
        const text = this.inputArea.value;
        if (!text) {
            new Notice("No text to insert.");
            return;
        }

        let view = this.app.workspace.getActiveViewOfType(MarkdownView);

        // If sidebar is focused, active view might be us. Find a markdown leaf.
        if (!view) {
            const leaves = this.app.workspace.getLeavesOfType("markdown");
            if (leaves.length > 0) {
                // Ideally pick the last active one, but for now picker the first found
                view = leaves[0].view as MarkdownView;
            }
        }

        if (view) {
            const editor = view.editor;
            const cursor = editor.getCursor();

            // Insert text
            editor.replaceRange(text + "\n", cursor);

            // Scroll to end of insertion
            const lines = text.split('\n').length;
            editor.setCursor({ line: cursor.line + lines, ch: 0 });

            new Notice("Inserted to note!");

            // Collapse / Reset for next session
            this.collapseSession(text);

        } else {
            new Notice("No active Markdown note found to insert into.");
        }
    }

    collapseSession(savedText: string) {
        // 1. Clear Input
        this.inputArea.value = "";

        // 2. Identify Loose Messages (Current Session)
        // We only want to archive "homenet-message" elements (User or System)
        // We skip existing Summaries or Archives
        const looseMessages = Array.from(this.contentArea.children).filter(el =>
            el.classList.contains("homenet-message")
        );

        if (looseMessages.length === 0) return;

        // 3. Create Archive Container
        const archive = this.contentArea.createDiv({ cls: "homenet-session-archive" });
        archive.style.display = "none";

        // Move messages into archive
        looseMessages.forEach(msg => archive.appendChild(msg));

        // 4. Create Summary Toggle (Insert BEFORE Archive)
        const summaryText = savedText.length > 40 ? savedText.slice(0, 40) + "..." : savedText;
        const time = window.moment().format("HH:mm");

        const summaryEl = this.contentArea.createDiv({ cls: "homenet-session-summary is-collapsed" });
        summaryEl.style.cursor = "pointer";

        // Toggle Logic
        const icon = summaryEl.createSpan({ cls: "summary-icon", text: "▶️" });
        summaryEl.createSpan({ cls: "summary-time", text: `[${time}]` });
        summaryEl.createSpan({ cls: "summary-text", text: summaryText });

        summaryEl.onclick = () => {
            const isHidden = archive.style.display === "none";
            archive.style.display = isHidden ? "block" : "none";
            icon.setText(isHidden ? "🔽" : "▶️");
            summaryEl.toggleClass("is-collapsed", !isHidden);
        };

        // Re-order in DOM: Summary -> Archive -> (New content will follow)
        // Since we created them, they are at the bottom now.
        // Order is correct: Summary (created 3nd), Archive (created 4th but appended msgs).
        // Wait, I created `archive` (step 3), then `summaryEl` (step 4).
        // So `archive` is ABOVE `summaryEl` in DOM.
        // I want Summary ABOVE Archive.
        this.contentArea.insertBefore(summaryEl, archive);

        // 5. Reset Context
        this.lastTranscription = "";

        // Add a fresh system message which will appear AFTER this block
        this.addSystemMessage("Session saved to note. History collapsed.");
    }

    async refineText() {
        const text = this.inputArea.value;
        if (!text) return;

        this.updateStatus("Refining...", "var(--text-accent)");

        // @ts-ignore
        const settings = this.app.plugins.getPlugin('homenet-sync').settings;

        // --- Construct Dynamic Prompt ---
        let systemPrompt = "";

        if (this.refineMode === 'journal') {
            systemPrompt = `You are a professional diary editor. 
Your task is to polish the user's raw thoughts into a coherent, reflective, and concise journal entry (Daily Note).
Perspective: First-person.
Format: Clean paragraphs.
STRICTLY NO CHAT. OUTPUT ONLY THE REFINED TEXT.`;

        } else if (this.refineMode === 'meeting') {
            systemPrompt = `You are a professional secretary.
Target: Meeting Minutes.
Structure:
- **Summary**: 1-2 sentences.
- **Key Points**: Bullet list.
- **Action Items**: [ ] Checklist of tasks.
STRICTLY NO CHAT. OUTPUT ONLY THE STRUCTURED NOTE.`;

        } else if (this.refineMode === 'list') {
            systemPrompt = `You are a strict checklist assistant.
Target: Convert text into a Markdown Todo List ([ ]).
Rules:
- Break down complex sentences into atomic tasks.
- Ignore fluff.
- Output ONLY the list.`;
        }

        // 2. Language Modifier (Mutually Exclusive)
        if (this.isTranslationMode) {
            // A. Smart Translation (Swap)
            systemPrompt += `\n\nCRITICAL ADDITIONAL INSTRUCTION (SMART TRANSLATION): 
After processing the above format, perform a LANGUAGE CHECK:
1. IF the refined textual content is CHINESE -> TRANSLATE it into ENGLISH.
2. IF the refined textual content is ENGLISH -> TRANSLATE it into CHINESE (Simplified).
Output ONLY the final translated result in the requested format.`;
        } else {
            // B. Keep Original (Strict)
            systemPrompt += `\n\nCRITICAL: OUTPUT IN THE SAME LANGUAGE AS THE INPUT (Input CN->Output CN, Input EN->Output EN).`;
        }

        try {
            let result = "";
            if (settings.refineProvider === 'dify') {
                // Dify Flow is static, so we might lose the prompt override unless we pass it as a variable.
                // For now, assume user knows Dify flow is fixed. 
                // Or we could pass 'mode' variable if Dify supports it.
                // Falling back to just running it.
                result = await this.difyService.runJournalAgent(text);
            } else {
                // Direct LLM (SiliconFlow) supports system Prompt override!
                result = await this.difyService.refineTextViaSiliconFlow(text, settings.refineModel, systemPrompt);
            }

            this.inputArea.value = result;

            const modeIcons = { journal: '📝', meeting: '👥', list: '✅' };
            const icon = modeIcons[this.refineMode];
            this.addSystemMessage(`✨ Refined: ${icon} ${this.refineMode.toUpperCase()} ${this.isTranslationMode ? `(+ 🌐 Translate)` : ''}`);

            this.updateStatus("Ready");
        } catch (e) {
            this.updateStatus("Error", "var(--text-error)");
            new Notice("Refine Error: " + e.message);
        }
    }

    async onClose() {
        this.stopRecording(true);
    }
}
