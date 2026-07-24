import { and, eq } from 'drizzle-orm';
import { chunks as chunksTable, documents } from '@companybrain/db';
import type { Database } from '@companybrain/db';
import type { EmbeddingProvider } from './embeddings/index.js';
import { toStorageVector } from './embeddings/index.js';
import { chunkText } from './text/chunk.js';
import { estimateTokens } from './text/tokens.js';
import { normalizeText } from './text/normalize.js';
import type { EngineConfig } from './config.js';

export interface IndexResult {
  documentId: string;
  chunks: number;
  tokens: number;
}

/**
 * Index (or re-index) a stored document: normalize -> chunk -> embed -> replace
 * chunk rows. Assumes the `documents` row already exists.
 */
export async function indexDocument(
  db: Database,
  embedder: EmbeddingProvider,
  config: EngineConfig,
  documentId: string,
): Promise<IndexResult> {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) throw new Error(`document ${documentId} not found`);

  await db
    .update(documents)
    .set({ status: 'processing', error: null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  try {
    const text = normalizeText(doc.content ?? '');
    const pieces = chunkText(text, config.chunk);

    // Replace any existing chunks (idempotent re-index).
    await db.delete(chunksTable).where(eq(chunksTable.documentId, documentId));

    let totalTokens = 0;
    if (pieces.length > 0) {
      // Embed in batches so a large document does not exceed the provider's
      // per-request limits (e.g. OpenAI caps a request at 2048 inputs / ~300k
      // tokens); one embed call for a whole book would otherwise fail.
      const EMBED_BATCH = 96;
      const vectors: number[][] = [];
      for (let i = 0; i < pieces.length; i += EMBED_BATCH) {
        const batch = pieces.slice(i, i + EMBED_BATCH).map((p) => p.content);
        vectors.push(...(await embedder.embed(batch)));
      }
      const rows = pieces.map((p, i) => {
        totalTokens += p.tokenCount;
        return {
          orgId: doc.orgId,
          documentId: doc.id,
          spaceId: doc.spaceId,
          chunkIndex: p.index,
          content: p.content,
          tokenCount: p.tokenCount,
          embedding: toStorageVector(vectors[i] ?? [], config.embedding.dimensions),
          metadata: {},
        };
      });
      // Insert in batches to keep statements bounded.
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(chunksTable).values(rows.slice(i, i + BATCH));
      }
    }

    await db
      .update(documents)
      .set({
        status: 'indexed',
        tokenCount: totalTokens || estimateTokens(text),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return { documentId, chunks: pieces.length, tokens: totalTokens };
  } catch (err) {
    await db
      .update(documents)
      .set({ status: 'failed', error: String(err), updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    throw err;
  }
}

/** Look up an existing document by connection + source id (for connector upserts). */
export async function findBySource(
  db: Database,
  connectionId: string,
  sourceId: string,
): Promise<{ id: string; contentHash: string | null } | null> {
  const [row] = await db
    .select({ id: documents.id, contentHash: documents.contentHash })
    .from(documents)
    .where(and(eq(documents.connectionId, connectionId), eq(documents.sourceId, sourceId)))
    .limit(1);
  return row ?? null;
}
