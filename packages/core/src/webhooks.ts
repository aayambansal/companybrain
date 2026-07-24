/**
 * Outbound webhook delivery. On events like `memory.created`, POST a signed
 * JSON payload to every active webhook registered for the org. Fire-and-forget:
 * failures are recorded on the webhook row but never block the caller.
 */
import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { webhooks } from '@companybrain/db';
import type { Database } from '@companybrain/db';
import { isBlockedWebhookTarget } from './net-guard.js';

export interface WebhookEvent {
  event: string;
  orgId: string;
  data: Record<string, unknown>;
}

/** Sign a payload body with the webhook secret (HMAC-SHA256, hex). */
export function signWebhook(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export async function dispatchWebhooks(db: Database, evt: WebhookEvent): Promise<void> {
  // Webhook URLs are user-controlled; refuse to deliver to internal/private
  // targets (SSRF) unless the operator has explicitly opted in.
  const allowInternal = process.env.WEBHOOK_ALLOW_INTERNAL === 'true';
  let hooks;
  try {
    hooks = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.orgId, evt.orgId), eq(webhooks.active, true)));
  } catch {
    return; // table may not exist yet on very old schemas
  }
  const targets = hooks.filter((h) => (h.events ?? []).includes(evt.event));
  if (targets.length === 0) return;

  const body = JSON.stringify({
    event: evt.event,
    createdAt: new Date().toISOString(),
    data: evt.data,
  });
  await Promise.allSettled(
    targets.map(async (h) => {
      if (!allowInternal && (await isBlockedWebhookTarget(h.url))) {
        // Record a distinct status so a blocked target is visible, not silent.
        await db
          .update(webhooks)
          .set({ lastStatus: -1, lastDeliveredAt: new Date() })
          .where(eq(webhooks.id, h.id));
        return;
      }
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'CompanyBrain-Webhook/1',
        'x-companybrain-event': evt.event,
      };
      if (h.secret) headers['x-companybrain-signature'] = signWebhook(h.secret, body);
      let status = 0;
      try {
        const res = await fetch(h.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(8000),
        });
        status = res.status;
      } catch {
        status = 0;
      }
      await db
        .update(webhooks)
        .set({ lastStatus: status, lastDeliveredAt: new Date() })
        .where(eq(webhooks.id, h.id));
    }),
  );
}
