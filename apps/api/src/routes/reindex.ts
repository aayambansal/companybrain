import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { documents } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

// Re-chunk and re-embed every memory. Runs in the background; returns the count.
app.post('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.orgId, auth.orgId));
  void engine.reindexAll(auth.orgId).catch((e) => console.error('[reindex] failed:', e));
  return c.json({ started: true, documents: rows.length }, 202);
});

export default app;
