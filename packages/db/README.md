# @companybrain/db

Database schema, migrations, and client for CompanyBrain — Postgres + pgvector via Drizzle ORM.

## Usage

```ts
import { createDb, spaces } from '@companybrain/db';

const { db } = createDb(process.env.DATABASE_URL!);
const rows = await db.select().from(spaces);
```

## Migrations

The source of truth for DDL is the hand-authored SQL in `migrations/` (needed for the
`pgvector` HNSW index and the generated `tsvector` full-text column, which Drizzle can't
express natively). A lightweight runner applies them in order and tracks state in
`__cb_migrations`.

```bash
pnpm --filter @companybrain/db migrate   # apply pending migrations
pnpm --filter @companybrain/db seed      # seed demo org + API key
pnpm --filter @companybrain/db studio    # drizzle-kit studio
```

## Schema overview

`organizations` → `spaces` → `documents` → `chunks` (vector + tsvector). Plus `users`,
`api_keys`, `connections`, `sync_runs`, and `chat_sessions`/`chat_messages`.

Embedding dimension is **1536** (see `EMBEDDING_DIMENSIONS`). Changing it requires a
migration and re-embedding all chunks.
