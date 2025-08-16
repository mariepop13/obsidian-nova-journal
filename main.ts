import { Editor, MarkdownView, Plugin } from 'obsidian';

import type { PromptStyle } from './prompt/PromptRegistry';
import { DEFAULT_SETTINGS, NovaJournalSettings, normalizeSettings } from './settings/PluginSettings';
import { removeDateHeadingInEditor } from './services/editor/NoteEditor';
import { FrontmatterService } from './services/rendering/FrontmatterService';
import { EditorNotFoundError } from './services/shared/ErrorTypes';
import { ToastSpinnerService } from './services/editor/ToastSpinnerService';
import { ServiceInitializer, type ServiceCollection } from './services/ServiceInitializer';
import { CommandRegistry, type CommandCallbacks } from './commands/CommandRegistry';
import { NovaJournalSettingTab } from './ui/SettingsTab';

export default class NovaJournalPlugin extends Plugin {
    settings: NovaJournalSettings;
    private services: ServiceCollection;
    private serviceInitializer: ServiceInitializer;
    private commandRegistry: CommandRegistry;

	async onload() {
		await this.loadSettings();
        this.initializeServices();
        this.registerCommands();
        this.registerSettingsTab();
        void this.startEmbeddingMigration();
	}

    private initializeServices(): void {
        this.serviceInitializer = new ServiceInitializer(this.app, this.settings);
        this.services = this.serviceInitializer.initializeServices();
    }

    private registerCommands(): void {
        const callbacks: CommandCallbacks = {
            insertTodaysPrompt: () => this.insertTodaysPrompt(),
            insertPromptInActiveEditor: () => this.insertPromptInActiveEditor(),
            cyclePromptStyle: () => this.cyclePromptStyle(),
            deepenLastLine: (targetLine) => this.deepenLastLine(targetLine),
            deepenWholeNote: (label) => this.deepenWholeNote(label),
            analyzeMood: () => this.analyzeMood(),
            rebuildEmbeddings: () => this.rebuildEmbeddings(),
            getDeepButtonLabel: () => this.settings.deepenButtonLabel
        };

        this.commandRegistry = new CommandRegistry(this, callbacks);
        this.commandRegistry.registerAllCommands();
    }

    private registerSettingsTab(): void {
        this.addSettingTab(new NovaJournalSettingTab(this.app, this));
    }

    private async startEmbeddingMigration(): Promise<void> {
        await this.serviceInitializer.initializeEmbeddingMigration();
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
            await this.services.conversationService.deepenLine(editor, targetLine);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async deepenWholeNote(label: string): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            await this.services.conversationService.deepenWholeNote(editor, label);
        } catch (error) {
            this.handleError(error);
        }
    }

    private async rebuildEmbeddings(): Promise<void> {
        try {
            if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
                ToastSpinnerService.error('Nova Journal: AI must be enabled to rebuild embeddings.');
                return;
            }

            ToastSpinnerService.info('Nova Journal: Rebuilding embeddings index...');
            
            const { EnhancedEmbeddingService } = await import('./services/ai/EnhancedEmbeddingService');
            const embeddingService = new EnhancedEmbeddingService(this.app, this.settings);
            
            await embeddingService.forceFullRebuild(this.settings.dailyNoteFolder);
            
            ToastSpinnerService.notice('Nova Journal: Embeddings index rebuilt successfully.');
        } catch (error) {
            console.error('[Nova Journal] Failed to rebuild embeddings:', error);
            ToastSpinnerService.error('Nova Journal: Failed to rebuild embeddings index.');
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
            ToastSpinnerService.error(error.message);
        } else {
            ToastSpinnerService.error('Nova Journal: An unexpected error occurred.');
        }
    }

	async saveSettings() {
		await this.saveData(this.settings);
        this.services = this.serviceInitializer.recreateServicesAfterSettingsChange(this.services);
	}

    private async insertTodaysPrompt(): Promise<void> {
        try {
            const todayFile = await this.services.fileService.ensureTodayNote(
                this.settings.dailyNoteFolder,
                this.settings.dailyNoteFormat,
                this.settings.organizeByYearMonth
            );
            
            await this.services.fileService.openFileIfNotActive(todayFile);
            await this.services.fileService.removeDateHeadingFromFile(todayFile);

            const editor = this.getActiveEditor();
            removeDateHeadingInEditor(editor);
            
            const success = await this.services.promptInsertionService.insertTodaysPrompt(editor);
            if (!success) {
                ToastSpinnerService.error('Nova Journal: prompt insertion was unsuccessful.');
            }
        } catch (error) {
            console.error('Nova Journal insert error', error);
            ToastSpinnerService.error('Nova Journal: failed to insert prompt. See console for details.');
        }
    }

    private async insertPromptInActiveEditor(): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            await this.services.promptInsertionService.insertPromptAtLocation(editor);
        } catch (error) {
            this.handleError(error);
        }
    }

    private cyclePromptStyle(): void {
        const order: PromptStyle[] = ['reflective', 'gratitude', 'planning', 'dreams'];
        const idx = order.indexOf(this.settings.promptStyle as PromptStyle);
        const safeIdx = idx >= 0 ? idx : 0;
        const next = order[(safeIdx + 1) % order.length];
        this.settings.promptStyle = next as PromptStyle;
        void this.saveSettings();
        ToastSpinnerService.info(`Nova Journal: style set to ${next}`);
    }

    private async analyzeMood(): Promise<void> {
        try {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) {
                ToastSpinnerService.error('Nova Journal: open a note to analyze mood.');
                return;
            }

            ToastSpinnerService.info('Analyzing mood...');
            const editor = view.editor;
            const noteText = editor.getValue();
            const analysis = await this.services.moodAnalysisService.analyzeCurrentNoteContent(noteText);
            if (!analysis) return;

            let props: Record<string, any> = {};
            try { props = JSON.parse(analysis); } catch {}
            const cleaned = FrontmatterService.normalizeMoodProps(props, this.settings.userName);
            FrontmatterService.upsertFrontmatter(editor, cleaned);
            ToastSpinnerService.notice('Mood properties updated.');
        } catch (error) {
            console.error('Mood analysis error:', error);
            ToastSpinnerService.error('Failed to analyze mood data.');
        }
    }



}
