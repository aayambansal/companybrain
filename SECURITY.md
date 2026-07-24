# Security Policy

## Reporting a vulnerability

CompanyBrain stores potentially sensitive company knowledge, so we take security seriously.

If you discover a security vulnerability, **please do not open a public issue.** Instead,
email the maintainers with:

- A description of the vulnerability and its impact.
- Steps to reproduce.
- Any suggested remediation.

We will acknowledge within 72 hours and keep you updated on the fix.

## Supported versions

CompanyBrain is pre-1.0 and moving quickly. Security fixes are applied to `main` and the
latest release.

## Built-in protections

These are on by default; you configure them with the environment variables noted below.

- **Authentication.** Single-user mode maps every request to one workspace and can be gated with
  `ACCESS_TOKEN`. Multi-user mode (`AUTH_MODE=multi`) uses scrypt-hashed passwords verified in
  constant time, HS256-pinned session JWTs in an httpOnly cookie, and API keys stored only as a
  SHA-256 hash. Every record is scoped to its organization and ownership is checked on each `/:id`
  route.
- **Encryption at rest.** With `CREDENTIALS_KEY` set, connector credentials and provider API keys
  are encrypted with AES-256-GCM. Decryption fails closed.
- **SSRF guards.** Outbound webhooks refuse internal, private, and loopback targets (including the
  cloud metadata address) by default. Connectors apply the same guard to the URLs they crawl,
  re-checking every redirect hop; the default is mode-aware (blocked in multi-tenant mode, allowed
  in single-user mode). Override with `WEBHOOK_ALLOW_INTERNAL` and `CONNECTOR_ALLOW_INTERNAL`.
- **Rate limiting.** Login attempts are throttled per account. LLM generations (chat and playbook
  synthesis) are capped per principal with `LLM_RATE_LIMIT_PER_MIN` (default 60) so a leaked key or
  a runaway loop cannot run up provider cost.
- **Error handling.** In production, 500 responses return a generic message; the detail is logged
  server-side only. Set `EXPOSE_ERROR_DETAILS=true` to surface it while debugging.
- **Input bounds.** Ingest sizes are capped (document content, tags, metadata, and image/audio/video
  data URLs) so one request cannot spawn unbounded embedding or decode work.
- **Webhook integrity.** Deliveries are signed with an HMAC-SHA256 signature (`x-companybrain-signature`)
  so receivers can verify the payload came from your instance.
- **Credential redaction.** Connector URLs are redacted before appearing in error messages or sync
  logs, so a token passed in a query string is not leaked into the dashboard.

## Self-host hardening checklist

- [ ] Change `JWT_SECRET` to a strong random value (`openssl rand -hex 32`).
- [ ] Set `CREDENTIALS_KEY` (`openssl rand -hex 32`) to encrypt stored credentials at rest. Keep it
      stable and backed up; rotating it makes existing encrypted values unreadable.
- [ ] In single-user mode, set `ACCESS_TOKEN` if the instance is reachable by anyone but you.
- [ ] Restrict `CORS_ORIGINS` to your dashboard's origin.
- [ ] Leave `EXPOSE_ERROR_DETAILS` off in production.
- [ ] Leave `WEBHOOK_ALLOW_INTERNAL` and, in multi-tenant mode, `CONNECTOR_ALLOW_INTERNAL` off unless
      you deliberately reach a trusted internal address.
- [ ] Keep `LLM_RATE_LIMIT_PER_MIN` set (raise it for high-volume automation rather than disabling).
- [ ] Put the API behind TLS (reverse proxy).
- [ ] Use a dedicated Postgres role with least privilege.
- [ ] Rotate API keys periodically.
- [ ] Keep provider API keys in a secrets manager, not in `.env` on shared hosts.
