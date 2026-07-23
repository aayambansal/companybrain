# BEIR benchmark

A reproducible evaluation of CompanyBrain retrieval on [BEIR](https://github.com/beir-cellar/beir),
the standard information-retrieval benchmark suite. Unlike the toy corpus in
[`README.md`](./README.md), these are public datasets with third-party relevance judgments, and
the metrics are directly comparable to the published BEIR leaderboard. Scoring uses
[`pytrec_eval`](https://github.com/cvangysel/pytrec_eval), the standard TREC evaluator.

## What is measured

Each dataset's corpus is ingested through CompanyBrain's real pipeline (chunk to embed to index)
into a dedicated space, then the dataset's TEST queries are run in each retrieval mode. We report
**nDCG@10** (the headline BEIR metric), **Recall@10 / @100**, and **MRR**.

- `keyword` — Postgres full-text (`tsvector` / `ts_rank`), a lexical baseline.
- `semantic` — dense vector retrieval (pgvector cosine).
- `hybrid` — both arms fused with Reciprocal Rank Fusion, optionally reranked.

Retrieval quality tracks the embedding model and reranker you configure; run the harness with your
own providers to get numbers for your setup.

## Reproduce

```sh
# 1. Download datasets into bench/beir/
mkdir -p bench/beir && cd bench/beir
for ds in scifact nfcorpus fiqa arguana scidocs; do
  curl -sLO "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/$ds.zip"
  unzip -oq "$ds.zip"
done
cd ../..
pip install pytrec_eval-terrier

# 2. Run (against a live Postgres; single-user ORG_ID from your DB)
export DATABASE_URL=... ORG_ID=... BEIR_DIR=bench/beir
export EMBEDDING_PROVIDER=openai OPENAI_API_KEY=... LLM_PROVIDER=none
export ENRICH_ON_INGEST=false TEMPORAL_RESOLUTION=false
node_modules/.bin/tsx bench/beir.mts scifact
node_modules/.bin/tsx bench/beir.mts nfcorpus

# 3. Score
for m in keyword semantic hybrid; do python3 bench/trec_eval.py scifact $m; done
```

## Notes

- Using a stronger embedding model (e.g. `text-embedding-3-large`) and enabling the reranker on the
  fused top-k both raise nDCG@10; the harness reports whatever your configured pipeline produces.
- Postgres full-text is the recall-oriented lexical arm of the hybrid, not a standalone BM25 clone,
  so its standalone numbers trail a tuned Lucene BM25.
- Point the harness at any retrieval service that exposes an add + ranked-search API to evaluate it
  on the same corpus, queries, qrels, and evaluator.
