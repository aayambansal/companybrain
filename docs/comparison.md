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

## Recently closed

- **Multimodal**: CompanyBrain OCRs + captions images (vision LLM) and transcribes audio
  (Whisper), alongside PDF and YouTube transcripts.
- **Framework wrappers**: LangChain (retriever), Vercel AI SDK (tools), and an n8n community node.
- **Benchmarks**: a reproducible harness in `bench/` (Recall@k / MRR / latency).
- **Webhooks**: signed real-time events on ingest.

## Where Supermemory is still ahead (our roadmap)

- **Video frames**: CompanyBrain transcribes audio (Whisper) and handles PDF, images, and
  YouTube transcripts; full video (frame extraction) is on the roadmap.
- **More framework wrappers**: OpenAI Agents SDK, Mastra, Agno.
- **Temporal reasoning**: contradiction resolution and expiry of stale facts are deeper in
  Supermemory today.

## The short version

For the widest connector set (32 vs ~6), the simplest self-host (one command, no sign-in), image
+ document ingestion, framework wrappers, webhooks, published benchmarks, and full control of your
data and providers, CompanyBrain is the stronger fit today. Supermemory still leads on general
video transcription and the depth of its temporal-reasoning layer, both on our roadmap.
