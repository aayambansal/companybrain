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

## Self-host hardening checklist

- [ ] Change `JWT_SECRET` to a strong random value (`openssl rand -hex 32`).
- [ ] Restrict `CORS_ORIGINS` to your dashboard's origin.
- [ ] Put the API behind TLS (reverse proxy).
- [ ] Use a dedicated Postgres role with least privilege.
- [ ] Rotate API keys periodically.
- [ ] Keep provider API keys in a secrets manager, not in `.env` on shared hosts.
