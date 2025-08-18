import { App, PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings/PluginSettings';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';
import { BasicSettingsRenderer } from './BasicSettingsRenderer';
import { AISettingsRenderer } from './AISettingsRenderer';
import { SettingsUtils } from './SettingsUtils';
import type NovaJournalPlugin from '../main';

export class NovaJournalSettingTab extends PluginSettingTab {
  private readonly plugin: NovaJournalPlugin;
  private readonly basicRenderer: BasicSettingsRenderer;
  private readonly aiRenderer: AISettingsRenderer;

  constructor(app: App, plugin: NovaJournalPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.basicRenderer = new BasicSettingsRenderer(plugin, () => this.display());
    this.aiRenderer = new AISettingsRenderer(plugin, () => this.display());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Nova Journal Settings' });

    this.renderResetButton(containerEl);
    this.basicRenderer.renderBasicSettings(containerEl);
    this.aiRenderer.renderAISettings(containerEl);
  }

  private renderResetButton(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Restore all Nova Journal settings to factory defaults')
      .addButton(b =>
        b.setButtonText('Reset').onClick(async () => {
          await SettingsUtils.saveSettingsWithErrorHandling(
            this.plugin,
            () => {
              this.plugin.settings = { ...DEFAULT_SETTINGS };
            },
            'Failed to reset settings',
            true,
            () => this.display()
          );
        })
      );
  }
}
