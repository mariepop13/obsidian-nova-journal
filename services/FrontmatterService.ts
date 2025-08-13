import { Editor } from 'obsidian';
import { MOOD_LIMITS, EXCLUDED_NAMES, VALID_SENTIMENTS, FRONTMATTER_ORDER } from './Constants';

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
      tags,
      people_present: people
    };
  }

  static upsertFrontmatter(editor: Editor, data: MoodData): void {
    const content = editor.getValue();
    const lines = content.split('\n');
    const { start, end } = this.findFrontmatterBounds(lines);

    const serializedData = this.serializeMoodData(data);
    if (serializedData.length === 0) return;

    if (start === 0 && end > 0) {
      this.updateExistingFrontmatter(editor, lines, end, serializedData);
    } else {
      this.createNewFrontmatter(editor, content, serializedData);
    }
  }

  private static extractMoodEmoji(input: Record<string, any>): string {
    const emoji = input?.mood_emoji;
    return typeof emoji === 'string' && emoji.trim().length > 0 ? emoji.trim() : '😐';
  }

  private static extractSentiment(input: Record<string, any>): string {
    const sentiment = (input?.sentiment || '').toLowerCase();
    return VALID_SENTIMENTS.includes(sentiment as any) ? sentiment : 'neutral';
  }

  private static extractStringArray(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item: any) => typeof item === 'string' && item.trim())
      .map((item: string) => item.toLowerCase());
  }

  private static extractPeoplePresent(input: Record<string, any>, userName: string): string[] {
    const peopleRaw = this.extractStringArray(input.people_present);
    const excludeNames = new Set([...EXCLUDED_NAMES, (userName || 'you').toLowerCase()]);
    return peopleRaw.filter(person => !excludeNames.has(person));
  }

  private static findFrontmatterBounds(lines: string[]): { start: number; end: number } {
    if (lines[0] !== '---') return { start: -1, end: -1 };
    
    const end = lines.findIndex((line, index) => index > 0 && line === '---');
    return { start: 0, end };
  }

  private static serializeMoodData(data: MoodData): string[] {
    return FRONTMATTER_ORDER
      .filter(key => data[key as keyof MoodData] != null)
      .map(key => this.serializeProperty(key, data[key as keyof MoodData]));
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
    const existingKeys = new Set(serializedData.map(line => line.split(':')[0]!.trim()));
    
    const filtered = before.filter((line, index) => 
      index === 0 || !existingKeys.has(line.split(':')[0]!.trim())
    );
    
    const merged = [...filtered, ...serializedData, ...after];
    editor.setValue(merged.join('\n'));
  }

  private static createNewFrontmatter(
    editor: Editor, 
    content: string, 
    serializedData: string[]
  ): void {
    const header = ['---', ...serializedData, '---', '', content].join('\n');
    editor.setValue(header);
  }
}
