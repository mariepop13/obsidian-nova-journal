import { App } from "obsidian";
import type { NovaJournalSettings } from "../../settings/PluginSettings";
import { EmbeddingService } from "./EmbeddingService";
import { EnhancedEmbeddingService } from "./EnhancedEmbeddingService";

export class EmbeddingMigrationService {
  constructor(
    private readonly app: App,
    private readonly settings: NovaJournalSettings
  ) {}

  async migrateToEnhancedSystem(): Promise<boolean> {
    try {
      console.log('[EmbeddingMigrationService] Starting migration to enhanced system');

      const legacyService = new EmbeddingService(this.app, this.settings);
      const enhancedService = new EnhancedEmbeddingService(this.app, this.settings);

      await this.backupLegacyIndex();

      const folder = this.settings.dailyNoteFolder || 'Journal';
      await enhancedService.incrementalUpdateIndex(folder);

      console.log('[EmbeddingMigrationService] Migration completed successfully');
      return true;
    } catch (error) {
      console.error('[EmbeddingMigrationService] Migration failed', error);
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
      const backupKey = `nova-journal-index-backup-${this.app.vault.getName()}-${Date.now()}`;
      
      const legacyData = localStorage.getItem(legacyIndexKey);
      if (legacyData) {
        localStorage.setItem(backupKey, legacyData);
        console.log('[EmbeddingMigrationService] Legacy index backed up');
      }
    } catch (error) {
      console.error('[EmbeddingMigrationService] Failed to backup legacy index', error);
      throw error; // Propagate the error to fail the migration
    }
  }

  async cleanupLegacyIndex(): Promise<void> {
    try {
      const legacyIndexKey = `nova-journal-index-${this.app.vault.getName()}`;
      localStorage.removeItem(legacyIndexKey);
      console.log('[EmbeddingMigrationService] Legacy index cleaned up');
    } catch (error) {
      console.error('[EmbeddingMigrationService] Failed to cleanup legacy index', error);
    }
  }
}
