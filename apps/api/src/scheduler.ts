import { eq } from 'drizzle-orm';
import { connections, syncRuns } from '@companybrain/db';
import { getConnectorRegistry } from './connectors/registry.js';
import { getEngine } from './context.js';

/**
 * In-process connector scheduler. Every tick it looks for active connections
 * whose `config.syncIntervalMinutes` is set and due, and runs their sync. A
 * single instance is assumed (self-host default); with multiple API replicas,
 * disable it on all but one via DISABLE_SCHEDULER=true.
 */
const running = new Set<string>();

function intervalMinutes(config: unknown): number {
  const v = (config as { syncIntervalMinutes?: unknown } | null)?.syncIntervalMinutes;
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function startScheduler(intervalMs = 60_000): NodeJS.Timeout {
  const tick = async () => {
    try {
      const runner = getConnectorRegistry().getRunner();
      if (!runner) return;
      const engine = getEngine();
      const rows = await engine.db.select().from(connections).where(eq(connections.status, 'active'));
      const now = Date.now();
      for (const conn of rows) {
        const interval = intervalMinutes(conn.config);
        if (!interval || running.has(conn.id)) continue;
        const last = conn.lastSyncedAt ? new Date(conn.lastSyncedAt).getTime() : 0;
        if (now - last < interval * 60_000) continue;
        running.add(conn.id);
        const [run] = await engine.db.insert(syncRuns).values({ connectionId: conn.id }).returning();
        if (!run) {
          running.delete(conn.id);
          continue;
        }
        void runner(engine, conn, run)
          .catch((e) => console.error('[scheduler] sync failed', conn.id, e))
          .finally(() => running.delete(conn.id));
      }
    } catch (e) {
      console.error('[scheduler] tick error:', e);
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return timer;
}
