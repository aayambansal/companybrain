import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import {
  buildPlaybookPrompt,
  buildContext,
  toCitations,
  PLAYBOOK_SYSTEM,
} from '@companybrain/core';
import { getEngine, type Variables } from '../context.js';
import { llmRateLimit } from '../llm-rate-limit.js';

const app = new Hono<{ Variables: Variables }>();

// Playbook synthesis calls the LLM on every request; share the same per-
// principal budget as chat so a leaked key or runaway loop can't run up
// provider cost here either. Covers both `/` and `/stream`.
app.use('*', llmRateLimit);

const playbookSchema = z.object({
  topic: z.string().min(1).max(300),
  spaceId: z.string().uuid().optional(),
  space: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  /** Save the generated playbook back as a searchable memory. */
  save: z.boolean().optional(),
});

app.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = playbookSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const engine = getEngine();

  const playbook = await engine.generatePlaybook(auth.orgId, {
    topic: d.topic,
    spaceId: d.spaceId,
    spaceSlug: d.space,
    limit: d.limit,
  });

  // Optionally persist it so the playbook itself becomes recall-able.
  let savedId: string | undefined;
  if (d.save) {
    const memory = await engine.addMemory({
      orgId: auth.orgId,
      title: playbook.title,
      content: playbook.content,
      format: 'markdown',
      spaceId: d.spaceId,
      spaceSlug: d.space,
      sourceType: 'playbook',
      tags: ['playbook'],
      metadata: { topic: d.topic, generated: true },
    });
    savedId = memory.id;
  }

  return c.json({ playbook, savedId }, 201);
});

// Server-sent events: emit citations, then stream the playbook token by token.
app.post('/stream', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = playbookSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const engine = getEngine();

  return streamSSE(c, async (stream) => {
    const { hits } = await engine.search(auth.orgId, {
      q: d.topic,
      spaceId: d.spaceId,
      spaceSlug: d.space,
      mode: 'hybrid',
      limit: d.limit ?? 12,
    });
    await stream.writeSSE({ event: 'citations', data: JSON.stringify(toCitations(hits)) });

    const llm = engine.llm;
    if (llm.available && llm.stream && hits.length > 0) {
      let sentAny = false;
      try {
        for await (const token of llm.stream({
          system: PLAYBOOK_SYSTEM,
          temperature: 0.3,
          maxTokens: 1600,
          messages: [{ role: 'user', content: buildPlaybookPrompt(d.topic, buildContext(hits)) }],
        })) {
          // JSON-encode so newlines survive SSE framing (Markdown needs them).
          await stream.writeSSE({ event: 'token', data: JSON.stringify(token) });
          sentAny = true;
        }
      } catch {
        // The model stream failed; if nothing was sent, emit a source outline
        // so the user gets a grounded result rather than an empty document.
        if (!sentAny) {
          const outline = `# ${d.topic}\n\n## Sources\n\n${hits
            .map((h, i) => `- ${h.document.title ?? 'Untitled'} [${i + 1}]`)
            .join('\n')}`;
          await stream.writeSSE({ event: 'token', data: JSON.stringify(outline) });
        }
      }
    } else {
      const playbook = await engine.generatePlaybook(auth.orgId, {
        topic: d.topic,
        spaceId: d.spaceId,
        spaceSlug: d.space,
        limit: d.limit,
      });
      await stream.writeSSE({ event: 'token', data: JSON.stringify(playbook.content) });
    }
    await stream.writeSSE({ event: 'done', data: '1' });
  });
});

export default app;
