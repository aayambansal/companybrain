import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

const chatSchema = z.object({
  message: z.string().min(1),
  spaceId: z.string().uuid().optional(),
  space: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const engine = getEngine();
  const res = await engine.chat(auth.orgId, d.message, {
    spaceId: d.spaceId,
    spaceSlug: d.space,
    limit: d.limit,
    history: d.history,
  });
  return c.json(res);
});

// Server-sent events streaming. Emits the citations first, then tokens.
app.post('/stream', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const engine = getEngine();

  return streamSSE(c, async (stream) => {
    const { hits } = await engine.search(auth.orgId, {
      q: d.message,
      spaceId: d.spaceId,
      spaceSlug: d.space,
      mode: 'hybrid',
      limit: d.limit ?? 8,
    });
    await stream.writeSSE({
      event: 'citations',
      data: JSON.stringify(hits.map((h, i) => ({ index: i + 1, documentId: h.documentId, title: h.document.title, sourceUrl: h.document.sourceUrl }))),
    });

    const llm = engine.llm;
    if (llm.available && llm.stream && hits.length > 0) {
      const context = hits.map((h, i) => `[${i + 1}] ${h.document.title ?? 'Untitled'}\n${h.content}`).join('\n\n');
      for await (const token of llm.stream({
        system: 'You are CompanyBrain. Answer only from the context. Cite passages inline as [n]. Be concise.',
        messages: [
          ...(d.history ?? []),
          { role: 'user', content: `Context:\n\n${context}\n\n---\nQuestion: ${d.message}` },
        ],
      })) {
        await stream.writeSSE({ event: 'token', data: token });
      }
    } else {
      const res = await engine.chat(auth.orgId, d.message, {
        spaceId: d.spaceId,
        spaceSlug: d.space,
        limit: d.limit,
        history: d.history,
      });
      await stream.writeSSE({ event: 'token', data: res.message });
    }
    await stream.writeSSE({ event: 'done', data: '1' });
  });
});

export default app;
