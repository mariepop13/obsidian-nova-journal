import type { EnhancedIndexedChunk } from './EnhancedEmbeddingService';

export class VectorUtils {
  static cosineSimilarity(a: number[], b: number[]): number {
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

  static applyDiversityFilter(
    scored: Array<{ item: EnhancedIndexedChunk; score: number }>, 
    threshold: number
  ): Array<{ item: EnhancedIndexedChunk; score: number }> {
    if (threshold <= 0) return scored;

    const result: Array<{ item: EnhancedIndexedChunk; score: number }> = [];
    
    for (const candidate of scored) {
      let shouldInclude = true;
      
      for (const existing of result) {
        const similarity = VectorUtils.cosineSimilarity(candidate.item.vector, existing.item.vector);
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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  static splitIntoChunks(content: string, chunkSize: number = 250, overlap: number = 75): string[] {
    const tokens = content.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;
    
    while (i < tokens.length) {
      const part = tokens
        .slice(i, i + chunkSize)
        .join(" ")
        .trim();
      if (part) chunks.push(part);
      if (i + chunkSize >= tokens.length) break;
      i += chunkSize - overlap;
      if (i < 0) i = 0;
    }
    return chunks;
  }
}
