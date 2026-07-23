```
                    _---~~(~~-_.                        __________  __  _______  ___    _   ____  __
                  _{        )   )                      / ____/ __ \/  |/  / __ \/   |  / | / /\ \/ /
                ,   ) -~~- ( ,-' )_                    / /   / / / / /|_/ / /_/ / /| | /  |/ /  \  /
               (  `-,_..`., )-- '_,)                  / /___/ /_/ / /  / / ____/ ___ |/ /|  /   / /
              ( ` _)  (  -~( -_ `,  }                 \____/\____/_/  /_/_/   /_/  |_/_/ |_/   /_/
              (_-  _  ~_-~~~~`,  ,' )                     ____  ____  ___    _____   __
                `~ -^(    __;-,((()))                    / __ )/ __ \/   |  /  _/ | / /
                      ~~~~ {_ -_(())                    / __  / /_/ / /| |  / //  |/ /
                             `\  }                     / /_/ / _, _/ ___ |_/ // /|  /
                               { }                    /_____/_/ |_/_/  |_/___/_/ |_/
```

> The open-source memory layer for your company. Index everything, recall anything, own all of it.

[![License](https://img.shields.io/badge/license-MIT-black)](./LICENSE)
[![Postgres](https://img.shields.io/badge/db-postgres%20%2B%20pgvector-336791)](https://github.com/pgvector/pgvector)
[![Self-host](https://img.shields.io/badge/self--host-one%20command-2ea44f)](#run-it)
[![PRs](https://img.shields.io/badge/PRs-welcome-blue)](./CONTRIBUTING.md)

CompanyBrain is a self-hosted memory backend. You point it at your knowledge (Obsidian
vaults, Google Docs, Slack, Notion, GitHub, PDFs, plain URLs) and it becomes one private,
searchable brain that answers questions with citations. Your agents talk to it over MCP.
Your apps talk to it over a typed SDK. Your data never leaves your Postgres.

It is a from-scratch, MIT-licensed alternative to hosted memory services like Supermemory
and memory.store. No per-seat pricing, no vendor holding your knowledge hostage.

## Run it

```sh
git clone https://github.com/aayambansal/companybrain.git
cd companybrain
cp .env.example .env      # defaults work with zero keys
docker compose up -d      # postgres + pgvector, api, dashboard
open http://localhost:3000
```

That is the whole install. The default embedding model runs locally with no API key, so you
can ingest and search in the first minute. Swap in OpenAI, Ollama, or Google embeddings when
you want to, by changing one line in `.env`.

Prefer running it on the metal:

```sh
pnpm install
docker compose up -d db   # just postgres
pnpm db:migrate
pnpm dev                  # api :3333, dashboard :3000
```

## What you get

```
  ingest ── chunk ── embed ── index ── search ── cite
     │                                            │
  connectors                                  agents · apps · you
```

- One store for everything. Files, notes, chat logs, docs, and web pages land as `documents`,
  split into retrievable `chunks` with a vector and a full-text index side by side.
- Hybrid retrieval. Vector similarity and Postgres full-text search, fused with reciprocal
  rank fusion, so you get both meaning and exact keywords.
- Answers with receipts. RAG chat returns citations that point back at the source chunk.
- Agent-native. A built-in Model Context Protocol server lets Claude, Cursor, or any agent
  read and write the brain as a tool.
- Yours to run. Bring your own Postgres. Nothing phones home.

## How it fits together

```
  dashboard        chrome ext        mcp server        sdk (ts / py)
  (next.js)                          (agents)
      \                 \                |                 /
       \                 \               |                /
        `------------------\-------------+---------------'
                            \            |
                        ┌────────────────────────┐
                        │    companybrain api     │   hono + node
                        │  auth · spaces · search │
                        └───────────┬────────────┘
                        ┌───────────────────────┐
                        │     memory engine      │   ingest → chunk →
                        │  embed · rank · fuse   │   embed → index → search
                        └───────────┬────────────┘
                        ┌───────────────────────┐
                        │   postgres + pgvector  │   your database
                        └────────────────────────┘
```

Full design notes live in [docs/architecture.md](./docs/architecture.md).

## Repo layout

| path                    | what it is                                            |
| ----------------------- | ----------------------------------------------------- |
| `apps/api`              | the HTTP API (Hono)                                   |
| `apps/web`              | the dashboard (Next.js)                               |
| `apps/mcp`              | Model Context Protocol server for agents              |
| `apps/extension`        | Chrome extension                                      |
| `packages/core`         | ingestion, chunking, embeddings, hybrid search        |
| `packages/db`           | Drizzle schema + migrations (Postgres / pgvector)     |
| `packages/connectors`   | source integrations                                   |
| `packages/sdk`          | TypeScript SDK                                         |
| `sdks/python`           | Python SDK                                             |

## Connectors

| source                | status     |
| --------------------- | ---------- |
| Raw text / API        | `[core]`   |
| Web pages / URLs      | `[planned]`|
| Markdown / files      | `[planned]`|
| Obsidian vault        | `[planned]`|
| PDF / DOCX            | `[planned]`|
| Google Docs / Drive   | `[planned]`|
| Slack                 | `[planned]`|
| Notion                | `[planned]`|
| GitHub                | `[planned]`|

The table moves as connectors land.

## Docs

- [Quickstart](./docs/quickstart.md)
- [Architecture](./docs/architecture.md)
- [Self-hosting](./docs/self-hosting.md)
- [API reference](./docs/api.md)
- [Connectors](./docs/connectors.md)

## Contributing

Built in the open, moving fast. Every change ships as a pull request. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE). Take it, run it, ship it.
