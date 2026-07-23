import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from './types.js';

/**
 * Zero-config, dependency-free embedding provider.
 *
 * It hashes token unigrams and bigrams into a fixed-dimension vector (a hashed
 * bag-of-n-grams), applies sublinear term weighting, and L2-normalizes. This is
 * deterministic and requires no model download or API key, which makes it a
 * good default for local dev and small vaults. It captures lexical overlap
 * rather than deep semantics; switch to `openai` / `ollama` / `google` for
 * true semantic recall.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'local';
  readonly model = 'cb-hash-embed-v1';
  readonly dimensions: number;

  constructor(dimensions = 1536) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embedOne(text);
  }

  private embedOne(text: string): number[] {
    const dim = this.dimensions;
    const vec = new Float64Array(dim);
    const tokens = tokenize(text);
    if (tokens.length === 0) return Array.from(vec);

    const counts = new Map<string, number>();
    const add = (term: string) => counts.set(term, (counts.get(term) ?? 0) + 1);
    for (let i = 0; i < tokens.length; i++) {
      add(tokens[i]!);
      if (i + 1 < tokens.length) add(`${tokens[i]}_${tokens[i + 1]}`); // bigram
    }

    for (const [term, count] of counts) {
      const weight = 1 + Math.log(count); // sublinear tf
      // Two hashes give a signed contribution to reduce collisions.
      const h1 = hashToIndex(term, dim);
      const sign = hashSign(term);
      vec[h1] = (vec[h1] ?? 0) + weight * sign;
    }

    // L2 normalize.
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vec[i]! * vec[i]!;
    norm = Math.sqrt(norm) || 1;
    const out = new Array<number>(dim);
    for (let i = 0; i < dim; i++) out[i] = vec[i]! / norm;
    return out;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 40);
}

function hashToIndex(term: string, dim: number): number {
  const h = createHash('md5').update(term).digest();
  // Use 4 bytes as an unsigned int.
  const n = h.readUInt32BE(0);
  return n % dim;
}

function hashSign(term: string): 1 | -1 {
  const h = createHash('md5').update(`sign:${term}`).digest();
  return (h[0]! & 1) === 0 ? 1 : -1;
}
