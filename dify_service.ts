import { requestUrl, RequestUrlParam } from 'obsidian';

export class DifyService {
    baseUrl: string;
    journalKey: string;
    siliconFlowKey: string;
    inputVar: string;
    refineTemplate: string;

    constructor(baseUrl: string, journalKey: string, siliconFlowKey: string, inputVar: string = 'journal_text', refineTemplate: string = "") {
        this.baseUrl = baseUrl.replace(/\/$/, '').trim();
        this.journalKey = journalKey.trim();
        this.siliconFlowKey = siliconFlowKey.trim();
        this.inputVar = inputVar.trim();
        this.refineTemplate = refineTemplate;
    }

    updateConfig(baseUrl: string, journalKey: string, siliconFlowKey: string, inputVar: string, refineTemplate: string) {
        this.baseUrl = baseUrl.replace(/\/$/, '').trim();
        this.journalKey = journalKey.trim();
        this.siliconFlowKey = siliconFlowKey.trim();
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

        const inputs: any = {};
        inputs[this.inputVar] = text;

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
                    const errorBody = await response.json;
                    errorMsg += `: ${JSON.stringify(errorBody)}`;
                } catch (e) {
                    errorMsg += ` (Body: ${response.text})`;
                }
                throw new Error(errorMsg);
            }

            return response.json.data.outputs.result;

        } catch (error) {
            console.error("Dify Service Error:", error);
            throw error;
        }
    }

    async transcribeAudio(audioFile: File, prompt?: string): Promise<string> {
        if (!this.siliconFlowKey) throw new Error("SiliconFlow API Key is missing.");

        // Docs: https://docs.siliconflow.cn/api-reference/audio-transcriptions
        const url = "https://api.siliconflow.cn/v1/audio/transcriptions";

        const boundary = '----ObsidianSiliconBoundary' + Date.now();
        const arrayBuffer = await audioFile.arrayBuffer();
        const fileBytes = new Uint8Array(arrayBuffer);

        // Header Part 1: File
        const fileHeader = `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${audioFile.name}"\r\n` +
            `Content-Type: ${audioFile.type || 'audio/webm'}\r\n\r\n`;

        // Header Part 2: Model (CORRECTED FIX)
        const modelHeader = `\r\n--${boundary}\r\n` +
            `Content-Disposition: form-data; name="model"\r\n\r\n` +
            `FunAudioLLM/SenseVoiceSmall`;

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

        try {
            const response = await requestUrl({
                url: url,
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.siliconFlowKey}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                },
                body: bodyBuffer.buffer as ArrayBuffer
            });

            if (response.status !== 200) {
                console.error("SiliconFlow Error:", response.text);
                throw new Error(response.text);
            }

            return response.json.text;

        } catch (error) {
            console.error("Transcription Failed:", error);
            throw error;
        }
    }

    async refineTextViaSiliconFlow(text: string, model: string = "Qwen/Qwen2.5-7B-Instruct", systemPrompt?: string): Promise<string> {
        // ... (existing code) ...
        if (!this.siliconFlowKey) throw new Error("SiliconFlow API Key is missing.");

        const url = "https://api.siliconflow.cn/v1/chat/completions";

        const messages: any[] = [];

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

            return response.json.choices[0].message.content;

        } catch (error) {
            console.error("SiliconFlow Refine Error:", error);
            throw error;
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

            return response.json.choices[0].message.content;

        } catch (error) {
            console.error("SiliconFlow Translate Error:", error);
            throw error;
        }
    }
}
