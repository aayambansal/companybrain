import { describe, it, expect } from 'vitest';
import { queryInt } from './query.js';

describe('queryInt', () => {
  it('parses a valid integer within range', () => {
    expect(queryInt('50', { fallback: 10, min: 1, max: 200 })).toBe(50);
  });

  it('falls back for missing or non-numeric input', () => {
    expect(queryInt(undefined, { fallback: 10 })).toBe(10);
    expect(queryInt('', { fallback: 10 })).toBe(10);
    expect(queryInt('abc', { fallback: 10 })).toBe(10);
  });

  it('clamps a negative value up to min (Postgres rejects negative LIMIT/OFFSET)', () => {
    expect(queryInt('-5', { fallback: 50, min: 0 })).toBe(0);
    expect(queryInt('-5', { fallback: 50, min: 1, max: 200 })).toBe(1);
  });

  it('clamps an oversized value down to max', () => {
    expect(queryInt('1000000', { fallback: 50, min: 1, max: 200 })).toBe(200);
  });

  it('takes the leading integer of a mixed string, then clamps', () => {
    expect(queryInt('42abc', { fallback: 10, max: 200 })).toBe(42);
  });
});
