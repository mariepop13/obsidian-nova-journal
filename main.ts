import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { PromptService } from './prompt/PromptService';
import type { PromptStyle } from './prompt/PromptRegistry';
import { DEFAULT_SETTINGS, NovaJournalSettings, normalizeSettings } from './settings/PluginSettings';
import { removeDateHeadingInEditor } from './services/NoteEditor';
import { ConversationService } from './services/ConversationService';
import { FileService } from './services/FileService';
import { PromptInsertionService } from './services/PromptInsertionService';
import { EditorNotFoundError } from './services/ErrorTypes';
import { NovaJournalSettingTab } from './ui/SettingsTab';
import { registerDeepenHandlers } from './ui/DeepenHandlers';

export default class NovaJournalPlugin extends Plugin {
    settings: NovaJournalSettings;
    private promptService: PromptService;
    private conversationService: ConversationService;
    private fileService: FileService;
    private promptInsertionService: PromptInsertionService;

	async onload() {
		await this.loadSettings();
        this.promptService = new PromptService();
        this.conversationService = new ConversationService(this.settings);
        this.fileService = new FileService(this.app);
        this.promptInsertionService = new PromptInsertionService(this.promptService, this.settings);
        this.addRibbonIcon('sparkles', 'Nova Journal: Insert today\'s prompt', async () => {
            await this.insertTodaysPrompt();
        });
        this.addRibbonIcon('gear', 'Nova Journal: Settings', async () => {
            const settings = (this.app as any).setting;
            if (settings?.open) settings.open();
            if (settings?.openTabById) settings.openTabById(this.manifest.id);
        });
        this.addCommand({
            id: 'nova-insert-todays-prompt',
            name: 'Nova Journal: Insert today\'s prompt',
            callback: async () => {
                await this.insertTodaysPrompt();
            },
        });
        this.addCommand({
            id: 'nova-open-settings',
            name: 'Nova Journal: Open settings',
            callback: async () => {
                const settings = (this.app as any).setting;
                if (settings?.open) settings.open();
                if (settings?.openTabById) settings.openTabById(this.manifest.id);
            },
        });
		this.addCommand({
            id: 'nova-insert-prompt-here',
            name: 'Nova Journal: Insert prompt here',
            callback: async () => {
                await this.insertPromptInActiveEditor();
            },
        });
		this.addCommand({
            id: 'nova-cycle-prompt-style',
            name: 'Nova Journal: Cycle prompt style',
            callback: async () => {
                this.cyclePromptStyle();
            },
        });
		this.addCommand({
            id: 'nova-deepen-last-line',
            name: 'Nova Journal: Deepen last line (AI)',
            callback: async () => {
                await this.deepenLastLine();
            },
        });
        this.addSettingTab(new NovaJournalSettingTab(this.app, this));

        registerDeepenHandlers(this, () => this.settings.deepenButtonLabel, (line) => this.deepenLastLine(line), (label) => this.deepenWholeNote(label));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        const normalized = normalizeSettings(this.settings);
        if (JSON.stringify(normalized) !== JSON.stringify(this.settings)) {
            this.settings = normalized;
            await this.saveSettings();
        }
    }

    private async deepenLastLine(targetLine?: number): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            await this.conversationService.deepenLine(editor, targetLine);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async deepenWholeNote(label: string): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            await this.conversationService.deepenWholeNote(editor, label);
        } catch (error) {
            this.handleError(error);
        }
    }

    private getActiveEditor(): Editor {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            throw new EditorNotFoundError();
        }
        return view.editor;
    }

    private handleError(error: unknown): void {
        console.error(error);
        
        if (error instanceof EditorNotFoundError) {
            new Notice(error.message);
        } else {
            new Notice('Nova Journal: An unexpected error occurred.');
        }
    }

	async saveSettings() {
		await this.saveData(this.settings);
        this.conversationService = new ConversationService(this.settings);
        this.promptInsertionService = new PromptInsertionService(this.promptService, this.settings);
	}

    private async insertTodaysPrompt(): Promise<void> {
        try {
            const todayFile = await this.fileService.ensureTodayNote(
                this.settings.dailyNoteFolder,
                this.settings.dailyNoteFormat,
                this.settings.organizeByYearMonth
            );
            
            await this.fileService.openFileIfNotActive(todayFile);
            await this.fileService.removeDateHeadingFromFile(todayFile);

            const editor = this.getActiveEditor();
            removeDateHeadingInEditor(editor);
            
            const date = new Date();
            const basePrompt = this.promptService.getPromptForDate(this.settings.promptStyle as PromptStyle, date);

            const wasInserted = await this.promptInsertionService.insertTodaysPromptWithDuplicateCheck(
                editor,
                basePrompt,
                date
            );
            
            if (wasInserted) {
                new Notice('Nova Journal: prompt inserted.');
            }
        } catch (error) {
            console.error('Nova Journal insert error', error);
            new Notice('Nova Journal: failed to insert prompt. See console for details.');
        }
    }



    private async insertPromptInActiveEditor(): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            await this.promptInsertionService.insertPromptAtLocation(editor);
        } catch (error) {
            this.handleError(error);
        }
    }

    private cyclePromptStyle(): void {
        const order: PromptStyle[] = ['reflective', 'gratitude', 'planning'];
        const idx = order.indexOf(this.settings.promptStyle as PromptStyle);
        const safeIdx = idx >= 0 ? idx : 0;
        const next = order[(safeIdx + 1) % order.length];
        this.settings.promptStyle = next as PromptStyle;
        void this.saveSettings();
        new Notice(`Nova Journal: style set to ${next}`);
    }




}
