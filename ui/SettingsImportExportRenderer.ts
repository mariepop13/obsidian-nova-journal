import { ButtonComponent, Setting } from 'obsidian';
import type NovaJournalPlugin from '../main';
import { SettingsService } from '../services/SettingsService';
import type { SettingsExportData, SettingsExportOptions, SettingsImportResult } from '../settings/PluginSettings';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';
import { FILE_LIMITS, UI_CONSTANTS } from '../services/shared/Constants';

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
    this.renderExportButtons(containerEl);
    this.renderApiKeyToggle(containerEl);
  }

  private renderExportButtons(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Export settings')
      .setDesc('Save your current settings to a file')
      .addButton((button: ButtonComponent): void => {
        const handleExportToFile = async (): Promise<void> => {
          try {
            await this.settingsService.saveSettingsWithFilePicker(this.includeApiKeyInExport);
          } catch {
            ToastSpinnerService.error('Failed to export settings. Please try again.');
          }
        };

        button
          .setButtonText('Export to file')
          .setClass('mod-cta')
          .onClick(handleExportToFile);
      })
      .addButton((button: ButtonComponent): void => {
        const handleCopyToClipboard = async (): Promise<void> => {
          await this.handleCopyToClipboard();
        };

        button
          .setButtonText('Copy to clipboard')
          .onClick(handleCopyToClipboard);
      });
  }

  private async handleCopyToClipboard(): Promise<void> {
    try {
      const options: SettingsExportOptions = {
        includeApiKey: this.includeApiKeyInExport,
        includeMetadata: true,
      };
      const exportData = await this.settingsService.exportSettings(options);
      const content = JSON.stringify(exportData, null, 2);
      
      const shouldProceed = await this.confirmApiKeyExportIfNeeded(exportData);
      if (!shouldProceed) {
        return;
      }
      
      await this.attemptClipboardWrite(content);
    } catch {
      ToastSpinnerService.error('Failed to copy settings. Please try again.');
    }
  }

  private async confirmApiKeyExportIfNeeded(exportData: SettingsExportData): Promise<boolean> {
    if (this.includeApiKeyInExport && exportData.settings.aiApiKey) {
      const confirmed = confirm(
        'WARNING: You are about to copy sensitive API key data to clipboard.\\n\\nThis data will be accessible to other applications and may remain in clipboard history.\\n\\nContinue only if you trust your current environment.\\n\\nContinue?'
      );
      return confirmed;
    }
    return true;
  }

  private async attemptClipboardWrite(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      ToastSpinnerService.notice('Settings copied to clipboard');
    } catch {
      // Fallback for clipboard permission issues
      this.showCopyFallbackDialog(content);
    }
  }

  private renderApiKeyToggle(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Include API key in export')
      .setDesc('Warning: Only enable if you trust the export destination')
      .addToggle((toggle): void => {
        const handleApiKeyToggle = async (includeApiKey: boolean): Promise<void> => {
          this.includeApiKeyInExport = includeApiKey;
        };

        toggle.setValue(false);
        toggle.onChange(handleApiKeyToggle);
      });
  }

  private renderImportSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Import settings')
      .setDesc('Load settings from a file or clipboard')
      .addButton((button: ButtonComponent): void => {
        const handleFileImportClick = async (): Promise<void> => {
          await this.handleFileImport();
        };

        button
          .setButtonText('Import from file')
          .setClass('mod-cta')
          .onClick(handleFileImportClick);
      })
      .addButton((button: ButtonComponent): void => {
        const handleClipboardImportClick = async (): Promise<void> => {
          await this.handleClipboardImport();
        };

        button
          .setButtonText('Import from clipboard')
          .onClick(handleClipboardImportClick);
      });
  }

  private async handleFileImport(): Promise<void> {
    try {
      const result = await this.settingsService.loadSettingsFromFile();
      await this.processImportResult(result);
    } catch {
      ToastSpinnerService.error('Failed to import settings. Please try again.');
    }
  }

  private async handleClipboardImport(): Promise<void> {
    try {
      const clipboardText = await this.getClipboardText();
      if (!clipboardText) {
        return;
      }
      
      if (clipboardText.length > FILE_LIMITS.MAX_CLIPBOARD_SIZE_BYTES) {
        ToastSpinnerService.error('Clipboard content too large. Maximum size is 1MB.');
        return;
      }
      
      const data = await this.parseClipboardJson(clipboardText);
      if (!data) {
        return;
      }
      
      const result = await this.settingsService.importSettings(data);
      await this.processImportResult(result);
    } catch {
      ToastSpinnerService.error('Failed to import from clipboard. Please check the format.');
    }
  }

  private async getClipboardText(): Promise<string | null> {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Fallback for clipboard permission issues
      const fallbackText = await this.showClipboardFallbackDialog();
      return fallbackText;
    }
  }

  private async parseClipboardJson(clipboardText: string): Promise<SettingsExportData | null> {
    try {
      return JSON.parse(clipboardText);
    } catch {
      ToastSpinnerService.error('Invalid JSON format in clipboard.');
      return null;
    }
  }

  private async processImportResult(result: SettingsImportResult): Promise<void> {
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
  }

  private async showClipboardFallbackDialog(): Promise<string | null> {
    return new Promise((resolve): void => {
      const modal = document.createElement('div');
      modal.className = 'modal-container';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${UI_CONSTANTS.PERCENTAGE_FULL}%;
        height: ${UI_CONSTANTS.PERCENTAGE_FULL}%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${UI_CONSTANTS.Z_INDEX_MODAL};
      `;
      
      const content = document.createElement('div');
      content.className = 'modal';
      content.style.cssText = `
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 20px;
        max-width: 500px;
        width: 90%;
      `;
      
      content.innerHTML = `
        <h3>Clipboard Access Required</h3>
        <p>Unable to access clipboard automatically. Please paste your settings data below:</p>
        <textarea id="fallback-textarea" style="width: ${UI_CONSTANTS.PERCENTAGE_FULL}%; height: ${UI_CONSTANTS.HEIGHT_SMALL}px; margin: 10px 0; font-family: monospace; font-size: ${UI_CONSTANTS.FONT_SIZE_NORMAL}px;"></textarea>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="fallback-cancel">Cancel</button>
          <button id="fallback-import" class="mod-cta">Import</button>
        </div>
      `;
      
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      const textarea = content.querySelector('#fallback-textarea') as HTMLTextAreaElement;
      const cancelBtn = content.querySelector('#fallback-cancel') as HTMLButtonElement;
      const importBtn = content.querySelector('#fallback-import') as HTMLButtonElement;
      
      textarea.focus();
      
      const cleanup = (): void => {
        document.body.removeChild(modal);
      };
      
      cancelBtn.onclick = (): void => {
        cleanup();
        resolve(null);
      };
      
      importBtn.onclick = (): void => {
        const text = textarea.value.trim();
        cleanup();
        resolve(text || null);
      };
      
      modal.onclick = (e): void => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      };
    });
  }

  private showCopyFallbackDialog(content: string): void {
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: ${UI_CONSTANTS.PERCENTAGE_FULL}%;
      height: ${UI_CONSTANTS.PERCENTAGE_FULL}%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: ${UI_CONSTANTS.Z_INDEX_MODAL};
    `;
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal';
    modalContent.style.cssText = `
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 20px;
      max-width: 600px;
      width: 90%;
    `;
    
    modalContent.innerHTML = `
      <h3>Copy Settings Data</h3>
      <p>Unable to copy automatically. Please manually copy the data below:</p>
      <textarea readonly style="width: ${UI_CONSTANTS.PERCENTAGE_FULL}%; height: ${UI_CONSTANTS.HEIGHT_MEDIUM}px; margin: 10px 0; font-family: monospace; font-size: ${UI_CONSTANTS.FONT_SIZE_SMALL}px;">${content}</textarea>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="copy-fallback-close" class="mod-cta">Close</button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    const textarea = modalContent.querySelector('textarea') as HTMLTextAreaElement;
    const closeBtn = modalContent.querySelector('#copy-fallback-close') as HTMLButtonElement;
    
    // Select all text for easy copying
    textarea.select();
    textarea.focus();
    
    const cleanup = (): void => {
      document.body.removeChild(modal);
    };
    
    closeBtn.onclick = cleanup;
    modal.onclick = (e: MouseEvent): void => {
      if (e.target === modal) {
        cleanup();
      }
    };
    
    ToastSpinnerService.notice('Settings data displayed - please copy manually');
  }

  private renderResetSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values')
      .addButton((button: ButtonComponent): void => {
        const handleResetSettings = async (): Promise<void> => {
          const confirmed = confirm(
            'Are you sure you want to reset all settings to defaults? This action cannot be undone.'
          );
          
          if (confirmed) {
            try {
              await this.settingsService.resetToDefaults();
              this.refreshCallback();
            } catch {
              ToastSpinnerService.error('Failed to reset settings. Please try again.');
            }
          }
        };

        button
          .setButtonText('Reset all settings')
          .setClass('mod-warning')
          .onClick(handleResetSettings);
      });
  }
}