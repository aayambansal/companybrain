import { describe, it, expect } from 'vitest';
import { buildTopic, buildTopics } from './topics.js';

describe('buildTopic', () => {
  it('zips parallel sample arrays into id/title pairs', () => {
    const t = buildTopic({
      tag: 'onboarding',
      count: 4,
      sample_ids: ['a', 'b'],
      sample_titles: ['Onboarding checklist', ''],
    });
    expect(t).toEqual({
      topic: 'onboarding',
      count: 4,
      sample: [
        { id: 'a', title: 'Onboarding checklist' },
        { id: 'b', title: null },
      ],
    });
  });

  it('handles null sample arrays', () => {
    const t = buildTopic({ tag: 'x', count: 2, sample_ids: null, sample_titles: null });
    expect(t.sample).toEqual([]);
  });
});

describe('buildTopics', () => {
  const rows = [
    { tag: 'launch', count: 5, sample_ids: ['1'], sample_titles: ['Launch plan'] },
    { tag: '', count: 9, sample_ids: [], sample_titles: [] },
    { tag: 'rare', count: 1, sample_ids: ['2'], sample_titles: ['x'] },
  ];

  it('drops empty tags and those below minCount', () => {
    const out = buildTopics(rows, { minCount: 2 });
    expect(out.map((t) => t.topic)).toEqual(['launch']);
  });

  it('keeps single-use tags when minCount is 1', () => {
    const out = buildTopics(rows, { minCount: 1 });
    expect(out.map((t) => t.topic).sort()).toEqual(['launch', 'rare']);
  });
});
