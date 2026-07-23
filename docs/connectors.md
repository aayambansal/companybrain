# Connectors

A connector pulls content from a source, hands it to the ingestion pipeline, and keeps it in
sync. Everything ends up as `documents` and `chunks` in the same store, so search and chat
work across sources without caring where anything came from.

## Model

Each connector implements a small interface:

```ts
interface Connector {
  id: string;                         // 'obsidian', 'slack', ...
  displayName: string;
  configSchema: ConfigSchema;         // what the UI asks for
  // Yield normalized documents. Called for full and incremental syncs.
  pull(ctx: ConnectorContext): AsyncIterable<SourceDocument>;
}
```

A `SourceDocument` is source-agnostic: title, content, a stable `sourceId` for dedupe, a
`sourceUrl`, timestamps, and free-form metadata. The pipeline handles parsing, chunking,
embedding, and indexing from there.

## Sync

- Full sync walks the whole source once.
- Incremental sync uses the connection `cursor` (a timestamp, an eTag, a Slack ts, a Drive
  page token) to only pull what changed.
- Every run is recorded in `sync_runs` with counts and any error.

## Available connectors

| connector           | id         | auth          | config                       | status      |
| ------------------- | ---------- | ------------- | ---------------------------- | ----------- |
| Raw text / API      | `api`      | none / key    | (post to /v1/memories)       | `[core]`    |
| Web page / URL      | `web`      | none          | `url`                        | `[core]`    |
| Sitemap crawl       | `sitemap`  | none          | `sitemapUrl`, `limit`        | `[core]`    |
| Markdown / files / PDF | `files` | local path | `path`, `extensions` (md,txt,pdf) | `[core]`    |
| Obsidian vault      | `obsidian` | local path    | `path`                       | `[core]`    |
| RSS / Atom          | `rss`      | none          | `feedUrl`                    | `[core]`    |
| GitHub              | `github`   | token         | `repo`, `token?`, `branch?`  | `[core]`    |
| Notion              | `notion`   | token         | `token` (integration)        | `[core]`    |
| Slack               | `slack`    | bot token     | `token`, `channel`           | `[core]`    |
| Google Docs / Drive | `google`   | OAuth         | (planned)                    | `[planned]` |
| PDF (via files)     | `files`    | local path    | in the files connector       | `[core]`    |

## Writing your own

1. Add a package or file under `packages/connectors`.
2. Implement the `Connector` interface.
3. Register it so the API and dashboard can list it.
4. Add a row to this table and open a PR.

See existing connectors for the pattern.
