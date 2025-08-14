import { promptPacks, PromptStyle } from './PromptRegistry';
import type { MoodData } from '../services/rendering/FrontmatterService';

export class PromptService {
  getPromptForDate(style: PromptStyle, date: Date): string {
    const prompts = promptPacks[style] ?? promptPacks.reflective;
    const seed = this.generateDateSeed(style, date);
    const index = seed % prompts.length;
    return prompts[index];
  }

  getContextAwarePrompt(
    preferredStyle: PromptStyle,
    date: Date,
    noteText?: string,
    moodData?: Partial<MoodData>
  ): { style: PromptStyle; prompt: string } {
    const style = this.selectStyleFromContext(preferredStyle, noteText, moodData);
    return { style, prompt: this.getPromptForDate(style, date) };
  }

  private selectStyleFromContext(
    preferredStyle: PromptStyle,
    noteText?: string,
    moodData?: Partial<MoodData>
  ): PromptStyle {
    const text = (noteText || '').toLowerCase();

    // Heuristics: if user mentions dreams, switch to dreams
    const indicatesDream = /\b(dream|rêve|reves|rêves|nightmare|cauchemar)\b/i.test(text);
    if (indicatesDream) {
      return 'dreams';
    }

    // Heuristics based on mood tags/emotions
    const tags = (moodData?.tags || []).map((t) => t.toLowerCase());
    const emotions = (moodData?.dominant_emotions || []).map((e) => e.toLowerCase());
    if (tags.includes('sleep') || tags.includes('dreams') || emotions.includes('curious')) {
      return 'dreams';
    }

    return preferredStyle;
  }

  private generateDateSeed(style: string, date: Date): number {
    const key = `${style}:${date.getUTCFullYear()}-${date.getUTCMonth()+1}-${date.getUTCDate()}`;
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

