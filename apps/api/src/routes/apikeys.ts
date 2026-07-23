import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { apiKeys } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';
import { generateApiKey } from '../crypto.js';

const app = new Hono<{ Variables: Variables }>();

app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.orgId, auth.orgId))
    .orderBy(desc(apiKeys.createdAt));
  return c.json({ keys: rows });
});

const createSchema = z.object({ name: z.string().min(1).max(120) });

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const { key, prefix, hash } = generateApiKey();
  const [row] = await engine.db
    .insert(apiKeys)
    .values({
      orgId: auth.orgId,
      createdByUserId: auth.userId ?? null,
      name: parsed.data.name,
      keyHash: hash,
      prefix,
    })
    .returning({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt });
  // The plaintext key is returned exactly once.
  return c.json({ key: { ...row, secret: key } }, 201);
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const [row] = await engine.db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.orgId, auth.orgId), eq(apiKeys.id, c.req.param('id'))))
    .returning({ id: apiKeys.id });
  if (!row) return c.json({ error: 'not_found' }, 404);
  return c.json({ revoked: true });
});

export default app;
