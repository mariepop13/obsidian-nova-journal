import { ButtonComponent, Setting } from 'obsidian';
import type NovaJournalPlugin from '../main';
import { SettingsService } from '../services/SettingsService';
import type { SettingsExportOptions } from '../settings/PluginSettings';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';

export class SettingsImportExportRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;
  private readonly settingsService: SettingsService;

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
              await this.settingsService.saveSettingsToFile();
            } catch (error) {
              ToastSpinnerService.error(`Failed to export settings: ${error.message}`);
            }
          });
      })
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Copy to clipboard')
          .onClick(async () => {
            try {
              const options: SettingsExportOptions = {
                includeApiKey: false,
                includeMetadata: true,
              };
              const exportData = await this.settingsService.exportSettings(options);
              const content = JSON.stringify(exportData, null, 2);
              
              await navigator.clipboard.writeText(content);
              ToastSpinnerService.notice('Settings copied to clipboard');
            } catch (error) {
              ToastSpinnerService.error(`Failed to copy settings: ${error.message}`);
            }
          });
      });

    new Setting(containerEl)
      .setName('Include API key in export')
      .setDesc('Warning: Only enable if you trust the export destination')
      .addToggle((toggle) => {
        toggle.setValue(false);
        toggle.onChange(async (includeApiKey) => {
          // Store the preference temporarily for the export buttons above
          const exportButtons = containerEl.querySelectorAll('.setting-item button');
          exportButtons.forEach((btn: HTMLButtonElement) => {
            if (btn.textContent?.includes('Export') || btn.textContent?.includes('Copy')) {
              btn.onclick = async () => {
                try {
                  const options: SettingsExportOptions = {
                    includeApiKey,
                    includeMetadata: true,
                  };

                  if (btn.textContent?.includes('Export')) {
                    const exportData = await this.settingsService.exportSettings(options);
                    const content = JSON.stringify(exportData, null, 2);
                    const filename = `nova-journal-settings-${includeApiKey ? 'with-key-' : ''}${new Date().toISOString().split('T')[0]}.json`;
                    
                    const file = await this.plugin.app.vault.create(filename, content);
                    ToastSpinnerService.notice(`Settings exported to ${file.path}`);
                  } else {
                    const exportData = await this.settingsService.exportSettings(options);
                    const content = JSON.stringify(exportData, null, 2);
                    await navigator.clipboard.writeText(content);
                    ToastSpinnerService.notice('Settings copied to clipboard');
                  }
                } catch (error) {
                  ToastSpinnerService.error(`Export failed: ${error.message}`);
                }
              };
            }
          });
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
                ToastSpinnerService.error(
                  `Import failed: ${result.errors?.join(', ')}`
                );
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
              ToastSpinnerService.error(
                `Failed to import settings: ${error.message}`
              );
            }
          });
      })
      .addButton((button: ButtonComponent) => {
        button
          .setButtonText('Import from clipboard')
          .onClick(async () => {
            try {
              const clipboardText = await navigator.clipboard.readText();
              const data = JSON.parse(clipboardText);
              const result = await this.settingsService.importSettings(data);

              if (!result.success) {
                ToastSpinnerService.error(
                  `Import failed: ${result.errors?.join(', ')}`
                );
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
              ToastSpinnerService.error(
                `Failed to import from clipboard: ${error.message}`
              );
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
                ToastSpinnerService.error(
                  `Failed to reset settings: ${error.message}`
                );
              }
            }
          });
      });
  }
}