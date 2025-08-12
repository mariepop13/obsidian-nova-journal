import { TFile } from 'obsidian';
import type { NovaJournalSettings } from '../settings/PluginSettings';

export interface MoodData {
  mood?: string;
  moodLevel?: number;
  energy?: number;
  tags?: string[];
}

export interface FrontmatterData {
  [key: string]: any;
  mood?: string;
  mood_level?: number;
  energy?: number;
  tags?: string[];
}

export class MoodTrackingService {
  constructor(private readonly settings: NovaJournalSettings) {}

  isEnabled(): boolean {
    return this.settings.moodTrackingEnabled;
  }

  isRequired(): boolean {
    return this.settings.moodPromptRequired;
  }

  getDefaultEmojis(): string[] {
    return this.settings.moodDefaultEmojis;
  }

  getCustomTags(): string[] {
    return this.settings.customMoodTags;
  }

  validateMoodData(data: MoodData): boolean {
    if (this.isRequired() && !data.mood) {
      return false;
    }

    if (data.moodLevel !== undefined && (data.moodLevel < 1 || data.moodLevel > 10)) {
      return false;
    }

    if (data.energy !== undefined && (data.energy < 1 || data.energy > 10)) {
      return false;
    }

    return true;
  }

  convertToFrontmatter(moodData: MoodData): FrontmatterData {
    const frontmatter: FrontmatterData = {};

    if (moodData.mood) {
      frontmatter.mood = moodData.mood;
    }

    if (moodData.moodLevel !== undefined) {
      frontmatter.mood_level = moodData.moodLevel;
    }

    if (this.settings.energyTrackingEnabled && moodData.energy !== undefined) {
      frontmatter.energy = moodData.energy;
    }

    if (moodData.tags && moodData.tags.length > 0) {
      frontmatter.tags = moodData.tags;
    }

    return frontmatter;
  }

  async addMoodToFile(file: TFile, vault: any, moodData: MoodData): Promise<void> {
    if (!this.validateMoodData(moodData)) {
      throw new Error('Invalid mood data');
    }

    const content = await vault.read(file);
    const frontmatterData = this.convertToFrontmatter(moodData);
    const updatedContent = this.ensureFrontmatterAtTop(content, frontmatterData);
    
    await vault.modify(file, updatedContent);
  }

  private ensureFrontmatterAtTop(content: string, newData: FrontmatterData): string {
    const existingData = this.extractAndRemoveFrontmatter(content);
    const mergedData = { ...existingData.frontmatter, ...newData };
    const newFrontmatter = this.serializeFrontmatter(mergedData);
    const cleanContent = existingData.content.replace(/^\s*\n/, '');
    
    return [
      '---',
      newFrontmatter,
      '---',
      '',
      cleanContent
    ].join('\n');
  }

  private extractAndRemoveFrontmatter(content: string): { frontmatter: FrontmatterData; content: string } {
    const lines = content.split('\n');
    let frontmatter: FrontmatterData = {};
    let contentStartIndex = 0;
    
    if (lines[0] === '---') {
      const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
      
      if (endIndex !== -1) {
        const frontmatterYaml = lines.slice(1, endIndex).join('\n');
        frontmatter = this.mergeFrontmatterData(frontmatterYaml, {});
        contentStartIndex = endIndex + 1;
      }
    }
    
    const contentLines = lines.slice(contentStartIndex);
    return {
      frontmatter,
      content: contentLines.join('\n')
    };
  }



  private mergeFrontmatterData(existingYaml: string, newData: FrontmatterData): FrontmatterData {
    const existing: FrontmatterData = {};
    
    existingYaml.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex !== -1) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();
          
          if (value.startsWith('[') && value.endsWith(']')) {
            existing[key] = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
          } else {
            existing[key] = value.replace(/['"]/g, '');
          }
        }
      }
    });

    return { ...existing, ...newData };
  }

  private serializeFrontmatter(data: FrontmatterData): string {
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}
