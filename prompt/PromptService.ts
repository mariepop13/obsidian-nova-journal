import { promptPacks, PromptStyle } from './PromptRegistry';

export class PromptService {
  getPromptForDate(style: PromptStyle, date: Date): string {
    const prompts = promptPacks[style] ?? promptPacks.reflective;
    const seed = this.generateDateSeed(style, date);
    const index = seed % prompts.length;
    return prompts[index];
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


