import { describe, it, expect } from 'vitest';
import { parseEnrichment } from './enrich.js';

describe('parseEnrichment', () => {
  it('parses a clean JSON response', () => {
    const e = parseEnrichment(
      '{"summary":"We ship on Thursdays.","tags":["release","process"],"facts":["Releases are weekly."]}',
    );
    expect(e.summary).toBe('We ship on Thursdays.');
    expect(e.tags).toEqual(['release', 'process']);
    expect(e.facts).toEqual(['Releases are weekly.']);
  });

  it('extracts JSON embedded in prose or code fences', () => {
    const e = parseEnrichment(
      'Sure! Here you go:\n```json\n{"summary":"x","tags":["A","a","b"]}\n```\n',
    );
    expect(e.summary).toBe('x');
    expect(e.tags).toEqual(['a', 'b']); // lowercased + deduped
  });

  it('returns empty on junk', () => {
    expect(parseEnrichment('no json here')).toEqual({});
    expect(parseEnrichment('{broken')).toEqual({});
  });

  it('caps tag length and count', () => {
    const many = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    const e = parseEnrichment(JSON.stringify({ tags: many }));
    expect(e.tags!.length).toBeLessThanOrEqual(8);
  });
});
