import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EnhancedEmbeddingService, type SearchOptions } from './EnhancedEmbeddingService';


export interface ContextualPromptOptions {
  prioritizeRecent?: boolean;
  includeEmotionalContext?: boolean;
  includeThematicContext?: boolean;
  maxContextChunks?: number;
  diversityThreshold?: number;
}

export interface PromptWithRagConfig {
  style: PromptStyle;
  noteText: string;
  mood?: Partial<MoodData>;
  ragContext?: string;
  options?: ContextualPromptOptions;
}

export interface ThematicPromptConfig {
  style: PromptStyle;
  noteText: string;
  themes: string[];
  timeFrame?: 'recent' | 'week' | 'month';
}

export interface ContextGatheringConfig {
  noteText: string;
  mood: Partial<MoodData> | undefined;
  maxChunks: number;
  options: {
    prioritizeRecent: boolean;
    includeEmotionalContext: boolean;
    includeThematicContext: boolean;
    diversityThreshold: number;
  };
}

export interface SearchPerformanceConfig {
  embeddingService: EnhancedEmbeddingService;
  searchText: string;
  maxChunks: number;
  searchOptions: SearchOptions;
}

export interface UserPromptConfig {
  style: PromptStyle;
  noteText: string;
  mood: Partial<MoodData> | undefined;
  contextualInfo: string;
}

export class EnhancedPromptGenerationService {
  private embeddingService?: EnhancedEmbeddingService;

  constructor(private readonly settings: NovaJournalSettings) {}

  private getEmbeddingService(): EnhancedEmbeddingService | null {
    if (!this.embeddingService) {
      const appRef = (window as any)?.app;

      if (appRef) {
        try {
          this.embeddingService = new EnhancedEmbeddingService(appRef, this.settings);
        } catch (error) {
          return null;
        }
      }
    }
    return this.embeddingService || null;
  }

  async generateContextualPromptWithRag(config: PromptWithRagConfig): Promise<string | null> {
    const { style, noteText, mood, ragContext, options = {} } = config;
    
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const systemPrompt = this.buildSystemPrompt(style, true, true);
    const contextualInfo = ragContext || '';

    const userPrompt = this.buildUserPrompt({ style, noteText, mood, contextualInfo });

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(80, this.settings.aiMaxTokens ?? 80),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const cleaned = response.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
  }

  async generateContextualPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>,
    options: ContextualPromptOptions = {}
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const {
      prioritizeRecent = true,
      includeEmotionalContext = true,
      includeThematicContext = true,
      maxContextChunks = 5,
      diversityThreshold = 0.3,
    } = options;

    const systemPrompt = this.buildSystemPrompt(style, includeEmotionalContext, includeThematicContext);

    let contextualInfo = '';
    try {
      contextualInfo = await this.gatherContextualInformation({
        noteText,
        mood,
        maxChunks: maxContextChunks,
        options: {
          prioritizeRecent,
          includeEmotionalContext,
          includeThematicContext,
          diversityThreshold,
        },
      });
    } catch (err) {
    }

    const userPrompt = this.buildUserPrompt({ style, noteText, mood, contextualInfo });

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(80, this.settings.aiMaxTokens ?? 80),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const raw = response;
      const cleaned = raw.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
  }

  async generateEmotionallyAwarePrompt(
    style: PromptStyle,
    noteText: string,
    mood: Partial<MoodData>
  ): Promise<string | null> {
    const embeddingService = this.getEmbeddingService();
    if (!embeddingService) return this.generateContextualPrompt(style, noteText, mood);

    try {
      const emotionalContext = await embeddingService.emotionalSearch(noteText, mood, 3);

      const systemPrompt = `Generate ONE emotionally sensitive journaling question based on the current note content and emotional context. 

EMOTIONAL AWARENESS RULES:
- Consider the user's current emotional state: ${mood.sentiment ?? 'unknown'}
- Be empathetic to emotions: ${mood.dominant_emotions?.join(', ') ?? 'none specified'}
- Adjust tone accordingly: supportive for negative emotions, celebratory for positive ones
- Reference emotional patterns from past entries when relevant

OUTPUT: Only the question text (no quotes/labels), max 30 words.

Style guidance:
- reflective: gentle self-inquiry considering emotional state
- gratitude: find appreciation even in difficult emotions  
- planning: practical next steps honoring current feelings
- dreams: explore emotional themes in dreams/aspirations`;

      const contextText =
        emotionalContext.length > 0
          ? `\n\nEmotional context from past entries:\n${emotionalContext.map((c, i) => `${i + 1}. ${c.text.substring(0, 300)}...`).join('\n')}`
          : '';

      const userPrompt = `Style: ${style}
Current emotional state: ${JSON.stringify(mood)}
Current note: ${noteText ?? '(empty)'}${contextText}

Generate an emotionally aware question that acknowledges the user's feelings while encouraging healthy reflection.`;

      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(80, this.settings.aiMaxTokens ?? 80),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const raw = response;
      const cleaned = raw.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      return this.generateContextualPrompt(style, noteText, mood);
    }
  }

  async generateThematicPrompt(config: ThematicPromptConfig): Promise<string | null> {
    const { style, noteText, themes, timeFrame = 'week' } = config;
    
    const embeddingService = this.getEmbeddingService();
    if (!embeddingService) return this.generateContextualPrompt(style, noteText);

    try {
      const thematicContext = await embeddingService.thematicSearch(noteText, themes, 4);
      const temporalContext = await embeddingService.temporalSearch(noteText, timeFrame, 2);

      const allContext = [...thematicContext, ...temporalContext];

      const systemPrompt = `Generate ONE thematic journaling question focusing on specific life areas and recent patterns.

THEMATIC FOCUS RULES:
- Center the question around these themes: ${themes.join(', ')}
- Reference patterns and evolution in these areas from past entries
- Ask about growth, challenges, or insights within these themes
- Use specific details from the context when relevant

Time frame: Focus on ${timeFrame === 'recent' ? 'the last few days' : timeFrame === 'week' ? 'this week' : 'this month'}

OUTPUT: Only the question text (no quotes/labels), max 35 words.

Style guidance:
- reflective: deep inquiry into thematic patterns
- gratitude: appreciation within these life areas
- planning: actionable steps for these themes
- dreams: aspirations related to these themes`;

      const contextText =
        allContext.length > 0
          ? `\n\nThematic and temporal context:\n${allContext.map((c, i) => `${i + 1}. ${c.text.substring(0, 250)}...`).join('\n')}`
          : '';

      const userPrompt = `Style: ${style}
Target themes: ${themes.join(', ')}
Time frame: ${timeFrame}
Current note: ${noteText ?? '(empty)'}${contextText}

Generate a thematically focused question that explores patterns and development in these life areas.`;

      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(90, this.settings.aiMaxTokens ?? 90),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const raw = response;
      const cleaned = raw.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      return this.generateContextualPrompt(style, noteText);
    }
  }

  private async gatherContextualInformation(config: ContextGatheringConfig): Promise<string> {
    const { noteText, mood, maxChunks, options } = config;
    
    const embeddingService = this.validateEmbeddingService();
    if (!embeddingService) return '';

    const searchText = this.validateSearchText(noteText);
    if (!searchText) return '';

    const searchOptions = this.buildSearchOptions(options, mood);
    return this.performContextualSearch({ embeddingService, searchText, maxChunks, searchOptions });
  }

  private validateEmbeddingService(): EnhancedEmbeddingService | null {
    const embeddingService = this.getEmbeddingService();
    return embeddingService;
  }

  private validateSearchText(noteText: string): string | null {
    const searchText = noteText?.trim();
    if (!searchText || searchText.length === 0) {
      return null;
    }
    return searchText;
  }

  private buildSearchOptions(options: Record<string, any>, mood: Partial<MoodData> | undefined): SearchOptions {
    const searchOptions: SearchOptions = {
      boostRecent: options.prioritizeRecent,
      diversityThreshold: options.diversityThreshold,
    };

    if (options.includeEmotionalContext && mood?.dominant_emotions) {
      searchOptions.emotionalFilter = mood.dominant_emotions;
    }

    if (options.includeThematicContext && mood?.tags) {
      searchOptions.thematicFilter = mood.tags;
    }

    return searchOptions;
  }

  private async performContextualSearch(config: SearchPerformanceConfig): Promise<string> {
    const { embeddingService, searchText, maxChunks, searchOptions } = config;
    
    try {
      const contextChunks = await embeddingService.contextualSearch(searchText, maxChunks, searchOptions);

      if (contextChunks.length === 0) {
        return '';
      }

      return this.enrichContextChunks(contextChunks);
    } catch (error) {
      return '';
    }
  }

  private enrichContextChunks(contextChunks: any[]): string {
    const enrichedContext = contextChunks
      .map((chunk, i) => {
        const preview = chunk.text.substring(0, 350);
        const contextInfo = this.buildChunkMetadata(chunk);
        const metadata = contextInfo.length > 0 ? ` (${contextInfo.join('; ')})` : '';
        return `${i + 1}. ${preview}...${metadata}`;
      })
      .join('\n');

    return `\n\nContextual information from your recent entries:\n${enrichedContext}`;
  }

  private buildChunkMetadata(chunk: any): string[] {
    const contextInfo = [];

    if (chunk.contextType !== 'general') {
      contextInfo.push(`[${chunk.contextType}]`);
    }

    if (chunk.emotionalTags && chunk.emotionalTags.length > 0) {
      contextInfo.push(`emotions: ${chunk.emotionalTags.join(', ')}`);
    }

    if (chunk.thematicTags && chunk.thematicTags.length > 0) {
      contextInfo.push(`themes: ${chunk.thematicTags.join(', ')}`);
    }

    return contextInfo;
  }

  private buildSystemPrompt(_style: PromptStyle, includeEmotional: boolean, includeThematic: boolean): string {
    const basePrompt = `Generate ONE contextually aware journaling question based on the current note content and provided context, in the user's language.

CRITICAL RULES:
- Output ONLY the question text (no quotes/labels)
- One sentence, concise (<= 30 words)
- Use EXACT details from the contextual information when relevant
- Reference specific people, events, or patterns from past entries
- Use real temporal references from the context
- DO NOT invent connections not present in the context
- DO NOT assume feelings or situations not explicitly stated`;

    const emotionalGuidance = includeEmotional
      ? `\n- Consider emotional patterns and evolution from past entries
- Be sensitive to emotional context when crafting the question`
      : '';

    const thematicGuidance = includeThematic
      ? `\n- Explore thematic connections and development over time
- Reference recurring themes and topics from the context`
      : '';

    const styleGuidance = `\n\nStyle-specific approach:
- reflective: deep self-inquiry using contextual patterns
- gratitude: appreciation based on past and current experiences
- planning: next steps informed by historical context
- dreams: exploration connecting past aspirations with current state`;

    return basePrompt + emotionalGuidance + thematicGuidance + styleGuidance;
  }

  private buildUserPrompt(config: UserPromptConfig): string {
    const { style, noteText, mood, contextualInfo } = config;
    
    const moodFragment = mood ? `\n\nCurrent mood/emotional state:\n${JSON.stringify(mood)}` : '';

    return `Style: ${style}

Current note content:
${noteText ?? '(empty)'}${moodFragment}${contextualInfo}

Generate a contextually informed question that:
1. References specific facts, people, or patterns from the contextual information
2. Asks about evolution, change, or development based on past entries
3. Uses temporal markers and emotional context appropriately
4. Encourages meaningful reflection building on established patterns
5. Stays factual and avoids emotional assumptions not supported by context`;
  }
}
