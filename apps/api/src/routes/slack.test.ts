import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySlackSignature } from './slack.js';

const SECRET = 'test-signing-secret';

/** Produce a valid Slack v0 signature for the given timestamp + body. */
function sign(ts: string, body: string, secret = SECRET): string {
  return 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex');
}

const nowTs = () => Math.floor(Date.now() / 1000).toString();

describe('verifySlackSignature', () => {
  it('accepts a correctly signed, fresh request', () => {
    const ts = nowTs();
    const body = 'token=abc&command=%2Fbrain&text=hello';
    expect(verifySlackSignature(body, ts, sign(ts, body), SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = nowTs();
    const sig = sign(ts, 'original body');
    expect(verifySlackSignature('tampered body', ts, sig, SECRET)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const ts = nowTs();
    const body = 'payload';
    expect(verifySlackSignature(body, ts, sign(ts, body, 'attacker-secret'), SECRET)).toBe(false);
  });

  it('rejects a stale timestamp (replay protection)', () => {
    const stale = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
    const body = 'payload';
    // Even with a signature that is valid for that timestamp, it is too old.
    expect(verifySlackSignature(body, stale, sign(stale, body), SECRET)).toBe(false);
  });

  it('rejects missing or malformed inputs without throwing', () => {
    const ts = nowTs();
    expect(verifySlackSignature('x', ts, sign(ts, 'x'), '')).toBe(false); // no secret
    expect(verifySlackSignature('x', '', 'v0=abc', SECRET)).toBe(false); // no timestamp
    expect(verifySlackSignature('x', ts, '', SECRET)).toBe(false); // no signature
    expect(verifySlackSignature('x', 'not-a-number', 'v0=abc', SECRET)).toBe(false); // bad ts
  });

  it('rejects a length-mismatched signature without throwing', () => {
    const ts = nowTs();
    // timingSafeEqual throws on unequal lengths; the guard must catch this first.
    expect(verifySlackSignature('x', ts, 'v0=short', SECRET)).toBe(false);
  });
});
