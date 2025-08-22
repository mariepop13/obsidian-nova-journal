import { Editor, MarkdownView, Plugin } from 'obsidian';

import type { PromptStyle } from './prompt/PromptRegistry';
import { DEFAULT_SETTINGS, NovaJournalSettings, normalizeSettings } from './settings/PluginSettings';
import { removeDateHeadingInEditor } from './services/editor/NoteEditor';
import { FrontmatterService } from './services/rendering/FrontmatterService';
import { EditorNotFoundError } from './services/shared/ErrorTypes';
import { ToastSpinnerService } from './services/editor/ToastSpinnerService';
import { type ServiceCollection, ServiceInitializer } from './services/ServiceInitializer';
import { type CommandCallbacks, CommandRegistry } from './commands/CommandRegistry';
import { NovaJournalSettingTab } from './ui/SettingsTab';
import { logger } from './services/shared/LoggingService';

interface EmbeddingServiceInterface {
  forceFullRebuild(folder: string): Promise<void>;
}

export default class NovaJournalPlugin extends Plugin {
  settings: NovaJournalSettings;
  private services: ServiceCollection;
  private serviceInitializer: ServiceInitializer;
  private commandRegistry: CommandRegistry;

  async onload(): Promise<void> {
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
      deepenLastLine: targetLine => this.deepenLastLine(targetLine),
      deepenWholeNote: label => this.deepenWholeNote(label),
      analyzeMood: () => this.analyzeMood(),
      rebuildEmbeddings: () => this.rebuildEmbeddings(),
      getDeepButtonLabel: () => this.settings.deepenButtonLabel,
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

  async loadSettings(): Promise<void> {
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
      if (!this.validateEmbeddingPrerequisites()) {
        return;
      }

      ToastSpinnerService.info('Nova Journal: Rebuilding embeddings index...');

      const embeddingService = await this.createEmbeddingService();
      if (!embeddingService) {
        return;
      }

      await (embeddingService as EmbeddingServiceInterface).forceFullRebuild(this.settings.dailyNoteFolder);
      ToastSpinnerService.notice('Nova Journal: Embeddings index rebuilt successfully.');
    } catch {
      logger.error('Failed to rebuild embeddings index', 'NovaJournalPlugin');
      ToastSpinnerService.error('Nova Journal: Failed to rebuild embeddings index.');
    }
  }

  private validateEmbeddingPrerequisites(): boolean {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
      ToastSpinnerService.error('Nova Journal: AI must be enabled to rebuild embeddings.');
      return false;
    }
    return true;
  }

  private async createEmbeddingService(): Promise<EmbeddingServiceInterface | null> {
    const mod = await import('./services/ai/EnhancedEmbeddingService');
    const enhancedEmbeddingService = mod.EnhancedEmbeddingService;
    
    if (!enhancedEmbeddingService) {
      logger.error('Embedding service module not found', 'NovaJournalPlugin');
      ToastSpinnerService.error('Nova Journal: Embedding service unavailable.');
      return null;
    }

    const embeddingService = new enhancedEmbeddingService(this.app, this.settings);
    if (typeof embeddingService.forceFullRebuild !== 'function') {
      logger.error('forceFullRebuild method not available on embedding service', 'NovaJournalPlugin');
      ToastSpinnerService.error('Nova Journal: Embedding service method missing.');
      return null;
    }

    return embeddingService;
  }

  private getActiveEditor(): Editor {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      throw new EditorNotFoundError();
    }
    return view.editor;
  }

  private handleError(error: unknown): void {
    logger.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'NovaJournalPlugin');

    if (error instanceof EditorNotFoundError) {
      ToastSpinnerService.error(error.message);
    } else {
      ToastSpinnerService.error('Nova Journal: An unexpected error occurred.');
    }
  }

  async saveSettings(): Promise<void> {
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
      logger.error(`Failed to insert today's prompt: ${error instanceof Error ? error.message : 'Unknown error'}`, 'NovaJournalPlugin');
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
      
      await this.processMoodAnalysis(editor, noteText);
      ToastSpinnerService.notice('Mood properties updated.');
    } catch (error) {
      logger.error(`Mood analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'NovaJournalPlugin');
      ToastSpinnerService.error('Failed to analyze mood data.');
    }
  }

  private async processMoodAnalysis(editor: Editor, noteText: string): Promise<void> {
    const analysis = await this.services.moodAnalysisService.analyzeCurrentNoteContent(noteText);
    if (!analysis) return;

    const { validateAndParseJSON } = await import('./utils/Sanitizer');
    const props = validateAndParseJSON<Record<string, unknown>>(analysis, {}) ?? {};
    const cleaned = FrontmatterService.normalizeMoodProps(props, this.settings.userName);
    FrontmatterService.upsertFrontmatter(editor, cleaned);
  }
}
