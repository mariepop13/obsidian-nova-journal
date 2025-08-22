import { DateFormatter, TemplateFactory, type PromptPreset } from '../settings/PluginSettings';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';
import type NovaJournalPlugin from '../main';

export class SettingsUtils {
  static async saveSettingsWithErrorHandling(
    plugin: NovaJournalPlugin,
    operation: () => Promise<void> | void,
    errorMessage: string,
    shouldRefresh = false,
    refreshCallback?: () => void
  ): Promise<void> {
    try {
      await operation();
      await plugin.saveSettings();
      if (shouldRefresh && refreshCallback) {
        refreshCallback();
      }
    } catch (error) {
      console.error('Nova Journal settings error:', error);
      ToastSpinnerService.error(errorMessage);
    }
  }

  static renderTemplatePreview(containerEl: HTMLElement, promptTemplate: string, userName: string): void {
    const preview = containerEl.createEl('div', {
      cls: 'nova-settings-template-preview',
    });

    const now = new Date();
    const samplePrompt = 'What are you grateful for today?';
    let output = (promptTemplate ?? '').trim();

    output = output.replace(/\{\{\s*prompt\s*\}\}/g, samplePrompt);
    output = output.replace(/\{\{\s*user_line\s*\}\}/g, `**${userName ?? 'You'}** (you): `);
    output = output.replace(/\{\{\s*date(?::([^}]+))?\s*\}\}/g, (_match: string, format?: string) => {
      const dateFormat = typeof format === 'string' ? format.trim() : 'YYYY-MM-DD';
      return DateFormatter.format(now, dateFormat);
    });

    preview.setText(output);
  }

  static renderDateFormatPreview(containerEl: HTMLElement, dailyNoteFormat: string): void {
    const previewEl = containerEl.createEl('div', {
      cls: 'nova-settings-preview',
    });
    const previewText = DateFormatter.getPreviewFilename(dailyNoteFormat);
    previewEl.setText(`Example: ${previewText}`);
  }

  static getCurrentTemplatePreset(promptTemplate: string): string {
    return TemplateFactory.getPresetType(promptTemplate ?? '');
  }

  static getTemplatePreset(preset: string): string {
    return TemplateFactory.getPreset(preset as PromptPreset);
  }

  static isValidOpenAIKey(apiKey: string): boolean {
    return (apiKey ?? '').startsWith('sk-');
  }

  static isValidOpenAIModel(model: string): boolean {
    return /^(gpt|o\d)/i.test(model ?? '');
  }

  static hasAIExploreLinks(template: string): boolean {
    return /<a[^>]*class="nova-deepen"/i.test(template);
  }
}
