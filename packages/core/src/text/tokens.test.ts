import { describe, it, expect } from 'vitest';
import { estimateTokens } from './tokens.js';

describe('estimateTokens', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('returns at least 1 for any non-empty text', () => {
    expect(estimateTokens('a')).toBeGreaterThanOrEqual(1);
  });
  it('grows with length', () => {
    const short = estimateTokens('one two three');
    const long = estimateTokens('one two three four five six seven eight nine ten eleven twelve');
    expect(long).toBeGreaterThan(short);
  });
  it('lands in a sane range for a paragraph (~4 chars/token)', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(10); // ~450 chars
    const est = estimateTokens(text);
    expect(est).toBeGreaterThan(60);
    expect(est).toBeLessThan(160);
  });
});
