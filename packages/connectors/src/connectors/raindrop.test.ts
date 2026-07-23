import { describe, it, expect } from 'vitest';
import { raindropItemToDoc } from './raindrop.js';

describe('raindropItemToDoc', () => {
  it('maps a bookmark, merging excerpt/note and tags', () => {
    const doc = raindropItemToDoc({
      _id: 42,
      title: 'CompanyBrain',
      excerpt: 'Self-hosted memory',
      note: 'worth a look',
      link: 'https://example.com/companybrain',
      tags: ['memory', 'oss'],
      created: '2025-06-10T09:00:00Z',
    });
    expect(doc.sourceId).toBe('42');
    expect(doc.sourceType).toBe('raindrop');
    expect(doc.sourceUrl).toBe('https://example.com/companybrain');
    expect(doc.title).toBe('CompanyBrain');
    expect(doc.content).toContain('Self-hosted memory');
    expect(doc.content).toContain('worth a look');
    expect(doc.tags).toEqual(['raindrop', 'memory', 'oss']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2025-06-10T09:00:00.000Z');
  });
});
