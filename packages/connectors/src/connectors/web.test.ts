import { describe, it, expect } from 'vitest';
import { parseHtmlPage } from './web.js';

describe('parseHtmlPage', () => {
  it('builds a web SourceDocument from HTML and a URL', () => {
    const doc = parseHtmlPage(
      '<html><head><title>Release notes</title></head><body><p>We shipped it.</p></body></html>',
      'https://example.com/notes',
    );
    expect(doc.sourceId).toBe('https://example.com/notes');
    expect(doc.sourceType).toBe('web');
    expect(doc.sourceUrl).toBe('https://example.com/notes');
    expect(doc.title).toBe('Release notes');
    expect(doc.content).toContain('We shipped it.');
    expect(doc.metadata).toEqual({ url: 'https://example.com/notes' });
  });

  it('falls back to the URL as the title when there is no <title>', () => {
    const doc = parseHtmlPage('<p>hi</p>', 'https://example.com/x');
    expect(doc.title).toBe('https://example.com/x');
  });
});
