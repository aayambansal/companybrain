// Public surface of the CompanyBrain memory engine.
export * from './types.js';
export * from './config.js';
export * from './memory.js';

// Text utilities
export { chunkText } from './text/chunk.js';
export { estimateTokens } from './text/tokens.js';
export { contentHash } from './text/hash.js';
export { normalizeText, markdownToText, htmlToText } from './text/normalize.js';

// Embeddings
export {
  createEmbeddingProvider,
  toStorageVector,
  toPgVector,
  LocalEmbeddingProvider,
  OpenAIEmbeddingProvider,
  OllamaEmbeddingProvider,
  GoogleEmbeddingProvider,
} from './embeddings/index.js';
export type { EmbeddingProvider } from './embeddings/index.js';

// LLM
export { createLlmProvider, AnthropicProvider, OpenAIProvider, OllamaProvider, NoopLlmProvider } from './llm/index.js';
export type { LlmProvider, LlmMessage, CompleteOptions } from './llm/index.js';

// Search
export { hybridSearch } from './search/hybrid.js';
export { reciprocalRankFusion } from './search/rrf.js';

// Ingest & chat
export { indexDocument, findBySource } from './ingest.js';
export { generateAnswer, extractiveAnswer, buildContext, toCitations } from './chat.js';
