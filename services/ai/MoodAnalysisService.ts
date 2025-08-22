
import { chat } from '../../ai/AiClient';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { App } from 'obsidian';
import { ToastSpinnerService } from '../editor/ToastSpinnerService';
import {
  TIME_CONSTANTS,
  CONTENT_LIMITS,
  MOOD_LIMITS,
  PARSING_CONSTANTS,
} from '../shared/Constants';
export interface FrontmatterData {
  [key: string]: string | number | string[] | undefined;
  mood?: string;
  mood_level?: number;
  energy?: number;
  tags?: string[];
}

export interface MoodHistoryEntry {
  date: string;
  mood?: string;
  moodLevel?: number;
  energy?: number;
  tags?: string[];
  note?: string;
}

export class MoodAnalysisService {
  constructor(
    private readonly settings: NovaJournalSettings,
    private readonly app: App
  ) {}

  async analyzeCurrentNoteContent(noteText: string): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
      ToastSpinnerService.warn('AI must be enabled for mood analysis.');
      return null;
    }

    const meaningfulContent = this.extractMeaningfulContent(noteText);
    if (!meaningfulContent || meaningfulContent.length === 0) {
      ToastSpinnerService.info('No content to analyze for mood.');
      return null;
    }

    const systemPrompt = `You analyze a journaling note and return ONLY a compact JSON object. You MUST fill ALL fields - never leave arrays empty unless there is truly no content.

{
  "mood_emoji": string,               // REQUIRED: choose the most appropriate emoji based on content tone
  "sentiment": "positive"|"neutral"|"negative",  // REQUIRED: determine overall sentiment, default to "neutral" only if truly neutral
  "dominant_emotions": string[],      // REQUIRED: extract 1-5 emotions even from subtle cues, e.g. ["frustrated","tired","hopeful"]
  "tags": string[],                   // REQUIRED: identify 1-8 relevant themes/topics, e.g. ["work","family","health"]
  "people_present": string[]          // Extract ANY people mentioned: names, family relations, friends, colleagues, etc.
}

RULES:
- Be assertive in your analysis - look for subtle emotional cues and context
- If you detect any emotion like "frustration", you MUST also set mood_emoji and sentiment accordingly
- Always try to find at least 1-2 emotions and 1-2 tags from the content
- Only use empty arrays [] if there is genuinely nothing to extract
- Do not add any text before or after the JSON.`;

    const userPrompt = `Note content:
${meaningfulContent}`;

    try {
      const analysis = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: this.settings.aiMaxTokens,
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel,
      });
      return analysis;
    } catch (error) {
      ToastSpinnerService.error('Mood analysis failed.');
      return null;
    }
  }

  async analyzeMoodData(daysBack = TIME_CONSTANTS.DEFAULT_ANALYSIS_DAYS): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
      ToastSpinnerService.warn('AI must be enabled for mood analysis.');
      return null;
    }

    try {
      const moodHistory = await this.collectMoodHistory(daysBack);

      if (moodHistory.length === 0) {
        ToastSpinnerService.info('No mood data found for analysis.');
        return null;
      }

      const analysis = await this.generateMoodInsights(moodHistory);
      return analysis;
    } catch (error) {
      ToastSpinnerService.error('Mood analysis failed. Check console for details.');
      return null;
    }
  }

  private async collectMoodHistory(daysBack: number): Promise<MoodHistoryEntry[]> {
    const history: MoodHistoryEntry[] = [];
    const files = this.app.vault.getMarkdownFiles();

    const today = new Date();
    const cutoffDate = new Date(today.getTime() - daysBack * TIME_CONSTANTS.MS_PER_DAY);

    for (const file of files) {
      try {
        const fileDate = this.extractDateFromFilename(file.name);
        if (!fileDate || fileDate < cutoffDate) continue;

        const content = await this.app.vault.read(file);
        const frontmatter = this.parseFrontmatter(content);

        if (frontmatter.mood || frontmatter.mood_level || frontmatter.energy) {
          const contentWithoutFrontmatter = this.removeMarkdownFrontmatter(content);
          const noteExcerpt = this.extractNoteExcerpt(contentWithoutFrontmatter);

          history.push({
            date: fileDate.toISOString().split('T')[0],
            mood: frontmatter.mood,
            moodLevel: frontmatter.mood_level,
            energy: frontmatter.energy,
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
            note: noteExcerpt,
          });
        }
      } catch (error) {
      }
    }

    return history.sort((a, b) => a.date.localeCompare(b.date));
  }

  private extractDateFromFilename(filename: string): Date | null {
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return null;

    const date = new Date(dateMatch[1]);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseFrontmatter(content: string): FrontmatterData {
    const lines = content.split('\n');
    if (lines[PARSING_CONSTANTS.FRONTMATTER_START_INDEX] !== '---') return {};

    const endIndex = lines.findIndex((line, index) => index > PARSING_CONSTANTS.FRONTMATTER_SEARCH_START && line === '---');
    if (endIndex === -1) return {};

    const frontmatterText = lines.slice(PARSING_CONSTANTS.FRONTMATTER_LINE_AFTER_START, endIndex).join('\n');
    const result: FrontmatterData = {};

    frontmatterText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) return;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + PARSING_CONSTANTS.STRING_NEXT_CHAR_OFFSET).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value
          .slice(PARSING_CONSTANTS.ARRAY_BRACKET_TRIM_START, PARSING_CONSTANTS.ARRAY_BRACKET_TRIM_END)
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''));
      } else if (!isNaN(Number(value))) {
        result[key] = Number(value);
      } else {
        result[key] = value.replace(/['"]/g, '');
      }
    });

    return result;
  }

  private removeMarkdownFrontmatter(content: string): string {
    const lines = content.split('\n');
    if (lines[PARSING_CONSTANTS.FRONTMATTER_START_INDEX] !== '---') return content;

    const endIndex = lines.findIndex((line, index) => index > PARSING_CONSTANTS.FRONTMATTER_SEARCH_START && line === '---');
    if (endIndex === -1) return content;

    return lines
      .slice(endIndex + PARSING_CONSTANTS.FRONTMATTER_NEXT_LINE_OFFSET)
      .join('\n')
      .trim();
  }

  private extractNoteExcerpt(content: string, maxLength = CONTENT_LIMITS.NOTE_EXCERPT_MAX_LENGTH): string {
    const cleanContent = content
      .replace(/^#+\s+.*$/gm, '')
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    return cleanContent.length > maxLength ? cleanContent.substring(0, maxLength) + '...' : cleanContent;
  }

  private async generateMoodInsights(history: MoodHistoryEntry[]): Promise<string> {
    const historyText = this.formatHistoryForAI(history);

    const systemPrompt = `You are a mood analysis expert. Analyze the user's mood data and provide helpful insights. Focus on:
1. Patterns and trends in mood and energy
2. Correlations between mood, energy, and activities/tags
3. Practical suggestions for wellbeing
4. Gentle observations (avoid medical advice)

Be concise, empathetic, and actionable.`;

    const userPrompt = `Analyze my mood data from the past ${history.length} days:

${historyText}

Please provide insights about patterns, trends, and suggestions for maintaining good mental health.`;

    return await chat({
      apiKey: this.settings.aiApiKey,
      model: this.settings.aiModel,
      systemPrompt,
      userText: userPrompt,
      maxTokens: this.settings.aiMaxTokens,
      debug: this.settings.aiDebug,
      retryCount: this.settings.aiRetryCount,
      fallbackModel: this.settings.aiFallbackModel,
    });
  }

  private formatHistoryForAI(history: MoodHistoryEntry[]): string {
    return history
      .map(entry => {
        const parts = [`Date: ${entry.date}`];

        if (entry.mood) parts.push(`Mood: ${entry.mood}`);
        if (entry.moodLevel) parts.push(`Level: ${entry.moodLevel}/${MOOD_LIMITS.MAX_MOOD_LEVEL}`);
        if (entry.energy) parts.push(`Energy: ${entry.energy}/${MOOD_LIMITS.MAX_ENERGY_LEVEL}`);
        if (entry.tags && entry.tags.length > 0) parts.push(`Tags: ${entry.tags.join(', ')}`);
        if (entry.note) parts.push(`Note: ${entry.note}`);

        return parts.join(' | ');
      })
      .join('\n');
  }

  private extractMeaningfulContent(noteText: string): string {
    const contentWithoutFrontmatter = this.removeMarkdownFrontmatter(noteText);

    const cleanedContent = contentWithoutFrontmatter
      .replace(/^---[\s\S]*?^---/gm, '')
      .replace(/^#+\s+.*$/gm, '')
      .replace(/^\s*[-*+]\s*(?=\s*$)/gm, '')
      .replace(/^\s*\d+\.\s*(?=\s*$)/gm, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedContent.length > CONTENT_LIMITS.MIN_MEANINGFUL_CONTENT ? cleanedContent : '';
  }
}
