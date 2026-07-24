import { describe, it, expect } from 'vitest';
import type { MemoryEngine } from '@companybrain/core';
import health from './health.js';
import { setEngine } from '../context.js';

/** A stand-in engine whose db ping either succeeds or throws. */
function stubEngine(ping: () => Promise<unknown>): MemoryEngine {
  return { client: { sql: () => ping() } } as unknown as MemoryEngine;
}

describe('GET /health', () => {
  it('returns 200 ok when the database responds', async () => {
    setEngine(stubEngine(() => Promise.resolve([{ '?column?': 1 }])));
    const res = await health.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('returns 503 degraded when the database is unreachable', async () => {
    setEngine(stubEngine(() => Promise.reject(new Error('connection refused'))));
    const res = await health.request('/');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
