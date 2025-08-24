import { Setting } from 'obsidian';
import { SettingsValidator } from '../../settings/PluginSettings';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import type NovaJournalPlugin from '../../main';

export class AdvancedSettingsRenderer {
  private readonly plugin: NovaJournalPlugin;

  constructor(plugin: NovaJournalPlugin) {
    this.plugin = plugin;
  }

  renderAdvancedSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Advanced' });

    this.renderMaxTokensSetting(containerEl);
    this.renderRetryCountSetting(containerEl);
  }

  renderDebugSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Debug' });

    this.renderDebugLogsSetting(containerEl);
  }

  private renderMaxTokensSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Max tokens')
      .setDesc('Upper bound on AI response tokens')
      .addText(text => {
        const handleMaxTokensChange = async (value: string): Promise<void> => {
          try {
            const tokenCount = Number(value);
            this.plugin.settings.aiMaxTokens = SettingsValidator.validateTokens(tokenCount);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save max tokens');
          }
        };

        text
          .setPlaceholder('800')
          .setValue(String(this.plugin.settings.aiMaxTokens))
          .onChange(handleMaxTokensChange);
      });
  }

  private renderRetryCountSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Retry count')
      .setDesc('Number of retries on transient AI errors')
      .addText(text => {
        const handleRetryCountChange = async (value: string): Promise<void> => {
          try {
            const retryCount = Number(value);
            this.plugin.settings.aiRetryCount = SettingsValidator.validateRetryCount(retryCount);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save retry count');
          }
        };

        text
          .setPlaceholder('2')
          .setValue(String(this.plugin.settings.aiRetryCount))
          .onChange(handleRetryCountChange);
      });
  }

  private renderDebugLogsSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Enable AI debug logs')
      .setDesc('Show detailed logs in the console for RAG and AI operations')
      .addToggle(toggle => {
        const handleDebugChange = async (value: boolean): Promise<void> => {
          try {
            this.plugin.settings.aiDebug = value;
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save debug setting');
          }
        };

        toggle.setValue(this.plugin.settings.aiDebug).onChange(handleDebugChange);
      });
  }
}
