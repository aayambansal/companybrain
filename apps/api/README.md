# @companybrain/api

The CompanyBrain HTTP API, built on Hono. Runs on Node, serves the dashboard, SDKs, MCP
server, and Chrome extension.

```sh
pnpm --filter @companybrain/api dev   # :3333
```

Auto-migrates on boot (disable with `AUTO_MIGRATE=false`), prints an ASCII banner, and serves
interactive docs at `/docs` plus the raw spec at `/v1/openapi.json`.

## Auth

- API keys: `Authorization: Bearer cb_...` (hashed at rest, prefix shown in the UI).
- Session JWT: set by `/v1/auth/login` and `/v1/auth/register`, also accepted as a bearer token
  or `cb_session` cookie.

## Routes

`/health`, `/v1/status`, `/v1/auth/*`, `/v1/memories`, `/v1/search`, `/v1/chat` (+ `/stream`),
`/v1/spaces`, `/v1/connections`, `/v1/api-keys`. See `/docs`.

Connectors register into an in-process registry (`src/connectors/registry.ts`) so the API does
not hard-depend on every connector package.
