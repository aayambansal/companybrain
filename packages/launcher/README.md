# companybrain

One command to run [CompanyBrain](https://github.com/aayambansal/companybrain), the open-source
memory layer for your company.

```sh
npx companybrain
```

That clones the repo if needed, asks two questions (embeddings, optional keys), writes a `.env`,
and starts the whole stack with Docker: Postgres + pgvector, the API, and the dashboard. No
sign-in required (single-user mode). Open http://localhost:3000.

## Commands

```
npx companybrain up        set up and start          (default)
npx companybrain down      stop it
npx companybrain logs      tail logs
npx companybrain status    health check
npx companybrain mcp       print an MCP client config snippet
npx companybrain help
```

Flags: `--yes` (accept defaults, no prompts), `--dir=<path>`, `--no-mcp`.

## Requirements

- Docker (Desktop or engine) running.
- Or run without Docker from a checkout: `pnpm install && pnpm db:migrate && pnpm dev`.

## Bring your own keys

Runs with a zero-config local embedding model out of the box. Add OpenAI, Anthropic, Google, or
Ollama from the dashboard under Settings > Providers, or set keys in the generated `.env`.
