import { requestUrl, RequestUrlParam } from 'obsidian';

export class DifyService {
    baseUrl: string;
    journalKey: string;
    siliconFlowKey: string;
    groqApiKey: string; // New separate key
    inputVar: string;
    refineTemplate: string;

    constructor(baseUrl: string, journalKey: string, siliconFlowKey: string, groqApiKey: string, inputVar: string = 'journal_text', refineTemplate: string = "") {
        this.baseUrl = baseUrl.replace(/\/$/, '').trim();
        this.journalKey = journalKey.trim();
        this.siliconFlowKey = siliconFlowKey.trim();
        this.groqApiKey = groqApiKey.trim();
        this.inputVar = inputVar.trim();
        this.refineTemplate = refineTemplate;
    }

    updateConfig(baseUrl: string, journalKey: string, siliconFlowKey: string, groqApiKey: string, inputVar: string, refineTemplate: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '').trim();
        this.journalKey = journalKey.trim();
        this.siliconFlowKey = siliconFlowKey.trim();
        this.groqApiKey = groqApiKey.trim();
        this.inputVar = inputVar.trim();
        this.refineTemplate = refineTemplate;
    }

    async runJournalAgent(text: string): Promise<string> {
        if (!this.journalKey) throw new Error("Journal App Key is missing.");

        const url = `${this.baseUrl}/workflows/run`;
        const headers = {
            "Authorization": `Bearer ${this.journalKey}`,
            "Content-Type": "application/json"
        };

        const inputs: Record<string, string> = {
            [this.inputVar]: text
        };

        const body = {
            inputs: inputs,
            response_mode: "blocking",
            user: "obsidian-plugin"
        };

        try {
            const response = await requestUrl({
                url: url,
                method: "POST",
                headers: headers,
                body: JSON.stringify(body)
            });

            if (response.status !== 200) {
                console.error("Dify Error Headers:", response.headers);
                // Try to read error body
                let errorMsg = `Status ${response.status}`;
                try {
                    const errorBody = response.json as { message?: string; code?: string };
                    errorMsg += `: ${JSON.stringify(errorBody)}`;
                } catch {
                    errorMsg += ` (Body: ${response.text})`;
                }
                throw new Error(errorMsg);
            }

            return (response.json as { data: { outputs: { result: string } } }).data.outputs.result;

        } catch (error) {
            console.error("Dify Service Error:", error);
            throw error;
        }
    }

    async transcribeAudio(audioFile: File, prompt?: string): Promise<string> {
        let url = "";
        let apiKey = "";
        let model = "";

        if (this.siliconFlowKey) {
            url = "https://api.siliconflow.cn/v1/audio/transcriptions";
            apiKey = this.siliconFlowKey;
            model = "FunAudioLLM/SenseVoiceSmall";
            console.debug(`[DifyService] Using SiliconFlow (SenseVoiceSmall) for Transcription`);
        } else if (this.groqApiKey) {
            url = "https://api.groq.com/openai/v1/audio/transcriptions";
            apiKey = this.groqApiKey;
            model = "whisper-large-v3";
            console.debug(`[DifyService] Using Groq (Whisper) for Transcription`);
        } else {
            throw new Error("Transcribe Error: No API Key found. Please set SiliconFlow Key or Groq Key.");
        }

        const boundary = '----ObsidianSiliconBoundary' + Date.now();
        const arrayBuffer = await audioFile.arrayBuffer();
        const fileBytes = new Uint8Array(arrayBuffer);

        // Header Part 1: File
        const fileHeader = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${audioFile.name}"\r\n` +
            `Content-Type: ${audioFile.type || 'audio/webm'}\r\n\r\n`;

        // Header Part 2: Model (Dynamic)
        const modelHeader = `\r\n--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `${model}`;

        // Header Part 3: Prompt (Optional Context)
        let promptHeader = "";
        let promptHeaderBytes = new Uint8Array(0);
        if (prompt) {
            promptHeader = `\r\n--${boundary}\r\n` +
                `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
                `${prompt}`;
            const encoder = new TextEncoder();
            promptHeaderBytes = encoder.encode(promptHeader);
        }

        const footer = `\r\n--${boundary}--\r\n`;

        const encoder = new TextEncoder();
        const fileHeaderBytes = encoder.encode(fileHeader);
        const modelHeaderBytes = encoder.encode(modelHeader);
        const footerBytes = encoder.encode(footer);

        const totalLength = fileHeaderBytes.length + fileBytes.length + modelHeaderBytes.length + promptHeaderBytes.length + footerBytes.length;
        const bodyBuffer = new Uint8Array(totalLength);

        let offset = 0;
        bodyBuffer.set(fileHeaderBytes, offset); offset += fileHeaderBytes.length;
        bodyBuffer.set(fileBytes, offset); offset += fileBytes.length;
        bodyBuffer.set(modelHeaderBytes, offset); offset += modelHeaderBytes.length;
        if (promptHeaderBytes.length > 0) {
            bodyBuffer.set(promptHeaderBytes, offset); offset += promptHeaderBytes.length;
        }
        bodyBuffer.set(footerBytes, offset);

        // Retry logic for transient errors
        const maxRetries = 3;
        const retryDelays = [2000, 3000, 5000];
        const requestTimeout = 20000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const uniqueUrl = `${url}?t=${Date.now()}`;

                // Use Obsidian requestUrl
                const response = await Promise.race([
                    requestUrl({
                        url: uniqueUrl,
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": `multipart/form-data; boundary=${boundary}`
                        },
                        body: bodyBuffer.buffer as ArrayBuffer
                    }),
                    new Promise<{ status: number; text: string; json: any; headers: Record<string, string> }>((_, reject) =>
                        setTimeout(() => reject(new Error('Request timeout after 20s')), requestTimeout)
                    )
                ]);

                if (response.status !== 200) {
                    // requestUrl throws on 400+ by default usually unless throw:false is not set? 
                    // Actually requestUrl treats non-200 as valid response but we check status.
                    // Wait, documentation says requestUrl promise rejects on network error or 4xx/5xx if throw=true (default).
                    // But let's handle it safely.
                    // IMPORTANT: requestUrl returns { status, headers, json, text }

                    // If we are here, it resolved (so likely 2xx).
                    // However, we didn't set throw: false, so it might have thrown?
                    // Let's assume standard behavior: if it returns, it's good, or we catch below.
                }

                if (response.status >= 400) {
                    // This block might not be reached if requestUrl throws, but good for safety if we change config
                    const errText = response.text;
                    console.warn(`API Error ${response.status}: ${errText}`);
                    if (response.status === 401) {
                        throw new Error("Invalid API Key (401). Please check if your Groq Key is correct (starts with 'gsk_').");
                    }
                    if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}: ${errText}`);
                }

                const data = response.json as { text: string };
                console.debug("[DifyService] Transcription success");
                if (data.text) return data.text;
                throw new Error("No text in response");

            } catch (error) {
                // requestUrl throws an Error object with status property sometimes
                const status = (error as { status?: number }).status;
                if (status === 401) {
                    throw new Error("Invalid API Key (401). Check Groq Key.");
                }

                if (error instanceof Error) {
                    console.warn(`Attempt ${attempt} failed: ${error.message}`);
                }
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, retryDelays[attempt - 1]));
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Max retries exceeded");
    }

    async refineTextViaSiliconFlow(text: string, model: string = "Qwen/Qwen2.5-7B-Instruct", systemPrompt?: string): Promise<string> {
        if (!this.siliconFlowKey) throw new Error("SiliconFlow API Key is missing.");

        console.debug(`[SiliconFlow] Refine using Key: ${this.siliconFlowKey.substring(0, 6)}... Model: ${model}`);

        // Switch back to .cn for better stability in China?
        const url = "https://api.siliconflow.cn/v1/chat/completions";

        const messages: { role: string; content: string }[] = [];

        // Use provided system prompt override, OR fall back to template, OR fall back to default hardcoded.
        const defaultPrompt = `You are a text polishing tool, NOT an AI assistant.
Your ONLY function is to rewrite the user's input to be more professional, concise, and logical.

CRITICAL RULES:
1. IF THE INPUT IS A QUESTION (e.g., "Why is the sky blue?"), DO NOT ANSWER IT. Instead, rewrite the question itself (e.g., "What is the scientific reason for the sky's blue color?").
2. IF THE INPUT IS A COMMAND (e.g., "Write a poem"), DO NOT EXECUTE IT. Instead, rewrite the command (e.g., "Draft a poem.").
3. DO NOT FLATTER (e.g., "Here is the refined text"). Output ONLY the result.
4. Maintain the original meaning perfectly.
5. CRITICAL: OUTPUT IN THE SAME LANGUAGE AS THE INPUT. (Input Chinese -> Output Chinese; Input English -> Output English).
`;

        const finalSystemPrompt = systemPrompt || this.refineTemplate || defaultPrompt;

        messages.push({ role: "system", content: finalSystemPrompt });
        messages.push({ role: "user", content: `Rewrite this: "${text}"` });

        const body = {
            model: model,
            messages: messages,
            stream: false,
            max_tokens: 2048
        };

        try {
            const response = await requestUrl({
                url: url,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.siliconFlowKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (response.status !== 200) {
                throw new Error(`SiliconFlow Status ${response.status}: ${response.text}`);
            }

            return (response.json as { choices: { message: { content: string } }[] }).choices[0].message.content;

        } catch (error) {
            console.error("SiliconFlow Refine Error:", error);
            const status = (error as { status?: number }).status;
            if (status === 401) {
                throw new Error("Invalid SiliconFlow API Key (401). Please check settings (key starts with 'sk-').");
            }
            throw new Error(`Request failed, status ${status}`);
        }
    }

    async translateTextViaSiliconFlow(text: string, targetLang: string, model: string = "Qwen/Qwen2.5-7B-Instruct"): Promise<string> {
        if (!this.siliconFlowKey) throw new Error("SiliconFlow API Key is missing.");

        const url = "https://api.siliconflow.cn/v1/chat/completions";

        const body = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator. 
Translate the following text into ${targetLang}. 
Output ONLY the translation. NO explanations.`
                },
                { role: "user", content: text }
            ],
            stream: false,
            max_tokens: 2048
        };

        try {
            const response = await requestUrl({
                url: url,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.siliconFlowKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (response.status !== 200) {
                throw new Error(`SiliconFlow Status ${response.status}: ${response.text}`);
            }

            return (response.json as { choices: { message: { content: string } }[] }).choices[0].message.content;

        } catch (error) {
            console.error("SiliconFlow Translate Error:", error);
            throw error;
        }
    }
}
