import { describe, it, expect } from 'vitest';
import { hnHitToDoc } from './hackernews.js';

describe('hnHitToDoc', () => {
  it('maps a story that links to an external url', () => {
    const doc = hnHitToDoc({
      objectID: '123',
      title: 'Show HN: CompanyBrain',
      url: 'https://example.com/companybrain',
      author: 'ada',
      points: 42,
      num_comments: 7,
      created_at: '2025-06-10T09:00:00Z',
    });
    expect(doc.sourceId).toBe('123');
    expect(doc.sourceType).toBe('hackernews');
    expect(doc.sourceUrl).toBe('https://example.com/companybrain');
    expect(doc.title).toBe('Show HN: CompanyBrain');
    expect(doc.content).toContain('Show HN: CompanyBrain');
    expect(doc.content).toContain('https://example.com/companybrain');
    expect(doc.tags).toEqual(['hackernews']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2025-06-10T09:00:00.000Z');
  });

  it('falls back to the item permalink for a text-only story', () => {
    const doc = hnHitToDoc({
      objectID: '456',
      story_text: 'This is the body text',
    });
    expect(doc.sourceUrl).toBe('https://news.ycombinator.com/item?id=456');
    expect(doc.content).toBe('This is the body text');
    expect(doc.title).toBeUndefined();
  });
});
