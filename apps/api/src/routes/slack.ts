import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEngine, ensureDefaultOrg, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

/** Verify a Slack request signature (v0 HMAC-SHA256 over `v0:ts:body`). */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Reject stale requests (replay protection): 5 minutes.
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected =
    'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Slack slash command endpoint. Add a `/brain` command in your Slack app
 * pointing here; it answers from the company brain with citations.
 * Public (no API key): authenticated by the Slack signing secret instead.
 */
app.post('/command', async (c) => {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    return c.json({
      response_type: 'ephemeral',
      text: 'Slack is not configured on this server (set SLACK_SIGNING_SECRET).',
    });
  }
  const raw = await c.req.text();
  const ts = c.req.header('x-slack-request-timestamp') ?? '';
  const sig = c.req.header('x-slack-signature') ?? '';
  if (!verifySlackSignature(raw, ts, sig, secret)) {
    return c.text('invalid signature', 401);
  }

  const params = new URLSearchParams(raw);
  const text = (params.get('text') ?? '').trim();
  if (!text) {
    return c.json({
      response_type: 'ephemeral',
      text: 'Ask me something: `/brain how do we cut a release?`',
    });
  }

  const engine = getEngine();
  const orgId = await ensureDefaultOrg();
  const res = await engine.chat(orgId, text, { limit: 6 });
  const sources = res.citations
    .slice(0, 3)
    .map(
      (cit, i) =>
        `${i + 1}. ${cit.title ?? 'Untitled'}${cit.sourceUrl ? ` — ${cit.sourceUrl}` : ''}`,
    )
    .join('\n');

  return c.json({
    response_type: 'in_channel',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${text}*\n\n${res.message}` } },
      ...(sources
        ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: `Sources:\n${sources}` }] }]
        : []),
    ],
  });
});

export default app;
