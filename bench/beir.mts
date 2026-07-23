/**
 * BEIR retrieval benchmark for CompanyBrain.
 *
 * Ingests a BEIR dataset's corpus through CompanyBrain's real ingest pipeline
 * (chunk -> embed -> index) into a dedicated space, then runs the dataset's
 * TEST queries in each retrieval mode and writes a TREC-format run file per
 * mode. Score the runs with `bench/trec_eval.py` (uses pytrec_eval, the
 * standard TREC evaluator) to get nDCG@10 / Recall@k / MRR that are directly
 * comparable to the public BEIR leaderboard.
 *
 *   BEIR_DIR=/path/to/beir DATABASE_URL=... EMBEDDING_PROVIDER=openai \
 *   OPENAI_API_KEY=... node_modules/.bin/tsx bench/beir.mts scifact
 *
 * Env: ORG_ID (single-user org), BEIR_DIR (dir holding <dataset>/), CONCURRENCY.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryEngine } from '../packages/core/src/index.js';

const dataset = process.argv[2];
if (!dataset) throw new Error('usage: tsx bench/beir.mts <dataset>');

const BEIR_DIR = process.env.BEIR_DIR ?? join(process.cwd(), 'bench', 'beir');
const ORG_ID = process.env.ORG_ID ?? '';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? '24');
// VARIANT suffixes the space and run-file names so A/B configs (e.g. different
// embedding models) can be evaluated without clobbering each other.
const VARIANT = process.env.VARIANT ? `_${process.env.VARIANT}` : '';
const SPACE = `beir_${dataset}${VARIANT}`;
const RUN_TAG = `${dataset}${VARIANT}`;
const SKIP_INGEST = process.env.SKIP_INGEST === '1';
const MODES = ['keyword', 'semantic', 'hybrid'] as const;
const dir = join(BEIR_DIR, dataset);

if (!ORG_ID) throw new Error('ORG_ID is required (the single-user org id)');

function readJsonl(path: string): any[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** TEST-split query ids and the graded judgments, from qrels/test.tsv. */
function readQrels(path: string): { qids: Set<string> } {
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const qids = new Set<string>();
  for (const line of lines.slice(1)) {
    const [qid] = line.split('\t');
    if (qid) qids.add(qid);
  }
  return { qids };
}

/** Bounded-concurrency map. */
async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx] as T, idx);
    }
  });
  await workers.reduce((p) => p, Promise.resolve());
  await Promise.all(workers);
}

async function main() {
  const engine = new MemoryEngine();
  const t0 = Date.now();

  const corpus = readJsonl(join(dir, 'corpus.jsonl'));
  const allQueries = readJsonl(join(dir, 'queries.jsonl'));
  const { qids } = readQrels(join(dir, 'qrels', 'test.tsv'));
  const queries = allQueries.filter((q) => qids.has(String(q._id)));
  console.log(`[${dataset}] corpus=${corpus.length} test-queries=${queries.length}`);

  // Fresh ingest: clear the space, then index each doc as title + text.
  const spaceId = await engine.resolveSpaceId(ORG_ID, { spaceSlug: SPACE });
  if (SKIP_INGEST) {
    console.log(`  SKIP_INGEST: reusing existing space ${SPACE}`);
  } else {
  await engine.client.sql`DELETE FROM documents WHERE space_id = ${spaceId}`;

  let done = 0;
  let failed = 0;
  await pool(corpus, CONCURRENCY, async (doc) => {
    const content = [doc.title, doc.text].filter(Boolean).join('. ').trim();
    if (!content) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await engine.addMemory({ orgId: ORG_ID, spaceId, content, sourceId: String(doc._id), sourceType: 'beir', dedupe: false });
        if (++done % 500 === 0) console.log(`  ingested ${done}/${corpus.length}`);
        return;
      } catch (e) {
        if (attempt === 3) {
          failed++;
          console.error(`  ingest failed for ${doc._id}: ${String((e as Error).message ?? e).slice(0, 120)}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  });
  if (failed) console.error(`  WARNING: ${failed} docs failed to ingest`);
  console.log(`  ingest done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  // Map documentId -> BEIR corpus id for scoring.
  const rows = await engine.client.sql<{ id: string; source_id: string }[]>`
    SELECT id, source_id FROM documents WHERE space_id = ${spaceId}
  `;
  const idOf = new Map(rows.map((r) => [r.id, r.source_id]));

  for (const mode of MODES) {
    const run: Record<string, Record<string, number>> = {};
    const lat: number[] = [];
    for (const q of queries) {
      const qs = Date.now();
      const res = await engine.search(ORG_ID, {
        q: String(q.text),
        spaceId,
        mode,
        limit: 200,
        minScore: 0,
      });
      lat.push(Date.now() - qs);
      const seen = new Set<string>();
      const docScores: Record<string, number> = {};
      for (const h of res.hits) {
        const cid = idOf.get(h.documentId);
        if (!cid || seen.has(cid)) continue; // best (highest) rank per doc
        seen.add(cid);
        docScores[cid] = h.score;
        if (seen.size >= 100) break;
      }
      run[String(q._id)] = docScores;
    }
    lat.sort((a, b) => a - b);
    const p50 = lat[Math.floor(lat.length * 0.5)] ?? 0;
    const outPath = join(BEIR_DIR, `${RUN_TAG}_${mode}.run.json`);
    writeFileSync(outPath, JSON.stringify(run));
    console.log(`  [${mode}] ${queries.length} queries, p50 ${p50}ms -> ${outPath}`);
  }

  await engine.close();
  console.log(`[${dataset}] total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
