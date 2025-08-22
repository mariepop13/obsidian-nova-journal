import { Editor } from 'obsidian';
import { EXCLUDED_NAMES, FRONTMATTER_ORDER, MOOD_LIMITS, VALID_SENTIMENTS } from '../shared/Constants';

export interface MoodData {
  mood_emoji: string[];
  sentiment: string[];
  dominant_emotions: string[];
  tags: string[];
  people_present: string[];
}

export class FrontmatterService {
  static normalizeMoodProps(input: Record<string, any>, userName: string): MoodData {
    const moodEmoji = this.extractMoodEmoji(input);
    const sentiment = this.extractSentiment(input);
    const dominantEmotions = this.extractStringArray(input.dominant_emotions).slice(0, MOOD_LIMITS.DOMINANT_EMOTIONS);
    const tags = this.extractStringArray(input.tags).slice(0, MOOD_LIMITS.TAGS);
    const people = this.extractPeoplePresent(input, userName).slice(0, MOOD_LIMITS.PEOPLE_PRESENT);

    return {
      mood_emoji: [moodEmoji],
      sentiment: [sentiment],
      dominant_emotions: dominantEmotions,
      tags: tags,
      people_present: people,
    };
  }

  static readMoodProps(editor: Editor): Partial<MoodData> | undefined {
    const content = editor.getValue();
    const lines = content.split('\n');
    const bounds = this.findFrontmatterBounds(lines);
    if (!this.hasFrontmatter(bounds)) return undefined;

    const data: Partial<MoodData> = {};
    for (let i = bounds.start + 1; i < bounds.end; i += 1) {
      const line = lines[i];
      const match = /^([\w_]+)\s*:\s*\[(.*)\]\s*$/.exec(line.trim());
      if (!match) continue;
      const key = match[1];
      const arrayContent = match[2];
      const items: string[] = [];
      for (const raw of arrayContent.split(',')) {
        const t = raw.trim().replace(/^["']|["']$/g, '');
        if (t) items.push(t);
      }

      if (items.length === 0) continue;
      switch (key) {
        case 'mood_emoji':
          (data as any).mood_emoji = items;
          break;
        case 'sentiment':
          (data as any).sentiment = items;
          break;
        case 'dominant_emotions':
          (data as any).dominant_emotions = items;
          break;
        case 'tags':
          (data as any).tags = items;
          break;
        case 'people_present':
          (data as any).people_present = items;
          break;
        default:
          break;
      }
    }

    return data;
  }

  static upsertFrontmatter(editor: Editor, data: MoodData): void {
    const content = editor.getValue();
    const lines = content.split('\n');
    const frontmatterBounds = this.findFrontmatterBounds(lines);
    const serializedData = this.serializeMoodData(data);

    if (this.hasFrontmatter(frontmatterBounds)) {
      this.updateExistingFrontmatter(editor, lines, frontmatterBounds.end, serializedData);
    } else {
      this.createNewFrontmatter(editor, content, serializedData);
    }
  }

  private static extractMoodEmoji(input: Record<string, any>): string {
    const emoji = input?.mood_emoji;
    return typeof emoji === 'string' && emoji.trim().length > 0 ? emoji.trim() : '😐';
  }

  private static extractSentiment(input: Record<string, any>): string {
    const sentiment = (input?.sentiment ?? '').toLowerCase();
    return VALID_SENTIMENTS.includes(sentiment as (typeof VALID_SENTIMENTS)[number]) ? sentiment : 'neutral';
  }

  private static extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item: unknown) => typeof item === 'string' && item.trim())
      .map((item: string) => item.toLowerCase());
  }

  private static extractPeoplePresent(input: Record<string, any>, userName: string): string[] {
    const peopleRaw = this.extractStringArray(input.people_present);
    const excludeNames = new Set([...EXCLUDED_NAMES, (userName ?? 'you').toLowerCase()]);
    return peopleRaw.filter(person => !excludeNames.has(person));
  }

  private static hasFrontmatter(frontmatterBounds: { start: number; end: number }): boolean {
    return frontmatterBounds.start === 0 && frontmatterBounds.end > 0;
  }

  private static findFrontmatterBounds(lines: string[]): {
    start: number;
    end: number;
  } {
    if (lines[0] !== '---') return { start: -1, end: -1 };

    const end = lines.findIndex((line, index) => index > 0 && line === '---');
    return { start: 0, end };
  }

  private static serializeMoodData(data: MoodData): string[] {
    return FRONTMATTER_ORDER.map(key => {
      const value = data[key as keyof MoodData];
      const cleanedValue = this.getCleanedValue(key, value, data);
      return this.serializeProperty(key, cleanedValue);
    });
  }

  private static getCleanedValue(key: string, value: string[], allData: MoodData): string[] {
    if (this.isEmptyOrInvalidValue(value)) {
      return [];
    }

    if (this.isDefaultValue(key, value) && this.hasNoSignificantContent(allData)) {
      return [];
    }

    return value;
  }

  private static hasNoSignificantContent(data: MoodData): boolean {
    const hasEmotions = data.dominant_emotions && data.dominant_emotions.length > 0;
    const hasTags = data.tags && data.tags.length > 0;
    const hasPeople = data.people_present && data.people_present.length > 0;

    return !hasEmotions && !hasTags && !hasPeople;
  }

  private static isEmptyOrInvalidValue(value: string[]): boolean {
    return !value || !Array.isArray(value) || value.length === 0;
  }

  private static isDefaultValue(key: string, value: string[]): boolean {
    if (value.length !== 1) {
      return false;
    }

    const singleValue = value[0];
    return this.isDefaultMoodEmoji(key, singleValue) || this.isDefaultSentiment(key, singleValue);
  }

  private static isDefaultMoodEmoji(key: string, value: string): boolean {
    return key === 'mood_emoji' && value === '😐';
  }

  private static isDefaultSentiment(key: string, value: string): boolean {
    return key === 'sentiment' && value === 'neutral';
  }

  private static serializeProperty(key: string, value: string[]): string {
    const items = value.map(item => `"${String(item).replace(/"/g, '\\"')}"`).join(', ');
    return `${key}: [${items}]`;
  }

  private static updateExistingFrontmatter(
    editor: Editor,
    lines: string[],
    end: number,
    serializedData: string[]
  ): void {
    const before = lines.slice(0, end);
    const after = lines.slice(end);
    const filteredFrontmatter = this.removeMoodKeysFromFrontmatter(before);
    const merged = [...filteredFrontmatter, ...serializedData, ...after];
    editor.setValue(merged.join('\n'));
  }

  private static removeMoodKeysFromFrontmatter(frontmatterLines: string[]): string[] {
    const allMoodKeys = new Set(FRONTMATTER_ORDER);

    return frontmatterLines.filter((line, index) => {
      if (index === 0) return true;

      if (this.isOrphanedListItem(line)) {
        return false;
      }

      const key = line.split(':')[0]!.trim();
      const isMoodKey = allMoodKeys.has(key as keyof MoodData);
      return !isMoodKey;
    });
  }

  private static isOrphanedListItem(line: string): boolean {
    const trimmed = line.trim();

    if (!trimmed) return false;

    if (trimmed.startsWith('- ') && !trimmed.includes(':')) {
      return true;
    }

    if (trimmed === '-') {
      return true;
    }

    if (trimmed.startsWith('-') && !trimmed.includes(':')) {
      return true;
    }

    if (!trimmed.includes(':') && trimmed !== '---') {
      return true;
    }

    return false;
  }

  private static createNewFrontmatter(editor: Editor, content: string, serializedData: string[]): void {
    const header = ['---', ...serializedData, '---', '', content].join('\n');
    editor.setValue(header);
  }
}
