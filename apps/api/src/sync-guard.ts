import type { MemoryEngine } from '@companybrain/core';

/**
 * How long a `running` sync run stays authoritative. A run that is still marked
 * `running` past this bound is treated as abandoned — its process died before it
 * could finalize the row — so it stops blocking new syncs forever. Chosen well
 * above a normal sync's duration; only a crashed run (or an unusually large
 * initial import) reaches it.
 */
const RUNNING_STALE_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Return the id of an in-flight sync run for the connection, or null if none.
 *
 * Both the manual sync route and the in-process scheduler call this before
 * starting a run so two syncs never run for the same connection at once. Concurrent
 * syncs share one starting cursor and race on `setCursor`, which can move the
 * cursor backwards and make the next sync re-fetch already-synced items.
 */
export async function activeSyncRunId(
  engine: MemoryEngine,
  connectionId: string,
): Promise<string | null> {
  const cutoff = new Date(Date.now() - RUNNING_STALE_MS);
  const rows = await engine.client.sql<{ id: string }[]>`
    select id from sync_runs
    where connection_id = ${connectionId}
      and status = 'running'
      and started_at > ${cutoff}
    order by started_at desc
    limit 1`;
  return rows[0]?.id ?? null;
}
