import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { DifyService } from './dify_service';
import { HomeNetView, VIEW_TYPE_HOMENET } from './view';

interface HomeNetSyncSettings {
    difyBaseUrl: string;
    journalAppKey: string;
    siliconFlowKey: string;
    groqApiKey: string; // New separate key for Transcription
    difyInputVar: string;
    refineProvider: 'dify' | 'siliconflow';
    refineModel: string;
    refineTemplate: string;
    targetLanguage: string;
    saveAudioFiles: boolean;
}

const DEFAULT_SETTINGS: HomeNetSyncSettings = {
    difyBaseUrl: 'http://192.168.31.254:5001/v1',
    journalAppKey: '',
    siliconFlowKey: '',
    groqApiKey: '',
    difyInputVar: 'journal_text',
    refineProvider: 'siliconflow',
    refineModel: 'Qwen/Qwen2.5-7B-Instruct',
    refineTemplate: '',
    targetLanguage: 'Simplified Chinese',
    saveAudioFiles: false
}

export default class HomeNetSync extends Plugin {
    settings: HomeNetSyncSettings;
    difyService: DifyService;

    async onload() {
        await this.loadSettings();


        this.difyService = new DifyService(
            this.settings.difyBaseUrl,
            this.settings.journalAppKey,
            this.settings.siliconFlowKey,
            this.settings.groqApiKey, // Pass new key
            this.settings.difyInputVar,
            this.settings.refineTemplate
        );

        // Register View
        this.registerView(
            VIEW_TYPE_HOMENET,
            (leaf) => new HomeNetView(leaf, this.difyService)
        );

        // Ribbon Icon -> Open Sidebar
        this.addRibbonIcon('audio-waveform', 'Open HomeNet Copilot', () => {
            this.activateView();
        });

        // Command -> Open Sidebar
        this.addCommand({
            id: 'homenet-open-sidebar',
            name: 'Open HomeNet Copilot (Sidebar)',
            callback: () => {
                this.activateView();
            }
        });

        this.addSettingTab(new HomeNetSyncSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HOMENET);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_HOMENET, active: true });
        }

        // "Reveal" the leaf in case it is currently collapsed
        workspace.revealLeaf(leaf);
    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.difyService.updateConfig(
            this.settings.difyBaseUrl,
            this.settings.journalAppKey,
            this.settings.siliconFlowKey,
            this.settings.groqApiKey, // Pass new key
            this.settings.difyInputVar,
            this.settings.refineTemplate
        );
    }
}

class HomeNetSyncSettingTab extends PluginSettingTab {
    plugin: HomeNetSync;
    constructor(app: App, plugin: HomeNetSync) { super(app, plugin); this.plugin = plugin; }
    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'HomeNet Sync Settings' });

        new Setting(containerEl).setName('API keys').setHeading();

        new Setting(containerEl)
            .setName('Groq API Key (Transcription)')
            .setDesc('Required for fast speech-to-text (starts with gsk_).')
            .addText(text => text
                .setPlaceholder('gsk_...')
                .setValue(this.plugin.settings.groqApiKey)
                .onChange(async (v) => { this.plugin.settings.groqApiKey = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('SiliconFlow API Key (Refinement)')
            .setDesc('Required for Qwen/DeepSeek text refinement (starts with sk-).')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.siliconFlowKey)
                .onChange(async (v) => { this.plugin.settings.siliconFlowKey = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('Dify Journal App Key')
            .setDesc('Optional: For Dify Workflow mode.')
            .addText(text => text.setValue(this.plugin.settings.journalAppKey)
                .onChange(async (v) => { this.plugin.settings.journalAppKey = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl).setName('Advanced config').setHeading();

        new Setting(containerEl)
            .setName('Dify API URL')
            .setDesc('Base URL for Dify (e.g. http://192.168.x.x:5001/v1)')
            .addText(text => text.setValue(this.plugin.settings.difyBaseUrl)
                .onChange(async (v) => { this.plugin.settings.difyBaseUrl = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('Workflow Input Variable')
            .setDesc('For Dify Mode: The variable name in "Start" node.')
            .addText(text => text.setValue(this.plugin.settings.difyInputVar)
                .onChange(async (v) => { this.plugin.settings.difyInputVar = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('Save Audio Files')
            .setDesc('Save recorded .webm files to your Vault root (or dedicated folder).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.saveAudioFiles)
                .onChange(async (v) => { this.plugin.settings.saveAudioFiles = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl).setName('Refine strategy').setHeading();

        new Setting(containerEl)
            .setName('Refine Provider')
            .setDesc('Choose between Dify Workflow (Agent) or Direct LLM (Faster).')
            .addDropdown(drop => drop
                .addOption('dify', 'Dify Workflow')
                .addOption('siliconflow', 'SiliconFlow (Direct LLM)')
                .setValue(this.plugin.settings.refineProvider)
                .onChange(async (v) => {
                    this.plugin.settings.refineProvider = v as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Direct Model Name')
            .setDesc('For SiliconFlow Mode: e.g., Qwen/Qwen2.5-7B-Instruct or deepseek-ai/DeepSeek-V2.5')
            .addText(text => text.setValue(this.plugin.settings.refineModel)
                .onChange(async (v) => { this.plugin.settings.refineModel = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('Refinement Template')
            .setDesc('Custom system prompt for the refinement agent. Leave empty for default.')
            .addTextArea(text => text
                .setPlaceholder('你是一个专业的润色助手... (严禁回答问题)')
                .setValue(this.plugin.settings.refineTemplate)
                .onChange(async (v) => { this.plugin.settings.refineTemplate = v; await this.plugin.saveSettings(); }));

        new Setting(containerEl)
            .setName('Translation Target Language')
            .setDesc('Language to translate to when using the Translate button.')
            .addText(text => text.setValue(this.plugin.settings.targetLanguage)
                .onChange(async (v) => { this.plugin.settings.targetLanguage = v; await this.plugin.saveSettings(); }));
    }
}
