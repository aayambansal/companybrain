import { describe, it, expect } from 'vitest';
import { snip } from './ui.js';

describe('snip', () => {
  it('collapses runs of whitespace to single spaces and trims the ends', () => {
    expect(snip('  hello   world\n\tthere  ', 100)).toBe('hello world there');
  });

  it('returns the text unchanged when it is within max', () => {
    expect(snip('abcde', 5)).toBe('abcde');
  });

  it('truncates to exactly max characters with a trailing ellipsis', () => {
    const out = snip('abcdefghij', 5);
    expect(out).toBe('abcd…');
    expect([...out]).toHaveLength(5);
  });

  it('measures length after collapsing whitespace, not before', () => {
    // 12 raw chars collapse to "a b" (3 chars), so no truncation at max 5.
    expect(snip('a          b', 5)).toBe('a b');
  });
});
