import { describe, it, expect } from 'vitest';
import { contentHash } from './hash.js';

describe('contentHash', () => {
  it('is deterministic for the same input', () => {
    expect(contentHash('hello')).toBe(contentHash('hello'));
  });
  it('differs for different input', () => {
    expect(contentHash('hello')).not.toBe(contentHash('hello '));
  });
  it('returns 64 lowercase hex characters', () => {
    expect(contentHash('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
