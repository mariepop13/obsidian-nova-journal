import { ButtonComponent, Setting } from 'obsidian';
import type NovaJournalPlugin from '../main';
import { SettingsService } from '../services/SettingsService';
import type { SettingsExportOptions } from '../settings/PluginSettings';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';

export class SettingsImportExportRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;
  private readonly settingsService: SettingsService;
  private includeApiKeyInExport = false;

  constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
    this.settingsService = new SettingsService(plugin.app, plugin);
  }

  renderImportExportSection(containerEl: HTMLElement): void {
    const importExportContainer = containerEl.createDiv();
    importExportContainer.createEl('h3', { text: 'Import/Export Settings' });
    
    this.renderExportSettings(importExportContainer);
    this.renderImportSettings(importExportContainer);
    this.renderResetSettings(importExportContainer);
  }

  private renderExportSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Export settings')
      .setDesc('Save your current settings to a file')
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Export to file')
          .setClass('mod-cta')
          .onClick(async () => {
            try {
              await this.settingsService.saveSettingsWithFilePicker(this.includeApiKeyInExport);
            } catch (error) {
              console.error('Export failed:', error);
              ToastSpinnerService.error('Failed to export settings. Please try again.');
            }
          });
      })
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Copy to clipboard')
          .onClick(async () => {
            try {
              const options: SettingsExportOptions = {
                includeApiKey: this.includeApiKeyInExport,
                includeMetadata: true,
              };
              const exportData = await this.settingsService.exportSettings(options);
              const content = JSON.stringify(exportData, null, 2);
              
              if (this.includeApiKeyInExport && exportData.settings.aiApiKey) {
                const confirmed = confirm(
                  'WARNING: You are about to copy sensitive API key data to clipboard.\n\nThis data will be accessible to other applications and may remain in clipboard history.\n\nContinue only if you trust your current environment.\n\nContinue?'
                );
                if (!confirmed) {
                  return;
                }
              }
              
              await navigator.clipboard.writeText(content);
              ToastSpinnerService.notice('Settings copied to clipboard');
            } catch (error) {
              console.error('Copy to clipboard failed:', error);
              ToastSpinnerService.error('Failed to copy settings. Please try again.');
            }
          });
      });

    new Setting(containerEl)
      .setName('Include API key in export')
      .setDesc('Warning: Only enable if you trust the export destination')
      .addToggle((toggle) => {
        toggle.setValue(false);
        toggle.onChange(async (includeApiKey) => {
          this.includeApiKeyInExport = includeApiKey;
        });
      });
  }

  private renderImportSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Import settings')
      .setDesc('Load settings from a file or clipboard')
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Import from file')
          .setClass('mod-cta')
          .onClick(async () => {
            try {
              const result = await this.settingsService.loadSettingsFromFile();
              
              if (!result.success) {
                ToastSpinnerService.error('Import failed. Please check your file format.');
                return;
              }

              if (result.warnings?.length) {
                ToastSpinnerService.warn(
                  `Import completed with warnings: ${result.warnings.join(', ')}`
                );
              }

              if (result.settings) {
                await this.settingsService.applyImportedSettings(result.settings);
                this.refreshCallback();
              }
            } catch (error) {
              console.error('File import failed:', error);
              ToastSpinnerService.error('Failed to import settings. Please try again.');
            }
          });
      })
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Import from clipboard')
          .onClick(async () => {
            try {
              const clipboardText = await navigator.clipboard.readText();
              
              if (clipboardText.length > 1024 * 1024) {
                ToastSpinnerService.error('Clipboard content too large. Maximum size is 1MB.');
                return;
              }
              
              let data;
              try {
                data = JSON.parse(clipboardText);
              } catch (parseError) {
                ToastSpinnerService.error('Invalid JSON format in clipboard.');
                return;
              }
              
              const result = await this.settingsService.importSettings(data);

              if (!result.success) {
                ToastSpinnerService.error('Import failed. Please check your file format.');
                return;
              }

              if (result.warnings?.length) {
                ToastSpinnerService.warn(
                  `Import completed with warnings: ${result.warnings.join(', ')}`
                );
              }

              if (result.settings) {
                await this.settingsService.applyImportedSettings(result.settings);
                this.refreshCallback();
              }
            } catch (error) {
              console.error('Clipboard import failed:', error);
              ToastSpinnerService.error('Failed to import from clipboard. Please check the format.');
            }
          });
      });
  }

  private renderResetSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values')
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Reset all settings')
          .setClass('mod-warning')
          .onClick(async () => {
            const confirmed = confirm(
              'Are you sure you want to reset all settings to defaults? This action cannot be undone.'
            );
            
            if (confirmed) {
              try {
                await this.settingsService.resetToDefaults();
                this.refreshCallback();
              } catch (error) {
                console.error('Settings reset failed:', error);
                ToastSpinnerService.error('Failed to reset settings. Please try again.');
              }
            }
          });
      });
  }
}