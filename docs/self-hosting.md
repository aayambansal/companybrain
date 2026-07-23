# Self-hosting

CompanyBrain is built to run on your own hardware with your own database. There is no hosted
control plane and nothing calls home.

## The short version

```sh
cp .env.example .env
# edit JWT_SECRET and pick your embedding provider
docker compose up -d
```

## Bring your own Postgres

You do not have to use the bundled database. Point `DATABASE_URL` at any Postgres 14+ that has
the `vector` extension available (most managed providers do: Supabase, Neon, RDS with the
extension enabled, Crunchy, etc.).

```sh
DATABASE_URL=postgres://user:pass@your-host:5432/companybrain
```

Then run migrations against it:

```sh
pnpm db:migrate
```

The migration creates the `vector` and `pgcrypto` extensions, all tables, the HNSW vector
index, and the full-text GIN index.

## Choosing an embedding provider

| provider | env | keys | notes |
| -------- | --- | ---- | ----- |
| `local`  | `EMBEDDING_PROVIDER=local` | none | deterministic, zero-config, good for dev and small vaults |
| `openai` | `EMBEDDING_PROVIDER=openai` | `OPENAI_API_KEY` | `text-embedding-3-small` (1536 dims) |
| `ollama` | `EMBEDDING_PROVIDER=ollama` | none | runs models locally, e.g. `nomic-embed-text` |
| `google` | `EMBEDDING_PROVIDER=google` | `GOOGLE_API_KEY` | `text-embedding-004` |

All provider outputs are normalized and stored in a `vector(1536)` column. Smaller-dimension
models are zero-padded, which preserves cosine similarity. If you switch providers after
indexing, re-embed your chunks so scores stay comparable.

## Production checklist

- [ ] Set a strong `JWT_SECRET` (`openssl rand -hex 32`).
- [ ] Lock `CORS_ORIGINS` to your dashboard origin.
- [ ] Terminate TLS at a reverse proxy in front of the API and web.
- [ ] Use a least-privilege Postgres role.
- [ ] Back up the database. Your brain lives there.
- [ ] Keep provider keys in a secrets manager, not a shared `.env`.

## Scaling notes

- The API is stateless. Run several replicas behind a load balancer.
- Ingestion is queue-driven. Set `QUEUE_PROVIDER=redis` and point `REDIS_URL` at a Redis
  instance to run background workers separately from the API.
- The vector index is HNSW. It trades a little build time for fast recall and handles millions
  of chunks comfortably on a single Postgres node.
