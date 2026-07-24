import { Hono } from 'hono';
import { z } from 'zod';
import { parseDataUrl } from '@companybrain/core';
import { getEngine, type Variables } from '../context.js';
import { queryInt } from '../query.js';

const app = new Hono<{ Variables: Variables }>();

// A single memory of ~1MB is already ~500 embedding chunks; cap here so one
// request can't spawn unbounded embedding work (cost, latency, memory). This
// is generous, a full book is well under it.
export const MAX_CONTENT = 1_000_000;
const tagsSchema = z.array(z.string().max(64)).max(50);

// Metadata is arbitrary JSON stored as jsonb and echoed back in list/search
// responses. Bound its serialized size so a memory can't carry a multi-MB blob
// that bloats every row and response; 100KB is far above real key/value use.
const MAX_METADATA = 100_000;
export const metadataSchema = z
  .record(z.unknown())
  .refine((m) => JSON.stringify(m).length <= MAX_METADATA, {
    message: `metadata must be under ${MAX_METADATA} bytes when serialized`,
  });

// Media data URLs are base64 (~33% larger than the bytes) and get decoded into
// memory then handed to a vision model / Whisper / ffmpeg. Cap each near the
// real provider ceiling so an oversized blob is rejected up front instead of
// buffered and sent to a processor that would reject it anyway. Vision APIs cap
// around 20MB, Whisper around 25MB; video is looser since ffmpeg runs locally.
const MAX_IMAGE = 28_000_000; // ~20MB decoded
const MAX_AUDIO = 35_000_000; // ~25MB decoded
const MAX_VIDEO = 280_000_000; // ~200MB decoded

export const addSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().min(1).max(MAX_CONTENT).optional(),
  /** A data URL (data:image/png;base64,...) to OCR + caption with a vision LLM. */
  image: z.string().max(MAX_IMAGE).optional(),
  /** A data URL (data:audio/mpeg;base64,...) to transcribe with a speech model. */
  audio: z.string().max(MAX_AUDIO).optional(),
  /** A data URL (data:video/mp4;base64,...) to transcribe + frame-caption via ffmpeg. */
  video: z.string().max(MAX_VIDEO).optional(),
  format: z.enum(['text', 'markdown', 'html']).optional(),
  space: z.string().optional(),
  spaceId: z.string().uuid().optional(),
  tags: tagsSchema.optional(),
  sourceUrl: z.string().url().optional(),
  sourceType: z.string().max(64).optional(),
  metadata: metadataSchema.optional(),
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

  // Image ingestion: OCR + caption the image with a vision LLM, then store the text.
  let content = d.content;
  let sourceType = d.sourceType;
  if (d.image) {
    const img = parseDataUrl(d.image);
    if (!img)
      return c.json(
        { error: 'invalid_image', message: 'image must be a data URL: data:image/png;base64,...' },
        400,
      );
    try {
      const described = await engine.describeImage(img);
      content = [d.content, described].filter(Boolean).join('\n\n');
      sourceType = sourceType ?? 'image';
    } catch (e) {
      return c.json({ error: 'no_vision', message: String((e as Error).message ?? e) }, 422);
    }
  }
  if (d.audio) {
    const clip = parseDataUrl(d.audio);
    if (!clip)
      return c.json(
        { error: 'invalid_audio', message: 'audio must be a data URL: data:audio/mpeg;base64,...' },
        400,
      );
    try {
      const transcript = await engine.transcribeAudio(clip);
      content = [content, transcript].filter(Boolean).join('\n\n');
      sourceType = sourceType ?? 'audio';
    } catch (e) {
      return c.json({ error: 'no_transcription', message: String((e as Error).message ?? e) }, 422);
    }
  }
  if (d.video) {
    const clip = parseDataUrl(d.video);
    if (!clip)
      return c.json(
        { error: 'invalid_video', message: 'video must be a data URL: data:video/mp4;base64,...' },
        400,
      );
    try {
      const result = await engine.describeVideo(clip);
      content = [content, result.text].filter(Boolean).join('\n\n');
      sourceType = sourceType ?? 'video';
    } catch (e) {
      return c.json({ error: 'no_video', message: String((e as Error).message ?? e) }, 422);
    }
  }
  if (!content)
    return c.json(
      { error: 'invalid_request', message: 'content, image, audio, or video is required' },
      400,
    );

  const memory = await engine.addMemory({
    orgId: auth.orgId,
    title: d.title,
    content,
    format: d.format,
    spaceId: d.spaceId,
    spaceSlug: d.space,
    tags: d.tags,
    sourceUrl: d.sourceUrl,
    sourceType,
    metadata: d.metadata,
    dedupe: d.dedupe,
  });
  return c.json({ memory }, 201);
});

app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const limit = queryInt(c.req.query('limit'), { fallback: 50, min: 1, max: 200 });
  const offset = queryInt(c.req.query('offset'), { fallback: 0, min: 0 });
  const spaceId = c.req.query('spaceId') || undefined;
  const connector = c.req.query('connector') || undefined;
  const { memories, total } = await engine.listMemories({
    orgId: auth.orgId,
    spaceId,
    connector,
    limit,
    offset,
  });
  return c.json({ memories, total, limit, offset });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const memory = await engine.getMemory(auth.orgId, c.req.param('id'));
  if (!memory) return c.json({ error: 'not_found' }, 404);
  return c.json({ memory });
});

// Similar memories ("see also").
app.get('/:id/related', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const limit = queryInt(c.req.query('limit'), { fallback: 5, min: 1, max: 20 });
  const related = await engine.related(auth.orgId, c.req.param('id'), limit);
  return c.json({ related });
});

// Prior content versions (temporal history).
app.get('/:id/versions', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const versions = await engine.getVersions(auth.orgId, c.req.param('id'));
  return c.json({ versions });
});

const patchSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT).optional(),
  tags: tagsSchema.optional(),
  spaceId: z.string().uuid().optional(),
  metadata: metadataSchema.optional(),
});

app.patch('/:id', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
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
