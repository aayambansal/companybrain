# How CompanyBrain compares

An honest look at CompanyBrain next to Supermemory (the closest open-source memory platform).
Both are MIT licensed. The goal here is a fair map, not a scoreboard.

## Where CompanyBrain leads

| | CompanyBrain | Supermemory |
| --- | --- | --- |
| Connectors | **28** built in | ~6 (Drive, Gmail, Notion, OneDrive, GitHub, Web) |
| Self-host onboarding | `npx companybrain`, **no sign-in** by default | local binary, sign-in |
| Deploy targets | Docker Compose, Render, Railway, Fly.io, GHCR images, bring-your-own Postgres | hosted + local binary |
| Dashboard | 8 pages, provider keys, analytics, backup, webhooks in the UI | web app |
| Provider flexibility | swap embedding + LLM providers live from the dashboard | configured at setup |
| Data ownership | your Postgres, plain `docker compose`, one-file export | local dir or hosted |

## At parity

| | Both |
| --- | --- |
| Hybrid search | vector + full-text, fused (CompanyBrain adds RRF + optional LLM rerank) |
| Auto fact extraction | summary, tags, facts on ingest when an LLM is set |
| Deduplication | on by default for identical content |
| MCP server | tools for search / add / ask / spaces; keyless in single-user mode |
| SDKs | TypeScript + Python (CompanyBrain also ships a CLI) |
| Browser extension | save any page or selection |
| Webhooks | signed real-time events on ingest |
| Spaces / scoping | named collections + tags |

## Where Supermemory is still ahead (our roadmap)

- **Multimodal depth**: image OCR and video transcription. CompanyBrain does PDF and YouTube
  transcripts today; OCR/video are on the roadmap.
- **Framework wrappers**: Supermemory ships many (LangChain, LangGraph, Vercel AI SDK, OpenAI
  Agents, Mastra, Agno, n8n). CompanyBrain ships LangChain and the Vercel AI SDK, with more
  landing.
- **Published benchmarks**: both now ship a reproducible eval harness. CompanyBrain's is in
  `bench/` (Recall@k / MRR / latency); Supermemory has MemoryBench with more datasets.
- **Temporal reasoning**: contradiction resolution and expiry of stale facts are deeper in
  Supermemory today.

## The short version

If you want the widest set of connectors, the simplest self-host (one command, no sign-in), and
full control of your data and providers, CompanyBrain is the stronger fit today. If you need
image/video ingestion or published memory benchmarks right now, Supermemory has a head start on
those specific fronts — both of which are on our roadmap.
