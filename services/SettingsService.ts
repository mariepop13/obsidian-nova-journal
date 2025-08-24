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
import { logger } from './shared/LoggingService';

export class SettingsService {
  constructor(
    private app: App,
    private plugin: NovaJournalPlugin,
  ) {}

  private createExportMetadata(): { exportedBy: string; obsidianVersion: string; pluginVersion: string } {
    return {
      exportedBy: 'Nova Journal Plugin',
      obsidianVersion: 'Desktop',
      pluginVersion: this.plugin.manifest.version,
    };
  }

  private prepareSettingsForExport(includeApiKey: boolean): NovaJournalSettings {
    const settings = { ...this.plugin.settings };
    
    if (!includeApiKey) {
      settings.aiApiKey = '';
    } else {
      settings.aiApiKey = this.plugin.settings.aiApiKey ?? '';
    }
    
    return settings;
  }

  async exportSettings(options: SettingsExportOptions = {}): Promise<SettingsExportData> {
    const {
      includeApiKey = false,
      includeMetadata = true,
    } = options;

    const settings = this.prepareSettingsForExport(includeApiKey);

    const exportData: SettingsExportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings,
    };

    if (includeMetadata) {
      exportData.metadata = this.createExportMetadata();
    }

    return exportData;
  }

  private processImportSettings(data: SettingsExportData): { settings: NovaJournalSettings; warnings: string[] } {
    const normalizedSettings = normalizeSettings(data.settings);
    const warnings: string[] = [];

    if (data.settings.aiApiKey && !normalizedSettings.aiApiKey) {
      warnings.push('API key was excluded from import for security');
    }

    if (JSON.stringify(data.settings) !== JSON.stringify(normalizedSettings)) {
      warnings.push('Some settings were normalized during import');
    }

    return { settings: normalizedSettings, warnings };
  }

  async importSettings(data: SettingsExportData): Promise<SettingsImportResult> {
    const result = this.validateImportData(data);
    
    if (!result.success) {
      return result;
    }

    try {
      const { settings, warnings } = this.processImportSettings(data);

      return {
        success: true,
        settings,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to process settings: ${error.message}`],
      };
    }
  }



  private generateTimestampedFilename(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `nova-journal-settings-${yyyy}-${mm}-${dd}_${HH}-${min}.json`;
  }

  private createDownloadElement(content: string, filename: string): HTMLAnchorElement {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    return a;
  }

  async saveSettingsWithFilePicker(includeApiKey = false): Promise<void> {
    return new Promise((resolve, reject) => {
      this.exportSettings({ includeApiKey }).then(data => {
        const content = JSON.stringify(data, null, 2);
        const filename = this.generateTimestampedFilename();
        const a = this.createDownloadElement(content, filename);
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          ToastSpinnerService.notice(`Settings exported to ${filename}`);
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

  private validateFileForImport(file: File | null): SettingsImportResult | null {
    if (!file) {
      return {
        success: false,
        errors: ['No file selected'],
      };
    }

    // Validate size from File metadata before reading content
    if (typeof file.size === 'number' && file.size > FILE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        errors: ['File too large. Maximum size is 1MB.'],
      };
    }

    // No error, file is valid
    return null;
  }

  private async handleFileSelection(e: Event): Promise<SettingsImportResult> {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    
    const validationError = this.validateFileForImport(file);
    if (validationError) {
      return validationError;
    }

    try {
      const content = await file!.text();
      return await this.parseFileContent(content);
    } catch (err) {
      logger.error(`Failed to read settings file: ${err instanceof Error ? err.message : String(err)}`, 'SettingsService');
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
      
      await this.applyImportedSettings(settingsObj);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to parse settings file content: ${error.message}`, 'SettingsService');
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

  private validateDataStructure(data: unknown): { valid: boolean; dataObj?: Record<string, unknown>; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Invalid data format' };
    }

    const dataObj = data as Record<string, unknown>;
    if (!dataObj.settings || typeof dataObj.settings !== 'object') {
      return { valid: false, error: 'Missing or invalid settings data' };
    }

    return { valid: true, dataObj };
  }

  private validateRequiredFields(settingsObj: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const requiredFields = ['promptStyle', 'insertLocation', 'dailyNoteFolder'];
    
    for (const field of requiredFields) {
      if (!(field in settingsObj)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    return errors;
  }

  private validateImportData(data: unknown): SettingsImportResult {
    const errors: string[] = [];

    const structureValidation = this.validateDataStructure(data);
    if (!structureValidation.valid) {
      return { success: false, errors: [structureValidation.error ?? 'Validation failed'] };
    }

    const dataObj = structureValidation.dataObj;
    if (!dataObj?.version) {
      errors.push('Missing version information');
    }

    const settingsObj = dataObj?.settings as Record<string, unknown>;
    const fieldErrors = this.validateRequiredFields(settingsObj);
    errors.push(...fieldErrors);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }
}