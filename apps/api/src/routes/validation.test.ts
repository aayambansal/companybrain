import { describe, it, expect } from 'vitest';
import { addSchema, MAX_CONTENT } from './memories.js';
import { searchSchema } from './search.js';

describe('memories addSchema bounds', () => {
  it('accepts a normal memory', () => {
    const r = addSchema.safeParse({ content: 'a decision we made', tags: ['eng', 'release'] });
    expect(r.success).toBe(true);
  });

  it('rejects content past the size cap so one request cannot spawn unbounded embedding work', () => {
    const ok = addSchema.safeParse({ content: 'x'.repeat(MAX_CONTENT) });
    expect(ok.success).toBe(true);
    const tooBig = addSchema.safeParse({ content: 'x'.repeat(MAX_CONTENT + 1) });
    expect(tooBig.success).toBe(false);
  });

  it('caps the tag list length and per-tag length', () => {
    expect(addSchema.safeParse({ content: 'c', tags: Array(51).fill('t') }).success).toBe(false);
    expect(addSchema.safeParse({ content: 'c', tags: ['x'.repeat(65)] }).success).toBe(false);
    expect(addSchema.safeParse({ content: 'c', tags: Array(50).fill('t') }).success).toBe(true);
  });

  it('bounds sourceType', () => {
    expect(addSchema.safeParse({ content: 'c', sourceType: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('search searchSchema bounds', () => {
  it('accepts a normal query', () => {
    expect(searchSchema.safeParse({ q: 'how do we ship?', tags: ['eng'] }).success).toBe(true);
  });

  it('rejects an over-long query and an oversized tag filter', () => {
    expect(searchSchema.safeParse({ q: 'x'.repeat(1001) }).success).toBe(false);
    expect(searchSchema.safeParse({ q: 'ok', tags: Array(51).fill('t') }).success).toBe(false);
  });
});
