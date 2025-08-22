import { App, TFile } from 'obsidian';
import { embed } from '../../ai/EmbeddingClient';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { MoodData } from '../rendering/FrontmatterService';
import { ContextAnalyzer } from './ContextAnalyzer';
import { TemporalUtils } from './TemporalUtils';
import { VectorUtils } from './VectorUtils';
import { ContextualSearchEngine } from './ContextualSearchEngine';
import {
  EMBEDDING_CONFIG,
  TIME_CONSTANTS,
  SEARCH_CONSTANTS,
} from '../shared/Constants';

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
  private readonly indexPath = 'nova-journal-enhanced-index.json';
  private readonly maxDays = EMBEDDING_CONFIG.MAX_DAYS_INDEX;
  private readonly maxChunksPerBatch = EMBEDDING_CONFIG.MAX_CHUNKS_PER_BATCH;
  private readonly version = '2.0.0';
  private index: EnhancedIndexData | null = null;
  private readonly contextAnalyzer = new ContextAnalyzer();
  private readonly searchEngine: ContextualSearchEngine;

  constructor(
    private readonly app: App,
    private readonly settings: NovaJournalSettings
  ) {
    this.searchEngine = new ContextualSearchEngine(settings);
  }

  async incrementalUpdateIndex(folder: string): Promise<void> {
    console.log('[EnhancedEmbeddingService] Debug - incrementalUpdateIndex called with folder:', folder);
    console.log('[EnhancedEmbeddingService] Debug - AI enabled:', this.settings.aiEnabled);
    console.log(
      '[EnhancedEmbeddingService] Debug - API key configured:',
      this.settings.aiEnabled && !!this.settings.aiApiKey
    );

    if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
      console.log('[EnhancedEmbeddingService] Debug - AI disabled or no API key, skipping indexing');
      return;
    }

    try {
      await this.ensureIndexLoaded();

      if (!this.index || this.index.version !== this.version) {
        console.log('[EnhancedEmbeddingService] Debug - No index or version mismatch, performing full rebuild');
        await this.fullRebuild(folder);
        return;
      }

      const changeResult = await this.detectChanges(folder);
      if (!changeResult.hasChanges) {
        console.log('[EnhancedEmbeddingService] Index is up to date');
        return;
      }

      await this.processUpdates(changeResult);
      await this.finalizeIndexUpdate();
    } catch (error) {
      console.error('[EnhancedEmbeddingService] Incremental update failed', error);
      await this.fullRebuild(folder);
    }
  }

  async contextualSearch(query: string, k: number, options: SearchOptions = {}): Promise<EnhancedIndexedChunk[]> {
    console.log('[EnhancedEmbeddingService] Debug - contextualSearch called, query length:', query ? query.length : 0);
    console.log('[EnhancedEmbeddingService] Debug - k:', k, 'options:', options);

    await this.ensureIndexLoaded();
    console.log('[EnhancedEmbeddingService] Debug - Index loaded:', !!this.index);
    console.log('[EnhancedEmbeddingService] Debug - Index items count:', this.index?.items?.length ?? 0);

    if (!this.index || this.index.items.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
      console.log('[EnhancedEmbeddingService] Debug - No index or empty index, returning empty results');
      return [];
    }

    const results = await this.searchEngine.performContextualSearch(query || '', k, this.index.items, options);
    console.log('[EnhancedEmbeddingService] Debug - Search completed, resultsCount:', results?.length ?? 0);
    return results;
  }

  async emotionalSearch(query: string, mood: Partial<MoodData>, k = EMBEDDING_CONFIG.EMOTIONAL_SEARCH_K): Promise<EnhancedIndexedChunk[]> {
    await this.ensureIndexLoaded();
    if (!this.index || this.index.items.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) return [];

    return this.searchEngine.emotionalSearch(query, mood, k, this.index.items);
  }

  async temporalSearch(query: string, timeFrame: 'recent' | 'week' | 'month', k = EMBEDDING_CONFIG.TEMPORAL_SEARCH_K): Promise<EnhancedIndexedChunk[]> {
    await this.ensureIndexLoaded();
    if (!this.index || this.index.items.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) return [];

    return this.searchEngine.temporalSearch(query, timeFrame, k, this.index.items);
  }

  async thematicSearch(query: string, themes: string[], k = EMBEDDING_CONFIG.THEMATIC_SEARCH_K): Promise<EnhancedIndexedChunk[]> {
    await this.ensureIndexLoaded();
    if (!this.index || this.index.items.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) return [];

    return this.searchEngine.thematicSearch(query, themes, k, this.index.items);
  }

  async forceFullRebuild(folder: string): Promise<void> {
    await this.fullRebuild(folder);
  }

  private async fullRebuild(folder: string): Promise<void> {
    console.log('[EnhancedEmbeddingService] Performing full rebuild');

    const files = this.getMarkdownFilesInFolder(folder);
    const cutoff = Date.now() - this.maxDays * TIME_CONSTANTS.MS_PER_DAY;

    this.index = {
      model: 'text-embedding-3-small',
      updatedAt: Date.now(),
      version: this.version,
      items: [],
      fileHashes: {},
    };

    for (const file of files) {
      const stat = this.app.vault.getAbstractFileByPath(file.path) as TFile;
      const fileDate = TemporalUtils.extractDateFromFilename(file.name) || Date.now();

      if (fileDate < cutoff) continue;

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

      if (texts.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
        this.index!.fileHashes[file.path] = fileHash;
        return;
      }

      const { embeddings } = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: texts.slice(0, this.maxChunksPerBatch),
      });

      if (!embeddings || embeddings.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) {
        this.index!.fileHashes[file.path] = fileHash;
        return;
      }

      for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
        const vector = embeddings[i];
        if (!Array.isArray(vector) || vector.length === SEARCH_CONSTANTS.MIN_RESULT_INDEX) continue;

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
    const fileDate = TemporalUtils.extractDateFromFilename(file.name) || Date.now();
    const chunks: Omit<EnhancedIndexedChunk, 'vector'>[] = [];

    const textChunks = VectorUtils.splitIntoChunks(content);

    for (const text of textChunks) {
      if (text.trim().length < EMBEDDING_CONFIG.DEFAULT_OVERLAP) continue;

      const chunk: Omit<EnhancedIndexedChunk, 'vector'> = {
        path: file.path,
        date: fileDate,
        lastModified: fileDate,
        text: text.trim(),
        contextType: this.contextAnalyzer.determineContextType(text),
        emotionalTags: this.contextAnalyzer.extractEmotionalTags(text),
        thematicTags: this.contextAnalyzer.extractThematicTags(text),
        temporalMarkers: this.contextAnalyzer.extractTemporalMarkers(text),
        hash: VectorUtils.hashString(text),
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  private removeChunksForFiles(filePaths: string[]): void {
    if (!this.index) return;

    this.index.items = this.index.items.filter(item => !filePaths.includes(item.path));

    for (const path of filePaths) {
      delete this.index.fileHashes[path];
    }
  }

  private async detectChanges(folder: string): Promise<{
    hasChanges: boolean;
    filesToUpdate: TFile[];
    filesToRemove: string[];
  }> {
    console.log('[EnhancedEmbeddingService] Debug - Getting markdown files...');
    const files = this.getMarkdownFilesInFolder(folder);
    console.log('[EnhancedEmbeddingService] Debug - Found', files.length, 'markdown files');

    const cutoff = Date.now() - this.maxDays * TIME_CONSTANTS.MS_PER_DAY;
    console.log('[EnhancedEmbeddingService] Debug - Date cutoff:', new Date(cutoff));

    const filesToUpdate: TFile[] = [];
    const filesToRemove: string[] = [];
    const currentFilePaths = new Set(files.map(f => f.path));

    for (const f of files) {
      const stat = this.app.vault.getAbstractFileByPath(f.path) as TFile;
      const fileDate = TemporalUtils.extractDateFromFilename(f.name) || Date.now();

      if (fileDate < cutoff) {
        console.log('[EnhancedEmbeddingService] Debug - Skipping old file:', f.path, 'date:', new Date(fileDate));
        continue;
      }

      const currentHash = await this.computeFileHash(f);
      const storedHash = this.index!.fileHashes[f.path];

      if (!storedHash || storedHash !== currentHash) {
        console.log('[EnhancedEmbeddingService] Debug - File needs update:', f.path);
        filesToUpdate.push(f);
      }
    }

    for (const path of Object.keys(this.index!.fileHashes)) {
      if (!currentFilePaths.has(path)) {
        filesToRemove.push(path);
      }
    }

    return {
      hasChanges: filesToUpdate.length > SEARCH_CONSTANTS.MIN_RESULT_INDEX || filesToRemove.length > SEARCH_CONSTANTS.MIN_RESULT_INDEX,
      filesToUpdate,
      filesToRemove,
    };
  }

  private async processUpdates(changeResult: { filesToUpdate: TFile[]; filesToRemove: string[] }): Promise<void> {
    console.log(
      `[EnhancedEmbeddingService] Updating ${changeResult.filesToUpdate.length} files, removing ${changeResult.filesToRemove.length} files`
    );

    this.removeChunksForFiles(changeResult.filesToRemove);

    for (const file of changeResult.filesToUpdate) {
      console.log('[EnhancedEmbeddingService] Debug - Processing file:', file.path);
      await this.updateFileChunks(file);
    }
  }

  private async finalizeIndexUpdate(): Promise<void> {
    this.index!.updatedAt = Date.now();
    await this.saveIndex();
    console.log(
      '[EnhancedEmbeddingService] Debug - Index update completed with',
      this.index!.items.length,
      'total items'
    );
  }

  private async computeFileHash(file: TFile): Promise<string> {
    const content = await this.app.vault.read(file);
    const mtime = file.stat?.mtime || SEARCH_CONSTANTS.MIN_RESULT_INDEX;
    return VectorUtils.hashString(content + mtime.toString());
  }

  private getMarkdownFilesInFolder(folder: string): TFile[] {
    const files: TFile[] = [];
    const targetFolder = folder || 'Journal';
    const normalizedFolder = targetFolder.endsWith('/') ? targetFolder : targetFolder + '/';

    const all = this.app.vault.getFiles();
    for (const f of all) {
      if (!f.path.toLowerCase().endsWith('.md')) continue;
      if (f.path.includes('/.trash/') || f.path.includes('/.obsidian/')) continue;

      if (!f.path.startsWith(normalizedFolder)) continue;

      files.push(f);
    }

    return files;
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.index) {
      console.log('[EnhancedEmbeddingService] Debug - Index already loaded with', this.index.items.length, 'items');
      return;
    }

    console.log('[EnhancedEmbeddingService] Debug - Loading index from localStorage...');

    try {
      const vaultName = this.app.vault.getName();
      const storageKey = `nova-journal-enhanced-index-${vaultName}`;
      console.log('[EnhancedEmbeddingService] Debug - Storage key:', storageKey);

      const json = localStorage.getItem(storageKey);
      console.log('[EnhancedEmbeddingService] Debug - JSON found in localStorage:', !!json);

      if (json) {
        const { validateAndParseJSON } = await import('../../utils/Sanitizer');
        const loaded = validateAndParseJSON<EnhancedIndexData>(json);
        console.log(
          '[EnhancedEmbeddingService] Debug - Parsed index version:',
          loaded?.version,
          'expected:',
          this.version
        );
        console.log('[EnhancedEmbeddingService] Debug - Parsed index items count:', loaded?.items?.length || 0);

        if (loaded && loaded.version === this.version) {
          this.index = loaded;
          console.log(
            '[EnhancedEmbeddingService] Debug - Index loaded successfully with',
            this.index.items.length,
            'items'
          );
        } else {
          console.log('[EnhancedEmbeddingService] Debug - Version mismatch, index not loaded');
        }
      } else {
        console.log('[EnhancedEmbeddingService] Debug - No stored index found');
      }
    } catch (error) {
      console.error('[EnhancedEmbeddingService] Debug - Failed to load index:', error);
      this.index = null;
    }

    if (!this.index) {
      console.log('[EnhancedEmbeddingService] Debug - No index available after loading attempt');
    }
  }

  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    const payload = JSON.stringify(this.index);
    localStorage.setItem(`nova-journal-enhanced-index-${this.app.vault.getName()}`, payload);
  }
}
