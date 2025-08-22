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
import { FILE_LIMITS, TIMING_CONFIG } from './shared/Constants';

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
      settings.aiApiKey = this.plugin.settings.aiApiKey ?? '';
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
      
      this.exportSettings({ includeApiKey }).then(data => {
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
        }, TIMING_CONFIG.FILE_OPERATION_DELAY);
      }).catch(reject);
    });
  }

  async loadSettingsFromFile(): Promise<SettingsImportResult> {
    return new Promise((resolve) => {
      const input = this.createFileInput();
      input.onchange = async (e): Promise<void> => {
        const result = await this.handleFileSelection(e);
        resolve(result);
      };
      input.click();
    });
  }

  private createFileInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    return input;
  }

  private async handleFileSelection(e: Event): Promise<SettingsImportResult> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return {
        success: false,
        errors: ['No file selected'],
      };
    }

    try {
      const content = await file.text();
      
      if (content.length > FILE_LIMITS.MAX_FILE_SIZE_BYTES) {
        return {
          success: false,
          errors: ['File too large. Maximum size is 1MB.'],
        };
      }

      return await this.parseFileContent(content);
    } catch (error) {
      console.error('Settings import failed:', error);
      return {
        success: false,
        errors: ['Failed to read file. Please try again.'],
      };
    }
  }

  private async parseFileContent(content: string): Promise<SettingsImportResult> {
    try {
      const data = JSON.parse(content);
      const validation = this.validateImportData(data);
      
      if (!validation.success) {
        return validation;
      }

      const dataObj = data as Record<string, unknown>;
      const settingsObj = dataObj.settings as NovaJournalSettings;
      
      this.plugin.settings = {
        ...this.plugin.settings,
        ...settingsObj,
      };
      await this.plugin.saveSettings();

      return { success: true };
    } catch {
      return {
        success: false,
        errors: ['Invalid JSON format. Please check your file.'],
      };
    }
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

  private validateImportData(data: unknown): SettingsImportResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format');
      return { success: false, errors };
    }

    const dataObj = data as Record<string, unknown>;

    if (!dataObj.version) {
      errors.push('Missing version information');
    }

    if (!dataObj.settings || typeof dataObj.settings !== 'object') {
      errors.push('Missing or invalid settings data');
      return { success: false, errors };
    }

    const settingsObj = dataObj.settings as Record<string, unknown>;
    const requiredFields = ['promptStyle', 'insertLocation', 'dailyNoteFolder'];
    for (const field of requiredFields) {
      if (!(field in settingsObj)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }
}