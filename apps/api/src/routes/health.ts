import { Hono } from 'hono';
import { getEngine } from '../context.js';

const app = new Hono();

app.get('/', async (c) => {
  let db = 'unknown';
  try {
    await getEngine().client.sql`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }
  const healthy = db === 'up';
  // Return 503 when the database is unreachable so load balancers, orchestrator
  // readiness probes, and the Docker HEALTHCHECK take the instance out of
  // rotation instead of routing traffic it cannot serve.
  return c.json(
    { status: healthy ? 'ok' : 'degraded', db, ts: new Date().toISOString() },
    healthy ? 200 : 503,
  );
});

export default app;
