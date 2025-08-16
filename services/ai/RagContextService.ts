import { Editor, App } from 'obsidian';
import { EnhancedEmbeddingService, type SearchOptions } from './EnhancedEmbeddingService';
import type { NovaJournalSettings } from '../../settings/PluginSettings';

const CONTENT_THRESHOLDS = {
  MIN_CONTENT_LENGTH: 100,
  MIN_SUBSTANTIAL_LENGTH: 200,
  EMPTY_PROMPT_MAX_LENGTH: 300,
  MARKUP_HEAVY_MAX_LENGTH: 500,
  MAX_BUTTONS_ALLOWED: 2,
  MAX_CONTEXT_CHUNKS: 8,
  PREVIEW_LENGTH: 500
} as const;

export class RagContextService {
  private embeddingService: EnhancedEmbeddingService | null = null;
  private readonly settings: NovaJournalSettings;
  private readonly debug: boolean;
  private readonly app: App | null;

  constructor(settings: NovaJournalSettings, app?: App) {
    this.settings = settings;
    this.debug = settings.aiDebug;
    this.app = app || null;
  }

  private getEmbeddingService(): EnhancedEmbeddingService | null {
    if (!this.embeddingService) {
      const appRef = this.app || (window as any)?.app;
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
      console.log('[RagContextService] Searching for context with query length:', userText?.trim().length);
    }
    
    if (!embeddingService) {
      console.warn('[RagContextService] Embedding service not available, returning empty context');
      return '';
    }
    
    if (!userText?.trim()) {
      if (this.debug) {
        console.log('[RagContextService] No user text provided, returning empty context');
      }
      return '';
    }

    try {
      const searchText = this.extractSearchText(userText, editor, targetLine);

      const searchOptions: SearchOptions = {
        boostRecent: false,
        diversityThreshold: 0.3
      };

      let contextChunks = await embeddingService.contextualSearch(
        searchText,
        25,
        searchOptions
      );

      contextChunks = this.filterSubstantialContent(contextChunks);
      
      if (this.debug) {
        console.log('[RagContextService] Found substantial chunks:', contextChunks.length);
      }

      if (contextChunks.length === 0) {
        contextChunks = await this.searchInAllHistory(embeddingService, searchText);
      }

      if (contextChunks.length === 0) return '';

      contextChunks = this.prioritizeBySubstance(contextChunks);

      const contextText = contextChunks.slice(0, CONTENT_THRESHOLDS.MAX_CONTEXT_CHUNKS).map((chunk, i) => {
        const preview = chunk.text.substring(0, CONTENT_THRESHOLDS.PREVIEW_LENGTH);
        let contextInfo = '';
        
        if (chunk.date) {
          const timeAgo = this.getTimeAgoString(chunk.date);
          contextInfo = `[${timeAgo}] `;
        }
        
        return `${i + 1}. ${contextInfo}${preview}`;
      }).join('\n\n');

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
        return trimmed.length > 0 && 
               !trimmed.includes('**Nova**:') && 
               !trimmed.includes('##') &&
               !trimmed.startsWith('<button') &&
               !trimmed.startsWith('<a') &&
               !trimmed.includes('class="nova-');
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
      const daysDiff = Math.floor((Date.now() - chunk.date) / (1000 * 60 * 60 * 24));
      return daysDiff <= 2;
    });
    
    if (allRecent && this.debug) {
      console.log('[RagContextService] Debug - All results are very recent, trying broader search');
    }
    
    const expandedSearchTerms = this.extractExpandedSearchTerms(searchText, contextChunks);
    if (expandedSearchTerms.length > 0 || allRecent) {
      const searchTerms = expandedSearchTerms.length > 0 ? expandedSearchTerms.join(' ') : searchText;
      const additionalChunks = await embeddingService.contextualSearch(
        searchTerms,
        allRecent ? 15 : 5,
        { 
          ...searchOptions, 
          diversityThreshold: allRecent ? 0.05 : 0.3,
          boostRecent: false
        }
      );
      
      const combinedChunks = [...contextChunks];
      additionalChunks.forEach(chunk => {
        if (!combinedChunks.some(existing => existing.hash === chunk.hash)) {
          combinedChunks.push(chunk);
        }
      });
      
      contextChunks = combinedChunks.slice(0, 12);
      
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
      
      const daysDiff = Math.floor((now - chunk.date) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 2) {
        recentChunks.push(chunk);
      } else {
        historicalChunks.push(chunk);
      }
    });
    
    const recentHasSubstance = recentChunks.some(chunk => {
      const text = chunk.text.toLowerCase();
      const searchLower = searchText.toLowerCase();
      return text.includes(searchLower) && text.length > 100 && 
             !text.includes('## journal prompt') && 
             !text.includes('**nova**:');
    });
    
    const historicalHasSubstance = historicalChunks.some(chunk => {
      const text = chunk.text.toLowerCase();
      const searchLower = searchText.toLowerCase();
      return text.includes(searchLower) && text.length > 100;
    });
    
    if (this.debug) {
      console.log('[RagContextService] Debug - Recent chunks:', recentChunks.length, 'with substance:', recentHasSubstance);
      console.log('[RagContextService] Debug - Historical chunks:', historicalChunks.length, 'with substance:', historicalHasSubstance);
    }
    
    if (historicalHasSubstance && !recentHasSubstance) {
      return [...historicalChunks, ...recentChunks];
    }
    
    if (historicalHasSubstance && recentHasSubstance) {
      return [...historicalChunks.slice(0, 5), ...recentChunks.slice(0, 3)];
    }
    
    return contextChunks;
  }

  private extractExpandedSearchTerms(originalSearch: string, contextChunks: any[]): string[] {
    const expandedTerms: Set<string> = new Set();
    
    const firstChunk = contextChunks[0];
    if (firstChunk && firstChunk.text) {
      const text = firstChunk.text;
      
      const words = text.split(/\s+/)
        .map((word: string) => word.replace(/[^\w]/g, ''))
        .filter((word: string) => 
          word.length > 3 && 
          word.length < 15 &&
          !originalSearch.toLowerCase().includes(word.toLowerCase())
        );
      
      const wordCounts = new Map<string, number>();
      words.forEach((word: string) => {
        const lowerWord = word.toLowerCase();
        wordCounts.set(lowerWord, (wordCounts.get(lowerWord) || 0) + 1);
      });
      
      const sentences = text.split(/[.!?]+/);
      sentences.forEach((sentence: string) => {
        const sentenceWords = sentence.trim().split(/\s+/).slice(0, 5);
        sentenceWords.forEach((word: string) => {
          const cleanWord = word.replace(/[^\w]/g, '');
          if (cleanWord.length > 3 && cleanWord.length < 15) {
            expandedTerms.add(cleanWord);
          }
        });
      });
      
      Array.from(wordCounts.entries())
        .filter(([word, count]) => count > 1 && word.length > 3)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 3)
        .forEach(([word]) => expandedTerms.add(word));
    }
    
    return Array.from(expandedTerms).slice(0, 5);
  }

  private getTimeAgoString(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '0d';
    if (diffDays === 1) return '1d';
    if (diffDays < 7) return `${diffDays}d`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}m`;
    
    const diffYears = Math.floor(diffMonths / 12);
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
    const hasUserSection = text.includes('**marie** (you):');
    const hasButton = text.includes('</button>');
    const isTooShort = textLength < CONTENT_THRESHOLDS.EMPTY_PROMPT_MAX_LENGTH;
    
    return hasNovaPrompt && hasUserSection && !hasButton && isTooShort;
  }

  private isTooShort(textLength: number): boolean {
    return textLength < CONTENT_THRESHOLDS.MIN_CONTENT_LENGTH;
  }

  private isMostlyMarkup(text: string, textLength: number): boolean {
    const buttonCount = (text.match(/<button/g) || []).length;
    const tooManyButtons = buttonCount > CONTENT_THRESHOLDS.MAX_BUTTONS_ALLOWED;
    const isShort = textLength < CONTENT_THRESHOLDS.MARKUP_HEAVY_MAX_LENGTH;
    
    return tooManyButtons && isShort;
  }

  private isSubstantialContent(text: string, textLength: number): boolean {
    const isLongContent = textLength > CONTENT_THRESHOLDS.MIN_SUBSTANTIAL_LENGTH;
    const isMediumContentWithoutPrompt = textLength > CONTENT_THRESHOLDS.MIN_CONTENT_LENGTH && 
                                         !text.includes('**nova**:');
    
    return isLongContent || isMediumContentWithoutPrompt;
  }

  private async searchInAllHistory(embeddingService: EnhancedEmbeddingService, searchText: string): Promise<any[]> {
    const broadSearchOptions: SearchOptions = {
      boostRecent: false,
      diversityThreshold: 0.5
    };

    const chunks = await embeddingService.contextualSearch(searchText, 50, broadSearchOptions);
    return this.filterSubstantialContent(chunks);
  }

  private prioritizeBySubstance(chunks: any[]): any[] {
    return chunks.sort((a, b) => {
      const aHasSubstance = this.hasUserContent(a.text);
      const bHasSubstance = this.hasUserContent(b.text);
      
      if (aHasSubstance && !bHasSubstance) return -1;
      if (!aHasSubstance && bHasSubstance) return 1;
      
      return (b.text?.length || 0) - (a.text?.length || 0);
    });
  }

  private hasUserContent(text: string): boolean {
    if (!text) return false;
    
    const userSectionMatch = text.match(/\*\*\w+\*\*.*?:\s*(.*?)(?:\*\*|$|<button)/i);
    if (!userSectionMatch) return false;
    
    const userContent = userSectionMatch[1].trim();
    const cleanUserContent = userContent.replace(/<[^>]*>/g, '').trim();
    
    return cleanUserContent.length > 20;
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
        diversityThreshold: 0.3
      };

      let contextChunks = await embeddingService.contextualSearch(style, 25, searchOptions);
      contextChunks = this.filterSubstantialContent(contextChunks);
      
      if (this.debug) {
        console.log('[RagContextService] Found substantial chunks:', contextChunks.length);
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

      const contextText = contextChunks.slice(0, CONTENT_THRESHOLDS.MAX_CONTEXT_CHUNKS).map((chunk, i) => {
        const preview = chunk.text.substring(0, CONTENT_THRESHOLDS.PREVIEW_LENGTH);
        let contextInfo = '';
        
        if (chunk.date) {
          const timeAgo = this.getTimeAgoString(chunk.date);
          contextInfo = `[${timeAgo}] `;
        }
        
        return `${i + 1}. ${contextInfo}${preview}`;
      }).join('\n\n');

      return contextText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[RagContextService] Failed to get recent context:', errorMessage);
      return '';
    }
  }

  private filterRecentEntries(chunks: any[], daysLimit: number): any[] {
    const cutoffDate = Date.now() - (daysLimit * 24 * 60 * 60 * 1000);
    
    return chunks.filter(chunk => {
      if (!chunk.date) return false;
      return chunk.date >= cutoffDate;
    });
  }
}
