#!/usr/bin/env node
/**
 * CompanyBrain retrieval benchmark.
 *
 *   COMPANYBRAIN_API_URL=http://localhost:3333 \
 *   COMPANYBRAIN_API_KEY=cb_... \
 *   node bench/run.mjs [--mode hybrid|semantic|keyword] [--k 5] [--space bench] [--verbose]
 *
 * Ingests a small labeled corpus into a dedicated space, then runs question
 * probes and reports Recall@k, MRR, and search latency. With --verbose it also
 * prints, per question, where the right document ranked. Zero dependencies.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const API = (process.env.COMPANYBRAIN_API_URL ?? 'http://localhost:3333').replace(/\/$/, '');
const KEY = process.env.COMPANYBRAIN_API_KEY ?? '';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const MODE = flag('mode', 'hybrid');
const K = Number(flag('k', '5'));
const SPACE = flag('space', 'bench');
const VERBOSE = args.includes('--verbose');

function headers(json = false) {
  const h = {};
  if (KEY) h['authorization'] = `Bearer ${KEY}`;
  if (json) h['content-type'] = 'application/json';
  return h;
}

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: headers(body !== undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const corpus = JSON.parse(readFileSync(join(here, 'corpus.json'), 'utf8'));
  const probes = JSON.parse(readFileSync(join(here, 'probes.json'), 'utf8'));

  // Health check.
  try {
    await fetch(API + '/health').then((r) => r.json());
  } catch {
    console.error(
      `Cannot reach CompanyBrain at ${API}. Start it first (npx companybrain / pnpm dev).`,
    );
    process.exit(1);
  }

  console.log(
    `\ncorpus: ${corpus.length} docs   probes: ${probes.length}   mode: ${MODE}   k: ${K}   space: ${SPACE}\n`,
  );

  process.stdout.write('ingesting… ');
  for (const doc of corpus) {
    await api('POST', '/v1/memories', {
      title: doc.title,
      content: doc.content,
      space: SPACE,
      dedupe: true,
    });
  }
  console.log('done');

  let hitAtK = 0;
  let reciprocalRankSum = 0;
  const latencies = [];
  const perProbe = [];

  for (const probe of probes) {
    const t0 = performance.now();
    const res = await api('POST', '/v1/search', {
      q: probe.q,
      mode: MODE,
      space: SPACE,
      limit: Math.max(K, 10),
    });
    latencies.push(performance.now() - t0);
    const titles = res.hits.map((h) => h.document.title);
    const rank = titles.indexOf(probe.expect); // 0-based rank of the expected doc
    if (rank >= 0 && rank < K) hitAtK += 1;
    if (rank >= 0) reciprocalRankSum += 1 / (rank + 1);
    // When the right document was not first, name the one that was: that is
    // the useful part of a miss.
    const first = rank === 0 ? '' : `   (first: ${titles[0] ?? 'nothing'})`;
    perProbe.push(`  ${rank < 0 ? '   -' : String(rank + 1).padStart(4)}  ${probe.q}${first}`);
  }

  if (VERBOSE) {
    console.log('\n  rank  question');
    console.log('  ----  --------');
    for (const line of perProbe) console.log(line);
  }

  const recall = hitAtK / probes.length;
  const mrr = reciprocalRankSum / probes.length;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1];

  console.log('\n  metric        value');
  console.log('  ------------  -------');
  console.log(`  Recall@${K}      ${(recall * 100).toFixed(1)}%`);
  console.log(`  MRR           ${mrr.toFixed(3)}`);
  console.log(`  search p50    ${p50.toFixed(1)} ms`);
  console.log(`  search p95    ${p95.toFixed(1)} ms`);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
