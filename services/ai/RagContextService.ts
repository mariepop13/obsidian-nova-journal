import { App, Editor } from 'obsidian';
import { EnhancedEmbeddingService, type SearchOptions } from './EnhancedEmbeddingService';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import {
  CONTEXT_LIMITS,
  SEARCH_CONSTANTS,
  TIME_CONSTANTS,
} from '../shared/Constants';

export class RagContextService {
  private embeddingService: EnhancedEmbeddingService | null = null;
  private readonly settings: NovaJournalSettings;
  private readonly debug: boolean;
  private readonly app: App | null;

  constructor(settings: NovaJournalSettings, app?: App) {
    this.settings = settings;
    this.debug = settings.aiDebug;
    this.app = app ?? null;
  }

  private getEmbeddingService(): EnhancedEmbeddingService | null {
    if (!this.embeddingService) {
      const appRef = this.app ?? (window as any)?.app;
      if (appRef) {
        this.embeddingService = new EnhancedEmbeddingService(appRef, this.settings);
      } else {
        console.warn('[RagContextService] No app reference available for embedding service');
      }
    }
    return this.embeddingService;
  }

  async getRagContext(userText: string, editor?: Editor, targetLine?: number): Promise<string> {
    const embeddingService = this.getEmbeddingService();

    if (this.debug) {

    }

    if (!embeddingService) {
      console.warn('[RagContextService] Embedding service not available, returning empty context');
      return '';
    }

    if (!userText?.trim()) {
      if (this.debug) {

      }
      return '';
    }

    try {
      const searchText = this.extractSearchText(userText, editor, targetLine);

      const searchOptions: SearchOptions = {
        boostRecent: false,
        diversityThreshold: SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_DEFAULT,
      };

      let contextChunks = await embeddingService.contextualSearch(searchText, CONTEXT_LIMITS.BROAD_SEARCH_CHUNKS, searchOptions);

      contextChunks = this.filterSubstantialContent(contextChunks);

      if (this.debug) {

      }

      if (contextChunks.length === 0) {
        contextChunks = await this.searchInAllHistory(embeddingService, searchText);
      }

      if (contextChunks.length === 0) return '';

      contextChunks = this.prioritizeBySubstance(contextChunks);

      const contextText = contextChunks
        .slice(0, CONTEXT_LIMITS.MAX_CONTEXT_CHUNKS)
        .map((chunk, i) => {
          const preview = chunk.text.substring(0, CONTEXT_LIMITS.PREVIEW_LENGTH_RAG);
          let contextInfo = '';

          if (chunk.date) {
            const timeAgo = this.getTimeAgoString(chunk.date);
            contextInfo = `[${timeAgo}] `;
          }

          return `${i + 1}. ${contextInfo}${preview}`;
        })
        .join('\n\n');

      return contextText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[RagContextService] Failed to get RAG context:', errorMessage, error);

      if (this.debug) {
        console.log('[RagContextService] Debug - Error occurred during RAG retrieval, context will be empty');
      }

      return '';
    }
  }

  private extractSearchText(userText: string, editor?: Editor, targetLine?: number): string {
    let searchText = userText;

    if (typeof targetLine === 'number' && editor) {
      const lineText = editor.getLine(targetLine);
      if (lineText?.trim()) {
        searchText = lineText;
      }
    } else if (editor && userText.includes('**Nova**:')) {
      const lines = userText.split('\n');
      const userLines = lines.filter(line => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          !trimmed.includes('**Nova**:') &&
          !trimmed.includes('##') &&
          !trimmed.startsWith('<button') &&
          !trimmed.startsWith('<a') &&
          !trimmed.includes('class="nova-')
        );
      });

      let lastUserLine = userLines[userLines.length - 1];
      if (lastUserLine?.trim()) {
        lastUserLine = lastUserLine.replace(/^\*\*.*?\*\*.*?:\s*/, '').trim();
        if (lastUserLine.length > 0) {
          searchText = lastUserLine;
        }
      }
    }

    return searchText;
  }

  private async expandContextSearch(
    embeddingService: EnhancedEmbeddingService,
    contextChunks: any[],
    searchText: string,
    searchOptions: SearchOptions
  ): Promise<any[]> {
    const allRecent = contextChunks.every(chunk => {
      if (!chunk.date) return false;
      const daysDiff = Math.floor((Date.now() - chunk.date) / TIME_CONSTANTS.MS_PER_DAY);
      return daysDiff <= TIME_CONSTANTS.VERY_RECENT_DAYS_LIMIT;
    });

    if (allRecent && this.debug) {
      console.log('[RagContextService] Debug - All results are very recent, trying broader search');
    }

    const expandedSearchTerms = this.extractExpandedSearchTerms(searchText, contextChunks);
    if (expandedSearchTerms.length > 0 || allRecent) {
      const searchTerms = expandedSearchTerms.length > 0 ? expandedSearchTerms.join(' ') : searchText;
      const additionalChunks = await embeddingService.contextualSearch(searchTerms, allRecent ? CONTEXT_LIMITS.RECENT_SEARCH_LIMIT : CONTEXT_LIMITS.DEFAULT_MAX_CHUNKS, {
        ...searchOptions,
        diversityThreshold: allRecent ? SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_MINIMAL : SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_DEFAULT,
        boostRecent: false,
      });

      const combinedChunks = [...contextChunks];
      additionalChunks.forEach(chunk => {
        if (!combinedChunks.some(existing => existing.hash === chunk.hash)) {
          combinedChunks.push(chunk);
        }
      });

      contextChunks = combinedChunks.slice(0, CONTEXT_LIMITS.COMBINED_CHUNKS_MAX);

      if (this.debug) {
        console.log('[RagContextService] Debug - expanded search with terms:', expandedSearchTerms);
        console.log('[RagContextService] Debug - total contextChunks after expansion:', contextChunks.length);
      }
    }

    return contextChunks;
  }

  private prioritizeRelevantContext(contextChunks: any[], searchText: string): any[] {
    const recentChunks: any[] = [];
    const historicalChunks: any[] = [];
    const now = Date.now();

    contextChunks.forEach(chunk => {
      if (!chunk.date) {
        historicalChunks.push(chunk);
        return;
      }

      const daysDiff = Math.floor((now - chunk.date) / TIME_CONSTANTS.MS_PER_DAY);

      if (daysDiff <= TIME_CONSTANTS.VERY_RECENT_DAYS_LIMIT) {
        recentChunks.push(chunk);
      } else {
        historicalChunks.push(chunk);
      }
    });

    const recentHasSubstance = recentChunks.some(chunk => {
      const text = chunk.text.toLowerCase();
      const searchLower = searchText.toLowerCase();
      return (
        text.includes(searchLower) &&
        text.length > CONTEXT_LIMITS.MIN_CONTENT_LENGTH_RAG &&
        !text.includes('## journal prompt') &&
        !text.includes('**nova**:')
      );
    });

    const historicalHasSubstance = historicalChunks.some(chunk => {
      const text = chunk.text.toLowerCase();
      const searchLower = searchText.toLowerCase();
      return text.includes(searchLower) && text.length > CONTEXT_LIMITS.MIN_CONTENT_LENGTH_RAG;
    });

    if (this.debug) {
      console.log(
        '[RagContextService] Debug - Recent chunks:',
        recentChunks.length,
        'with substance:',
        recentHasSubstance
      );
      console.log(
        '[RagContextService] Debug - Historical chunks:',
        historicalChunks.length,
        'with substance:',
        historicalHasSubstance
      );
    }

    if (historicalHasSubstance && !recentHasSubstance) {
      return [...historicalChunks, ...recentChunks];
    }

    if (historicalHasSubstance && recentHasSubstance) {
      return [...historicalChunks.slice(0, CONTEXT_LIMITS.HISTORICAL_CHUNKS_LIMIT), ...recentChunks.slice(0, CONTEXT_LIMITS.RECENT_CHUNKS_LIMIT)];
    }

    return contextChunks;
  }

  private extractExpandedSearchTerms(originalSearch: string, contextChunks: any[]): string[] {
    const expandedTerms: Set<string> = new Set();

    const firstChunk = contextChunks[0];
    if (firstChunk && firstChunk.text) {
      const text = firstChunk.text;

      const words = text
        .split(/\s+/)
        .map((word: string) => word.replace(/[^\w]/g, ''))
        .filter(
          (word: string) =>
            word.length > CONTEXT_LIMITS.WORD_LENGTH_MIN && word.length < CONTEXT_LIMITS.WORD_LENGTH_MAX && !originalSearch.toLowerCase().includes(word.toLowerCase())
        );

      const wordCounts = new Map<string, number>();
      words.forEach((word: string) => {
        const lowerWord = word.toLowerCase();
        wordCounts.set(lowerWord, (wordCounts.get(lowerWord) ?? 0) + 1);
      });

      const sentences = text.split(/[.!?]+/);
      sentences.forEach((sentence: string) => {
        const sentenceWords = sentence.trim().split(/\s+/).slice(0, CONTEXT_LIMITS.SENTENCE_WORDS_MAX);
        sentenceWords.forEach((word: string) => {
          const cleanWord = word.replace(/[^\w]/g, '');
          if (cleanWord.length > CONTEXT_LIMITS.WORD_LENGTH_MIN && cleanWord.length < CONTEXT_LIMITS.WORD_LENGTH_MAX) {
            expandedTerms.add(cleanWord);
          }
        });
      });

      Array.from(wordCounts.entries())
        .filter(([word, count]) => count > CONTEXT_LIMITS.MIN_WORD_COUNT && word.length > CONTEXT_LIMITS.WORD_LENGTH_MIN)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, CONTEXT_LIMITS.TOP_WORDS_MAX)
        .forEach(([word]) => expandedTerms.add(word));
    }

    return Array.from(expandedTerms).slice(0, CONTEXT_LIMITS.EXPANDED_TERMS_MAX);
  }

  private getTimeAgoString(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / TIME_CONSTANTS.MS_PER_DAY);

    if (diffDays === TIME_CONSTANTS.TIME_AGO_DAYS_MIN) return '0d';
    if (diffDays === TIME_CONSTANTS.TIME_AGO_DAYS_ONE) return '1d';
    if (diffDays < TIME_CONSTANTS.DAYS_IN_WEEK) return `${diffDays}d`;

    const diffWeeks = Math.floor(diffDays / TIME_CONSTANTS.DAYS_IN_WEEK);
    if (diffWeeks < TIME_CONSTANTS.TIME_AGO_WEEKS_LIMIT) return `${diffWeeks}w`;

    const diffMonths = Math.floor(diffDays / TIME_CONSTANTS.DAYS_IN_MONTH);
    if (diffMonths < TIME_CONSTANTS.TIME_AGO_MONTHS_LIMIT) return `${diffMonths}m`;

    const diffYears = Math.floor(diffMonths / TIME_CONSTANTS.MONTHS_IN_YEAR);
    return `${diffYears}y`;
  }

  private filterSubstantialContent(chunks: any[]): any[] {
    return chunks.filter(chunk => this.hasSubstantialContent(chunk));
  }

  private hasSubstantialContent(chunk: any): boolean {
    if (!chunk.text) return false;

    const text = chunk.text.toLowerCase();
    const textLength = chunk.text.length;

    if (this.isEmptyPrompt(text, textLength)) return false;
    if (this.isTooShort(textLength)) return false;
    if (this.isMostlyMarkup(text, textLength)) return false;

    return this.isSubstantialContent(text, textLength);
  }

  private isEmptyPrompt(text: string, textLength: number): boolean {
    const hasNovaPrompt = text.includes('**nova**:');
    const hasUserSection = /\*\*[^*]+\*\*\s*\(you\)\s*:/i.test(text);
    const hasButton = text.includes('</button>');
    const isTooShort = textLength < CONTEXT_LIMITS.EMPTY_PROMPT_MAX_LENGTH;

    return hasNovaPrompt && hasUserSection && !hasButton && isTooShort;
  }

  private isTooShort(textLength: number): boolean {
    return textLength < CONTEXT_LIMITS.MIN_CONTENT_LENGTH_RAG;
  }

  private isMostlyMarkup(text: string, textLength: number): boolean {
    const buttonCount = (text.match(/<button/g) ?? []).length;
    const tooManyButtons = buttonCount > CONTEXT_LIMITS.MAX_BUTTONS_ALLOWED;
    const isShort = textLength < CONTEXT_LIMITS.MARKUP_HEAVY_MAX_LENGTH;

    return tooManyButtons && isShort;
  }

  private isSubstantialContent(text: string, textLength: number): boolean {
    const isLongContent = textLength > CONTEXT_LIMITS.MIN_SUBSTANTIAL_LENGTH_RAG;
    const isMediumContentWithoutPrompt =
      textLength > CONTEXT_LIMITS.MIN_CONTENT_LENGTH_RAG && !text.includes('**nova**:');

    return isLongContent || isMediumContentWithoutPrompt;
  }

  private async searchInAllHistory(embeddingService: EnhancedEmbeddingService, searchText: string): Promise<any[]> {
    const broadSearchOptions: SearchOptions = {
      boostRecent: false,
      diversityThreshold: SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_RELAXED,
    };

    const chunks = await embeddingService.contextualSearch(searchText, CONTEXT_LIMITS.EXTENDED_SEARCH_CHUNKS, broadSearchOptions);
    return this.filterSubstantialContent(chunks);
  }

  private prioritizeBySubstance(chunks: any[]): any[] {
    return chunks.sort((a, b) => {
      const aHasSubstance = this.hasUserContent(a.text);
      const bHasSubstance = this.hasUserContent(b.text);

      if (aHasSubstance && !bHasSubstance) return -1;
      if (!aHasSubstance && bHasSubstance) return 1;

      return (b.text?.length ?? 0) - (a.text?.length ?? 0);
    });
  }

  private hasUserContent(text: string): boolean {
    if (typeof text !== 'string' || !text) return false;

    const userSectionMatch = text.match(new RegExp(`\\*\\*[^*]+\\*\\*\\s*[:\\-]\\s*([\\s\\S]{0,${CONTEXT_LIMITS.USER_SECTION_MAX_CAPTURE_RAG}}?)(?=(\\*\\*[^*]+\\*\\*|<button|$))`, 'i'));
    if (!userSectionMatch) return false;

    const userContent = (userSectionMatch[1] ?? '').trim();
    const cleanUserContent = userContent.replace(/<[^>]*>/g, '').trim();

    return cleanUserContent.length > CONTEXT_LIMITS.USER_SECTION_MIN_LENGTH_RAG;
  }

  async getRecentContext(style: string): Promise<string> {
    const embeddingService = this.getEmbeddingService();

    if (this.debug) {
      console.log('[RagContextService] Getting recent context for style:', style);
    }

    if (!embeddingService) {
      console.warn('[RagContextService] Embedding service not available for recent context');
      return '';
    }

    try {
      const searchOptions: SearchOptions = {
        boostRecent: true,
        diversityThreshold: SEARCH_CONSTANTS.DIVERSITY_THRESHOLD_DEFAULT,
      };

      let contextChunks = await embeddingService.contextualSearch(style, CONTEXT_LIMITS.BROAD_SEARCH_CHUNKS, searchOptions);
      contextChunks = this.filterSubstantialContent(contextChunks);

      if (this.debug) {

      }

      if (contextChunks.length === 0) {
        contextChunks = await this.searchInAllHistory(embeddingService, style);
      }

      if (contextChunks.length === 0) return '';

      contextChunks = this.prioritizeBySubstance(contextChunks);

      if (this.debug) {
        console.log('[RagContextService] Final context chunks:', contextChunks.length);
      }

      if (contextChunks.length === 0) return '';

      const contextText = contextChunks
        .slice(0, CONTEXT_LIMITS.MAX_CONTEXT_CHUNKS)
        .map((chunk, i) => {
          const preview = chunk.text.substring(0, CONTEXT_LIMITS.PREVIEW_LENGTH_RAG);
          let contextInfo = '';

          if (chunk.date) {
            const timeAgo = this.getTimeAgoString(chunk.date);
            contextInfo = `[${timeAgo}] `;
          }

          return `${i + 1}. ${contextInfo}${preview}`;
        })
        .join('\n\n');

      return contextText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[RagContextService] Failed to get recent context:', errorMessage);
      return '';
    }
  }

  private filterRecentEntries(chunks: any[], daysLimit: number): any[] {
    const cutoffDate = Date.now() - daysLimit * TIME_CONSTANTS.MS_PER_DAY;

    return chunks.filter(chunk => {
      if (!chunk.date) return false;
      return chunk.date >= cutoffDate;
    });
  }
}
