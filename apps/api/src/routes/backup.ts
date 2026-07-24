import { Hono } from 'hono';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { documents } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

// Export every memory for the org as a portable JSON document.
app.get('/export', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const rows = await engine.db
    .select({
      title: documents.title,
      content: documents.content,
      summary: documents.summary,
      tags: documents.tags,
      connector: documents.connector,
      sourceType: documents.sourceType,
      sourceUrl: documents.sourceUrl,
      metadata: documents.metadata,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.orgId, auth.orgId))
    .orderBy(desc(documents.createdAt));

  c.header('Content-Disposition', 'attachment; filename="companybrain-export.json"');
  return c.json({
    version: 1,
    tool: 'companybrain',
    count: rows.length,
    memories: rows,
  });
});

const importSchema = z.object({
  space: z.string().optional(),
  dedupe: z.boolean().optional().default(true),
  memories: z
    .array(
      z.object({
        title: z.string().max(500).nullable().optional(),
        content: z.string().min(1).max(1_000_000),
        tags: z.array(z.string().max(64)).max(50).optional(),
        sourceType: z.string().max(64).nullable().optional(),
        sourceUrl: z.string().nullable().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .max(5000),
});

// Import memories from a previously exported document (or any matching shape).
app.post('/import', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = importSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();
  const { memories, space, dedupe } = parsed.data;

  let imported = 0;
  let failed = 0;
  for (const m of memories) {
    try {
      await engine.addMemory({
        orgId: auth.orgId,
        spaceSlug: space,
        title: m.title ?? undefined,
        content: m.content,
        tags: m.tags,
        sourceType: m.sourceType ?? undefined,
        sourceUrl: m.sourceUrl ?? undefined,
        metadata: m.metadata,
        connector: 'import',
        dedupe,
      });
      imported += 1;
    } catch {
      failed += 1;
    }
  }
  return c.json({ imported, failed, total: memories.length });
});

export default app;
