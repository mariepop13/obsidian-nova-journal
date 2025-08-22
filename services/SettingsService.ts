import { App } from 'obsidian';
import type NovaJournalPlugin from '../main';
import {
  DEFAULT_SETTINGS,
  type NovaJournalSettings,
  type SettingsExportData,
  type SettingsExportOptions,
  type SettingsImportResult,
  normalizeSettings,
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
    } = options;

    const settings = { ...this.plugin.settings };
    
    if (!includeApiKey) {
      settings.aiApiKey = '';
    } else {
      settings.aiApiKey = this.plugin.settings.aiApiKey || '';
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



  async saveSettingsWithFilePicker(includeApiKey = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      // @ts-ignore - webkitdirectory for folder selection
      input.webkitdirectory = false;
      // Use save dialog instead of open
      const a = document.createElement('a');
      
      const exportData = this.exportSettings({ includeApiKey }).then(data => {
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const defaultFilename = `nova-journal-settings-${yyyy}-${mm}-${dd}_${HH}-${min}.json`;
        
        a.href = url;
        a.download = defaultFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          ToastSpinnerService.notice(`Settings exported to ${defaultFilename}`);
          resolve();
        }, 100);
      }).catch(reject);
    });
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
          
          if (content.length > 1024 * 1024) {
            resolve({
              success: false,
              errors: ['File too large. Maximum size is 1MB.'],
            });
            return;
          }
          
          let data;
          try {
            data = JSON.parse(content);
          } catch (parseError) {
            resolve({
              success: false,
              errors: ['Invalid JSON format. Please check your file.'],
            });
            return;
          }
          
          const result = await this.importSettings(data);
          resolve(result);
        } catch (error) {
          console.error('Settings import failed:', error);
          resolve({
            success: false,
            errors: ['Failed to read file. Please try again.'],
          });
        }
      };

      input.click();
    });
  }

  async applyImportedSettings(settings: NovaJournalSettings): Promise<void> {
    console.log('Settings import: Applying imported settings');
    this.plugin.settings = settings;
    await this.plugin.saveSettings();
    ToastSpinnerService.notice('Settings imported successfully');
  }

  async resetToDefaults(): Promise<void> {
    console.log('Settings reset: Resetting all settings to defaults');
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