import { describe, it, expect } from 'vitest';
import type { Sql } from 'postgres';
import { buildOrTsQuery, hybridSearch } from './hybrid.js';
import { STORAGE_DIMENSIONS } from '../config.js';

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

describe('hybridSearch', () => {
  it('pads a narrower query embedding to the storage width before pgvector sees it', async () => {
    // Stands in for the postgres.js tag: records every interpolated value and
    // returns no rows, which is all the vector arm needs to run.
    const seen: unknown[] = [];
    const sql = ((_strings: TemplateStringsArray, ...values: unknown[]) => {
      seen.push(...values);
      return Promise.resolve([]);
    }) as unknown as Sql;

    // nomic-embed-text and text-embedding-004 are both 768 wide.
    const hits = await hybridSearch(sql, {
      orgId: 'org',
      q: 'release',
      queryEmbedding: new Array<number>(768).fill(0.1),
      mode: 'semantic',
    });

    expect(hits).toEqual([]);
    const literal = seen.find((v): v is string => typeof v === 'string' && v.startsWith('['));
    expect(literal).toBeDefined();
    expect(literal!.slice(1, -1).split(',')).toHaveLength(STORAGE_DIMENSIONS);
  });
});
