import { describe, it, expect } from 'vitest';
import { dropboxEntryToDoc } from './dropbox.js';

const sampleEntry = {
  '.tag': 'file',
  id: 'id:abc123',
  name: 'notes.md',
  path_lower: '/notes/notes.md',
  client_modified: '2026-07-21T09:30:00Z',
};

describe('dropboxEntryToDoc', () => {
  it('maps a Dropbox entry and its text into a document', () => {
    const doc = dropboxEntryToDoc(sampleEntry, '# Hello\nWorld');
    expect(doc.sourceId).toBe('id:abc123');
    expect(doc.sourceType).toBe('dropbox');
    expect(doc.title).toBe('notes.md');
    expect(doc.content).toBe('# Hello\nWorld');
    expect(doc.tags).toEqual(['dropbox']);
    expect(doc.metadata).toEqual({ fileId: 'id:abc123', path: '/notes/notes.md' });
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2026-07-21T09:30:00.000Z');
  });

  it('falls back to a placeholder title and no timestamp when fields are missing', () => {
    const doc = dropboxEntryToDoc({ id: 'id:2' }, 'body');
    expect(doc.title).toBe('Untitled');
    expect(doc.content).toBe('body');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
