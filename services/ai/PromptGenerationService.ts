import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EmbeddingService } from './EmbeddingService';
import { EnhancedPromptGenerationService } from './EnhancedPromptGenerationService';

export class PromptGenerationService {
  private enhancedService: EnhancedPromptGenerationService | null = null;

  constructor(private readonly settings: NovaJournalSettings) {
    try {
      this.enhancedService = new EnhancedPromptGenerationService(settings);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        '[PromptGenerationService] Enhanced service initialization failed, using legacy mode:',
        errorMessage
      );
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
        if (mood?.dominant_emotions && mood.dominant_emotions.length > 0) {
          return await this.enhancedService.generateEmotionallyAwarePrompt(style, noteText, mood);
        }

        if (mood?.tags && mood.tags.length > 0) {
          return await this.enhancedService.generateThematicPrompt(style, noteText, mood.tags);
        }

        if (ragContext && ragContext.trim().length > 0) {
          return await this.enhancedService.generateContextualPromptWithRag(style, noteText, mood, ragContext, {
            prioritizeRecent: true,
            includeEmotionalContext: true,
            includeThematicContext: true,
            maxContextChunks: 3,
          });
        }
        return await this.enhancedService.generateContextualPrompt(style, noteText, mood, {
          prioritizeRecent: true,
          includeEmotionalContext: true,
          includeThematicContext: true,
          maxContextChunks: 3,
        });
      }
      return this.generateLegacyPrompt(style, noteText, mood, ragContext);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PromptGenerationService] Enhanced generation failed, falling back to legacy:', errorMessage);
      return this.generateLegacyPrompt(style, noteText, mood, ragContext);
    }
  }

  private async generateLegacyPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>,
    providedRagContext?: string
  ): Promise<string | null> {
    const systemPrompt = `Generate ONE simple journaling question in the SAME LANGUAGE as the context provided.

CRITICAL RULES:
- Output ONLY the question text (no quotes/labels).
- One sentence, concise (<= 25 words).
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

    let ragContext = '';
    if (providedRagContext && providedRagContext.trim().length > 0) {
      ragContext = `\n\nPrevious journal entries context:\n${providedRagContext}`;
      console.log(`[PromptGenerationService] Using provided RAG context:`, ragContext.substring(0, 200));
    } else {
      try {
        if (noteText && noteText.trim().length > 0) {
          const appRef = (window as any)?.app;
          if (appRef) {
            const embeddingService = new EmbeddingService(appRef, this.settings);
            const top = await embeddingService.topK(noteText, 3);
            console.log(`[PromptGenerationService] RAG results:`, top);
            if (Array.isArray(top) && top.length > 0) {
              const enriched = top
                .map((t, i) => {
                  const preview = (t.text || '').substring(0, 400);
                  return `${i + 1}. ${preview}...`;
                })
                .join('\n');
              ragContext = `\n\nPrevious journal entries context:\n${enriched}`;
              console.log(`[PromptGenerationService] Fallback RAG context:`, ragContext.substring(0, 200));
            } else {
              console.log(`[PromptGenerationService] No RAG results found`);
            }
          } else {
            console.log(`[PromptGenerationService] No app reference found`);
          }
        } else {
          console.log(`[PromptGenerationService] No note text provided`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[PromptGenerationService] RAG fetch failed:', errorMessage);
        if (this.settings.aiDebug) {
          console.log('[PromptGenerationService] Debug - RAG retrieval failed, proceeding without context');
        }
      }
    }

    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Style: ${style}\n\nCurrent note content:\n${noteText || '(empty)'}${moodFragment}${ragContext}

Generate a question that:
1. Uses the same language as the provided context
2. ONLY references details explicitly present in the context above
3. If no context exists, ask a general question without invented details
4. NEVER invent dates, years, people, or events not mentioned
5. Be factual and avoid assumptions about past states or emotions`;

    console.log(`[PromptGenerationService] Final user prompt:`, userPrompt);

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(60, this.settings.aiMaxTokens || 60),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel || '',
      });

      const text = (response || '').trim();
      if (!text) {
        if (this.settings.aiDebug) {
          console.log('[PromptGenerationService] Debug - Empty response from AI service');
        }
        return null;
      }

      const cleaned = text.replace(/^"|"$/g, '').trim();
      return cleaned || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[PromptGenerationService] AI generation failed:', errorMessage);
      return null;
    }
  }
}
