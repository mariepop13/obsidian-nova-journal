import { App } from 'obsidian';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EnhancedEmbeddingService, type EnhancedIndexedChunk, type SearchOptions } from './EnhancedEmbeddingService';
import {
  CONTEXT_LIMITS,
  SEARCH_CONSTANTS,
  EMBEDDING_CONFIG,
  TOKEN_LIMITS,
  CONTENT_LIMITS,
} from '../shared/Constants';

interface WindowWithObsidianApp extends Window {
  app?: App;
}


export interface ContextualPromptOptions {
  prioritizeRecent?: boolean;
  includeEmotionalContext?: boolean;
  includeThematicContext?: boolean;
  maxContextChunks?: number;
  diversityThreshold?: number;
}

interface ContextualSearchOptions {
  prioritizeRecent: boolean;
  includeEmotionalContext: boolean;
  includeThematicContext: boolean;
  diversityThreshold: number;
}

interface ContextConfig {
  mood?: Partial<MoodData>;
  maxContextChunks: number;
  options: ContextualSearchOptions;
}

interface EmotionalPromptData {
  style: PromptStyle;
  noteText: string;
  mood: Partial<MoodData>;
}

interface ThematicSearchParams {
  noteText: string;
  themes: string[];
  timeFrame: 'recent' | 'week' | 'month';
}

interface ThematicPromptData {
  style: PromptStyle;
  themes: string[];
  timeFrame: string;
  noteText: string;
}

export class EnhancedPromptGenerationService {
  private embeddingService?: EnhancedEmbeddingService;

  constructor(private readonly settings: NovaJournalSettings) {}

  private getEmbeddingService(): EnhancedEmbeddingService | null {
    console.log(
      '[EnhancedPromptGenerationService] Debug - Getting embedding service, current instance:',
      !!this.embeddingService
    );

    if (this.embeddingService) {
      return this.embeddingService;
    }

    return this.createEmbeddingService();
  }

  private createEmbeddingService(): EnhancedEmbeddingService | null {
    const appRef = (window as WindowWithObsidianApp)?.app;
    console.log('[EnhancedPromptGenerationService] Debug - App reference available:', !!appRef);

    if (!appRef) {
      console.warn('[EnhancedPromptGenerationService] Debug - No app reference found for embedding service');
      return null;
    }

    try {
      this.embeddingService = new EnhancedEmbeddingService(appRef, this.settings);
      console.log('[EnhancedPromptGenerationService] Debug - EnhancedEmbeddingService created successfully');
      return this.embeddingService;
    } catch (error) {
      console.error('[EnhancedPromptGenerationService] Debug - Failed to create EnhancedEmbeddingService:', error);
      return null;
    }
  }

  async generateContextualPromptWithRag(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>,
    ragContext?: string,
    _options: ContextualPromptOptions = {}
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const systemPrompt = this.buildSystemPrompt(style, true, true);
    const contextualInfo = ragContext ?? '';

    const userPrompt = this.buildUserPrompt(style, noteText, mood, contextualInfo);

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS, this.settings.aiMaxTokens ?? TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS),
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

  private async safelyGatherContext(
    noteText: string,
    contextConfig: ContextConfig
  ): Promise<string> {
    try {
      return await this.gatherContextualInformation(
        noteText, 
        contextConfig.mood, 
        contextConfig.maxContextChunks, 
        contextConfig.options
      );
    } catch (err) {
      console.error('[EnhancedPromptGenerationService] Context gathering failed', err);
      return '';
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
      maxContextChunks = CONTEXT_LIMITS.DEFAULT_MAX_CHUNKS,
      diversityThreshold = SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_DEFAULT,
    } = options;

    const systemPrompt = this.buildSystemPrompt(style, includeEmotionalContext, includeThematicContext);
    
    const contextualInfo = await this.safelyGatherContext(noteText, {
      mood,
      maxContextChunks,
      options: {
        prioritizeRecent,
        includeEmotionalContext,
        includeThematicContext,
        diversityThreshold,
      },
    });

    const userPrompt = this.buildUserPrompt(style, noteText, mood, contextualInfo);

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS, this.settings.aiMaxTokens ?? TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS),
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

  private createEmotionalSystemPrompt(mood: Partial<MoodData>): string {
    return `Generate ONE emotionally sensitive journaling question based on the current note content and emotional context. 

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
  }

  private createEmotionalUserPrompt(
    promptData: EmotionalPromptData,
    context: EnhancedIndexedChunk[]
  ): string {
    const contextText = context.length > 0
      ? `\n\nEmotional context from past entries:\n${context.map((c, i) => `${i + 1}. ${c.text.substring(0, CONTENT_LIMITS.MAX_CONTENT_DISPLAY)}...`).join('\n')}`
      : '';

    return `Style: ${promptData.style}
Current emotional state: ${JSON.stringify(promptData.mood)}
Current note: ${promptData.noteText ?? '(empty)'}${contextText}

Generate an emotionally aware question that acknowledges the user's feelings while encouraging healthy reflection.`;
  }

  async generateEmotionallyAwarePrompt(
    style: PromptStyle,
    noteText: string,
    mood: Partial<MoodData>
  ): Promise<string | null> {
    const embeddingService = this.getEmbeddingService();
    if (!embeddingService) return this.generateContextualPrompt(style, noteText, mood);

    try {
      const emotionalContext = await embeddingService.emotionalSearch(noteText, mood, EMBEDDING_CONFIG.EMOTIONAL_SEARCH_K);
      const systemPrompt = this.createEmotionalSystemPrompt(mood);
      const userPrompt = this.createEmotionalUserPrompt({ style, noteText, mood }, emotionalContext);

      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS, this.settings.aiMaxTokens ?? TOKEN_LIMITS.CONTEXTUAL_PROMPT_MAX_TOKENS),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const cleaned = response.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      console.error('[EnhancedPromptGenerationService] Emotional prompt generation failed', error);
      return this.generateContextualPrompt(style, noteText, mood);
    }
  }

  private async gatherThematicContext(
    embeddingService: EnhancedEmbeddingService,
    searchParams: ThematicSearchParams
  ): Promise<EnhancedIndexedChunk[]> {
    const thematicContext = await embeddingService.thematicSearch(searchParams.noteText, searchParams.themes, EMBEDDING_CONFIG.THEMATIC_SEARCH_K);
    const temporalContext = await embeddingService.temporalSearch(searchParams.noteText, searchParams.timeFrame, EMBEDDING_CONFIG.TEMPORAL_SEARCH_K);
    return [...thematicContext, ...temporalContext];
  }

  private createThematicSystemPrompt(themes: string[], timeFrame: string): string {
    const timeFrameText = timeFrame === 'recent' ? 'the last few days' : 
                         timeFrame === 'week' ? 'this week' : 'this month';

    return `Generate ONE thematic journaling question focusing on specific life areas and recent patterns.

THEMATIC FOCUS RULES:
- Center the question around these themes: ${themes.join(', ')}
- Reference patterns and evolution in these areas from past entries
- Ask about growth, challenges, or insights within these themes
- Use specific details from the context when relevant

Time frame: Focus on ${timeFrameText}

OUTPUT: Only the question text (no quotes/labels), max 35 words.

Style guidance:
- reflective: deep inquiry into thematic patterns
- gratitude: appreciation within these life areas
- planning: actionable steps for these themes
- dreams: aspirations related to these themes`;
  }

  private createThematicUserPrompt(
    thematicData: ThematicPromptData,
    context: EnhancedIndexedChunk[]
  ): string {
    const contextText = context.length > 0
      ? `\n\nThematic and temporal context:\n${context.map((c, i) => `${i + 1}. ${c.text.substring(0, CONTENT_LIMITS.MAX_CONTENT_PREVIEW)}...`).join('\n')}`
      : '';

    return `Style: ${thematicData.style}
Target themes: ${thematicData.themes.join(', ')}
Time frame: ${thematicData.timeFrame}
Current note: ${thematicData.noteText ?? '(empty)'}${contextText}

Generate a thematically focused question that explores patterns and development in these life areas.`;
  }

  async generateThematicPrompt(
    style: PromptStyle,
    noteText: string,
    themes: string[],
    timeFrame: 'recent' | 'week' | 'month' = 'week'
  ): Promise<string | null> {
    const embeddingService = this.getEmbeddingService();
    if (!embeddingService) return this.generateContextualPrompt(style, noteText);

    try {
      const context = await this.gatherThematicContext(embeddingService, { noteText, themes, timeFrame });
      const systemPrompt = this.createThematicSystemPrompt(themes, timeFrame);
      const userPrompt = this.createThematicUserPrompt({ style, themes, timeFrame, noteText }, context);

      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(TOKEN_LIMITS.THEMATIC_PROMPT_MAX_TOKENS, this.settings.aiMaxTokens ?? TOKEN_LIMITS.THEMATIC_PROMPT_MAX_TOKENS),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const cleaned = response.trim().replace(/^"|"$/g, '').trim();
      return cleaned.length > 0 ? cleaned : null;
    } catch (error) {
      console.error('[EnhancedPromptGenerationService] Thematic prompt generation failed', error);
      return this.generateContextualPrompt(style, noteText);
    }
  }

  private async gatherContextualInformation(
    noteText: string,
    mood: Partial<MoodData> | undefined,
    maxChunks: number,
    options: {
      prioritizeRecent: boolean;
      includeEmotionalContext: boolean;
      includeThematicContext: boolean;
      diversityThreshold: number;
    }
  ): Promise<string> {
    const embeddingService = this.validateEmbeddingService();
    if (!embeddingService) return '';

    const searchText = this.validateSearchText(noteText);
    if (!searchText) return '';

    const searchOptions = this.buildSearchOptions(options, mood);
    return this.performContextualSearch(embeddingService, searchText, maxChunks, searchOptions);
  }

  private validateEmbeddingService(): EnhancedEmbeddingService | null {
    console.log('[EnhancedPromptGenerationService] Debug - Getting embedding service...');
    const embeddingService = this.getEmbeddingService();
    if (!embeddingService) {
      console.log('[EnhancedPromptGenerationService] Debug - No embedding service available');
    }
    return embeddingService;
  }

  private validateSearchText(noteText: string): string | null {
    const searchText = noteText?.trim();
    if (!searchText || searchText.length === 0) {
      console.log('[EnhancedPromptGenerationService] Debug - No search text available');
      return null;
    }
    console.log('[EnhancedPromptGenerationService] Debug - Search text length:', searchText.length);
    return searchText;
  }

  private buildSearchOptions(options: ContextualPromptOptions, mood: Partial<MoodData> | undefined): SearchOptions {
    console.log('[EnhancedPromptGenerationService] Debug - Search options:', options);
    
    const searchOptions: SearchOptions = {
      boostRecent: options.prioritizeRecent,
      diversityThreshold: options.diversityThreshold,
    };

    if (options.includeEmotionalContext && mood?.dominant_emotions) {
      searchOptions.emotionalFilter = mood.dominant_emotions;
      console.log('[EnhancedPromptGenerationService] Debug - Added emotional filter:', mood.dominant_emotions);
    }

    if (options.includeThematicContext && mood?.tags) {
      searchOptions.thematicFilter = mood.tags;
      console.log('[EnhancedPromptGenerationService] Debug - Added thematic filter:', mood.tags);
    }

    return searchOptions;
  }

  private async performContextualSearch(embeddingService: EnhancedEmbeddingService, searchText: string, maxChunks: number, searchOptions: SearchOptions): Promise<string> {
    try {
      console.log('[EnhancedPromptGenerationService] Debug - Performing contextual search...');
      const contextChunks = await embeddingService.contextualSearch(searchText, maxChunks, searchOptions);

      console.log('[EnhancedPromptGenerationService] Debug - Found context chunks:', contextChunks.length);

      if (contextChunks.length === 0) {
        console.log('[EnhancedPromptGenerationService] Debug - No context chunks found');
        return '';
      }

      return this.enrichContextChunks(contextChunks);
    } catch (error) {
      console.error('[EnhancedPromptGenerationService] Failed to gather contextual information', error);
      return '';
    }
  }

  private enrichContextChunks(contextChunks: EnhancedIndexedChunk[]): string {
    const enrichedContext = contextChunks
      .map((chunk, i) => {
        const preview = chunk.text.substring(0, CONTENT_LIMITS.CHUNK_PREVIEW_MAX);
        const contextInfo = this.buildChunkMetadata(chunk);
        const metadata = contextInfo.length > 0 ? ` (${contextInfo.join('; ')})` : '';
        return `${i + 1}. ${preview}...${metadata}`;
      })
      .join('\n');

    console.log(
      '[EnhancedPromptGenerationService] Debug - Enriched context preview:',
      enrichedContext.substring(0, CONTENT_LIMITS.MAX_CONTENT_DISPLAY)
    );
    return `\n\nContextual information from your recent entries:\n${enrichedContext}`;
  }

  private buildChunkMetadata(chunk: EnhancedIndexedChunk): string[] {
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

  private buildUserPrompt(
    style: PromptStyle,
    noteText: string,
    mood: Partial<MoodData> | undefined,
    contextualInfo: string
  ): string {
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
