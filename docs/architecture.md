# CompanyBrain Architecture

CompanyBrain is a semantic memory platform. Content flows in from many **connectors**,
gets **ingested** (parsed → chunked → embedded → indexed), and is served back through
**hybrid search** to the dashboard, SDKs, and AI agents (via MCP).

## The ingestion pipeline

```
source → fetch → parse → normalize → chunk → embed → index → (summarize / tag)
```

1. **Fetch** — a connector pulls raw content (a file, a Slack message, a Google Doc, a URL).
2. **Parse** — extract clean text + metadata from the source format (Markdown, HTML, PDF, DOCX…).
3. **Normalize** — canonicalize into a `Document` with stable IDs, source refs, timestamps.
4. **Chunk** — split into semantically coherent, overlapping passages sized for retrieval.
5. **Embed** — turn each chunk into a vector via the configured embedding provider.
6. **Index** — store chunks + vectors + a `tsvector` in Postgres (`pgvector` for ANN search).
7. **Enrich** (optional) — LLM summaries, auto-tags, entity extraction.

## Data model (high level)

- **Organization** → the tenant boundary.
- **Space** → a named collection of memories (e.g. "Engineering", "Sales"). Scopes search & access.
- **Document** → one ingested item, tied to a source + connector.
- **Chunk** → a retrievable passage of a document, with an embedding + full-text vector.
- **Connection** → a configured connector instance (credentials, sync state).
- **User / ApiKey** → auth principals.

## Search

CompanyBrain fuses two signals:

- **Vector search** — cosine similarity over chunk embeddings (`pgvector`, HNSW/IVFFlat).
- **Full-text search** — Postgres `tsvector` / `ts_rank` keyword relevance.

Results are combined with **Reciprocal Rank Fusion (RRF)**, optionally reranked by an LLM
or cross-encoder, and returned with source citations.

## Providers are pluggable

Embeddings, the LLM, storage, and the job queue are all behind interfaces:

| Concern | Default | Alternatives |
| --- | --- | --- |
| Embeddings | `local` (zero-config) | OpenAI, Ollama, Google |
| LLM | `none` | Anthropic, OpenAI, Ollama |
| Storage | local disk | S3-compatible |
| Queue | in-process | Redis / BullMQ |
| Database | Postgres + pgvector | (any Postgres 14+ with pgvector) |

## Deployment

- **Docker Compose** — the default one-command path (db + api + web).
- **Bring your own Postgres** — point `DATABASE_URL` at a managed database.
- **Serverless-friendly** — the API is built on Hono and can run on Node, or edge runtimes.
