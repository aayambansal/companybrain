import { describe, it, expect } from 'vitest';
import { hitRateLimit, clearRateLimit } from './rate-limit.js';

const opts = { max: 3, windowMs: 1000 };

describe('hitRateLimit', () => {
  it('allows up to `max` hits, then limits within the window', () => {
    const key = 'k1';
    expect(hitRateLimit(key, opts, 0).limited).toBe(false); // 1
    expect(hitRateLimit(key, opts, 100).limited).toBe(false); // 2
    expect(hitRateLimit(key, opts, 200).limited).toBe(false); // 3
    const fourth = hitRateLimit(key, opts, 300); // 4 -> over
    expect(fourth.limited).toBe(true);
    expect(fourth.retryAfterSeconds).toBe(1); // ceil((1000-300)/1000)
  });

  it('resets after the window elapses', () => {
    const key = 'k2';
    for (let i = 0; i < 5; i++) hitRateLimit(key, opts, 0);
    expect(hitRateLimit(key, opts, 500).limited).toBe(true); // still in window
    expect(hitRateLimit(key, opts, 1000).limited).toBe(false); // window rolled over
  });

  it('keeps separate counters per key', () => {
    for (let i = 0; i < 5; i++) hitRateLimit('a', opts, 0);
    expect(hitRateLimit('a', opts, 0).limited).toBe(true);
    expect(hitRateLimit('b', opts, 0).limited).toBe(false);
  });

  it('clearRateLimit resets a key (e.g. after a successful login)', () => {
    const key = 'k3';
    for (let i = 0; i < 5; i++) hitRateLimit(key, opts, 0);
    expect(hitRateLimit(key, opts, 0).limited).toBe(true);
    clearRateLimit(key);
    expect(hitRateLimit(key, opts, 0).limited).toBe(false);
  });
});
