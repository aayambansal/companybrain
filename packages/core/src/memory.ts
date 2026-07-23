import { and, desc, eq, sql } from 'drizzle-orm';
import {
  createDb,
  documents,
  chunks as chunksTable,
  spaces,
  type DbClient,
} from '@companybrain/db';
import { loadConfig, type EngineConfig } from './config.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './embeddings/index.js';
import { createLlmProvider, type LlmProvider } from './llm/index.js';
import type { ImageInput } from './llm/types.js';
import { indexDocument, findBySource } from './ingest.js';
import { hybridSearch } from './search/hybrid.js';
import { llmRerank } from './search/rerank.js';
import { generateAnswer } from './chat.js';
import { enrichDocument } from './enrich.js';
import { dispatchWebhooks } from './webhooks.js';
import { contentHash } from './text/hash.js';
import { normalizeText, markdownToText, htmlToText } from './text/normalize.js';
import type {
  Memory,
  SearchQuery,
  SearchResponse,
  SearchHit,
  ChatResponse,
  SourceDocument,
} from './types.js';

export interface AddMemoryInput {
  orgId: string;
  spaceId?: string;
  spaceSlug?: string;
  title?: string;
  content: string;
  /** Content format hint for normalization. */
  format?: 'text' | 'markdown' | 'html';
  connector?: string;
  sourceType?: string;
  sourceId?: string;
  sourceUrl?: string;
  connectionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Skip creating a new memory if an identical one already exists in the space. */
  dedupe?: boolean;
}

export interface ListMemoriesInput {
  orgId: string;
  spaceId?: string;
  connector?: string;
  limit?: number;
  offset?: number;
}

/**
 * The CompanyBrain engine. One instance owns a DB connection plus the
 * configured embedding and LLM providers, and exposes the operations the API,
 * MCP server, and connectors build on.
 */
export class MemoryEngine {
  config: EngineConfig;
  readonly client: DbClient;
  // Providers can be reconfigured at runtime (e.g. from dashboard settings).
  embedder: EmbeddingProvider;
  llm: LlmProvider;

  constructor(opts: { config?: EngineConfig; client?: DbClient } = {}) {
    this.config = opts.config ?? loadConfig();
    this.client = opts.client ?? createDb(this.config.databaseUrl);
    this.embedder = createEmbeddingProvider(this.config);
    this.llm = createLlmProvider(this.config);
  }

  get db() {
    return this.client.db;
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * Reconfigure the embedding and/or LLM providers at runtime and rebuild the
   * provider instances. Changing the embedding provider does not re-embed
   * existing chunks; reindex if you need comparable scores across providers.
   */
  configureProviders(update: {
    embedding?: Partial<EngineConfig['embedding']>;
    llm?: Partial<EngineConfig['llm']>;
  }): void {
    if (update.embedding) {
      this.config = { ...this.config, embedding: { ...this.config.embedding, ...update.embedding } };
      this.embedder = createEmbeddingProvider(this.config);
    }
    if (update.llm) {
      this.config = { ...this.config, llm: { ...this.config.llm, ...update.llm } };
      this.llm = createLlmProvider(this.config);
    }
  }

  // ── Spaces ───────────────────────────────────────────────────────────────

  /** Resolve a space by id or slug, falling back to the org's default space. */
  async resolveSpaceId(orgId: string, opts: { spaceId?: string; spaceSlug?: string }): Promise<string> {
    if (opts.spaceId) return opts.spaceId;
    if (opts.spaceSlug) {
      const [s] = await this.db
        .select({ id: spaces.id })
        .from(spaces)
        .where(and(eq(spaces.orgId, orgId), eq(spaces.slug, opts.spaceSlug)))
        .limit(1);
      if (s) return s.id;
    }
    return this.getOrCreateDefaultSpace(orgId);
  }

  async getOrCreateDefaultSpace(orgId: string): Promise<string> {
    const [existing] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.orgId, orgId), eq(spaces.isDefault, true)))
      .limit(1);
    if (existing) return existing.id;
    const [created] = await this.db
      .insert(spaces)
      .values({ orgId, name: 'General', slug: 'general', isDefault: true, icon: 'brain' })
      .returning({ id: spaces.id });
    if (!created) throw new Error('failed to create default space');
    return created.id;
  }

  // ── Memories ─────────────────────────────────────────────────────────────

  async addMemory(input: AddMemoryInput): Promise<Memory> {
    const spaceId = await this.resolveSpaceId(input.orgId, {
      spaceId: input.spaceId,
      spaceSlug: input.spaceSlug,
    });
    const normalized = this.normalizeContent(input.content, input.format);
    const hash = contentHash(normalized);

    // Optional dedupe: return an existing identical memory in the same space
    // instead of storing a duplicate.
    if (input.dedupe) {
      const [dupe] = await this.db
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.orgId, input.orgId), eq(documents.spaceId, spaceId), eq(documents.contentHash, hash)))
        .limit(1);
      if (dupe) return this.getMemory(input.orgId, dupe.id) as Promise<Memory>;
    }

    const [doc] = await this.db
      .insert(documents)
      .values({
        orgId: input.orgId,
        spaceId,
        connectionId: input.connectionId ?? null,
        connector: input.connector ?? 'api',
        sourceType: input.sourceType ?? input.format ?? 'text',
        sourceId: input.sourceId ?? null,
        sourceUrl: input.sourceUrl ?? null,
        title: input.title ?? deriveTitle(normalized),
        content: normalized,
        contentHash: hash,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
        status: 'pending',
      })
      .returning();
    if (!doc) throw new Error('failed to insert document');

    await indexDocument(this.db, this.embedder, this.config, doc.id);
    await this.enrichDocumentRow(doc.id, doc.title, normalized, input.tags ?? [], input.metadata ?? {});
    void dispatchWebhooks(this.db, {
      event: 'memory.created',
      orgId: input.orgId,
      data: { id: doc.id, title: doc.title, spaceId, connector: doc.connector },
    }).catch(() => {});
    return this.getMemory(input.orgId, doc.id) as Promise<Memory>;
  }

  /**
   * Best-effort LLM enrichment of a stored document: writes a summary, merges
   * auto-tags, and stashes extracted facts in metadata. No-op without an LLM.
   */
  private async enrichDocumentRow(
    documentId: string,
    title: string | null,
    content: string,
    existingTags: string[],
    existingMeta: Record<string, unknown>,
  ): Promise<void> {
    if (!this.config.enrich.enabled || !this.llm.available) return;
    const enrichment = await enrichDocument(this.llm, { title, content });
    if (!enrichment.summary && !enrichment.tags && !enrichment.facts) return;
    const mergedTags = Array.from(new Set([...existingTags, ...(enrichment.tags ?? [])])).slice(0, 20);
    await this.db
      .update(documents)
      .set({
        summary: enrichment.summary ?? undefined,
        tags: mergedTags,
        metadata: { ...existingMeta, ...(enrichment.facts ? { facts: enrichment.facts } : {}) },
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
  }

  /** Insert-or-update a connector document by (connectionId, sourceId). */
  async upsertSourceDocument(
    orgId: string,
    spaceId: string,
    connectionId: string,
    connector: string,
    src: SourceDocument,
  ): Promise<{ documentId: string; action: 'created' | 'updated' | 'skipped' }> {
    const normalized = this.normalizeContent(src.content, guessFormat(src.sourceType));
    const hash = contentHash(normalized);
    const existing = src.sourceId ? await findBySource(this.db, connectionId, src.sourceId) : null;

    if (existing) {
      if (existing.contentHash === hash) return { documentId: existing.id, action: 'skipped' };
      await this.db
        .update(documents)
        .set({
          title: src.title ?? deriveTitle(normalized),
          content: normalized,
          contentHash: hash,
          sourceUrl: src.sourceUrl ?? null,
          tags: src.tags ?? [],
          metadata: src.metadata ?? {},
          sourceUpdatedAt: src.sourceUpdatedAt ?? null,
          status: 'pending',
          updatedAt: new Date(),
        })
        .where(eq(documents.id, existing.id));
      await indexDocument(this.db, this.embedder, this.config, existing.id);
      await this.enrichDocumentRow(existing.id, src.title ?? null, normalized, src.tags ?? [], src.metadata ?? {});
      return { documentId: existing.id, action: 'updated' };
    }

    const [doc] = await this.db
      .insert(documents)
      .values({
        orgId,
        spaceId,
        connectionId,
        connector,
        sourceType: src.sourceType ?? 'text',
        sourceId: src.sourceId ?? null,
        sourceUrl: src.sourceUrl ?? null,
        title: src.title ?? deriveTitle(normalized),
        content: normalized,
        contentHash: hash,
        tags: src.tags ?? [],
        metadata: src.metadata ?? {},
        sourceCreatedAt: src.sourceCreatedAt ?? null,
        sourceUpdatedAt: src.sourceUpdatedAt ?? null,
        status: 'pending',
      })
      .returning();
    if (!doc) throw new Error('failed to insert connector document');
    await indexDocument(this.db, this.embedder, this.config, doc.id);
    await this.enrichDocumentRow(doc.id, src.title ?? null, normalized, src.tags ?? [], src.metadata ?? {});
    return { documentId: doc.id, action: 'created' };
  }

  async getMemory(orgId: string, id: string): Promise<Memory | null> {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
      .limit(1);
    return doc ? toMemory(doc) : null;
  }

  async listMemories(input: ListMemoriesInput): Promise<{ memories: Memory[]; total: number }> {
    const conds = [eq(documents.orgId, input.orgId)];
    if (input.spaceId) conds.push(eq(documents.spaceId, input.spaceId));
    if (input.connector) conds.push(eq(documents.connector, input.connector));
    const where = and(...conds);

    const rows = await this.db
      .select()
      .from(documents)
      .where(where)
      .orderBy(desc(documents.createdAt))
      .limit(input.limit ?? 50)
      .offset(input.offset ?? 0);

    const countRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(where);

    return { memories: rows.map(toMemory), total: countRows[0]?.count ?? 0 };
  }

  async updateMemory(
    orgId: string,
    id: string,
    patch: { title?: string; content?: string; tags?: string[]; spaceId?: string; metadata?: Record<string, unknown> },
  ): Promise<Memory | null> {
    const existing = await this.getMemory(orgId, id);
    if (!existing) return null;
    const contentChanged = patch.content !== undefined && patch.content !== existing.content;
    const normalized = patch.content !== undefined ? normalizeText(patch.content) : undefined;
    await this.db
      .update(documents)
      .set({
        title: patch.title ?? undefined,
        content: normalized,
        contentHash: normalized ? contentHash(normalized) : undefined,
        tags: patch.tags ?? undefined,
        spaceId: patch.spaceId ?? undefined,
        metadata: patch.metadata ?? undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.orgId, orgId), eq(documents.id, id)));
    if (contentChanged) {
      await indexDocument(this.db, this.embedder, this.config, id);
    }
    return this.getMemory(orgId, id);
  }

  async deleteMemory(orgId: string, id: string): Promise<boolean> {
    const res = await this.db
      .delete(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
      .returning({ id: documents.id });
    return res.length > 0;
  }

  /**
   * Re-chunk and re-embed every document (optionally in one space). Needed after
   * switching the embedding provider so all vectors are comparable. Runs
   * sequentially; a single failing document does not abort the rest.
   */
  async reindexAll(
    orgId: string,
    opts: { spaceId?: string; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<{ documents: number; failed: number }> {
    const conds = [eq(documents.orgId, orgId)];
    if (opts.spaceId) conds.push(eq(documents.spaceId, opts.spaceId));
    const rows = await this.db.select({ id: documents.id }).from(documents).where(and(...conds));
    let failed = 0;
    let done = 0;
    for (const r of rows) {
      try {
        await indexDocument(this.db, this.embedder, this.config, r.id);
      } catch {
        failed += 1;
      }
      done += 1;
      opts.onProgress?.(done, rows.length);
    }
    return { documents: rows.length, failed };
  }

  // ── Search & chat ─────────────────────────────────────────────────────────

  async search(orgId: string, query: SearchQuery): Promise<SearchResponse> {
    const started = Date.now();
    const spaceId = query.spaceId ?? (query.spaceSlug ? await this.resolveSpaceId(orgId, { spaceSlug: query.spaceSlug }) : undefined);
    const mode = query.mode ?? 'hybrid';
    const needsVector = mode === 'hybrid' || mode === 'semantic';
    const queryEmbedding = needsVector ? await this.embedder.embedQuery(query.q) : [];
    let hits = await hybridSearch(this.client.sql, {
      orgId,
      spaceId,
      q: query.q,
      queryEmbedding,
      mode,
      limit: query.limit ?? 10,
      tags: query.tags,
      minScore: query.minScore,
    });
    if (query.rerank && this.llm.available) {
      hits = await llmRerank(this.llm, query.q, hits);
    }
    return { query: query.q, mode, hits, tookMs: Date.now() - started };
  }

  /** OCR + caption an image with the configured vision LLM. Throws if none. */
  async describeImage(image: ImageInput, prompt?: string): Promise<string> {
    if (!this.llm.supportsVision || !this.llm.describeImage) {
      throw new Error(
        'No vision-capable LLM configured. Set LLM_PROVIDER to anthropic or openai (with a vision model) to read images.',
      );
    }
    return this.llm.describeImage(image, prompt);
  }

  /** Transcribe audio bytes with the configured provider. Throws if none. */
  async transcribeAudio(audio: ImageInput): Promise<string> {
    if (!this.llm.supportsAudio || !this.llm.transcribeAudio) {
      throw new Error('No audio-capable provider configured. Set LLM_PROVIDER to openai to transcribe audio.');
    }
    return this.llm.transcribeAudio(audio);
  }

  /** Find memories similar to a given one (semantic "see also"), excluding itself. */
  async related(orgId: string, documentId: string, limit = 5): Promise<SearchHit[]> {
    const mem = await this.getMemory(orgId, documentId);
    if (!mem?.content) return [];
    const seed = mem.content.slice(0, 2000);
    const queryEmbedding = await this.embedder.embedQuery(seed);
    const hits = await hybridSearch(this.client.sql, {
      orgId,
      spaceId: mem.spaceId,
      q: seed.slice(0, 500),
      queryEmbedding,
      mode: 'semantic',
      limit: limit * 4,
    });
    const seen = new Set<string>([documentId]);
    const out: SearchHit[] = [];
    for (const h of hits) {
      if (seen.has(h.documentId)) continue;
      seen.add(h.documentId);
      out.push(h);
      if (out.length >= limit) break;
    }
    return out;
  }

  async chat(
    orgId: string,
    message: string,
    opts: { spaceId?: string; spaceSlug?: string; limit?: number; history?: { role: 'user' | 'assistant'; content: string }[] } = {},
  ): Promise<ChatResponse> {
    const { hits } = await this.search(orgId, {
      q: message,
      spaceId: opts.spaceId,
      spaceSlug: opts.spaceSlug,
      mode: 'hybrid',
      limit: opts.limit ?? 8,
    });
    return generateAnswer(this.llm, message, hits, opts.history ?? []);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private normalizeContent(content: string, format?: 'text' | 'markdown' | 'html'): string {
    if (format === 'markdown') return normalizeText(markdownToText(content));
    if (format === 'html') return normalizeText(htmlToText(content));
    return normalizeText(content);
  }
}

function toMemory(doc: typeof documents.$inferSelect): Memory {
  return {
    id: doc.id,
    spaceId: doc.spaceId,
    title: doc.title,
    content: doc.content,
    summary: doc.summary,
    connector: doc.connector,
    sourceType: doc.sourceType,
    sourceUrl: doc.sourceUrl,
    tags: doc.tags,
    metadata: doc.metadata,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function deriveTitle(content: string): string {
  const firstLine = content.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return firstLine.slice(0, 120) || 'Untitled';
}

function guessFormat(sourceType?: string): 'text' | 'markdown' | 'html' | undefined {
  if (!sourceType) return undefined;
  if (sourceType.includes('markdown') || sourceType === 'md') return 'markdown';
  if (sourceType.includes('html')) return 'html';
  return undefined;
}
