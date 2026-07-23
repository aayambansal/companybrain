import { describe, it, expect } from 'vitest';
import { pipedriveNoteDoc } from './pipedrive.js';

describe('pipedriveNoteDoc', () => {
  const note = {
    id: 314,
    content: '<p>Follow up with the customer &amp; send the <a href="https://acme.com/quote">quote</a>.</p>',
    add_time: '2024-01-16 03:20:00',
  };

  it('converts the HTML content to plain text', () => {
    const doc = pipedriveNoteDoc(note);
    const flat = doc.content.replace(/\s+/g, ' ').trim();
    expect(flat).toContain('Follow up with the customer & send the quote');
    expect(doc.content).not.toContain('<p>');
    expect(doc.content).not.toContain('href');
  });

  it('maps the fields onto a SourceDocument', () => {
    const doc = pipedriveNoteDoc(note);
    expect(doc.sourceId).toBe('314');
    expect(doc.sourceType).toBe('pipedrive_note');
    expect(doc.tags).toEqual(['pipedrive']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-01-16T03:20:00.000Z');
  });

  it('truncates the title to the first 80 chars of the text', () => {
    const long = 'x'.repeat(200);
    const doc = pipedriveNoteDoc({ id: 2, content: `<p>${long}</p>` });
    expect(doc.content.length).toBeGreaterThan(80);
    expect(doc.title).toHaveLength(80);
    expect(doc.title).toBe(doc.content.slice(0, 80));
  });

  it('tolerates a missing content and timestamp', () => {
    const doc = pipedriveNoteDoc({ id: 'abc' });
    expect(doc.sourceId).toBe('abc');
    expect(doc.content).toBe('');
    expect(doc.title).toBe('');
    expect(doc.sourceCreatedAt).toBeUndefined();
  });
});
