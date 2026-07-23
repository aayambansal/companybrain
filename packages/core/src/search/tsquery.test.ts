import { describe, it, expect } from 'vitest';
import { buildOrTsQuery } from './hybrid.js';

describe('buildOrTsQuery', () => {
  it('lowercases terms and joins them with OR', () => {
    expect(buildOrTsQuery('Ship Releases')).toBe('ship | releases');
  });

  it('strips punctuation and other tsquery-unsafe characters', () => {
    // Anything that could break to_tsquery (&, |, :, parens, quotes) becomes a space.
    expect(buildOrTsQuery("release & (deploy) | 'now'")).toBe('release | deploy | now');
  });

  it('drops single-character tokens', () => {
    expect(buildOrTsQuery('a big I O deploy')).toBe('big | deploy');
  });

  it('deduplicates while preserving first-seen order', () => {
    expect(buildOrTsQuery('ship ship deploy ship')).toBe('ship | deploy');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(buildOrTsQuery('!!! a i')).toBe('');
    expect(buildOrTsQuery('')).toBe('');
  });
});
