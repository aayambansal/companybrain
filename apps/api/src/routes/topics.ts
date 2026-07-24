import { Hono } from 'hono';
import { getEngine, type Variables } from '../context.js';
import { queryInt } from '../query.js';

const app = new Hono<{ Variables: Variables }>();

// GET /v1/topics?space=&limit=&minCount=
// Group memories by their tags to surface projects, people, and themes.
app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const spaceId = c.req.query('spaceId') || undefined;
  const space = c.req.query('space') || undefined;
  const limit = queryInt(c.req.query('limit'), { fallback: 24, min: 1, max: 100 });
  const minCount = queryInt(c.req.query('minCount'), { fallback: 2, min: 1 });
  const topics = await engine.topics(auth.orgId, { spaceId, spaceSlug: space, limit, minCount });
  return c.json({ topics });
});

export default app;
