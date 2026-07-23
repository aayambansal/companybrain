import { describe, it, expect } from 'vitest';
import { boxItemToDoc } from './box.js';

const sampleItem = {
  type: 'file',
  id: '987654321',
  name: 'README.md',
  modified_at: '2026-07-22T15:00:00-07:00',
};

describe('boxItemToDoc', () => {
  it('maps a Box item and its text into a document', () => {
    const doc = boxItemToDoc(sampleItem, 'The plan is to ship in Q3.');
    expect(doc.sourceId).toBe('987654321');
    expect(doc.sourceType).toBe('box');
    expect(doc.title).toBe('README.md');
    expect(doc.content).toBe('The plan is to ship in Q3.');
    expect(doc.tags).toEqual(['box']);
    expect(doc.metadata).toEqual({ fileId: '987654321' });
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2026-07-22T22:00:00.000Z');
  });

  it('falls back to a placeholder title and no timestamp when fields are missing', () => {
    const doc = boxItemToDoc({ id: 'i2' }, 'body');
    expect(doc.title).toBe('Untitled');
    expect(doc.content).toBe('body');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
