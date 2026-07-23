export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

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

export interface AddMemoryInput {
  content: string;
  title?: string;
  format?: 'text' | 'markdown' | 'html';
  space?: string;
  spaceId?: string;
  tags?: string[];
  sourceUrl?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  spaceId: string;
  score: number;
  scores: { vector?: number; keyword?: number; fused: number };
  content: string;
  chunkIndex: number;
  document: { id: string; title: string | null; sourceUrl: string | null; connector: string; tags: string[] };
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  hits: SearchHit[];
  tookMs: number;
}

export interface SearchInput {
  q: string;
  mode?: SearchMode;
  space?: string;
  spaceId?: string;
  limit?: number;
  tags?: string[];
  minScore?: number;
  /** Reorder the top results with the server's configured LLM. */
  rerank?: boolean;
}

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

export interface ChatInput {
  message: string;
  space?: string;
  spaceId?: string;
  limit?: number;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface PlaybookInput {
  topic: string;
  space?: string;
  spaceId?: string;
  limit?: number;
  /** Store the playbook as a searchable memory. */
  save?: boolean;
}

export interface PlaybookResponse {
  playbook: { title: string; content: string; citations: Citation[] };
  savedId?: string;
}

export interface TopicsInput {
  space?: string;
  spaceId?: string;
  limit?: number;
  minCount?: number;
}

export interface TopicGroup {
  topic: string;
  count: number;
  sample: { id: string; title: string | null }[];
}

export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  documentCount?: number;
  createdAt: string;
}

export interface ConnectorInfo {
  id: string;
  displayName: string;
  description: string;
  category?: string;
  auth?: string;
  configSchema: unknown[];
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}
