# rag-chatbot

A terminal REPL. Each question is streamed from `cb.chatStream`, tokens are
printed as they arrive, and the citing sources are listed after each answer.

## Prerequisites

- A running CompanyBrain API with some memories indexed (see `../ingest-folder`).
- An API key (`cb_...`). See `../curl` to mint one.

## Run

From the repo root:

```bash
pnpm install
export COMPANYBRAIN_API_URL=http://localhost:3333
export COMPANYBRAIN_API_KEY=cb_...
pnpm --filter @companybrain/example-rag-chatbot start
```

Type a question and press Enter. Ctrl+C or Ctrl+D exits.
