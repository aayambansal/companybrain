# @companybrain/mcp

Model Context Protocol (MCP) server for CompanyBrain. It exposes your company brain as MCP tools over stdio so MCP clients — Claude Desktop, Cursor, and others — can read from and write to it.

## Tools

| Tool | Args | Does |
| --- | --- | --- |
| `search_memory` | `query`, `mode?` (`hybrid`\|`semantic`\|`keyword`), `limit?`, `space?` | Search memories; returns ranked hits (title, score, snippet, source URL) plus a structured block. |
| `add_memory` | `content`, `title?`, `space?`, `tags?`, `sourceUrl?` | Write a new memory. Returns the id and status. |
| `ask_memory` | `question`, `space?` | RAG answer grounded in the brain, with a `Sources:` citation list. |
| `list_spaces` | — | List the spaces (memory partitions). |

## Config

Read from the environment:

- `COMPANYBRAIN_API_URL` — API base URL. Default `http://localhost:3333`.
- `COMPANYBRAIN_API_KEY` — API key (`cb_...`). Required. Without it the server still starts, but every tool returns a clear error telling you to set it.

stdout is the MCP channel; all logs go to stderr.

## Run

From this package:

```bash
# dev (recommended in the monorepo)
COMPANYBRAIN_API_KEY=cb_... pnpm --filter @companybrain/mcp dev

# or directly
npx tsx src/index.ts

# build, then run the binary
pnpm --filter @companybrain/mcp build
COMPANYBRAIN_API_KEY=cb_... companybrain-mcp   # exposed via bin when installed
```

## Claude Desktop

Add an entry to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`). Use an absolute path to this package.

```json
{
  "mcpServers": {
    "companybrain": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/companybrain/apps/mcp/src/index.ts"],
      "env": {
        "COMPANYBRAIN_API_URL": "http://localhost:3333",
        "COMPANYBRAIN_API_KEY": "cb_your_key_here"
      }
    }
  }
}
```

If you built the package and installed it globally (so `companybrain-mcp` is on `PATH`), you can instead use:

```json
{
  "mcpServers": {
    "companybrain": {
      "command": "companybrain-mcp",
      "env": {
        "COMPANYBRAIN_API_URL": "http://localhost:3333",
        "COMPANYBRAIN_API_KEY": "cb_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after editing the config.

## Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "companybrain": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/companybrain/apps/mcp/src/index.ts"],
      "env": {
        "COMPANYBRAIN_API_URL": "http://localhost:3333",
        "COMPANYBRAIN_API_KEY": "cb_your_key_here"
      }
    }
  }
}
```

Then enable the server in Cursor Settings → MCP.
