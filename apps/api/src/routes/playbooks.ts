import { Hono } from 'hono';
import { z } from 'zod';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

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
  if (!parsed.success) return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
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

export default app;
