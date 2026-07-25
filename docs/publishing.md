# Publishing to npm

CompanyBrain ships several packages to npm. This is the release procedure.

## Published

| Package | What it is | Install |
| --- | --- | --- |
| `companybrain` | One-command installer/runner | `npx companybrain` |
| `n8n-nodes-companybrain` | n8n community node | (add in n8n) |

## Scoped packages (`@companybrain/*`)

These publish under the `@companybrain` npm scope, which is an organization. Create it
once (free for public packages) at <https://www.npmjs.com/org/create> — name it
`companybrain`, choose the Free plan. After that, any maintainer added to the org can
publish.

| Package | What it is | Install |
| --- | --- | --- |
| `@companybrain/sdk` | TypeScript client SDK | `npm i @companybrain/sdk` |
| `@companybrain/mcp` | MCP server for AI agents | `npx -y @companybrain/mcp` |
| `@companybrain/ai-sdk` | Vercel AI SDK tools | `npm i @companybrain/ai-sdk` |
| `@companybrain/langchain` | LangChain retriever | `npm i @companybrain/langchain` |
| `@companybrain/openai` | OpenAI function-calling tools | `npm i @companybrain/openai` |

Each keeps `src`-based entry points for the workspace and swaps to compiled `dist`
at publish time via `publishConfig`, so consumers get plain JavaScript with types.

## Procedure

Releases run from CI, so no one needs an npm token on their machine. Bump the
version, push a matching tag, and the `Release` workflow does the rest:

```bash
# 1. Bump packages/launcher/package.json (and any other package you are shipping).
# 2. Commit it through the normal branch -> PR -> merge flow.
# 3. Tag the merge commit and push the tag.
git tag v0.6.0
git push origin v0.6.0
```

The workflow runs typecheck, test, format, and build, refuses to continue if the
tag does not match `packages/launcher`'s version, publishes to npm with
provenance, and opens a GitHub release with generated notes. Re-running a tag is
safe: versions already on the registry are skipped rather than failing the run.

It needs one repository secret, `NPM_TOKEN`, an npm automation token with
publish rights (Settings -> Secrets and variables -> Actions).

To publish by hand instead (needs a local token):

```bash
npm whoami                       # confirm the account
pnpm -r build
pnpm -r publish --access public --no-git-checks
```

To cut a new version, bump `version` in the affected `package.json` files (keep the
workspace in lockstep) and re-run the procedure. The Python SDK is released separately
to PyPI from `sdks/python`.
