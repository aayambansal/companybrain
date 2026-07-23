import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { connections, syncRuns } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';
import { getConnectorRegistry } from '../connectors/registry.js';

const app = new Hono<{ Variables: Variables }>();

// List connector types available to configure.
app.get('/available', (c) => {
  const registry = getConnectorRegistry();
  return c.json({ connectors: registry.list() });
});

// List configured connections for the org (never returns credentials).
app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({
      id: connections.id,
      connector: connections.connector,
      name: connections.name,
      config: connections.config,
      status: connections.status,
      spaceId: connections.spaceId,
      lastSyncedAt: connections.lastSyncedAt,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .where(eq(connections.orgId, auth.orgId))
    .orderBy(desc(connections.createdAt));
  return c.json({ connections: rows });
});

const createSchema = z.object({
  connector: z.string().min(1),
  name: z.string().min(1),
  spaceId: z.string().uuid().optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const d = parsed.data;
  const [conn] = await engine.db
    .insert(connections)
    .values({
      orgId: auth.orgId,
      connector: d.connector,
      name: d.name,
      spaceId: d.spaceId ?? null,
      config: d.config ?? {},
      credentials: d.credentials ?? {},
    })
    .returning({
      id: connections.id,
      connector: connections.connector,
      name: connections.name,
      status: connections.status,
    });
  return c.json({ connection: conn }, 201);
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const res = await engine.db
    .delete(connections)
    .where(and(eq(connections.orgId, auth.orgId), eq(connections.id, c.req.param('id'))))
    .returning({ id: connections.id });
  if (res.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ deleted: true });
});

// Trigger a sync. Runs the connector's runner if one is registered.
app.post('/:id/sync', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const [conn] = await engine.db
    .select()
    .from(connections)
    .where(and(eq(connections.orgId, auth.orgId), eq(connections.id, c.req.param('id'))))
    .limit(1);
  if (!conn) return c.json({ error: 'not_found' }, 404);

  const registry = getConnectorRegistry();
  const runner = registry.getRunner();
  if (!runner) {
    return c.json(
      { error: 'no_runner', message: 'No connector runner is registered on this server.' },
      501,
    );
  }

  const [run] = await engine.db.insert(syncRuns).values({ connectionId: conn.id }).returning();
  // Fire and forget; the runner updates the sync_run + connection records.
  void runner(engine, conn, run!).catch(() => {});
  return c.json({ started: true, syncRunId: run!.id }, 202);
});

// Sync history for a connection.
app.get('/:id/runs', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const [conn] = await engine.db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.orgId, auth.orgId), eq(connections.id, c.req.param('id'))))
    .limit(1);
  if (!conn) return c.json({ error: 'not_found' }, 404);
  const runs = await engine.db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.connectionId, conn.id))
    .orderBy(desc(syncRuns.startedAt))
    .limit(20);
  return c.json({ runs });
});

export default app;
