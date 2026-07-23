# Deploy

CompanyBrain is three Docker services (Postgres + pgvector, the API on `:3333`,
the dashboard on `:3000`) that you own. Migrations run automatically on API boot
(`AUTO_MIGRATE` defaults to true) and create the `vector` extension, so any
target with a pgvector-capable Postgres works. Pick a host below.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/aayambansal/companybrain)

## Docker Compose (the default)

Already the one-command path. Clones, provisions Postgres, builds both apps.

```sh
git clone https://github.com/aayambansal/companybrain.git
cd companybrain
cp .env.example .env      # defaults work with zero keys
docker compose up -d
```

Open `http://localhost:3000`. See [self-hosting](./self-hosting.md) for the
production checklist (set `JWT_SECRET`, lock `CORS_ORIGINS`, terminate TLS).

## npx companybrain

The installer wraps the same Compose stack. It clones if needed, asks two
questions, and starts everything.

```sh
npx companybrain
```

## Render

One click with the button above, or push [`render.yaml`](../render.yaml) and
create a Blueprint from the dashboard. It provisions managed Postgres, the API,
and the dashboard, wires `DATABASE_URL` from the database, generates
`JWT_SECRET`, sets `AUTH_MODE=single`, and points the dashboard at the API.
After the first deploy, set `CORS_ORIGINS` to the dashboard origin.

## Railway

Deploy the API from [`railway.json`](../railway.json) (New Project > Deploy from
Repo). Then, in the same project:

- Add a PostgreSQL database and set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on
  the API service.
- Set `AUTH_MODE=single` and `JWT_SECRET` (`openssl rand -hex 32`).
- Add a second service from `apps/web/Dockerfile` and set `NEXT_PUBLIC_API_URL`
  to the API's public URL.

Railway Postgres supports pgvector; the API migration enables it on boot.

## Fly.io

[`fly.toml`](../fly.toml) configures the API app. Postgres is provisioned
separately:

```sh
fly launch --no-deploy
fly postgres create --name companybrain-db
fly postgres attach companybrain-db     # sets DATABASE_URL
fly postgres connect -a companybrain-db -c "CREATE EXTENSION IF NOT EXISTS vector;"
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

Deploy the dashboard as its own Fly app from `apps/web/Dockerfile` and set its
`NEXT_PUBLIC_API_URL` to the API app's URL.

## Bring your own Postgres

Skip the bundled database and point `DATABASE_URL` at any managed Postgres 14+
with the `vector` extension available — Supabase, Neon, RDS (extension enabled),
Crunchy, and others all work.

```sh
DATABASE_URL=postgres://user:pass@your-host:5432/companybrain
```

The API creates the `vector` and `pgcrypto` extensions, all tables, and the
indexes on first boot. Run the API (Compose, Render, Railway, Fly, or bare
`pnpm dev`) against it — nothing else changes.

## Prebuilt images

Tagged releases publish to GHCR via
[`publish-images.yml`](../.github/workflows/publish-images.yml):

```sh
docker pull ghcr.io/aayambansal/companybrain-api:latest
docker pull ghcr.io/aayambansal/companybrain-web:latest
```
