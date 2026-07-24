# Changelog

Notable capabilities in CompanyBrain. This project ships continuously; entries are grouped by area
rather than by release. See the [commit history](https://github.com/aayambansal/companybrain/commits/main)
for the full record.

## Retrieval

- Hybrid search: pgvector similarity and Postgres full-text fused with weighted Reciprocal Rank
  Fusion (`RRF_VECTOR_WEIGHT` / `RRF_KEYWORD_WEIGHT`).
- LLM reranking, listwise or pointwise (`rerankMode`), over the fused top-k.
- HyDE query expansion (`hyde`), optionally multi-sample (`HYDE_SAMPLES`).
- `text-embedding-3-large` support via the dimensions parameter (fits the fixed vector column).
- Reproducible BEIR benchmark harness in [`bench/`](./bench) scored with `pytrec_eval`.

## Synthesis

- **Playbooks** — a cited Markdown page synthesized from the memories on a topic, with streaming
  generation (`POST /v1/playbooks` and `/stream`).
- **Topics** — memories grouped by tag (enrichment topics plus people from meeting connectors)
  into projects, people, and themes (`GET /v1/topics`).
- **Digest** — a short "what recently changed" brief over the newest memories (`GET /v1/digest`).
- **Temporal memory** — on ingest, a new memory that updates a fact on record marks the older one
  superseded, so recall returns the current truth while the history stays (`TEMPORAL_RESOLUTION`).

## Ingestion

- Multimodal: image OCR + caption, audio transcription (Whisper), and video (audio transcript +
  sampled-frame OCR via ffmpeg), all as `data:` URLs on `POST /v1/memories`.
- 44 built-in connectors, including Obsidian, Slack, Notion, GitHub, Google Docs, Wispr Flow,
  Granola, Fathom, and Raycast. Automatic per-connection scheduled sync.
- LLM enrichment on ingest: summary, topical tags, and extracted facts; content-hash dedupe.

## Surfaces

- Dashboard (Next.js): overview, search with term highlighting, ask, playbooks, topics, memories
  with bulk select, spaces, connections, analytics, settings — on the light brand system.
- Built-in Model Context Protocol server: record in one agent, recall in another.
- Clients: TypeScript SDK, Python SDK (sync + async), and the `companybrain` CLI, all covering
  memories, search, chat, playbooks, topics, and digest.
- Outbound signed (HMAC) webhooks on ingest.

## Operations

- Single-user mode by default (no sign-in); multi-workspace auth, API keys, and roles when needed.
- Bring your own Postgres and providers; local embedder runs with no API key.
- Connector and provider credentials encrypted at rest (AES-256-GCM) when `CREDENTIALS_KEY` is
  set; login throttled to slow credential brute-force.
- LLM generations (chat and playbook synthesis) rate-limited per principal on a shared budget
  (`LLM_RATE_LIMIT_PER_MIN`, default 60) so a leaked key or a runaway loop can't run up provider cost.
- One-command self-host (`npx companybrain`); Docker and cloud deploy blueprints.
