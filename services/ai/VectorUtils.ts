import type { EnhancedIndexedChunk } from './EnhancedEmbeddingService';

export class VectorUtils {
  static cosineSimilarity(a: number[], b: number[]): number {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
    const len = Math.min(a.length, b.length);
    let dot = 0,
      na = 0,
      nb = 0;

    for (let i = 0; i < len; i += 1) {
      const ai = a[i] || 0;
      const bi = b[i] || 0;
      dot += ai * bi;
      na += ai * ai;
      nb += bi * bi;
    }

    const denom = Math.sqrt(na) * Math.sqrt(nb);
    const EPS = 1e-12;
    if (!isFinite(denom) || denom < EPS) return 0;
    return dot / denom;
  }

  static applyDiversityFilter(
    scored: Array<{ item: EnhancedIndexedChunk; score: number }>,
    threshold: number
  ): Array<{ item: EnhancedIndexedChunk; score: number }> {
    if (threshold <= 0) return scored;

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const result: Array<{ item: EnhancedIndexedChunk; score: number }> = [];

    for (const candidate of sorted) {
      if (!Array.isArray(candidate.item.vector) || candidate.item.vector.length === 0) continue;
      let shouldInclude = true;

      for (const existing of result) {
        const ev = existing.item.vector;
        if (!Array.isArray(ev) || ev.length === 0) continue;
        const similarity = VectorUtils.cosineSimilarity(candidate.item.vector, ev);
        if (!isFinite(similarity)) {
          shouldInclude = false;
          break;
        }
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

  static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  static splitIntoChunks(content: string, chunkSize = 250, overlap = 75): string[] {
    const tokens = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const part = tokens
        .slice(i, i + chunkSize)
        .join(' ')
        .trim();
      if (part) chunks.push(part);
      if (i + chunkSize >= tokens.length) break;
      i += chunkSize - overlap;
      if (i < 0) i = 0;
    }
    return chunks;
  }
}
