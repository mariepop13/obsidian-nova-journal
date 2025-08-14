import { App, TFile } from "obsidian";
import { embed } from "../../ai/EmbeddingClient";
import type { NovaJournalSettings } from "../../settings/PluginSettings";
import type { MoodData } from "../rendering/FrontmatterService";

export type ContextType = 'emotional' | 'temporal' | 'thematic' | 'general';

export interface EnhancedIndexedChunk {
  path: string;
  date: number;
  lastModified: number;
  text: string;
  vector: number[];
  contextType: ContextType;
  emotionalTags?: string[];
  thematicTags?: string[];
  temporalMarkers?: string[];
  hash: string;
}

export interface EnhancedIndexData {
  model: string;
  updatedAt: number;
  version: string;
  items: EnhancedIndexedChunk[];
  fileHashes: Record<string, string>;
}

export interface SearchOptions {
  contextTypes?: ContextType[];
  emotionalFilter?: string[];
  thematicFilter?: string[];
  temporalRange?: { start: Date; end: Date };
  boostRecent?: boolean;
  diversityThreshold?: number;
}

export class EnhancedEmbeddingService {
  private readonly indexPath = "nova-journal-enhanced-index.json";
  private readonly maxDays = 180;
  private readonly chunkSize = 250;
  private readonly overlap = 75;
  private readonly maxChunksPerBatch = 50;
  private readonly version = "2.0.0";
  private index: EnhancedIndexData | null = null;

  constructor(
    private readonly app: App,
    private readonly settings: NovaJournalSettings
  ) {}

  async incrementalUpdateIndex(folder: string): Promise<void> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return;

    try {
      await this.ensureIndexLoaded();
      
      if (!this.index || this.index.version !== this.version) {
        await this.fullRebuild(folder);
        return;
      }

      const files = this.getMarkdownFilesInFolder(folder);
      const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;
      
      const filesToUpdate: TFile[] = [];
      const filesToRemove: string[] = [];
      const currentFilePaths = new Set(files.map(f => f.path));

      for (const f of files) {
        const stat = this.app.vault.getAbstractFileByPath(f.path) as TFile;
        const mtime = stat?.stat?.mtime || Date.now();
        
        if (mtime < cutoff) continue;

        const currentHash = await this.computeFileHash(f);
        const storedHash = this.index.fileHashes[f.path];
        
        if (!storedHash || storedHash !== currentHash) {
          filesToUpdate.push(f);
        }
      }

      for (const path of Object.keys(this.index.fileHashes)) {
        if (!currentFilePaths.has(path)) {
          filesToRemove.push(path);
        }
      }

      if (filesToUpdate.length === 0 && filesToRemove.length === 0) {
        console.log('[EnhancedEmbeddingService] Index is up to date');
        return;
      }

      console.log(`[EnhancedEmbeddingService] Updating ${filesToUpdate.length} files, removing ${filesToRemove.length} files`);

      this.removeChunksForFiles(filesToRemove);

      for (const file of filesToUpdate) {
        await this.updateFileChunks(file);
      }

      this.index.updatedAt = Date.now();
      await this.saveIndex();

    } catch (error) {
      console.error('[EnhancedEmbeddingService] Incremental update failed', error);
      await this.fullRebuild(folder);
    }
  }

  async contextualSearch(
    query: string, 
    k: number, 
    options: SearchOptions = {}
  ): Promise<EnhancedIndexedChunk[]> {
    try {
      await this.ensureIndexLoaded();
      if (!this.index || this.index.items.length === 0) return [];

      const { embeddings } = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: [query.trim()],
      });

      if (!embeddings || embeddings.length === 0) return [];

      const queryVector = embeddings[0];
      let candidates = this.index.items.filter(item => 
        item.vector && item.vector.length > 0
      );

      candidates = this.applyContextFilters(candidates, options);

      const scored = candidates
        .map((item) => ({
          item,
          score: this.calculateEnhancedScore(queryVector, item, query, options),
        }))
        .sort((a, b) => b.score - a.score);

      const results = this.applyDiversityFilter(scored, options.diversityThreshold || 0.3);
      
      return results
        .slice(0, Math.max(0, k))
        .map((s) => ({
          ...s.item,
          text: `[${this.formatDate(s.item.date)}] ${s.item.text}`,
        }));
    } catch {
      return [];
    }
  }

  async emotionalSearch(query: string, mood: Partial<MoodData>, k: number = 5): Promise<EnhancedIndexedChunk[]> {
    const emotionalTags = mood.dominant_emotions || [];
    const sentiment = mood.sentiment;
    
    return this.contextualSearch(query, k, {
      contextTypes: ['emotional', 'general'],
      emotionalFilter: emotionalTags,
      boostRecent: sentiment === 'negative',
      diversityThreshold: 0.4
    });
  }

  async temporalSearch(query: string, timeFrame: 'recent' | 'week' | 'month', k: number = 5): Promise<EnhancedIndexedChunk[]> {
    const now = new Date();
    let start: Date;
    
    switch (timeFrame) {
      case 'recent':
        start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return this.contextualSearch(query, k, {
      contextTypes: ['temporal', 'general'],
      temporalRange: { start, end: now },
      boostRecent: true
    });
  }

  async thematicSearch(query: string, themes: string[], k: number = 5): Promise<EnhancedIndexedChunk[]> {
    return this.contextualSearch(query, k, {
      contextTypes: ['thematic', 'general'],
      thematicFilter: themes,
      diversityThreshold: 0.5
    });
  }

  private async fullRebuild(folder: string): Promise<void> {
    console.log('[EnhancedEmbeddingService] Performing full rebuild');
    
    const files = this.getMarkdownFilesInFolder(folder);
    const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;

    this.index = {
      model: "text-embedding-3-small",
      updatedAt: Date.now(),
      version: this.version,
      items: [],
      fileHashes: {}
    };

    for (const file of files) {
      const stat = this.app.vault.getAbstractFileByPath(file.path) as TFile;
      const mtime = stat?.stat?.mtime || Date.now();
      
      if (mtime < cutoff) continue;
      
      try {
        await this.updateFileChunks(file);
      } catch (error) {
        console.error(`[EnhancedEmbeddingService] Failed to process ${file.path}:`, error);
      }
    }

    await this.saveIndex();
  }

  private async updateFileChunks(file: TFile): Promise<void> {
    try {
      this.removeChunksForFiles([file.path]);

      const content = await this.app.vault.read(file);
      const fileHash = await this.computeFileHash(file);
      
      const chunks = this.createEnhancedChunks(content, file);
      const texts = chunks.map(c => c.text);

      if (texts.length === 0) {
        this.index!.fileHashes[file.path] = fileHash;
        return;
      }

      const { embeddings } = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: texts.slice(0, this.maxChunksPerBatch),
      });

      if (!embeddings || embeddings.length === 0) return;

      for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
        const vector = embeddings[i];
        if (!Array.isArray(vector) || vector.length === 0) continue;

        this.index!.items.push({
          ...chunks[i],
          vector,
        });
      }

      this.index!.fileHashes[file.path] = fileHash;
    } catch (error) {
      console.error(`[EnhancedEmbeddingService] Failed to update chunks for ${file.path}:`, error);
    }
  }

  private createEnhancedChunks(content: string, file: TFile): Omit<EnhancedIndexedChunk, 'vector'>[] {
    const mtime = file.stat?.mtime || Date.now();
    const chunks: Omit<EnhancedIndexedChunk, 'vector'>[] = [];
    
    const textChunks = this.splitIntoChunks(content);
    
    for (const text of textChunks) {
      if (text.trim().length < 50) continue;

      const chunk: Omit<EnhancedIndexedChunk, 'vector'> = {
        path: file.path,
        date: mtime,
        lastModified: mtime,
        text: text.trim(),
        contextType: this.determineContextType(text),
        emotionalTags: this.extractEmotionalTags(text),
        thematicTags: this.extractThematicTags(text),
        temporalMarkers: this.extractTemporalMarkers(text),
        hash: this.hashString(text)
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private determineContextType(text: string): ContextType {
    const emotionalKeywords = /\b(feel|felt|emotion|mood|happy|sad|angry|frustrated|excited|anxious|calm|stressed|peaceful|worried|hopeful|disappointed|grateful|proud|embarrassed|confused|overwhelmed|content|joy|fear|love|hate|surprise|disgust|trust|anticipation)\b/i;
    const temporalKeywords = /\b(today|yesterday|tomorrow|this week|last week|next week|this month|last month|recently|soon|now|then|when|during|after|before|while|since|until|ago|later)\b/i;
    const thematicKeywords = /\b(work|job|career|family|friends|health|fitness|travel|hobby|project|goal|plan|study|learn|relationship|love|home|money|finance|food|exercise|book|movie|music|art|creative)\b/i;

    let scores = {
      emotional: 0,
      temporal: 0,
      thematic: 0
    };

    const emotionalMatches = text.match(emotionalKeywords);
    const temporalMatches = text.match(temporalKeywords);
    const thematicMatches = text.match(thematicKeywords);

    if (emotionalMatches) scores.emotional = emotionalMatches.length;
    if (temporalMatches) scores.temporal = temporalMatches.length;
    if (thematicMatches) scores.thematic = thematicMatches.length;

    const maxScore = Math.max(scores.emotional, scores.temporal, scores.thematic);
    
    if (maxScore === 0) return 'general';
    
    if (scores.emotional === maxScore) return 'emotional';
    if (scores.temporal === maxScore) return 'temporal';
    if (scores.thematic === maxScore) return 'thematic';
    
    return 'general';
  }

  private extractEmotionalTags(text: string): string[] {
    const emotionMap: Record<string, string[]> = {
      'positive': ['happy', 'excited', 'calm', 'peaceful', 'hopeful', 'grateful', 'proud', 'content', 'joy', 'love'],
      'negative': ['sad', 'angry', 'frustrated', 'anxious', 'stressed', 'worried', 'disappointed', 'embarrassed', 'overwhelmed', 'fear', 'hate'],
      'neutral': ['confused', 'surprised', 'curious', 'interested']
    };

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [category, emotions] of Object.entries(emotionMap)) {
      for (const emotion of emotions) {
        if (lowerText.includes(emotion)) {
          found.push(category);
          break;
        }
      }
    }

    return [...new Set(found)];
  }

  private extractThematicTags(text: string): string[] {
    const themeMap: Record<string, string[]> = {
      'work': ['work', 'job', 'career', 'office', 'meeting', 'project', 'colleague', 'boss', 'deadline'],
      'personal': ['family', 'friends', 'relationship', 'love', 'home', 'personal'],
      'health': ['health', 'fitness', 'exercise', 'doctor', 'wellness', 'sleep', 'tired'],
      'learning': ['study', 'learn', 'book', 'course', 'education', 'knowledge', 'skill'],
      'creativity': ['art', 'creative', 'music', 'write', 'paint', 'design', 'create'],
      'leisure': ['hobby', 'travel', 'movie', 'game', 'fun', 'vacation', 'relax']
    };

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [theme, keywords] of Object.entries(themeMap)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          found.push(theme);
          break;
        }
      }
    }

    return [...new Set(found)];
  }

  private extractTemporalMarkers(text: string): string[] {
    const timePatterns = [
      /\b(today|yesterday|tomorrow)\b/gi,
      /\b(this|last|next)\s+(week|month|year)\b/gi,
      /\b(\d{1,2}:\d{2})\b/g,
      /\b(morning|afternoon|evening|night)\b/gi,
      /\b(\d{1,2})\s+(days?|weeks?|months?)\s+ago\b/gi
    ];

    const found: string[] = [];
    
    for (const pattern of timePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        found.push(...matches.map(m => m.toLowerCase()));
      }
    }

    return [...new Set(found)];
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
    let baseScore = this.cosineSimilarity(queryVector, chunk.vector);

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

  private applyDiversityFilter(
    scored: Array<{ item: EnhancedIndexedChunk; score: number }>, 
    threshold: number
  ): Array<{ item: EnhancedIndexedChunk; score: number }> {
    if (threshold <= 0) return scored;

    const result: Array<{ item: EnhancedIndexedChunk; score: number }> = [];
    
    for (const candidate of scored) {
      let shouldInclude = true;
      
      for (const existing of result) {
        const similarity = this.cosineSimilarity(candidate.item.vector, existing.item.vector);
        if (similarity > threshold) {
          shouldInclude = false;
          break;
        }
      }
      
      if (shouldInclude) {
        result.push(candidate);
      }
    }

    return result;
  }

  private removeChunksForFiles(filePaths: string[]): void {
    if (!this.index) return;
    
    this.index.items = this.index.items.filter(item => 
      !filePaths.includes(item.path)
    );
    
    for (const path of filePaths) {
      delete this.index.fileHashes[path];
    }
  }

  private async computeFileHash(file: TFile): Promise<string> {
    const content = await this.app.vault.read(file);
    const mtime = file.stat?.mtime || 0;
    return this.hashString(content + mtime.toString());
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private splitIntoChunks(content: string): string[] {
    const tokens = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    
    while (i < tokens.length) {
      const part = tokens
        .slice(i, i + this.chunkSize)
        .join(" ")
        .trim();
      if (part) chunks.push(part);
      if (i + this.chunkSize >= tokens.length) break;
      i += this.chunkSize - this.overlap;
      if (i < 0) i = 0;
    }
    return chunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    
    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaines`;
    return date.toLocaleDateString("fr-FR", {
      month: "long",
      day: "numeric",
    });
  }

  private getMarkdownFilesInFolder(folder: string): TFile[] {
    const files: TFile[] = [];
    const targetFolder = folder || 'Journal';
    const normalizedFolder = targetFolder.endsWith('/') ? targetFolder : targetFolder + '/';
    
    const all = this.app.vault.getFiles();
    for (const f of all) {
      if (!f.path.toLowerCase().endsWith(".md")) continue;
      if (f.path.includes("/.trash/") || f.path.includes("/.obsidian/")) continue;
      
      if (!f.path.startsWith(normalizedFolder)) continue;
      
      files.push(f);
    }
    
    return files;
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.index) return;
    
    try {
      const json = localStorage.getItem(
        `nova-journal-enhanced-index-${this.app.vault.getName()}`
      );
      if (json) {
        const loaded = JSON.parse(json) as EnhancedIndexData;
        if (loaded.version === this.version) {
          this.index = loaded;
        }
      }
    } catch {
      this.index = null;
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;
    
    const payload = JSON.stringify(this.index);
    localStorage.setItem(
      `nova-journal-enhanced-index-${this.app.vault.getName()}`,
      payload
    );
  }
}
