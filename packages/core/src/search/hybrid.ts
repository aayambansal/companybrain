import type { Sql } from 'postgres';
import type { SearchHit, SearchMode } from '../types.js';
import { toPgVector } from '../embeddings/index.js';
import { reciprocalRankFusion } from './rrf.js';

interface Candidate {
  chunk_id: string;
  document_id: string;
  space_id: string;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  doc_title: string | null;
  doc_url: string | null;
  doc_connector: string;
  doc_tags: string[];
  score: number;
}

export interface HybridSearchParams {
  orgId: string;
  spaceId?: string | null;
  q: string;
  queryEmbedding: number[];
  mode?: SearchMode;
  limit?: number;
  tags?: string[];
  minScore?: number;
  /** How many candidates to pull per arm before fusing. */
  poolSize?: number;
}

/**
 * Hybrid retrieval over the `chunks` table: a vector arm (pgvector cosine) and
 * a keyword arm (Postgres full-text), fused with reciprocal rank fusion.
 */
export async function hybridSearch(sql: Sql, params: HybridSearchParams): Promise<SearchHit[]> {
  const mode: SearchMode = params.mode ?? 'hybrid';
  const limit = params.limit ?? 10;
  const pool = params.poolSize ?? Math.max(20, limit * 4);
  const spaceId = params.spaceId ?? null;
  const tags = params.tags && params.tags.length > 0 ? params.tags : null;

  const wantVector = mode === 'hybrid' || mode === 'semantic';
  const wantKeyword = mode === 'hybrid' || mode === 'keyword';

  const [vectorHits, keywordHits] = await Promise.all([
    wantVector ? vectorArm(sql, params, spaceId, tags, pool) : Promise.resolve<Candidate[]>([]),
    wantKeyword ? keywordArm(sql, params, spaceId, tags, pool) : Promise.resolve<Candidate[]>([]),
  ]);

  // Single-arm modes: return directly with normalized scores.
  if (mode === 'semantic') return toHits(vectorHits, limit, params.minScore, 'vector');
  if (mode === 'keyword') return toHits(keywordHits, limit, params.minScore, 'keyword');

  // Hybrid: fuse with RRF.
  const fused = reciprocalRankFusion<Candidate>(
    [
      { items: vectorHits, weight: 1 },
      { items: keywordHits, weight: 1 },
    ],
    (c) => c.chunk_id,
    60,
  );

  const byId = new Map<string, { vector?: number; keyword?: number }>();
  vectorHits.forEach((c) => byId.set(c.chunk_id, { ...byId.get(c.chunk_id), vector: c.score }));
  keywordHits.forEach((c) => byId.set(c.chunk_id, { ...byId.get(c.chunk_id), keyword: c.score }));

  const maxFused = fused[0]?.score ?? 1;
  return fused
    .slice(0, limit)
    .map(({ item, score }) => {
      const comp = byId.get(item.chunk_id) ?? {};
      const fusedNorm = maxFused > 0 ? score / maxFused : 0;
      return buildHit(item, fusedNorm, { ...comp, fused: fusedNorm });
    })
    .filter((h) => (params.minScore ? h.score >= params.minScore : true));
}

async function vectorArm(
  sql: Sql,
  params: HybridSearchParams,
  spaceId: string | null,
  tags: string[] | null,
  pool: number,
): Promise<Candidate[]> {
  const vec = toPgVector(params.queryEmbedding);
  const rows = await sql<Candidate[]>`
    SELECT c.id AS chunk_id, c.document_id, c.space_id, c.content, c.chunk_index,
           c.metadata, d.title AS doc_title, d.source_url AS doc_url,
           d.connector AS doc_connector, d.tags AS doc_tags,
           1 - (c.embedding <=> ${vec}::vector) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.org_id = ${params.orgId}
      AND c.embedding IS NOT NULL
      ${spaceId ? sql`AND c.space_id = ${spaceId}` : sql``}
      ${tags ? sql`AND d.tags ?| ${tags}` : sql``}
    ORDER BY c.embedding <=> ${vec}::vector
    LIMIT ${pool}
  `;
  return rows;
}

async function keywordArm(
  sql: Sql,
  params: HybridSearchParams,
  spaceId: string | null,
  tags: string[] | null,
  pool: number,
): Promise<Candidate[]> {
  const rows = await sql<Candidate[]>`
    SELECT c.id AS chunk_id, c.document_id, c.space_id, c.content, c.chunk_index,
           c.metadata, d.title AS doc_title, d.source_url AS doc_url,
           d.connector AS doc_connector, d.tags AS doc_tags,
           ts_rank(c.tsv, plainto_tsquery('english', ${params.q})) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.org_id = ${params.orgId}
      AND c.tsv @@ plainto_tsquery('english', ${params.q})
      ${spaceId ? sql`AND c.space_id = ${spaceId}` : sql``}
      ${tags ? sql`AND d.tags ?| ${tags}` : sql``}
    ORDER BY score DESC
    LIMIT ${pool}
  `;
  return rows;
}

function toHits(
  candidates: Candidate[],
  limit: number,
  minScore: number | undefined,
  arm: 'vector' | 'keyword',
): SearchHit[] {
  const max = candidates[0]?.score ?? 1;
  return candidates
    .slice(0, limit)
    .map((c) => {
      const norm = max > 0 ? c.score / max : 0;
      return buildHit(c, norm, { [arm]: c.score, fused: norm });
    })
    .filter((h) => (minScore ? h.score >= minScore : true));
}

function buildHit(
  c: Candidate,
  score: number,
  scores: { vector?: number; keyword?: number; fused: number },
): SearchHit {
  return {
    chunkId: c.chunk_id,
    documentId: c.document_id,
    spaceId: c.space_id,
    score,
    scores,
    content: c.content,
    chunkIndex: c.chunk_index,
    document: {
      id: c.document_id,
      title: c.doc_title,
      sourceUrl: c.doc_url,
      connector: c.doc_connector,
      tags: Array.isArray(c.doc_tags) ? c.doc_tags : [],
    },
    metadata: c.metadata ?? {},
  };
}
