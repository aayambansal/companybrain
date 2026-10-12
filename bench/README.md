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

Flags: `--mode hybrid|semantic|keyword`, `--k <n>`, `--space <slug>`, and `--verbose` to list, for
each question, where the right document ranked and what came first when it was not.

## What it measures

- **Recall@k** — fraction of probes where the correct document is in the top k results.
- **MRR** — mean reciprocal rank of the correct document (rewards ranking it first).
- **Latency** — p50 / p95 of the search request.

The corpus (`corpus.json`) and probes (`probes.json`) are intentionally small and readable so
you can see exactly what is being tested and extend it with your own data.

## Reference results

On the 12-document corpus with the **zero-config local embedder** (no API key), the Docker
Compose stack on a laptop, first run against a fresh database (October 2026, commit `e1945a0`):

| mode     | Recall@5 | MRR   | search p50 | search p95 |
| -------- | -------- | ----- | ---------- | ---------- |
| hybrid   | 100.0%   | 0.875 | 2.4 ms     | 3.4 ms     |
| keyword  | 91.7%    | 0.917 | 1.9 ms     | 2.3 ms     |
| semantic | 100.0%   | 0.808 | 2.1 ms     | 2.2 ms     |

Hybrid retrieval (vector + full-text fused with RRF) puts the right document in the top five for
every probe. Keyword search alone ranks it first more often but misses one question outright. The
built-in embedder is a hash of the words in the text, so fusing it in buys that recall at the cost
of a little rank-1 precision. With `nomic-embed-text` through Ollama the same run scores an MRR of
0.931 in hybrid mode.

Tied keyword scores are ordered arbitrarily by Postgres, and fusion works on ranks. Running the
benchmark again into a space that already holds the corpus can therefore move a couple of results
and report an MRR of 0.958 instead. Use `--space <new-name>` for a clean comparison.

This small corpus is a smoke test, not competitive proof. For a rigorous, reproducible evaluation
on public datasets with third-party relevance judgments (scored with `pytrec_eval`, comparable to
the BEIR leaderboard), see [BEIR.md](./BEIR.md).
