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

| connector           | id           | auth            | status      |
| ------------------- | ------------ | --------------- | ----------- |
| Raw text / API      | `api`        | API key         | `[core]`    |
| Web page / URL      | `web`        | none            | `[planned]` |
| Markdown / files    | `files`      | local path      | `[planned]` |
| Obsidian vault      | `obsidian`   | local path      | `[planned]` |
| PDF / DOCX          | `documents`  | upload          | `[planned]` |
| Google Docs / Drive | `google`     | OAuth           | `[planned]` |
| Slack               | `slack`      | OAuth           | `[planned]` |
| Notion              | `notion`     | OAuth           | `[planned]` |
| GitHub              | `github`     | app / token     | `[planned]` |
| RSS / Atom          | `rss`        | none            | `[planned]` |

## Writing your own

1. Add a package or file under `packages/connectors`.
2. Implement the `Connector` interface.
3. Register it so the API and dashboard can list it.
4. Add a row to this table and open a PR.

See existing connectors for the pattern.
