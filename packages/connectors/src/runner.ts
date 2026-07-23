import type { ConnectorContext, MemoryEngine } from '@companybrain/core';
import type { Connection, SyncRun } from '@companybrain/db';
import { getConnector } from './connectors/index.js';

export type RunConnectorSync = typeof runConnectorSync;

type SyncStatus = 'success' | 'partial' | 'error';

interface SyncStats {
  documents: number;
  chunks: number;
  skipped: number;
  failed: number;
}

/**
 * Run one connector sync for a configured connection and record the outcome.
 *
 * Resolves the connector by `connection.connector`, resolves the target space,
 * builds a ConnectorContext (with cursor persistence and logging), iterates the
 * connector's `pull`, upserts each document, and tallies stats. Per-document
 * failures are caught so a single bad document does not abort the run. Always
 * finalizes the `sync_runs` row and `connections.lastSyncedAt`; never throws.
 */
export async function runConnectorSync(
  engine: MemoryEngine,
  connection: Connection,
  syncRun: SyncRun,
): Promise<void> {
  const stats: SyncStats = { documents: 0, chunks: 0, skipped: 0, failed: 0 };
  const errors: string[] = [];

  const connector = getConnector(connection.connector);
  if (!connector) {
    await finishRun(engine, syncRun.id, connection.id, 'error', stats, [
      `unknown connector: ${connection.connector}`,
    ]);
    return;
  }

  const spaceId = connection.spaceId ?? (await engine.getOrCreateDefaultSpace(connection.orgId));

  let cursor = connection.cursor;
  const ctx: ConnectorContext = {
    config: connection.config,
    credentials: connection.credentials,
    cursor,
    setCursor: async (next: string) => {
      cursor = next;
      await engine.client
        .sql`update connections set cursor = ${next}, updated_at = now() where id = ${connection.id}`;
    },
    log: (message, meta) => {
      // eslint-disable-next-line no-console
      console.log(`[sync ${connection.connector} ${connection.id}] ${message}`, meta ?? {});
    },
  };

  let fatal: string | null = null;
  try {
    for await (const doc of connector.pull(ctx)) {
      try {
        const { action } = await engine.upsertSourceDocument(
          connection.orgId,
          spaceId,
          connection.id,
          connection.connector,
          doc,
        );
        if (action === 'skipped') stats.skipped += 1;
        else stats.documents += 1;
      } catch (err) {
        stats.failed += 1;
        const msg = errorMessage(err);
        errors.push(msg);
        ctx.log?.('document failed', { error: msg });
      }
    }
  } catch (err) {
    fatal = errorMessage(err);
    ctx.log?.('sync failed', { error: fatal });
  }

  const synced = stats.documents + stats.skipped;
  let status: SyncStatus;
  if (fatal) status = synced > 0 ? 'partial' : 'error';
  else if (stats.failed > 0) status = synced > 0 ? 'partial' : 'error';
  else status = 'success';

  const errorLines = fatal ? [fatal, ...errors] : errors;
  await finishRun(engine, syncRun.id, connection.id, status, stats, errorLines);
}

async function finishRun(
  engine: MemoryEngine,
  syncRunId: string,
  connectionId: string,
  status: SyncStatus,
  stats: SyncStats,
  errors: string[],
): Promise<void> {
  const error = errors.length > 0 ? errors.slice(0, 5).join('\n') : null;
  await engine.client.sql`
    update sync_runs
    set status = ${status}, stats = ${JSON.stringify(stats)}::jsonb, error = ${error}, finished_at = now()
    where id = ${syncRunId}
  `;
  await engine.client.sql`
    update connections set last_synced_at = now(), updated_at = now() where id = ${connectionId}
  `;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
