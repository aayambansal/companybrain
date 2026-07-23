import { describe, it, expect } from 'vitest';
import { oneDriveItemToDoc } from './onedrive.js';

const sampleItem = {
  id: 'item-abc',
  name: 'README.md',
  webUrl: 'https://onedrive.live.com/item-abc',
  lastModifiedDateTime: '2026-07-21T09:30:00.000Z',
  file: { mimeType: 'text/markdown' },
};

describe('oneDriveItemToDoc', () => {
  it('maps a OneDrive item and its text into a document', () => {
    const doc = oneDriveItemToDoc(sampleItem, '# Hello\nWorld');
    expect(doc.sourceId).toBe('item-abc');
    expect(doc.sourceType).toBe('onedrive');
    expect(doc.sourceUrl).toBe('https://onedrive.live.com/item-abc');
    expect(doc.title).toBe('README.md');
    expect(doc.content).toBe('# Hello\nWorld');
    expect(doc.tags).toEqual(['onedrive']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2026-07-21T09:30:00.000Z');
  });

  it('falls back to a placeholder title and no timestamp when fields are missing', () => {
    const doc = oneDriveItemToDoc({ id: 'i2', webUrl: 'https://od.example/i2' }, 'text');
    expect(doc.title).toBe('Untitled');
    expect(doc.content).toBe('text');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
