import { describe, it, expect } from 'vitest';
import { hubspotNoteDoc } from './hubspot.js';

describe('hubspotNoteDoc', () => {
  const note = {
    id: 123456,
    properties: {
      hs_note_body:
        '<p>Called the customer &amp; agreed to a <a href="https://acme.com/renew">renewal</a>.</p>',
      hs_timestamp: '2024-01-16T03:20:00Z',
    },
  };

  it('converts the HTML body to plain text', () => {
    const doc = hubspotNoteDoc(note);
    const flat = doc.content.replace(/\s+/g, ' ').trim();
    expect(flat).toContain('Called the customer & agreed to a renewal');
    expect(doc.content).not.toContain('<p>');
    expect(doc.content).not.toContain('href');
  });

  it('maps the fields onto a SourceDocument', () => {
    const doc = hubspotNoteDoc(note);
    expect(doc.sourceId).toBe('123456');
    expect(doc.sourceType).toBe('hubspot_note');
    expect(doc.tags).toEqual(['hubspot']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-01-16T03:20:00.000Z');
  });

  it('parses an epoch-millis timestamp string', () => {
    const doc = hubspotNoteDoc({
      id: 1,
      properties: { hs_note_body: 'Hi', hs_timestamp: '1705375200000' },
    });
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-01-16T03:20:00.000Z');
  });

  it('truncates the title to the first 80 chars of the text', () => {
    const long = 'x'.repeat(200);
    const doc = hubspotNoteDoc({ id: 2, properties: { hs_note_body: `<p>${long}</p>` } });
    expect(doc.content.length).toBeGreaterThan(80);
    expect(doc.title).toHaveLength(80);
    expect(doc.title).toBe(doc.content.slice(0, 80));
  });

  it('tolerates a missing body and timestamp', () => {
    const doc = hubspotNoteDoc({ id: 'abc' });
    expect(doc.sourceId).toBe('abc');
    expect(doc.content).toBe('');
    expect(doc.title).toBe('');
    expect(doc.sourceCreatedAt).toBeUndefined();
  });
});
