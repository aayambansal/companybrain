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

[![Website](https://img.shields.io/badge/site-companybrain-e6ac3f)](https://aayambansal.github.io/companybrain/)
[![License](https://img.shields.io/badge/license-MIT-black)](./LICENSE)
[![Postgres](https://img.shields.io/badge/db-postgres%20%2B%20pgvector-336791)](https://github.com/pgvector/pgvector)
[![Self-host](https://img.shields.io/badge/self--host-one%20command-2ea44f)](#run-it)
[![No sign-in](https://img.shields.io/badge/local-no%20sign--in-8a6d1f)](#no-sign-in)
[![PRs](https://img.shields.io/badge/PRs-welcome-blue)](./CONTRIBUTING.md)

CompanyBrain is a self-hosted memory backend. Point it at your knowledge (Obsidian vaults,
Google Docs, Slack, Notion, GitHub, web pages, RSS, plain files) and it becomes one private,
searchable brain that answers questions with citations. Your agents talk to it over MCP. Your
apps talk to it over a typed SDK. Your data never leaves your Postgres.

It is a from-scratch, MIT-licensed alternative to hosted memory services like Supermemory and
memory.store. No per-seat pricing, no vendor holding your knowledge hostage.

## Run it

One command. It clones (if needed), asks two questions, and starts everything with Docker.

```sh
npx companybrain
```

Then open http://localhost:3000. That is the whole install. The default embedding model runs
locally with no API key, so you can index and search in the first minute.

Prefer to drive it yourself:

```sh
git clone https://github.com/aayambansal/companybrain.git
cd companybrain
cp .env.example .env      # defaults work with zero keys
docker compose up -d      # postgres + pgvector, api, dashboard
```

Or on the metal, no Docker:

```sh
pnpm install
docker compose up -d db   # just postgres
pnpm db:migrate
pnpm dev                  # api :3333, dashboard :3000
```

## No sign-in

By default CompanyBrain runs in single-user mode: no login wall, one workspace, you are in.
That is the frictionless self-host experience. Flip `AUTH_MODE=multi` for full auth (register,
login, sessions, API keys, many workspaces), or set `ACCESS_TOKEN` to gate an exposed instance.

## Bring your own keys

Runs zero-config on a local embedding model. Want real semantic search or grounded chat?
Open Settings > Providers in the dashboard and paste an OpenAI, Anthropic, Google, or Ollama
key. It reconfigures the running engine on the spot. Nothing is required to start.

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
  dashboard        chrome ext        mcp server        sdk (ts / py)        cli
  (next.js)                          (agents)
      \                 \                |                 /                 /
       `------------------\-------------+----------------/-----------------'
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

Design notes: [docs/architecture.md](./docs/architecture.md).

## Repo layout

| path                    | what it is                                            |
| ----------------------- | ----------------------------------------------------- |
| `apps/api`              | the HTTP API (Hono)                                   |
| `apps/web`              | the dashboard (Next.js)                               |
| `apps/mcp`              | Model Context Protocol server for agents              |
| `apps/cli`              | the `companybrain` / `cb` command-line interface      |
| `apps/extension`        | Chrome extension                                      |
| `packages/core`         | ingestion, chunking, embeddings, hybrid search        |
| `packages/db`           | Drizzle schema + migrations (Postgres / pgvector)     |
| `packages/connectors`   | source integrations + sync runner                     |
| `packages/sdk`          | TypeScript SDK                                         |
| `packages/launcher`     | the `npx companybrain` installer                      |
| `sdks/python`           | Python SDK                                             |
| `examples`              | runnable TS / Python / curl examples                  |

## Connectors

| source                | id         | status      |
| --------------------- | ---------- | ----------- |
| Raw text / API        | `api`      | `[core]`    |
| Web page / URL        | `web`      | `[core]`    |
| Sitemap crawl         | `sitemap`  | `[core]`    |
| Markdown / files / PDF | `files`   | `[core]`    |
| Obsidian vault        | `obsidian` | `[core]`    |
| RSS / Atom            | `rss`      | `[core]`    |
| Notion                | `notion`   | `[core]`    |
| Slack                 | `slack`    | `[core]`    |
| GitHub                | `github`   | `[core]`    |
| Google Docs (shared)  | `googledocs`| `[core]`   |
| Linear                | `linear`   | `[core]`    |
| Confluence            | `confluence`| `[core]`   |
| Jira                  | `jira`     | `[core]`    |
| Gmail                 | `gmail`    | `[core]`    |
| Discord               | `discord`  | `[core]`    |
| YouTube transcripts   | `youtube`  | `[core]`    |
| Hacker News           | `hackernews`| `[core]`   |
| Google Drive          | `googledrive`| `[core]` |
| OneDrive              | `onedrive` | `[core]`    |
| Reddit                | `reddit`   | `[core]`    |
| Telegram              | `telegram` | `[core]`    |

Twenty connectors and counting. Configure and sync them from the dashboard under Connections. See
[docs/connectors.md](./docs/connectors.md) to write your own.

## Clients

- TypeScript SDK: `npm install @companybrain/sdk`
- Python SDK: `pip install companybrain`
- CLI: `companybrain add`, `search`, `ask`, `spaces`
- MCP: point Claude Desktop / Cursor at the server (`npx companybrain mcp` prints the config)
- Chrome extension: save any page or selection to your brain

## Deploy

`docker compose up` or `npx companybrain` locally; or one-click to a cloud with the included
blueprints. See [docs/deploy.md](./docs/deploy.md) for Render, Railway, Fly.io, bring-your-own
Postgres, and the GHCR images.

## Docs

- [Quickstart](./docs/quickstart.md)
- [Architecture](./docs/architecture.md)
- [Self-hosting](./docs/self-hosting.md)
- [Deploy](./docs/deploy.md)
- [API reference](./docs/api.md)
- [Connectors](./docs/connectors.md)

## Contributing

Built in the open, moving fast. Every change ships as a pull request. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE). Take it, run it, ship it.
