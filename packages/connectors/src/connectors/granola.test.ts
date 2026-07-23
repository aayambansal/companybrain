import { describe, it, expect } from 'vitest';
import { granolaMeetingDoc, parseGranolaExport } from './granola.js';

describe('granolaMeetingDoc', () => {
  it('builds a meeting document with attendee tags and notes + transcript', () => {
    const doc = granolaMeetingDoc(
      {
        id: 'm1',
        title: 'Launch sync',
        summary: 'Agreed to ship Thursday.',
        transcript: 'Alice: are we ready? Bob: yes.',
        attendees: ['Alice', 'Bob'],
        date: '2026-03-14T10:00:00Z',
        url: 'https://granola.so/m1',
      },
      0,
    );
    expect(doc).not.toBeNull();
    expect(doc!.sourceType).toBe('granola_meeting');
    expect(doc!.title).toBe('Launch sync');
    expect(doc!.content).toContain('Agreed to ship Thursday.');
    expect(doc!.content).toContain('Alice: are we ready?');
    expect(doc!.tags).toEqual(['granola', 'alice', 'bob']);
    expect(doc!.sourceUrl).toBe('https://granola.so/m1');
    expect(doc!.sourceCreatedAt?.toISOString()).toBe('2026-03-14T10:00:00.000Z');
  });

  it('accepts participants alias and drops empty meetings', () => {
    expect(granolaMeetingDoc({ notes: 'x', participants: ['Ann'] }, 0)?.tags).toEqual(['granola', 'ann']);
    expect(granolaMeetingDoc({}, 0)).toBeNull();
  });
});

describe('parseGranolaExport', () => {
  it('reads a bare array and a wrapper', () => {
    expect(parseGranolaExport('[{"title":"a"}]')).toHaveLength(1);
    expect(parseGranolaExport('{"meetings":[{"title":"a"},{"title":"b"}]}')).toHaveLength(2);
  });
  it('throws on an unknown shape', () => {
    expect(() => parseGranolaExport('{"nope":1}')).toThrow();
  });
});
