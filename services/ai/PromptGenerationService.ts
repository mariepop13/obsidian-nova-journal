import { App } from 'obsidian';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EmbeddingService } from './EmbeddingService';
import type { IndexedChunk } from './EmbeddingService';
import { EnhancedPromptGenerationService } from './EnhancedPromptGenerationService';

interface WindowWithObsidianApp extends Window {
  app?: App;
}

import {
  SEARCH_CONSTANTS,
  CONTENT_LIMITS,
  TOKEN_LIMITS,
  EMBEDDING_CONFIG,
} from '../shared/Constants';

export class PromptGenerationService {
  private enhancedService: EnhancedPromptGenerationService | null = null;

  constructor(private readonly settings: NovaJournalSettings) {
    try {
      this.enhancedService = new EnhancedPromptGenerationService(settings);
    } catch (error) {
      this.enhancedService = null;
    }
  }

  async generateOpeningPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>,
    ragContext?: string
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    try {
      if (this.enhancedService) {
        if (mood?.dominant_emotions && mood.dominant_emotions.length > SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
          return await this.enhancedService.generateEmotionallyAwarePrompt(style, noteText, mood);
        }

        if (mood?.tags && mood.tags.length > SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
          return await this.enhancedService.generateThematicPrompt(style, noteText, mood.tags);
        }

        if (ragContext && ragContext.trim().length > SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
          return await this.enhancedService.generateContextualPromptWithRag(style, noteText, mood, ragContext, {
            prioritizeRecent: true,
            includeEmotionalContext: true,
            includeThematicContext: true,
            maxContextChunks: EMBEDDING_CONFIG.TOP_K_DEFAULT,
          });
        }
        return await this.enhancedService.generateContextualPrompt(style, noteText, mood, {
          prioritizeRecent: true,
          includeEmotionalContext: true,
          includeThematicContext: true,
          maxContextChunks: EMBEDDING_CONFIG.TOP_K_DEFAULT,
        });
      }
      return this.generateLegacyPrompt(style, noteText, mood, ragContext);
    } catch (error) {
      return this.generateLegacyPrompt(style, noteText, mood, ragContext);
    }
  }

  private async generateLegacyPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>,
    providedRagContext?: string
  ): Promise<string | null> {
    const systemPrompt = this.createSystemPrompt();
    const ragContext = await this.getRagContext(noteText, providedRagContext);
    const userPrompt = this.buildUserPrompt(style, noteText, mood, ragContext);
    

    return this.callAIService(systemPrompt, userPrompt);
  }

  private createSystemPrompt(): string {
    return `Generate ONE simple journaling question in the SAME LANGUAGE as the context provided.

CRITICAL RULES:
- Output ONLY the question text (no quotes/labels).
- One sentence, concise (<= ${TOKEN_LIMITS.PROMPT_MAX_WORDS} words).
- ONLY reference EXACT details, people, events explicitly mentioned in the RAG context.
- If no specific details exist in context, ask a general question without invented references.
- DO NOT invent dates, years, people, or events not present in the context.
- DO NOT assume connections, emotions, or situations not explicitly stated.

Language rule:
- If context is in French, respond in French
- If context is in English, respond in English
- Match the language of the provided notes

What TO do:
- Reference ONLY specific people, events, or facts directly mentioned in the provided context
- Use only temporal markers actually present in the context
- Ask about evolution or change only if context shows previous states
- Stay strictly factual to the provided information

What NOT to do:
- NEVER invent dates, years, or time periods (like "2022", "last year", etc.)
- NEVER assume emotions, stress, or feelings not mentioned
- NEVER create fictional connections or relationships
- NEVER reference events not in the provided context

Styles:
- reflective: simple self-inquiry about the current topic
- gratitude: focus on appreciation related to current topic
- planning: next steps for current situation
- dreams: exploration of current dream content`;
  }

  private async getRagContext(noteText: string, providedRagContext?: string): Promise<string> {
    if (providedRagContext && providedRagContext.trim().length > SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
      const ragContext = `\n\nPrevious journal entries context:\n${providedRagContext}`;

      return ragContext;
    }
    
    return this.fetchRagContext(noteText);
  }

  private async fetchRagContext(noteText: string): Promise<string> {
    try {
      if (!noteText || noteText.trim().length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) {

        return '';
      }

      const appRef = (window as WindowWithObsidianApp)?.app;
      if (!appRef) {

        return '';
      }

      const embeddingService = new EmbeddingService(appRef, this.settings);
      const top = await embeddingService.topK(noteText, EMBEDDING_CONFIG.TOP_K_DEFAULT);

      
      if (!Array.isArray(top) || top.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) {

        return '';
      }

      return this.buildRagContextFromResults(top);
    } catch (_err) {
      return '';
    }
  }

  private buildRagContextFromResults(top: IndexedChunk[]): string {
    const enriched = top
      .map((t, i) => {
        const preview = (t.text ?? '').substring(SEARCH_CONSTANTS.MIN_RESULT_INDEX, CONTENT_LIMITS.MAX_CONTENT_DISPLAY);
        return `${i + 1}. ${preview}...`;
      })
      .join('\n');
    
    const ragContext = `\n\nPrevious journal entries context:\n${enriched}`;

    return ragContext;
  }

  private buildUserPrompt(style: PromptStyle, noteText: string, mood?: Partial<MoodData>, ragContext?: string): string {
    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    return `Style: ${style}\n\nCurrent note content:\n${noteText ?? '(empty)'}${moodFragment}${ragContext ?? ''}

Generate a question that:
1. Uses the same language as the provided context
2. ONLY references details explicitly present in the context above
3. If no context exists, ask a general question without invented details
4. NEVER invent dates, years, people, or events not mentioned
5. Be factual and avoid assumptions about past states or emotions`;
  }

  private async callAIService(systemPrompt: string, userPrompt: string): Promise<string | null> {
    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(TOKEN_LIMITS.PROMPT_MAX_TOKENS, this.settings.aiMaxTokens ?? TOKEN_LIMITS.PROMPT_MAX_TOKENS),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel ?? '',
      });

      const text = (response ?? '').trim();
      if (!text) {
        return null;
      }

      const cleaned = text.replace(/^"|"$/g, '').trim();
      return cleaned ?? null;
    } catch (_error) {
      return null;
    }
  }
}
