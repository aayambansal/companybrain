# API reference

The CompanyBrain API is a small REST surface over the memory engine. Every route is scoped to
the organization behind the API key or session.

Base URL in local dev: `http://localhost:3333`. All routes are versioned under `/v1`.

The running server also serves an OpenAPI document at `/v1/openapi.json` and interactive docs
at `/docs`, which are always the source of truth. This page is the human summary.

## Auth

Send an API key as a bearer token:

```
Authorization: Bearer cb_xxx_xxx
```

The dashboard uses a session cookie instead. Both resolve to an org context.

## Memories

```
POST   /v1/memories               add a memory (text or a URL to fetch)
GET    /v1/memories               list, with pagination and filters
GET    /v1/memories/:id           fetch one, with its chunks
GET    /v1/memories/:id/related   related memories, ranked by similarity
GET    /v1/memories/:id/versions  prior content versions (temporal history)
PATCH  /v1/memories/:id           update title, content, tags, space
DELETE /v1/memories/:id           remove a memory and its chunks
```

Add a memory:

```json
POST /v1/memories
{
  "title": "Release process",
  "content": "We cut releases every Thursday...",
  "space": "engineering",
  "tags": ["process", "release"],
  "metadata": { "author": "ada" }
}
```

The body also accepts `image`, `audio`, or `video` as `data:` URLs; each is turned into searchable
text (image OCR + caption, audio transcription, and video = audio transcript + sampled-frame OCR
via ffmpeg). With `TEMPORAL_RESOLUTION=true`, adding a memory that updates a fact already on record
marks the older one superseded so recall returns the current truth.

## Search

```
GET  /v1/search?q=...&space=...&limit=...&mode=hybrid
POST /v1/search           same, with a JSON body for complex filters
```

`mode` is one of `hybrid` (default), `semantic`, or `keyword`. Results are ranked chunks with a
score and the document they belong to. Optional flags: `rerank` (LLM reranks the top results),
`rerankMode` (`listwise` or `pointwise`), and `hyde` (blend the query with a hypothetical-answer
embedding to lift recall). Superseded memories are excluded by default.

## Chat

```
POST /v1/chat             RAG answer over your memory, with citations
POST /v1/chat/stream      server-sent events for token streaming
```

## Playbooks

Synthesize a structured, cited Markdown page from the memories on a topic.

```json
POST /v1/playbooks
{ "topic": "how we ship a release", "space": "engineering", "save": false }
```

Returns `{ playbook: { title, content, citations }, savedId }`. With `save: true` the playbook is
stored as a searchable memory. Regenerating reflects what the team knows now.

## Topics

Group memories by their tags (enrichment topics plus people from meeting/chat connectors) to
surface the projects, people, and themes running through the brain.

```
GET /v1/topics?space=...&limit=24&minCount=2
```

Returns `{ topics: [{ topic, count, sample: [{ id, title }] }] }`, ordered by count.

## Digest

Summarize what recently landed in the brain into a short brief.

```
GET /v1/digest?space=...&limit=15
```

Returns `{ digest: { summary, memories: [{ id, title, createdAt }], count } }`. `summary` is
Markdown bullets when an LLM is configured, otherwise a plain dated list.

## Spaces

```
GET    /v1/spaces
POST   /v1/spaces
PATCH  /v1/spaces/:id
DELETE /v1/spaces/:id
```

## Connections

```
GET    /v1/connections/available  list connector types you can configure
GET    /v1/connections            list configured connections (no credentials)
POST   /v1/connections            configure a connector instance
POST   /v1/connections/:id/sync   trigger a sync
GET    /v1/connections/:id/runs   recent sync runs for a connection
DELETE /v1/connections/:id
```

## Health

```
GET /health        liveness
GET /v1/status     build info, provider config, counts
```
