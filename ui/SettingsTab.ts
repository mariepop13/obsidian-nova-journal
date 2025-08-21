import { App, PluginSettingTab } from 'obsidian';

import { BasicSettingsRenderer } from './BasicSettingsRenderer';
import { AISettingsRenderer } from './AISettingsRenderer';
import { SettingsImportExportRenderer } from './SettingsImportExportRenderer';

import type NovaJournalPlugin from '../main';

export class NovaJournalSettingTab extends PluginSettingTab {
  private readonly plugin: NovaJournalPlugin;
  private readonly basicRenderer: BasicSettingsRenderer;
  private readonly aiRenderer: AISettingsRenderer;
  private readonly importExportRenderer: SettingsImportExportRenderer;

  constructor(app: App, plugin: NovaJournalPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.basicRenderer = new BasicSettingsRenderer(plugin, () => this.display());
    this.aiRenderer = new AISettingsRenderer(plugin, () => this.display());
    this.importExportRenderer = new SettingsImportExportRenderer(plugin, () => this.display());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Nova Journal Settings' });

    this.basicRenderer.renderBasicSettings(containerEl);
    this.aiRenderer.renderAISettings(containerEl);
    this.importExportRenderer.renderImportExportSection(containerEl);
  }


}
