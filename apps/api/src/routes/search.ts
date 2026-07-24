import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

const searchSchema = z.object({
  q: z.string().min(1).max(1000),
  mode: z.enum(['hybrid', 'semantic', 'keyword']).optional(),
  spaceId: z.string().uuid().optional(),
  space: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  minScore: z.number().min(0).max(1).optional(),
  rerank: z.boolean().optional(),
  rerankMode: z.enum(['listwise', 'pointwise']).optional(),
  hyde: z.boolean().optional(),
});

async function run(c: Context<{ Variables: Variables }>, input: z.infer<typeof searchSchema>) {
  const auth = c.get('auth');
  const engine = getEngine();
  const res = await engine.search(auth.orgId, {
    q: input.q,
    mode: input.mode,
    spaceId: input.spaceId,
    spaceSlug: input.space,
    limit: input.limit,
    tags: input.tags,
    minScore: input.minScore,
    rerank: input.rerank,
    rerankMode: input.rerankMode,
    hyde: input.hyde,
  });
  return c.json(res);
}

app.get('/', async (c) => {
  const parsed = searchSchema.safeParse({
    q: c.req.query('q'),
    mode: c.req.query('mode'),
    spaceId: c.req.query('spaceId') || undefined,
    space: c.req.query('space') || undefined,
    limit: c.req.query('limit') ? Number.parseInt(c.req.query('limit')!, 10) : undefined,
  });
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  return run(c, parsed.data);
});

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  return run(c, parsed.data);
});

export default app;
