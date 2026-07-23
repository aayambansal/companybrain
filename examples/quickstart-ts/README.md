# quickstart-ts

Adds three memories, runs a hybrid search, then asks a question and prints the
answer with citations, using `@companybrain/sdk`.

## Prerequisites

- A running CompanyBrain API (see the repo root README, default `http://localhost:3333`).
- An API key (`cb_...`). See `../curl` to mint one.

## Run

From the repo root:

```bash
pnpm install
export COMPANYBRAIN_API_URL=http://localhost:3333
export COMPANYBRAIN_API_KEY=cb_...
pnpm --filter @companybrain/example-quickstart-ts start
```

Typecheck only:

```bash
pnpm --filter @companybrain/example-quickstart-ts typecheck
```
