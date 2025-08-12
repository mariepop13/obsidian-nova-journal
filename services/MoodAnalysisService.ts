import { TFile, Notice } from 'obsidian';
import { chat } from '../ai/AiClient';
import type { NovaJournalSettings } from '../settings/PluginSettings';
import type { FrontmatterData } from './MoodTrackingService';

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
    private readonly app: any
  ) {}

  async analyzeMoodData(daysBack: number = 7): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
      new Notice('AI must be enabled for mood analysis.');
      return null;
    }

    try {
      const moodHistory = await this.collectMoodHistory(daysBack);
      
      if (moodHistory.length === 0) {
        new Notice('No mood data found for analysis.');
        return null;
      }

      const analysis = await this.generateMoodInsights(moodHistory);
      return analysis;
    } catch (error) {
      console.error('Mood analysis failed:', error);
      new Notice('Mood analysis failed. Check console for details.');
      return null;
    }
  }

  private async collectMoodHistory(daysBack: number): Promise<MoodHistoryEntry[]> {
    const history: MoodHistoryEntry[] = [];
    const files = this.app.vault.getMarkdownFiles();
    
    const today = new Date();
    const cutoffDate = new Date(today.getTime() - (daysBack * 24 * 60 * 60 * 1000));

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
            note: noteExcerpt
          });
        }
      } catch (error) {
        console.warn(`Failed to process file ${file.name}:`, error);
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
    if (lines[0] !== '---') return {};

    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex === -1) return {};

    const frontmatterText = lines.slice(1, endIndex).join('\n');
    const result: FrontmatterData = {};

    frontmatterText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) return;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
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
    if (lines[0] !== '---') return content;

    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex === -1) return content;

    return lines.slice(endIndex + 1).join('\n').trim();
  }

  private extractNoteExcerpt(content: string, maxLength: number = 200): string {
    const cleanContent = content
      .replace(/^#+\s+.*$/gm, '')
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    return cleanContent.length > maxLength 
      ? cleanContent.substring(0, maxLength) + '...'
      : cleanContent;
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
    return history.map(entry => {
      const parts = [`Date: ${entry.date}`];
      
      if (entry.mood) parts.push(`Mood: ${entry.mood}`);
      if (entry.moodLevel) parts.push(`Level: ${entry.moodLevel}/10`);
      if (entry.energy) parts.push(`Energy: ${entry.energy}/10`);
      if (entry.tags && entry.tags.length > 0) parts.push(`Tags: ${entry.tags.join(', ')}`);
      if (entry.note) parts.push(`Note: ${entry.note}`);
      
      return parts.join(' | ');
    }).join('\n');
  }
}
