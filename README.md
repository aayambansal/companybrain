<div align="center">

# 🧠 CompanyBrain

### The open-source memory layer for your company.

**Index everything. Recall anything. Own it all.**

Connect Obsidian, Google Docs, Slack, Notion, GitHub, the web — and every AI agent —
to a single, private, semantic memory you can self-host in one command.

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
![Self-hostable](https://img.shields.io/badge/self--host-1%20command-blue)
![Bring your own DB](https://img.shields.io/badge/DB-Postgres%20%2B%20pgvector-336791)

</div>

---

CompanyBrain is a fully open-source alternative to hosted memory platforms like Supermemory
and memory.store. It gives your team — and your AI agents — a shared, searchable brain:
drop in documents, notes, chats, and links, and get back precise, cited answers over
everything you know.

No vendor lock-in. No per-seat pricing. Your data lives in **your** Postgres.

## ✨ Why CompanyBrain

- **🔓 Truly open source** — MIT licensed, top to bottom. Read it, fork it, ship it.
- **⚡ One-command deploy** — `docker compose up`. Postgres + API + dashboard, done.
- **🗄️ Bring your own database** — points at any Postgres with `pgvector`. Your data, your server.
- **🔌 Connect everything** — Obsidian, Google Docs, Slack, Notion, GitHub, web pages, PDFs, and more.
- **🔎 Hybrid search** — semantic (vector) + keyword (full-text), fused and reranked.
- **🤖 Agent-native** — a built-in [MCP](https://modelcontextprotocol.io) server means Claude, Cursor, and any agent can read/write your memory.
- **💬 Chat with your knowledge** — RAG chat with inline citations across your whole vault.
- **🧩 SDKs** — first-class TypeScript and Python clients.
- **🎨 Impeccable dashboard** — a fast, beautiful web UI to browse, search, and manage memories.
- **🌐 Chrome extension** — save any page, highlight, or tweet to your brain in one click.

## 🚀 Quick start

```bash
git clone https://github.com/aayambansal/companybrain.git
cd companybrain
cp .env.example .env        # defaults work out of the box
docker compose up -d        # Postgres + API + dashboard
open http://localhost:3000  # 🎉
```

That's it. No API keys required for local dev — CompanyBrain ships with a zero-config
local embedding model so you can index and search immediately, then upgrade to
OpenAI / Ollama / Google embeddings whenever you like.

### Local development (without Docker)

```bash
pnpm install
docker compose up -d db     # just the database
pnpm db:migrate
pnpm dev                    # API on :3333, dashboard on :3000
```

## 🧱 Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Dashboard   │   │  Chrome Ext  │   │  MCP Server  │   │   SDKs       │
│  (Next.js)   │   │              │   │ (agents)     │   │  (TS / Py)   │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴────────┬─────────┴──────────────────┘
                                    ▼
                        ┌───────────────────────┐
                        │   CompanyBrain API     │   Hono + Node
                        │  auth · spaces · search│
                        └───────────┬───────────┘
                                    ▼
                        ┌───────────────────────┐
                        │   Core memory engine   │   ingest → chunk →
                        │  ingest · embed · rank │   embed → index → search
                        └───────────┬───────────┘
                                    ▼
                        ┌───────────────────────┐
                        │  Postgres + pgvector   │   your database
                        └───────────────────────┘
                                    ▲
       ┌────────────────────────────┴────────────────────────────┐
   Connectors: Obsidian · Google Docs · Slack · Notion · GitHub · Web · PDF · …
```

See [`docs/architecture.md`](./docs/architecture.md) for the full design.

## 📦 Monorepo layout

| Path | What it is |
| --- | --- |
| `apps/api` | The CompanyBrain HTTP API (Hono) |
| `apps/web` | The dashboard (Next.js, impeccable UI) |
| `apps/mcp` | Model Context Protocol server for agents |
| `apps/extension` | Chrome extension |
| `packages/core` | Ingestion, chunking, embedding, search engine |
| `packages/db` | Drizzle schema + migrations (Postgres/pgvector) |
| `packages/connectors` | Source integrations (Obsidian, GDocs, Slack, …) |
| `packages/sdk` | TypeScript SDK |
| `sdks/python` | Python SDK |
| `packages/ui` | Shared React component library |

## 🔌 Connectors

| Source | Status |
| --- | --- |
| Obsidian vault | 🟡 planned |
| Google Docs / Drive | 🟡 planned |
| Slack | 🟡 planned |
| Notion | 🟡 planned |
| GitHub | 🟡 planned |
| Web pages / URLs | 🟡 planned |
| PDF / DOCX / files | 🟡 planned |
| Raw text / API | 🟢 core |

_This table is updated as connectors land._

## 🤝 Contributing

CompanyBrain is built in the open and moves fast. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 📄 License

[MIT](./LICENSE) © CompanyBrain contributors.
