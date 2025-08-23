import { App } from 'obsidian';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import { EnhancedEmbeddingService } from './EnhancedEmbeddingService';

export class EmbeddingMigrationService {
  constructor(
    private readonly app: App,
    private readonly settings: NovaJournalSettings
  ) {}

  async migrateToEnhancedSystem(): Promise<boolean> {
    try {
      const enhancedService = new EnhancedEmbeddingService(this.app, this.settings);

      await this.backupLegacyIndex();

      const folder = this.settings.dailyNoteFolder ?? 'Journal';
      await enhancedService.incrementalUpdateIndex(folder);


      return true;
    } catch (_error) {
      return false;
    }
  }

  async checkMigrationNeeded(): Promise<boolean> {
    try {
      const legacyIndexKey = `nova-journal-index-${this.app.vault.getName()}`;
      const enhancedIndexKey = `nova-journal-enhanced-index-${this.app.vault.getName()}`;

      const hasLegacyIndex = localStorage.getItem(legacyIndexKey) !== null;
      const hasEnhancedIndex = localStorage.getItem(enhancedIndexKey) !== null;

      return hasLegacyIndex && !hasEnhancedIndex;
    } catch {
      return false;
    }
  }

  private async backupLegacyIndex(): Promise<void> {
    try {
      const legacyIndexKey = `nova-journal-index-${this.app.vault.getName()}`;
      const backupKey = `nova-journal-index-backup-${this.app.vault.getName()}`;

      const legacyData = localStorage.getItem(legacyIndexKey);
      if (legacyData) {
        try {
          localStorage.setItem(backupKey, legacyData);
        } catch (storageError) {
          throw storageError;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async cleanupLegacyIndex(): Promise<void> {
    try {
      const legacyIndexKey = `nova-journal-index-${this.app.vault.getName()}`;
      localStorage.removeItem(legacyIndexKey);

    } catch (_error) {
    }
  }
}
