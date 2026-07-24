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
export {
  createLlmProvider,
  AnthropicProvider,
  OpenAIProvider,
  OllamaProvider,
  NoopLlmProvider,
} from './llm/index.js';
export type { LlmProvider, LlmMessage, CompleteOptions } from './llm/index.js';

// Search
export { hybridSearch } from './search/hybrid.js';
export { reciprocalRankFusion } from './search/rrf.js';
export {
  llmRerank,
  llmRerankPointwise,
  applyRerankOrder,
  parseOrder,
  parseScores,
} from './search/rerank.js';
export {
  hypotheticalDocument,
  hypotheticalDocuments,
  hydePrompt,
  blendVectors,
} from './search/hyde.js';

// Ingest, chat & enrichment
export { indexDocument, findBySource } from './ingest.js';
export {
  generateAnswer,
  extractiveAnswer,
  buildContext,
  toCitations,
  recentHistory,
  MAX_CHAT_HISTORY,
} from './chat.js';
export {
  generatePlaybook,
  buildPlaybookPrompt,
  extractTitle,
  PLAYBOOK_SYSTEM,
  type PlaybookResult,
} from './playbook.js';
export { buildTopics, buildTopic, type Topic, type TopicRow } from './topics.js';
export { generateDigest, buildDigestPrompt, type DigestResult } from './digest.js';
export { enrichDocument, parseEnrichment, type Enrichment } from './enrich.js';
export { dispatchWebhooks, signWebhook, type WebhookEvent } from './webhooks.js';
export { parseDataUrl } from './vision.js';
export {
  describeVideo,
  hasFfmpeg,
  probeDurationSec,
  composeVideoText,
  formatTimestamp,
  type VideoDeps,
  type VideoOptions,
  type VideoResult,
  type VideoFrame,
} from './video.js';
export type { ImageInput } from './llm/types.js';
