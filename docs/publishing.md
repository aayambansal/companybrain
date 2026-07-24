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

```bash
# 1. Authenticate (a granular automation token with publish rights is fine).
npm whoami                       # confirm you are the intended account

# 2. Build every package's dist.
pnpm -r build

# 3. Publish. pnpm publishes in dependency order and skips private packages and
#    versions already on the registry, so this is safe to re-run.
pnpm -r publish --access public --no-git-checks
```

To cut a new version, bump `version` in the affected `package.json` files (keep the
workspace in lockstep) and re-run the procedure. The Python SDK is released separately
to PyPI from `sdks/python`.
