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
POST   /v1/memories          add a memory (text or a URL to fetch)
GET    /v1/memories          list, with pagination and filters
GET    /v1/memories/:id      fetch one, with its chunks
PATCH  /v1/memories/:id      update title, content, tags, space
DELETE /v1/memories/:id      remove a memory and its chunks
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

## Search

```
GET  /v1/search?q=...&space=...&limit=...&mode=hybrid
POST /v1/search           same, with a JSON body for complex filters
```

`mode` is one of `hybrid` (default), `semantic`, or `keyword`. Results are ranked chunks with
a score and the document they belong to.

## Chat

```
POST /v1/chat             RAG answer over your memory, with citations
POST /v1/chat/stream      server-sent events for token streaming
```

## Spaces

```
GET    /v1/spaces
POST   /v1/spaces
PATCH  /v1/spaces/:id
DELETE /v1/spaces/:id
```

## Connections

```
GET    /v1/connections
POST   /v1/connections            configure a connector instance
POST   /v1/connections/:id/sync   trigger a sync
DELETE /v1/connections/:id
```

## Health

```
GET /health        liveness
GET /v1/status     build info, provider config, counts
```
