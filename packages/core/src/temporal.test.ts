import { describe, it, expect } from 'vitest';
import { buildSupersedePrompt, parseSupersedeResponse } from './temporal.js';

const candidates = [
  {
    id: 'a1',
    title: 'Launch date',
    content: 'The launch review is on Wednesday.',
    createdAt: '2026-01-01',
  },
  { id: 'b2', title: 'Owner', content: 'Priya owns the billing service.', createdAt: '2026-01-02' },
];

describe('buildSupersedePrompt', () => {
  it('includes the new memory and every candidate id', () => {
    const p = buildSupersedePrompt(
      { title: 'Launch', content: 'The launch review moved to Thursday.' },
      candidates,
    );
    expect(p).toContain('The launch review moved to Thursday.');
    expect(p).toContain('[id=a1]');
    expect(p).toContain('[id=b2]');
    expect(p).toContain('JSON array');
  });
});

describe('parseSupersedeResponse', () => {
  it('keeps only true verdicts with known ids', () => {
    const reply =
      '[{"id":"a1","supersedes":true,"reason":"date changed Wed->Thu"},{"id":"b2","supersedes":false,"reason":"unrelated"}]';
    const v = parseSupersedeResponse(reply, ['a1', 'b2']);
    expect(v).toHaveLength(1);
    expect(v[0]?.id).toBe('a1');
    expect(v[0]?.reason).toContain('date changed');
  });

  it('tolerates prose and code fences around the JSON', () => {
    const reply =
      'Here is my judgment:\n```json\n[{"id":"a1","supersedes":true,"reason":"newer"}]\n```\nDone.';
    const v = parseSupersedeResponse(reply, ['a1', 'b2']);
    expect(v.map((x) => x.id)).toEqual(['a1']);
  });

  it('drops unknown ids and duplicates', () => {
    const reply =
      '[{"id":"zzz","supersedes":true},{"id":"a1","supersedes":true},{"id":"a1","supersedes":true}]';
    const v = parseSupersedeResponse(reply, ['a1', 'b2']);
    expect(v).toHaveLength(1);
    expect(v[0]?.id).toBe('a1');
  });

  it('returns [] on malformed output', () => {
    expect(parseSupersedeResponse('not json at all', ['a1'])).toEqual([]);
    expect(parseSupersedeResponse('', ['a1'])).toEqual([]);
  });
});
