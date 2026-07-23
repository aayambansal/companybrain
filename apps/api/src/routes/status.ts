import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { getEngine, getEnv, type Variables } from '../context.js';
import { resolveAuth } from '../auth.js';

const app = new Hono<{ Variables: Variables }>();

// Authenticated status: provider config + counts for the caller's org.
app.get('/', async (c) => {
  const auth = await resolveAuth(c);
  const engine = getEngine();
  const env = getEnv();
  const base = {
    name: 'companybrain',
    version: env.version,
    embedding: { provider: engine.embedder.name, model: engine.embedder.model },
    llm: { provider: engine.llm.name, model: engine.llm.model, available: engine.llm.available },
  };
  if (!auth) return c.json(base);

  const counts = await engine.client.sql<{ documents: number; chunks: number; spaces: number }[]>`
    SELECT
      (SELECT count(*)::int FROM documents WHERE org_id = ${auth.orgId}) AS documents,
      (SELECT count(*)::int FROM chunks WHERE org_id = ${auth.orgId}) AS chunks,
      (SELECT count(*)::int FROM spaces WHERE org_id = ${auth.orgId}) AS spaces
  `;
  return c.json({
    ...base,
    org: auth.orgId,
    counts: counts[0] ?? { documents: 0, chunks: 0, spaces: 0 },
  });
});

export default app;
