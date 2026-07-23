# @companybrain/connectors

Built-in connectors plus the sync runner and registry. A connector pulls
`SourceDocument`s from a source; the runner feeds them into the
`MemoryEngine` and records a `sync_runs` row.

No external npm dependencies: connectors use the global `fetch` (Node 20+) and
`node:fs` / `node:path` only. All parsing is isolated in pure, exported
functions so it can be unit-tested without network or filesystem.

```ts
import { MemoryEngine } from '@companybrain/core';
import { getConnector, runConnectorSync, registerAll } from '@companybrain/connectors';

// Register everything with a host registry (e.g. the API).
registerAll(registry);

// Or run a sync directly.
await runConnectorSync(engine, connection, syncRun);
```

## Connectors

### `web` — single web page

Fetches one URL, converts the HTML to text, and takes the title from `<title>`.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `url` | url | yes | The page to fetch and index. |

### `sitemap` — every page in a sitemap

Parses `<loc>` entries from a `sitemap.xml` (urlset or sitemap index), then
fetches each page like `web`.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `sitemapUrl` | url | yes | URL of the sitemap. |
| `limit` | number | no | Max pages per sync (default `100`). |

### `files` — local folder

Recursively walks a folder, reading each matching file. `sourceId` is the file
path relative to the root. `.md` / `.markdown` / `.mdx` files are indexed as
Markdown. Dotfiles and dot-directories are skipped.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `path` | path | yes | Absolute path to a folder the server can read. |
| `extensions` | string | no | Comma-separated extensions to include (default `md, markdown, mdx, txt`). |

### `obsidian` — Obsidian vault

Like `files`, but scoped to Markdown notes. Reads YAML frontmatter `tags`,
strips the frontmatter from the body, and records `[[wikilink]]` targets in
`metadata.links`.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `path` | path | yes | Absolute path to the vault folder. |

### `rss` — RSS / Atom feed

Parses an RSS 2.0 or Atom feed. Reads title, link, description /
`content:encoded` (or Atom `content` / `summary`), publish/updated dates, and
guid / id.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `feedUrl` | url | yes | URL of an RSS 2.0 or Atom feed. |

## Pure parse helpers

Exported for reuse and testing, independent of any I/O:

- `parseRss(xml)` — RSS 2.0 + Atom → `SourceDocument[]`.
- `parseSitemap(xml)` — `<loc>` URLs.
- `parseFrontmatter(text)` — `{ tags, body, links }` for an Obsidian note.
- `walkFiles(root, extensions?)` — sorted relative file paths.
- `parseHtmlPage(html, url)` — HTML → `SourceDocument`.

## Runner & registry

- `runConnectorSync(engine, connection, syncRun)` — resolves the connector by
  `connection.connector`, resolves the space (`connection.spaceId` or the org
  default), builds a `ConnectorContext` (cursor persistence + logging), iterates
  `pull`, upserts each document, and finalizes the `sync_runs` row plus
  `connections.lastSyncedAt`. Per-document errors are caught so one bad document
  never aborts the run.
- `registerAll(registry)` — registers every connector and the runner against a
  host-provided `ConnectorRegistry`. The package never imports from `apps/*`.
