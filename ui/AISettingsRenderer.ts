import { Setting } from 'obsidian';
import { SettingsUtils } from './SettingsUtils';
import { ApiKeySettingsRenderer } from './ai-settings/ApiKeySettingsRenderer';
import { ModelSettingsRenderer } from './ai-settings/ModelSettingsRenderer';
import { PromptTemplateSettingsRenderer } from './ai-settings/PromptTemplateSettingsRenderer';
import { UserInterfaceSettingsRenderer } from './ai-settings/UserInterfaceSettingsRenderer';
import { ButtonCustomizationSettingsRenderer } from './ai-settings/ButtonCustomizationSettingsRenderer';
import { AdvancedSettingsRenderer } from './ai-settings/AdvancedSettingsRenderer';
import type NovaJournalPlugin from '../main';

export class AISettingsRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;
  private readonly apiKeyRenderer: ApiKeySettingsRenderer;
  private readonly modelRenderer: ModelSettingsRenderer;
  private readonly promptTemplateRenderer: PromptTemplateSettingsRenderer;
  private readonly userInterfaceRenderer: UserInterfaceSettingsRenderer;
  private readonly buttonCustomizationRenderer: ButtonCustomizationSettingsRenderer;
  private readonly advancedRenderer: AdvancedSettingsRenderer;

  constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
    this.apiKeyRenderer = new ApiKeySettingsRenderer(plugin, refreshCallback);
    this.modelRenderer = new ModelSettingsRenderer(plugin, refreshCallback);
    this.promptTemplateRenderer = new PromptTemplateSettingsRenderer(plugin, refreshCallback);
    this.userInterfaceRenderer = new UserInterfaceSettingsRenderer(plugin);
    this.buttonCustomizationRenderer = new ButtonCustomizationSettingsRenderer(plugin);
    this.advancedRenderer = new AdvancedSettingsRenderer(plugin);
  }

  private renderAIEnableToggle(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Enable AI').addToggle(toggle =>
      toggle.setValue(this.plugin.settings.aiEnabled).onChange(async value => {
        const previousValue = this.plugin.settings.aiEnabled;
        try {
          await SettingsUtils.saveSettingsWithErrorHandling(
            this.plugin,
            () => {
              this.plugin.settings.aiEnabled = value;
            },
            'Failed to save AI setting',
            true,
            this.refreshCallback
          );
        } catch (_error) {
          // Reset toggle to previous state on failure
          toggle.setValue(previousValue);
          this.refreshCallback();
        }
      })
    );
  }

  renderAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI (OpenAI only)' });

    this.renderAIEnableToggle(containerEl);
    this.apiKeyRenderer.renderAIWarning(containerEl);

    if (this.plugin.settings.aiEnabled) {
      this.apiKeyRenderer.renderAPIKeySection(containerEl);
      this.modelRenderer.renderSystemPromptSection(containerEl);
      this.promptTemplateRenderer.renderPromptStyleSection(containerEl);
      this.promptTemplateRenderer.renderTemplateSection(containerEl);
      this.modelRenderer.renderModelSection(containerEl);
      this.userInterfaceRenderer.renderUserInterfaceSection(containerEl);
      this.buttonCustomizationRenderer.renderButtonCustomizationSection(containerEl);
      this.advancedRenderer.renderAdvancedSection(containerEl);
      this.advancedRenderer.renderDebugSection(containerEl);
    }
  }
}
