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
  return c.json({ status: db === 'up' ? 'ok' : 'degraded', db, ts: new Date().toISOString() });
});

export default app;
