import type { EngineConfig } from '../config.js';
import { STORAGE_DIMENSIONS } from '../config.js';
import type { EmbeddingProvider } from './types.js';
import { LocalEmbeddingProvider } from './local.js';
import { OpenAIEmbeddingProvider } from './openai.js';
import { OllamaEmbeddingProvider } from './ollama.js';
import { GoogleEmbeddingProvider } from './google.js';

export * from './types.js';
export {
  LocalEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
  GoogleEmbeddingProvider,
};

/** Build an embedding provider from engine config. */
export function createEmbeddingProvider(config: EngineConfig): EmbeddingProvider {
  const e = config.embedding;
  switch (e.provider) {
    case 'openai':
      return new OpenAIEmbeddingProvider({
        apiKey: e.openaiApiKey ?? '',
        model: e.model,
        dimensions: STORAGE_DIMENSIONS,
      });
    case 'ollama':
      return new OllamaEmbeddingProvider({ model: e.model, baseUrl: e.ollamaBaseUrl });
    case 'google':
      return new GoogleEmbeddingProvider({ apiKey: e.googleApiKey ?? '', model: e.model });
    case 'local':
    default:
      return new LocalEmbeddingProvider(STORAGE_DIMENSIONS);
  }
}

/**
 * Coerce any provider's output to the fixed storage dimension.
 * Smaller vectors are zero-padded (preserves cosine similarity exactly);
 * larger vectors are truncated (valid for Matryoshka-style embeddings).
 */
export function toStorageVector(embedding: number[], dim = STORAGE_DIMENSIONS): number[] {
  if (embedding.length === dim) return embedding;
  if (embedding.length > dim) return embedding.slice(0, dim);
  const out = embedding.slice();
  while (out.length < dim) out.push(0);
  return out;
}

/** Serialize a vector into the pgvector text format: `[1,2,3]`. */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
