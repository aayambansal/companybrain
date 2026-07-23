import { Hono } from 'hono';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

// GET /v1/topics?space=&limit=&minCount=
// Group memories by their tags to surface projects, people, and themes.
app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const spaceId = c.req.query('spaceId') || undefined;
  const space = c.req.query('space') || undefined;
  const limit = Math.min(Number.parseInt(c.req.query('limit') ?? '24', 10) || 24, 100);
  const minCount = Math.max(Number.parseInt(c.req.query('minCount') ?? '2', 10) || 2, 1);
  const topics = await engine.topics(auth.orgId, { spaceId, spaceSlug: space, limit, minCount });
  return c.json({ topics });
});

export default app;
