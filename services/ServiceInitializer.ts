import { App } from 'obsidian';
import { PromptService } from '../prompt/PromptService';
import { ConversationService } from './ai/ConversationService';
import { FileService } from './utils/FileService';
import { PromptInsertionService } from './editor/PromptInsertionService';
import { MoodAnalysisService } from './ai/MoodAnalysisService';
import { EnhancedEmbeddingService } from './ai/EnhancedEmbeddingService';
import { EmbeddingMigrationService } from './ai/EmbeddingMigrationService';
import { RagContextService } from './ai/RagContextService';
import type { NovaJournalSettings } from '../settings/PluginSettings';

export interface ServiceCollection {
  promptService: PromptService;
  conversationService: ConversationService;
  fileService: FileService;
  promptInsertionService: PromptInsertionService;
  moodAnalysisService: MoodAnalysisService;
  ragContextService: RagContextService;
}

export class ServiceInitializer {
  constructor(
    private app: App,
    private settings: NovaJournalSettings
  ) {}

  initializeServices(): ServiceCollection {
    const promptService = new PromptService(this.settings);
    const conversationService = new ConversationService(this.settings);
    const fileService = new FileService(this.app);
    const ragContextService = new RagContextService(this.settings, this.app);
    const promptInsertionService = new PromptInsertionService(promptService, this.settings, ragContextService);
    const moodAnalysisService = new MoodAnalysisService(this.settings, this.app);

    return {
      promptService,
      conversationService,
      fileService,
      promptInsertionService,
      moodAnalysisService,
      ragContextService,
    };
  }

  async initializeEmbeddingMigration(): Promise<void> {
    const migration = new EmbeddingMigrationService(this.app, this.settings);
    const enhancedEmb = new EnhancedEmbeddingService(this.app, this.settings);

    setTimeout(async () => {
      try {
        const needsMigration = await migration.checkMigrationNeeded();
        if (needsMigration) {
          console.log('[NovaJournal] Migrating to enhanced embedding system...');
          const success = await migration.migrateToEnhancedSystem();
          if (success) {
            await migration.cleanupLegacyIndex();
          }
        } else {
          await enhancedEmb.incrementalUpdateIndex(this.settings.dailyNoteFolder);
        }
      } catch (error) {
        console.error('[NovaJournal] Embedding migration failed:', error);
      }
    }, 3000);
  }

  recreateServicesAfterSettingsChange(services: ServiceCollection): ServiceCollection {
    const ragContextService = new RagContextService(this.settings, this.app);
    return {
      ...services,
      conversationService: new ConversationService(this.settings),
      promptInsertionService: new PromptInsertionService(services.promptService, this.settings, ragContextService),
      moodAnalysisService: new MoodAnalysisService(this.settings, this.app),
      ragContextService,
    };
  }
}
