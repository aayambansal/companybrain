/**
 * Core domain types shared across the CompanyBrain engine, API, connectors, and SDKs.
 */

/** A source-agnostic document produced by a connector, before ingestion. */
export interface SourceDocument {
  /** Stable identifier in the source system, used for dedupe/upsert. */
  sourceId?: string;
  /** Where this came from, e.g. 'markdown', 'slack_message', 'pdf'. */
  sourceType?: string;
  sourceUrl?: string;
  title?: string;
  /** The raw or normalized text content. */
  content: string;
  /** Optional pre-rendered summary. */
  summary?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  sourceCreatedAt?: Date;
  sourceUpdatedAt?: Date;
}

/** A single retrievable passage after chunking. */
export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

/** The unit CompanyBrain stores and returns. */
export interface Memory {
  id: string;
  spaceId: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  connector: string;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

export interface SearchQuery {
  q: string;
  spaceId?: string;
  spaceSlug?: string;
  mode?: SearchMode;
  limit?: number;
  /** Filter chunks by document tags (any-of). */
  tags?: string[];
  /** Minimum fused score to include (0..1-ish). */
  minScore?: number;
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  spaceId: string;
  score: number;
  /** Component scores for transparency/debugging. */
  scores: { vector?: number; keyword?: number; fused: number };
  content: string;
  chunkIndex: number;
  document: {
    id: string;
    title: string | null;
    sourceUrl: string | null;
    connector: string;
    tags: string[];
  };
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  hits: SearchHit[];
  tookMs: number;
}

/** A citation returned by RAG chat, pointing back at a chunk. */
export interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  title: string | null;
  sourceUrl: string | null;
  snippet: string;
}

export interface ChatResponse {
  message: string;
  citations: Citation[];
  usedHits: SearchHit[];
}

// ── Connector contract ─────────────────────────────────────────────────────

export interface ConfigField {
  key: string;
  label: string;
  type: 'string' | 'password' | 'number' | 'boolean' | 'path' | 'url' | 'select';
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  default?: unknown;
}

export interface ConnectorContext {
  /** Connection-specific config the user provided. */
  config: Record<string, unknown>;
  /** Decrypted credentials, if any. */
  credentials: Record<string, unknown>;
  /** Opaque cursor from the last sync, for incremental pulls. */
  cursor?: string | null;
  /** Called by the connector to persist a new cursor mid-sync. */
  setCursor?: (cursor: string) => void | Promise<void>;
  /** Structured logging back to the sync run. */
  log?: (message: string, meta?: Record<string, unknown>) => void;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface Connector {
  /** Stable id, e.g. 'obsidian'. */
  id: string;
  displayName: string;
  description: string;
  /** Category for grouping in the UI. */
  category?: 'files' | 'docs' | 'chat' | 'code' | 'web' | 'other';
  /** What the dashboard asks the user to configure. */
  configSchema: ConfigField[];
  /** Auth style, informational for the UI. */
  auth?: 'none' | 'apiKey' | 'oauth' | 'path';
  /** Pull documents from the source. Called for full and incremental syncs. */
  pull(ctx: ConnectorContext): AsyncIterable<SourceDocument>;
}
