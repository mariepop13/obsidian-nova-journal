import { Setting } from 'obsidian';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import { ApiTester } from '../../utils/ApiTester';
import { SettingsUtils } from '../SettingsUtils';
import type NovaJournalPlugin from '../../main';

export class ApiKeySettingsRenderer {
  private readonly plugin: NovaJournalPlugin;
  private readonly refreshCallback: () => void;

  constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
    this.plugin = plugin;
    this.refreshCallback = refreshCallback;
  }

  renderAIWarning(containerEl: HTMLElement): void {
    if (!this.plugin.settings.aiEnabled) {
      const template = this.plugin.settings.promptTemplate || '';
      if (SettingsUtils.hasAIExploreLinks(template)) {
        const warning = containerEl.createEl('div', {
          cls: 'nova-settings-warning',
        });
        warning.setText(
          'Note: your Prompt template contains the Explore link, but AI is disabled. It will be removed from inserted content.'
        );
      }
    }
  }

  renderAPIKeySection(containerEl: HTMLElement): void {
    const keyLooksValid = SettingsUtils.isValidOpenAIKey(this.plugin.settings.aiApiKey);

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc(
        keyLooksValid
          ? 'Stored locally. Only OpenAI is supported for now.'
          : 'Key format looks unusual. It should start with sk- for OpenAI.'
      )
      .addText(text => {
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.aiApiKey)
          .onChange(async value => {
            try {
              this.plugin.settings.aiApiKey = value;
              await this.plugin.saveSettings();
            } catch (error) {
              ToastSpinnerService.error('Failed to save API key');
            }
          });
        text.inputEl.addEventListener('blur', () => {
          this.refreshCallback();
        });
      })
      .addButton(button =>
        button.setButtonText('Test').onClick(async () => {
          await ApiTester.testOpenAIConnection(this.plugin.settings.aiApiKey);
        })
      );
  }
}
