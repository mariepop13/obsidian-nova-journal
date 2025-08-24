import { Setting, TextAreaComponent } from 'obsidian';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import { SettingsUtils } from '../SettingsUtils';
import type NovaJournalPlugin from '../../main';
import { UI_CONSTANTS } from '../../services/shared/Constants';

export class ModelSettingsRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;

  constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
  }

  renderSystemPromptSection(containerEl: HTMLElement): void {
    const handleSystemPromptChange = async (value: string): Promise<void> => {
      try {
        this.plugin.settings.aiSystemPrompt = value;
        await this.plugin.saveSettings();
      } catch {
        ToastSpinnerService.error('Failed to save system prompt');
      }
    };

    new Setting(containerEl).setName('System prompt').addTextArea((textArea: TextAreaComponent) => {
      textArea.setValue(this.plugin.settings.aiSystemPrompt).onChange(handleSystemPromptChange);
      textArea.inputEl.rows = UI_CONSTANTS.TEXTAREA_ROWS_SMALL;
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
        const handleModelChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.aiModel = value ?? 'gpt-4o-mini';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save model');
          }
        };

        text
          .setPlaceholder('gpt-4o-mini')
          .setValue(this.plugin.settings.aiModel)
          .onChange(handleModelChange);
        text.inputEl.addEventListener('blur', () => {
          this.refreshCallback();
        });
      });

    new Setting(containerEl)
      .setName('Fallback OpenAI model')
      .setDesc('Optional. Used if the primary OpenAI model fails.')
      .addText(text => {
        const handleFallbackModelChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.aiFallbackModel = value ?? '';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save fallback model');
          }
        };

        text
          .setPlaceholder('gpt-4o-mini')
          .setValue(this.plugin.settings.aiFallbackModel ?? '')
          .onChange(handleFallbackModelChange);
      });
  }
}
