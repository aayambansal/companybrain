import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { spaces, documents } from '@companybrain/db';
import { sql } from 'drizzle-orm';
import { getEngine, type Variables } from '../context.js';
import { slugify } from '../crypto.js';

const app = new Hono<{ Variables: Variables }>();

app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      description: spaces.description,
      icon: spaces.icon,
      color: spaces.color,
      isDefault: spaces.isDefault,
      createdAt: spaces.createdAt,
      documentCount: sql<number>`(select count(*)::int from ${documents} d where d.space_id = ${spaces.id})`,
    })
    .from(spaces)
    .where(eq(spaces.orgId, auth.orgId))
    .orderBy(desc(spaces.isDefault), spaces.name);
  return c.json({ spaces: rows });
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const d = parsed.data;
  const [space] = await engine.db
    .insert(spaces)
    .values({
      orgId: auth.orgId,
      name: d.name,
      slug: d.slug ? slugify(d.slug) : slugify(d.name),
      description: d.description,
      icon: d.icon,
      color: d.color,
    })
    .returning();
  return c.json({ space }, 201);
});

const patchSchema = createSchema.partial();

app.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const [space] = await engine.db
    .update(spaces)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(spaces.orgId, auth.orgId), eq(spaces.id, c.req.param('id'))))
    .returning();
  if (!space) return c.json({ error: 'not_found' }, 404);
  return c.json({ space });
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const [space] = await engine.db
    .select()
    .from(spaces)
    .where(and(eq(spaces.orgId, auth.orgId), eq(spaces.id, c.req.param('id'))))
    .limit(1);
  if (!space) return c.json({ error: 'not_found' }, 404);
  if (space.isDefault) return c.json({ error: 'cannot_delete_default_space' }, 400);
  await engine.db.delete(spaces).where(eq(spaces.id, space.id));
  return c.json({ deleted: true });
});

export default app;
