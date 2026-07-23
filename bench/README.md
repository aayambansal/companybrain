# Retrieval benchmark

A small, reproducible benchmark for CompanyBrain retrieval. It ingests a labeled corpus of
company-knowledge documents into a dedicated space, runs question probes, and reports
**Recall@k**, **MRR**, and **search latency**.

## Run it

Start CompanyBrain (`npx companybrain` or `pnpm dev`), then:

```sh
COMPANYBRAIN_API_URL=http://localhost:3333 \
COMPANYBRAIN_API_KEY=cb_...   \  # omit in single-user mode
node bench/run.mjs --mode hybrid --k 5
```

Flags: `--mode hybrid|semantic|keyword`, `--k <n>`, `--space <slug>`.

## What it measures

- **Recall@k** — fraction of probes where the correct document is in the top k results.
- **MRR** — mean reciprocal rank of the correct document (rewards ranking it first).
- **Latency** — p50 / p95 of the search request.

The corpus (`corpus.json`) and probes (`probes.json`) are intentionally small and readable so
you can see exactly what is being tested and extend it with your own data.

## Reference results

On the 12-document corpus with the **zero-config local embedder** (no API key), Postgres +
pgvector on a laptop:

| mode    | Recall@5 | MRR   | search p50 | search p95 |
| ------- | -------- | ----- | ---------- | ---------- |
| hybrid  | 100.0%   | 0.958 | 1.6 ms     | 2.6 ms     |
| keyword | 91.7%    | 0.875 | 1.5 ms     | 1.8 ms     |

Hybrid retrieval (vector + full-text fused with RRF) recovers the right document for every probe.
Real semantic embeddings (OpenAI / Ollama) and LLM reranking push MRR higher on paraphrased and
harder queries. Numbers will vary with corpus size and the embedding provider.
