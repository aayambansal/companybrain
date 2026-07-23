import { describe, it, expect } from 'vitest';
import { intercomArticleDoc, intercomNextUrl } from './intercom.js';

describe('intercomArticleDoc', () => {
  const article = {
    id: 987654,
    title: 'Getting started',
    body: '<p>Welcome! Read the <a href="https://help.acme.com/start">quick start</a> first.</p>',
    url: 'https://help.acme.com/en/articles/987654-getting-started',
    updated_at: 1737000000,
  };

  it('converts the HTML body to plain text', () => {
    const doc = intercomArticleDoc(article);
    const flat = doc.content.replace(/\s+/g, ' ').trim();
    expect(flat).toContain('Welcome! Read the quick start first.');
    expect(doc.content).not.toContain('<p>');
    expect(doc.content).not.toContain('href');
  });

  it('maps the fields onto a SourceDocument', () => {
    const doc = intercomArticleDoc(article);
    expect(doc.sourceId).toBe('987654');
    expect(doc.sourceType).toBe('intercom_article');
    expect(doc.sourceUrl).toBe('https://help.acme.com/en/articles/987654-getting-started');
    expect(doc.title).toBe('Getting started');
    expect(doc.tags).toEqual(['intercom']);
  });

  it('tolerates a missing title and body', () => {
    const doc = intercomArticleDoc({ id: 'abc' });
    expect(doc.sourceId).toBe('abc');
    expect(doc.title).toBe('Article');
    expect(doc.content).toBe('');
  });
});

describe('intercomNextUrl', () => {
  const base = 'https://api.intercom.io/articles?per_page=50';

  it('returns a string next URL as-is', () => {
    expect(intercomNextUrl('https://api.intercom.io/articles?per_page=50&page=2', base)).toBe(
      'https://api.intercom.io/articles?per_page=50&page=2',
    );
  });

  it('builds a URL from a starting_after cursor', () => {
    expect(intercomNextUrl({ starting_after: 'CURSOR123' }, base)).toBe(
      'https://api.intercom.io/articles?per_page=50&starting_after=CURSOR123',
    );
  });

  it('returns undefined when there is no next page', () => {
    expect(intercomNextUrl(null, base)).toBeUndefined();
    expect(intercomNextUrl(undefined, base)).toBeUndefined();
    expect(intercomNextUrl({}, base)).toBeUndefined();
  });
});
