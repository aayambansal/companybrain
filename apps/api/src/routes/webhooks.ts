import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, desc } from 'drizzle-orm';
import { webhooks } from '@companybrain/db';
import { signWebhook } from '@companybrain/core';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

app.get('/', async (c) => {
  const auth = c.get('auth');
  const rows = await getEngine()
    .db.select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      active: webhooks.active,
      lastStatus: webhooks.lastStatus,
      lastDeliveredAt: webhooks.lastDeliveredAt,
      createdAt: webhooks.createdAt,
      hasSecret: webhooks.secret,
    })
    .from(webhooks)
    .where(eq(webhooks.orgId, auth.orgId))
    .orderBy(desc(webhooks.createdAt));
  // Never return the raw secret.
  return c.json({ webhooks: rows.map(({ hasSecret, ...w }) => ({ ...w, hasSecret: Boolean(hasSecret) })) });
});

const createSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const [row] = await getEngine()
    .db.insert(webhooks)
    .values({
      orgId: auth.orgId,
      url: parsed.data.url,
      secret: parsed.data.secret ?? null,
      events: parsed.data.events ?? ['memory.created'],
    })
    .returning({ id: webhooks.id, url: webhooks.url, events: webhooks.events, active: webhooks.active });
  return c.json({ webhook: row }, 201);
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const res = await getEngine()
    .db.delete(webhooks)
    .where(and(eq(webhooks.orgId, auth.orgId), eq(webhooks.id, c.req.param('id'))))
    .returning({ id: webhooks.id });
  if (res.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ deleted: true });
});

// Send a test event to a webhook so users can confirm their receiver works.
app.post('/:id/test', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const [hook] = await engine.db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.orgId, auth.orgId), eq(webhooks.id, c.req.param('id'))))
    .limit(1);
  if (!hook) return c.json({ error: 'not_found' }, 404);
  const body = JSON.stringify({ event: 'ping', createdAt: new Date().toISOString(), data: { ok: true } });
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-companybrain-event': 'ping' };
  if (hook.secret) headers['x-companybrain-signature'] = signWebhook(hook.secret, body);
  let status = 0;
  try {
    const res = await fetch(hook.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    status = res.status;
  } catch {
    status = 0;
  }
  await engine.db.update(webhooks).set({ lastStatus: status, lastDeliveredAt: new Date() }).where(eq(webhooks.id, hook.id));
  return c.json({ status, ok: status >= 200 && status < 300 });
});

export default app;
