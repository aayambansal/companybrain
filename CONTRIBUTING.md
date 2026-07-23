# Contributing to CompanyBrain

Thanks for helping build the open-source memory layer for teams.

## Development setup

Requirements: Node 20+, pnpm 9+, Docker.

```bash
pnpm install
docker compose up -d db
pnpm db:migrate
pnpm dev
```

## Ground rules

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **Every change ships via a pull request** — branch → PR → merge. Never push to `main`.
- **Keep it typed.** `pnpm typecheck` must pass.
- **Keep it formatted.** `pnpm format` before you commit.
- **Small, focused PRs.** One feature/fix per PR.

## Project structure

This is a Turborepo + pnpm monorepo. Packages live under `packages/`, runnable apps under
`apps/`. Prefer adding to an existing package over creating a new one unless the boundary is
clear.

## Adding a connector

Connectors live in `packages/connectors`. Implement the `Connector` interface, register it,
add docs, and open a PR. See existing connectors for the pattern.

## Running checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

By contributing you agree your contributions are licensed under the MIT License.
