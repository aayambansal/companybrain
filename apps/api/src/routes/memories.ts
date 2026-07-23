import { Hono } from 'hono';
import { z } from 'zod';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

const addSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1),
  format: z.enum(['text', 'markdown', 'html']).optional(),
  space: z.string().optional(),
  spaceId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  dedupe: z.boolean().optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  }
  const d = parsed.data;
  const engine = getEngine();
  const memory = await engine.addMemory({
    orgId: auth.orgId,
    title: d.title,
    content: d.content,
    format: d.format,
    spaceId: d.spaceId,
    spaceSlug: d.space,
    tags: d.tags,
    sourceUrl: d.sourceUrl,
    sourceType: d.sourceType,
    metadata: d.metadata,
    dedupe: d.dedupe,
  });
  return c.json({ memory }, 201);
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const limit = Math.min(Number.parseInt(c.req.query('limit') ?? '50', 10) || 50, 200);
  const offset = Number.parseInt(c.req.query('offset') ?? '0', 10) || 0;
  const spaceId = c.req.query('spaceId') || undefined;
  const connector = c.req.query('connector') || undefined;
  const { memories, total } = await engine.listMemories({ orgId: auth.orgId, spaceId, connector, limit, offset });
  return c.json({ memories, total, limit, offset });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const memory = await engine.getMemory(auth.orgId, c.req.param('id'));
  if (!memory) return c.json({ error: 'not_found' }, 404);
  return c.json({ memory });
});

const patchSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  spaceId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

app.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const memory = await engine.updateMemory(auth.orgId, c.req.param('id'), parsed.data);
  if (!memory) return c.json({ error: 'not_found' }, 404);
  return c.json({ memory });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const ok = await engine.deleteMemory(auth.orgId, c.req.param('id'));
  if (!ok) return c.json({ error: 'not_found' }, 404);
  return c.json({ deleted: true });
});

export default app;
