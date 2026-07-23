import { describe, it, expect } from 'vitest';
import { readwiseBookDoc } from './readwise.js';

describe('readwiseBookDoc', () => {
  it('groups a book\'s highlights into one document', () => {
    const doc = readwiseBookDoc({
      user_book_id: 987,
      title: 'Thinking in Systems',
      author: 'Donella Meadows',
      source_url: 'https://example.com/book',
      highlights: [
        { id: 1, text: 'A system is more than the sum of its parts.', updated: '2025-01-01T00:00:00Z' },
        { id: 2, text: 'Systems fool us.', note: 'remember this', updated: '2025-01-02T00:00:00Z' },
      ],
    });
    expect(doc.sourceId).toBe('987');
    expect(doc.sourceType).toBe('readwise');
    expect(doc.sourceUrl).toBe('https://example.com/book');
    expect(doc.title).toBe('Thinking in Systems');
    expect(doc.content).toContain('A system is more than the sum of its parts.');
    expect(doc.content).toContain('Systems fool us.');
    expect(doc.content).toContain('remember this');
    expect(doc.tags).toEqual(['readwise']);
  });

  it('falls back to the title for sourceId when no user_book_id', () => {
    const doc = readwiseBookDoc({
      title: 'Untitled Book',
      highlights: [{ id: 3, text: 'lone highlight' }],
    });
    expect(doc.sourceId).toBe('Untitled Book');
    expect(doc.content).toContain('lone highlight');
  });
});
