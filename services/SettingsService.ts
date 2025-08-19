import { App, TFile, requestUrl } from 'obsidian';
import type NovaJournalPlugin from '../main';
import {
  type NovaJournalSettings,
  type SettingsExportData,
  type SettingsImportResult,
  type SettingsExportOptions,
  normalizeSettings,
  DEFAULT_SETTINGS,
} from '../settings/PluginSettings';
import { ToastSpinnerService } from './editor/ToastSpinnerService';

export class SettingsService {
  constructor(
    private app: App,
    private plugin: NovaJournalPlugin,
  ) {}

  async exportSettings(options: SettingsExportOptions = {}): Promise<SettingsExportData> {
    const {
      includeApiKey = false,
      includeMetadata = true,
      format = 'json',
    } = options;

    const settings = { ...this.plugin.settings };
    
    if (!includeApiKey) {
      settings.aiApiKey = '';
    }

    const exportData: SettingsExportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings,
    };

    if (includeMetadata) {
      exportData.metadata = {
        exportedBy: 'Nova Journal Plugin',
        obsidianVersion: 'Desktop',
        pluginVersion: this.plugin.manifest.version,
      };
    }

    return exportData;
  }

  async importSettings(data: SettingsExportData): Promise<SettingsImportResult> {
    const result = this.validateImportData(data);
    
    if (!result.success) {
      return result;
    }

    try {
      const normalizedSettings = normalizeSettings(data.settings);
      const warnings: string[] = [];

      if (data.settings.aiApiKey && !normalizedSettings.aiApiKey) {
        warnings.push('API key was excluded from import for security');
      }

      if (JSON.stringify(data.settings) !== JSON.stringify(normalizedSettings)) {
        warnings.push('Some settings were normalized during import');
      }

      return {
        success: true,
        settings: normalizedSettings,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to process settings: ${error.message}`],
      };
    }
  }

  async saveSettingsToFile(filename?: string): Promise<void> {
    const exportData = await this.exportSettings({ includeApiKey: false });
    const content = JSON.stringify(exportData, null, 2);
    
    const defaultFilename = `nova-journal-settings-${new Date().toISOString().split('T')[0]}.json`;
    const actualFilename = filename || defaultFilename;

    try {
      const file = await this.app.vault.create(actualFilename, content);
      ToastSpinnerService.notice(`Settings exported to ${file.path}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        const file = await this.app.vault.modify(
          this.app.vault.getAbstractFileByPath(actualFilename) as TFile,
          content,
        );
        ToastSpinnerService.notice(`Settings updated in ${actualFilename}`);
      } else {
        throw error;
      }
    }
  }

  async loadSettingsFromFile(): Promise<SettingsImportResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({
            success: false,
            errors: ['No file selected'],
          });
          return;
        }

        try {
          const content = await file.text();
          const data = JSON.parse(content);
          const result = await this.importSettings(data);
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            errors: [`Failed to read file: ${error.message}`],
          });
        }
      };

      input.click();
    });
  }

  async applyImportedSettings(settings: NovaJournalSettings): Promise<void> {
    this.plugin.settings = settings;
    await this.plugin.saveSettings();
    ToastSpinnerService.notice('Settings imported successfully');
  }

  async resetToDefaults(): Promise<void> {
    this.plugin.settings = { ...DEFAULT_SETTINGS };
    await this.plugin.saveSettings();
    ToastSpinnerService.notice('Settings reset to defaults');
  }

  private validateImportData(data: any): SettingsImportResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { success: false, errors };
    }

    if (!data.version) {
      errors.push('Missing version information');
    }

    if (!data.settings || typeof data.settings !== 'object') {
      errors.push('Missing or invalid settings data');
      return { success: false, errors };
    }

    const requiredFields = ['promptStyle', 'insertLocation', 'dailyNoteFolder'];
    for (const field of requiredFields) {
      if (!(field in data.settings)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }
}