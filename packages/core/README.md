# @companybrain/core

The memory engine. Ingestion, chunking, pluggable embeddings, hybrid search, and RAG chat.
Everything the API, MCP server, and connectors build on.

```ts
import { MemoryEngine } from '@companybrain/core';

const engine = new MemoryEngine(); // reads config from env

await engine.addMemory({
  orgId,
  title: 'Release process',
  content: 'We cut releases every Thursday...',
  tags: ['process'],
});

const { hits } = await engine.search(orgId, { q: 'when do we release', mode: 'hybrid' });
const answer = await engine.chat(orgId, 'How often do we ship?');
```

## Pieces

- `MemoryEngine` — the high-level surface (add/get/list/update/delete, search, chat, spaces).
- `chunkText` — recursive, structure-aware splitter with token overlap.
- Embeddings — `local` (zero-config hashed), `openai`, `ollama`, `google`. All coerced to the
  1536-dim storage vector via zero-padding, which preserves cosine similarity.
- `hybridSearch` — vector arm (pgvector cosine) plus keyword arm (Postgres full-text), fused
  with reciprocal rank fusion.
- LLM providers — `anthropic`, `openai`, `ollama`, and a `none` stub that degrades chat to an
  extractive answer.

## Config

Driven by env (`loadConfig()`): `EMBEDDING_PROVIDER`, `LLM_PROVIDER`, chunk sizes, keys. See
`.env.example` at the repo root.
