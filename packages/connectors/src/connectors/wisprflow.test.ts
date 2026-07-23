import { describe, it, expect } from 'vitest';
import { wisprFlowEntryDoc, parseWisprFlowExport } from './wisprflow.js';

describe('wisprFlowEntryDoc', () => {
  it('turns a dictation into a document with app tag and short title', () => {
    const doc = wisprFlowEntryDoc(
      {
        id: 'flow_42',
        text: 'Remind the team the launch review is Thursday at 10am, not Wednesday.',
        app: 'Slack',
        timestamp: '2026-02-03T15:04:05Z',
        wordCount: 12,
      },
      0,
    );
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('flow_42');
    expect(doc!.sourceType).toBe('wispr_flow');
    expect(doc!.title).toBe('Remind the team the launch review is Thursday at 10am, not Wednesday.');
    expect(doc!.content).toContain('launch review is Thursday');
    expect(doc!.tags).toEqual(['wispr-flow', 'slack']);
    expect(doc!.metadata?.app).toBe('Slack');
    expect(doc!.sourceCreatedAt?.toISOString()).toBe('2026-02-03T15:04:05.000Z');
  });

  it('accepts alias field names and epoch-second timestamps', () => {
    const doc = wisprFlowEntryDoc(
      { transcript: 'quick note to self', created_at: 1_700_000_000 },
      3,
    );
    expect(doc).not.toBeNull();
    expect(doc!.content).toBe('quick note to self');
    expect(doc!.sourceCreatedAt?.getUTCFullYear()).toBe(2023);
  });

  it('truncates a long transcript into a title but keeps full content', () => {
    const long = 'word '.repeat(40).trim();
    const doc = wisprFlowEntryDoc({ text: long }, 0);
    expect(doc!.title.length).toBeLessThanOrEqual(72);
    expect(doc!.title.endsWith('...')).toBe(true);
    expect(doc!.content).toBe(long);
  });

  it('drops empty dictations', () => {
    expect(wisprFlowEntryDoc({ text: '   ' }, 0)).toBeNull();
    expect(wisprFlowEntryDoc({}, 0)).toBeNull();
  });
});

describe('parseWisprFlowExport', () => {
  it('reads a bare array', () => {
    const entries = parseWisprFlowExport('[{"text":"a"},{"text":"b"}]');
    expect(entries).toHaveLength(2);
  });

  it('reads a wrapped export', () => {
    const entries = parseWisprFlowExport('{"flows":[{"text":"a"}]}');
    expect(entries).toHaveLength(1);
  });

  it('throws on an unrecognized shape', () => {
    expect(() => parseWisprFlowExport('{"nope":true}')).toThrow();
  });
});
