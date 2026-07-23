import { Hono } from 'hono';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

// GET /v1/digest?space=&limit=  — summarize what recently landed in the brain.
app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const space = c.req.query('space') || undefined;
  const spaceId = c.req.query('spaceId') || undefined;
  const limit = Math.min(Number.parseInt(c.req.query('limit') ?? '15', 10) || 15, 50);
  const digest = await engine.digest(auth.orgId, { spaceSlug: space, spaceId, limit });
  return c.json({ digest });
});

export default app;
