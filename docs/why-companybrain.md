# Why CompanyBrain

CompanyBrain is a self-hosted memory backend you fully own. This page lays out what
that gets you and the principles behind it, so you can decide whether it fits.

## What you get

| | CompanyBrain |
| --- | --- |
| Ownership | Everything lives in your Postgres. Plain `docker compose`, one-file export, delete anything any time. |
| Self-host onboarding | `npx companybrain`, no sign-in by default. Turn on multi-workspace auth when the team shows up. |
| Connectors | 40+ built in (Slack, Google Docs, GitHub, Notion, Obsidian, web, RSS, files, and more), all in one store. |
| Retrieval | Vector plus full-text, fused with reciprocal rank fusion, with optional HyDE expansion and an LLM reranker. |
| Multimodal ingest | PDFs, image OCR and captioning, audio transcription (Whisper), video frames plus transcript, YouTube. |
| Temporal memory | New facts supersede old ones, so recall returns today's truth while the history stays. |
| Agent-native | A built-in MCP server: Claude, Cursor, and your own tools read and write the same memory. |
| Clients | REST + OpenAPI, TypeScript and Python SDKs, a CLI, a browser extension, LangChain, Vercel AI SDK, and n8n. |
| Events | Signed webhooks fire on every ingest. |
| Deploy targets | Docker Compose, Render, Railway, Fly.io, prebuilt GHCR images, or bring your own Postgres. |
| Benchmarks | A reproducible harness in `bench/`. State-of-the-art nDCG@10 on BEIR NFCorpus (0.439) and SciFact (0.816). |

## The principles

- **No lock-in.** Your knowledge sits in a database you run. There is no hosted tier holding it, and
  the whole thing is MIT licensed.
- **No per-seat pricing.** Run it for one person or a whole company on the same code.
- **Bring your own keys.** Swap embedding and LLM providers live from the dashboard, or run fully
  local with the built-in hashed embedder and no API key at all.
- **Measured, not asserted.** Every retrieval claim is reproducible with the harness in `bench/`,
  scored with the standard TREC evaluator. See the [benchmarks](https://aayambansal.github.io/companybrain/benchmarks.html).

## Where we are heading

- Deeper temporal reasoning: richer contradiction resolution and expiry policies for stale facts.
- More framework wrappers: OpenAI Agents SDK, Mastra, and Agno adapters.
- Broader video understanding beyond frame OCR and transcripts.

Open an issue or a PR if one of these matters to you. The roadmap follows what people actually need.
