import { embed } from "../../ai/EmbeddingClient";
import type { NovaJournalSettings } from "../../settings/PluginSettings";
import type { MoodData } from "../rendering/FrontmatterService";
import type { EnhancedIndexedChunk, SearchOptions } from './EnhancedEmbeddingService';
import { VectorUtils } from './VectorUtils';
import { TemporalUtils } from './TemporalUtils';

export class ContextualSearchEngine {
  constructor(private readonly settings: NovaJournalSettings) {}

  async performContextualSearch(
    query: string, 
    k: number, 
    index: EnhancedIndexedChunk[],
    options: SearchOptions = {}
  ): Promise<EnhancedIndexedChunk[]> {
    try {
      if (index.length === 0) return [];

      const embedResp = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: [query.trim()],
      });

      const embeddings = embedResp.embeddings;
      if (!Array.isArray(embeddings) || embeddings.length === 0) return [];
      
      const queryVector = embeddings[0];
      if (!Array.isArray(queryVector) || queryVector.length === 0) return [];
      let candidates = index.filter(item => 
        item.vector && item.vector.length > 0
      );

      candidates = this.applyContextFilters(candidates, options);

      const scored = candidates
        .map((item) => ({
          item,
          score: this.calculateEnhancedScore(queryVector, item, query, options),
        }))
        .sort((a, b) => b.score - a.score);

      const results = VectorUtils.applyDiversityFilter(scored, options.diversityThreshold || 0.3);
      
      return results
        .slice(0, Math.max(0, k))
        .map((s) => ({
          ...s.item,
          text: `[${TemporalUtils.formatDate(s.item.date)}] ${s.item.text}`,
        }));
    } catch {
      return [];
    }
  }

  async emotionalSearch(
    query: string, 
    mood: Partial<MoodData>, 
    k: number,
    index: EnhancedIndexedChunk[]
  ): Promise<EnhancedIndexedChunk[]> {
    const emotionalTags = mood.dominant_emotions || [];
    const sentiment = mood.sentiment;
    
    return this.performContextualSearch(query, k, index, {
      contextTypes: ['emotional', 'general'],
      emotionalFilter: emotionalTags,
      boostRecent: sentiment?.includes('negative'),
      diversityThreshold: 0.4
    });
  }

  async temporalSearch(
    query: string, 
    timeFrame: 'recent' | 'week' | 'month', 
    k: number,
    index: EnhancedIndexedChunk[]
  ): Promise<EnhancedIndexedChunk[]> {
    const temporalRange = TemporalUtils.getTimeRangeForFrame(timeFrame);

    return this.performContextualSearch(query, k, index, {
      contextTypes: ['temporal', 'general'],
      temporalRange,
      boostRecent: true
    });
  }

  async thematicSearch(
    query: string, 
    themes: string[], 
    k: number,
    index: EnhancedIndexedChunk[]
  ): Promise<EnhancedIndexedChunk[]> {
    return this.performContextualSearch(query, k, index, {
      contextTypes: ['thematic', 'general'],
      thematicFilter: themes,
      diversityThreshold: 0.5
    });
  }

  private applyContextFilters(chunks: EnhancedIndexedChunk[], options: SearchOptions): EnhancedIndexedChunk[] {
    let filtered = chunks;

    if (options.contextTypes && options.contextTypes.length > 0) {
      filtered = filtered.filter(chunk => 
        options.contextTypes!.includes(chunk.contextType)
      );
    }

    if (options.emotionalFilter && options.emotionalFilter.length > 0) {
      filtered = filtered.filter(chunk =>
        chunk.emotionalTags?.some(tag => 
          options.emotionalFilter!.includes(tag)
        )
      );
    }

    if (options.thematicFilter && options.thematicFilter.length > 0) {
      filtered = filtered.filter(chunk =>
        chunk.thematicTags?.some(tag => 
          options.thematicFilter!.includes(tag)
        )
      );
    }

    if (options.temporalRange) {
      const { start, end } = options.temporalRange;
      filtered = filtered.filter(chunk =>
        chunk.date >= start.getTime() && chunk.date <= end.getTime()
      );
    }

    return filtered;
  }

  private calculateEnhancedScore(
    queryVector: number[], 
    chunk: EnhancedIndexedChunk, 
    query: string,
    options: SearchOptions
  ): number {
    let baseScore = VectorUtils.cosineSimilarity(queryVector, chunk.vector);

    if (options.boostRecent) {
      const ageInDays = (Date.now() - chunk.date) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.exp(-ageInDays / 7);
      baseScore *= (1 + recencyBoost * 0.2);
    }

    const queryLower = query.toLowerCase();
    const textLower = chunk.text.toLowerCase();
    
    if (textLower.includes(queryLower)) {
      baseScore *= 1.3;
    }

    if (chunk.contextType !== 'general') {
      baseScore *= 1.1;
    }

    return baseScore;
  }
}
