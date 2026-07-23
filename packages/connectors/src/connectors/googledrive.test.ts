import { describe, it, expect } from 'vitest';
import { driveFileToDoc } from './googledrive.js';

const sampleFile = {
  id: 'file-123',
  name: 'Q3 Planning',
  mimeType: 'application/vnd.google-apps.document',
  modifiedTime: '2026-07-22T15:00:00.000Z',
  webViewLink: 'https://docs.google.com/document/d/file-123/edit',
};

describe('driveFileToDoc', () => {
  it('maps a Drive file and its exported text into a document', () => {
    const doc = driveFileToDoc(sampleFile, 'The plan is to ship in Q3.');
    expect(doc.sourceId).toBe('file-123');
    expect(doc.sourceType).toBe('gdrive');
    expect(doc.sourceUrl).toBe('https://docs.google.com/document/d/file-123/edit');
    expect(doc.title).toBe('Q3 Planning');
    expect(doc.content).toBe('The plan is to ship in Q3.');
    expect(doc.tags).toEqual(['google-drive']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2026-07-22T15:00:00.000Z');
  });

  it('falls back to a placeholder title and no timestamp when fields are missing', () => {
    const doc = driveFileToDoc({ id: 'f2', webViewLink: 'https://drive.example/f2' }, 'body');
    expect(doc.title).toBe('Untitled');
    expect(doc.content).toBe('body');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
