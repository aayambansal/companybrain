import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { documents } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';
import { SingleFlight } from '../single-flight.js';

const app = new Hono<{ Variables: Variables }>();

// One reindex per org at a time: it re-embeds every document, so overlapping
// runs waste provider spend and re-process the same rows.
const reindexes = new SingleFlight();

// Re-chunk and re-embed every memory. Runs in the background; returns the count.
app.post('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.orgId, auth.orgId));
  if (!reindexes.tryStart(auth.orgId)) {
    return c.json({ started: false, alreadyRunning: true, documents: rows.length }, 200);
  }
  void engine
    .reindexAll(auth.orgId)
    .catch((e) => console.error('[reindex] failed:', e))
    .finally(() => reindexes.finish(auth.orgId));
  return c.json({ started: true, documents: rows.length }, 202);
});

export default app;
