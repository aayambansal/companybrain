import { describe, it, expect } from 'vitest';
import { buildOrTsQuery } from './hybrid.js';

describe('buildOrTsQuery', () => {
  it('lowercases and OR-joins the terms', () => {
    expect(buildOrTsQuery('Hello WORLD')).toBe('hello | world');
  });

  it('deduplicates while preserving first-seen order', () => {
    expect(buildOrTsQuery('deploy Deploy target deploy')).toBe('deploy | target');
  });

  it('drops single-character and empty tokens', () => {
    expect(buildOrTsQuery('a bb c dd e')).toBe('bb | dd');
  });

  it('neutralizes tsquery operators so raw input cannot inject syntax', () => {
    // &, |, :, *, !, parens, quotes all become whitespace before tokenizing.
    expect(buildOrTsQuery('foo & bar | baz:* !(qux)')).toBe('foo | bar | baz | qux');
    // A classic injection attempt collapses to its plain words.
    expect(buildOrTsQuery("'; drop table docs; --")).toBe('drop | table | docs');
  });

  it('keeps alphanumeric tokens including digits', () => {
    expect(buildOrTsQuery('PR-812 text123 v2')).toBe('pr | 812 | text123 | v2');
  });

  it('returns an empty string for blank or all-punctuation input', () => {
    expect(buildOrTsQuery('')).toBe('');
    expect(buildOrTsQuery('   ')).toBe('');
    expect(buildOrTsQuery('!@#$ %^&*')).toBe('');
  });
});
