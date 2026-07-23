# Quickstart

Get a running brain in about a minute, then put something in it and ask a question.

## 1. Boot the stack

```sh
git clone https://github.com/aayambansal/companybrain.git
cd companybrain
cp .env.example .env
docker compose up -d
```

This starts three things:

- `db` — Postgres 16 with the pgvector extension
- `api` — the CompanyBrain API on `:3333`
- `web` — the dashboard on `:3000`

The default `.env` uses the bundled local embedding model, so no API keys are required to
start indexing.

## 2. Get an API key

Open `http://localhost:3000`, create the first account (it becomes the org owner), and copy
an API key from Settings. For scripting you can also mint one from the CLI:

```sh
pnpm db:seed   # prints a ready-to-use API key for a demo org
```

## 3. Add a memory

```sh
curl -s http://localhost:3333/v1/memories \
  -H "Authorization: Bearer $COMPANYBRAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Release process",
    "content": "We cut releases every Thursday. Tag main, run the release workflow, post in #eng."
  }'
```

## 4. Search it

```sh
curl -s "http://localhost:3333/v1/search?q=when%20do%20we%20release" \
  -H "Authorization: Bearer $COMPANYBRAIN_API_KEY"
```

You get back ranked chunks with scores and a pointer to the source document.

## 5. Ask it

```sh
curl -s http://localhost:3333/v1/chat \
  -H "Authorization: Bearer $COMPANYBRAIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "How often do we release and where do we announce it?"}'
```

The answer comes back with inline citations that map to the chunks that produced it.

## Next

- Point a [connector](./connectors.md) at a real source.
- Wire an agent to the [MCP server](./architecture.md).
- Read the [self-hosting guide](./self-hosting.md) before you put it in production.
