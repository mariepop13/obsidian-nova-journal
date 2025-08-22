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
      .addText(text =>
        text
          .setPlaceholder('800')
          .setValue(String(this.plugin.settings.aiMaxTokens))
          .onChange(async value => {
            try {
              const tokenCount = Number(value);
              this.plugin.settings.aiMaxTokens = SettingsValidator.validateTokens(tokenCount);
              await this.plugin.saveSettings();
            } catch {
              ToastSpinnerService.error('Failed to save max tokens');
            }
          })
      );
  }

  private renderRetryCountSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Retry count')
      .setDesc('Number of retries on transient AI errors')
      .addText(text =>
        text
          .setPlaceholder('2')
          .setValue(String(this.plugin.settings.aiRetryCount))
          .onChange(async value => {
            try {
              const retryCount = Number(value);
              this.plugin.settings.aiRetryCount = SettingsValidator.validateRetryCount(retryCount);
              await this.plugin.saveSettings();
            } catch {
              ToastSpinnerService.error('Failed to save retry count');
            }
          })
      );
  }

  private renderDebugLogsSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Enable AI debug logs')
      .setDesc('Show detailed logs in the console for RAG and AI operations')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.aiDebug).onChange(async value => {
          try {
            this.plugin.settings.aiDebug = value;
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save debug setting');
          }
        })
      );
  }
}
