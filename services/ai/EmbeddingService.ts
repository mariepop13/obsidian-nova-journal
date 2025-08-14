import { App, TFile } from 'obsidian';
import { embed } from '../../ai/EmbeddingClient';
import type { NovaJournalSettings } from '../../settings/PluginSettings';

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
  private readonly indexPath = '.obsidian/plugins/nova-journal/index.json';
  private readonly maxDays = 90;
  private readonly chunkSize = 500;
  private readonly overlap = 100;
  private index: IndexData | null = null;

  constructor(private readonly app: App, private readonly settings: NovaJournalSettings) {}

  async rebuildIndexFromFolder(folder: string): Promise<void> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return;
    const files = this.getMarkdownFilesInFolder(folder);
    const cutoff = Date.now() - this.maxDays * 24 * 60 * 60 * 1000;

    const chunks: { path: string; date: number; text: string }[] = [];
    for (const f of files) {
      const stat = this.app.vault.getAbstractFileByPath(f.path) as TFile;
      const mtime = (stat?.stat?.mtime || Date.now());
      if (mtime < cutoff) continue;
      const content = await this.app.vault.read(stat);
      const pieces = this.splitIntoChunks(content);
      for (const p of pieces) {
        if (p.trim().length === 0) continue;
        chunks.push({ path: f.path, date: mtime, text: p });
      }
    }

    const inputs = chunks.map(c => c.text);
    if (inputs.length === 0) {
      this.index = { model: 'text-embedding-3-small', updatedAt: Date.now(), items: [] };
      await this.saveIndex();
      return;
    }

    const { embeddings } = await embed({ apiKey: this.settings.aiApiKey, inputs });
    const items: IndexedChunk[] = chunks.map((c, i) => ({ ...c, vector: embeddings[i] }));
    this.index = { model: 'text-embedding-3-small', updatedAt: Date.now(), items };
    await this.saveIndex();
  }

  async topK(query: string, k: number): Promise<IndexedChunk[]> {
    await this.ensureIndexLoaded();
    if (!this.index || this.index.items.length === 0) return [];
    const { embeddings } = await embed({ apiKey: this.settings.aiApiKey, inputs: [query] });
    const q = embeddings[0];
    const scored = this.index.items
      .map(item => ({ item, score: this.cosineSimilarity(q, item.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, k))
      .map(s => s.item);
    return scored;
  }

  private getMarkdownFilesInFolder(folder: string): TFile[] {
    const files: TFile[] = [];
    const base = folder.endsWith('/') ? folder : folder + '/';
    const all = this.app.vault.getFiles();
    for (const f of all) {
      if (!f.path.startsWith(base)) continue;
      if (!f.path.toLowerCase().endsWith('.md')) continue;
      files.push(f);
    }
    return files;
  }

  private splitIntoChunks(content: string): string[] {
    const tokens = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      const part = tokens.slice(i, i + this.chunkSize).join(' ').trim();
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

  private async ensureIndexLoaded(): Promise<void> {
    if (this.index) return;
    const file = this.app.vault.getAbstractFileByPath(this.indexPath) as TFile | null;
    if (!file) return;
    try {
      const json = await this.app.vault.read(file);
      this.index = JSON.parse(json) as IndexData;
    } catch {
      this.index = null;
    }
  }

  private async saveIndex(): Promise<void> {
    const payload = JSON.stringify(this.index || { items: [] });
    const existing = this.app.vault.getAbstractFileByPath(this.indexPath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, payload);
      return;
    }
    const parts = this.indexPath.split('/');
    parts.pop();
    let current = '';
    for (const p of parts) {
      current = current ? `${current}/${p}` : p;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
    await this.app.vault.create(this.indexPath, payload);
  }
}


