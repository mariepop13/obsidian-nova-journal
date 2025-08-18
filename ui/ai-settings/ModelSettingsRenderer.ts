import { Setting, TextAreaComponent } from 'obsidian';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import { SettingsUtils } from '../SettingsUtils';
import type NovaJournalPlugin from '../../main';

export class ModelSettingsRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;

  constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
  }

  renderSystemPromptSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('System prompt').addTextArea((textArea: TextAreaComponent) => {
      textArea.setValue(this.plugin.settings.aiSystemPrompt).onChange(async value => {
        try {
          this.plugin.settings.aiSystemPrompt = value;
          await this.plugin.saveSettings();
        } catch (error) {
          ToastSpinnerService.error('Failed to save system prompt');
        }
      });
      textArea.inputEl.rows = 3;
    });
  }

  renderModelSection(containerEl: HTMLElement): void {
    const modelLooksOpenAI = SettingsUtils.isValidOpenAIModel(this.plugin.settings.aiModel);

    new Setting(containerEl)
      .setName('OpenAI model')
      .setDesc(
        modelLooksOpenAI
          ? 'e.g., gpt-4o-mini. Only OpenAI models are supported for now.'
          : 'Model name may not be an OpenAI model (e.g., gpt-4o-mini).'
      )
      .addText(text => {
        text
          .setPlaceholder('gpt-4o-mini')
          .setValue(this.plugin.settings.aiModel)
          .onChange(async value => {
            try {
              this.plugin.settings.aiModel = value || 'gpt-4o-mini';
              await this.plugin.saveSettings();
            } catch (error) {
              ToastSpinnerService.error('Failed to save model');
            }
          });
        text.inputEl.addEventListener('blur', () => {
          this.refreshCallback();
        });
      });

    new Setting(containerEl)
      .setName('Fallback OpenAI model')
      .setDesc('Optional. Used if the primary OpenAI model fails.')
      .addText(text =>
        text
          .setPlaceholder('gpt-4o-mini')
          .setValue(this.plugin.settings.aiFallbackModel || '')
          .onChange(async value => {
            try {
              this.plugin.settings.aiFallbackModel = value || '';
              await this.plugin.saveSettings();
            } catch (error) {
              ToastSpinnerService.error('Failed to save fallback model');
            }
          })
      );
  }
}
