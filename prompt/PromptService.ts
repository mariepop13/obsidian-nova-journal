import { PromptStyle, promptPacks } from './PromptRegistry';
import type { MoodData } from '../services/rendering/FrontmatterService';
import { PromptStyleSelectorService } from '../services/ai/PromptStyleSelectorService';
import type { NovaJournalSettings } from '../settings/PluginSettings';
import { HASH_CONSTANTS } from '../services/shared/Constants';

export class PromptService {
  private selector?: PromptStyleSelectorService;

  constructor(settings?: NovaJournalSettings) {
    if (settings) {
      this.selector = new PromptStyleSelectorService(settings);
    }
  }
  getPromptForDate(style: PromptStyle, date: Date): string {
    const prompts = promptPacks[style] ?? promptPacks.reflective;
    const seed = this.generateDateSeed(style, date);
    const index = seed % prompts.length;
    return prompts[index];
  }

  async getContextAwarePrompt(
    preferredStyle: PromptStyle,
    date: Date,
    noteText?: string,
    moodData?: Partial<MoodData>
  ): Promise<{ style: PromptStyle; prompt: string }> {
    let style = preferredStyle;
    if (this.selector && noteText) {
      const aiStyle = await this.selector.recommendStyle(noteText, moodData);
      if (aiStyle) {
        style = aiStyle;
      } else {
        style = this.selectStyleFromContext(preferredStyle, noteText, moodData);
      }
    } else {
      style = this.selectStyleFromContext(preferredStyle, noteText, moodData);
    }
    return { style, prompt: this.getPromptForDate(style, date) };
  }

  private selectStyleFromContext(
    preferredStyle: PromptStyle,
    noteText?: string,
    moodData?: Partial<MoodData>
  ): PromptStyle {
    const text = (noteText ?? '').toLowerCase();

    const indicatesDream = /(dream|rêve|reves|rêves|nightmare|cauchemar)/i.test(text);
    if (indicatesDream) {
      return 'dreams';
    }

    const tags = (moodData?.tags ?? []).map(t => t.toLowerCase());
    const emotions = (moodData?.dominant_emotions ?? []).map(e => e.toLowerCase());
    if (tags.includes('sleep') || tags.includes('dreams') || emotions.includes('curious')) {
      return 'dreams';
    }

    return preferredStyle;
  }

  private generateDateSeed(style: string, date: Date): number {
    const key = `${style}:${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash << HASH_CONSTANTS.BIT_SHIFT_LEFT) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
