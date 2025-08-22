import { App, TFile } from 'obsidian';
import { embed } from '../../ai/EmbeddingClient';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import { EMBEDDING_CONFIG, TIME_CONSTANTS, CONTENT_LIMITS } from '../shared/Constants';

type IndexedChunk = {
  path: string;
  date: number;
  text: string;
  vector: number[];
};

type IndexData = {
  model: string;
  updatedAt: number;
  items: IndexedChunk[];
};

export class EmbeddingService {
  private readonly indexPath = 'nova-journal-index.json';
  private readonly maxDays = 90;
  private readonly chunkSize = EMBEDDING_CONFIG.DEFAULT_CHUNK_SIZE;
  private readonly overlap = EMBEDDING_CONFIG.DEFAULT_OVERLAP;
  private readonly maxChunksPerBatch = EMBEDDING_CONFIG.MAX_CHUNKS_LARGE_BATCH;
  private index: IndexData | null = null;

  constructor(
    private readonly app: App,
    private readonly settings: NovaJournalSettings
  ) {}

  async rebuildIndexFromFolder(folder: string): Promise<void> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return;

    try {
      const chunks = await this.collectFileChunks(folder);
      if (chunks.length === 0) {
        await this.createEmptyIndex();
        return;
      }

      const embeddings = await this.generateEmbeddings(chunks);
      const items = this.buildIndexItems(chunks, embeddings);

      this.index = {
        model: 'text-embedding-3-small',
        updatedAt: Date.now(),
        items,
      };
      await this.saveIndex();
    } catch (error) {
      await this.createEmptyIndex();
    }
  }

  async topK(query: string, k: number): Promise<IndexedChunk[]> {
    try {
      await this.ensureIndexLoaded();
      if (!this.index || this.index.items.length === 0) return [];

      const { embeddings } = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: [query.trim()],
      });

      if (!embeddings || embeddings.length === 0) return [];

      const q = embeddings[0];
      const scored = this.index.items
        .filter(item => item.vector && item.vector.length > 0)
        .map(item => ({
          item: {
            ...item,
            text: `[${this.formatDate(item.date)}] ${item.text}`,
          },
          score: this.cosineSimilarity(q, item.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, k))
        .map(s => s.item);
      return scored;
    } catch {
      return [];
    }
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} semaines`;
    return date.toLocaleDateString('fr-FR', {
      month: 'long',
      day: 'numeric',
    });
  }

  private getMarkdownFilesInFolder(folder: string): TFile[] {
    const files: TFile[] = [];
    const targetFolder = folder ?? 'Journal';
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

  private splitIntoChunks(content: string): string[] {
    const tokens = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      const part = tokens
        .slice(i, i + this.chunkSize)
        .join(' ')
        .trim();
      if (part) chunks.push(part);
      if (i + this.chunkSize >= tokens.length) break;
      i += this.chunkSize - this.overlap;
      if (i < 0) i = 0;
    }
    return chunks;
  }

  private async collectFileChunks(folder: string): Promise<{ path: string; date: number; text: string }[]> {
    const files = this.getMarkdownFilesInFolder(folder);
    const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;
    const chunks: { path: string; date: number; text: string }[] = [];

    for (const f of files) {
      try {
        const stat = this.app.vault.getAbstractFileByPath(f.path) as TFile;
        const mtime = stat?.stat?.mtime ?? Date.now();
        if (mtime < cutoff) continue;

        const content = await this.app.vault.read(stat);
        const pieces = this.splitIntoChunks(content);
        for (const p of pieces) {
          const cleaned = p.trim();
          if (cleaned.length < 50) continue;
          chunks.push({ path: f.path, date: mtime, text: cleaned });
        }
      } catch {
        continue;
      }
    }

    return chunks;
  }

  private async generateEmbeddings(chunks: { path: string; date: number; text: string }[]): Promise<number[][]> {
    const inputs = chunks.map(c => c.text).filter(t => t.length > 0);

    const limitedInputs = inputs.slice(0, this.maxChunksPerBatch);

    try {
      const resp = await embed({
        apiKey: this.settings.aiApiKey,
        inputs: limitedInputs,
      });
      return Array.isArray(resp?.embeddings) ? resp.embeddings : [];
    } catch (err) {
      console.error('[EmbeddingService] embed() failed', err);
      return [];
    }
  }

  private buildIndexItems(
    chunks: { path: string; date: number; text: string }[],
    embeddings: number[][]
  ): IndexedChunk[] {
    const limitedChunks = chunks.slice(0, this.maxChunksPerBatch);
    const items: IndexedChunk[] = [];

    for (let i = 0; i < limitedChunks.length; i += 1) {
      const vec = embeddings[i];
      if (!Array.isArray(vec) || vec.length === 0) continue;
      items.push({
        ...limitedChunks[i],
        vector: vec,
      });
    }

    return items;
  }

  private async createEmptyIndex(): Promise<void> {
    this.index = {
      model: 'text-embedding-3-small',
      updatedAt: Date.now(),
      items: [],
    };
    await this.saveIndex();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0,
      na = 0,
      nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.index) return;
    try {
      const json = localStorage.getItem(`nova-journal-index-${this.app.vault.getName()}`);
      if (json) {
        const { validateAndParseJSON } = await import('../../utils/Sanitizer');
        this.index = validateAndParseJSON<IndexData>(json) ?? null;
      }
    } catch {
      this.index = null;
    }
  }

  private async saveIndex(): Promise<void> {
    const payload = JSON.stringify(this.index ?? { items: [] });
    localStorage.setItem(`nova-journal-index-${this.app.vault.getName()}`, payload);
  }
}
