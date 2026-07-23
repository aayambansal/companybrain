import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signWebhook } from './webhooks.js';

describe('signWebhook', () => {
  it('produces an HMAC-SHA256 signature in the sha256=<hex> format', () => {
    const sig = signWebhook('topsecret', '{"event":"memory.created"}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('matches a real HMAC over the body keyed by the secret', () => {
    const body = '{"a":1}';
    const expected = 'sha256=' + createHmac('sha256', 'k').update(body).digest('hex');
    expect(signWebhook('k', body)).toBe(expected);
  });

  it('is deterministic and sensitive to both secret and body', () => {
    expect(signWebhook('k', 'b')).toBe(signWebhook('k', 'b'));
    expect(signWebhook('k', 'b')).not.toBe(signWebhook('k2', 'b'));
    expect(signWebhook('k', 'b')).not.toBe(signWebhook('k', 'b2'));
  });
});
