import { describe, it, expect } from 'vitest';
import { zendeskArticleDoc } from './zendesk.js';

describe('zendeskArticleDoc', () => {
  const article = {
    id: 12345,
    title: 'Resetting your password',
    body: '<h1>Reset</h1><p>Click the <a href="https://acme.zendesk.com/reset">reset link</a> in your email.</p>',
    html_url: 'https://acme.zendesk.com/hc/en-us/articles/12345',
    updated_at: '2026-01-15T09:30:00Z',
  };

  it('converts the HTML body to plain text', () => {
    const doc = zendeskArticleDoc(article);
    const flat = doc.content.replace(/\s+/g, ' ').trim();
    expect(flat).toContain('Reset');
    expect(flat).toContain('Click the reset link in your email.');
    expect(doc.content).not.toContain('<p>');
    expect(doc.content).not.toContain('href');
  });

  it('maps the fields onto a SourceDocument', () => {
    const doc = zendeskArticleDoc(article);
    expect(doc.sourceId).toBe('12345');
    expect(doc.sourceType).toBe('zendesk_article');
    expect(doc.sourceUrl).toBe('https://acme.zendesk.com/hc/en-us/articles/12345');
    expect(doc.title).toBe('Resetting your password');
    expect(doc.tags).toEqual(['zendesk']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2026-01-15T09:30:00.000Z');
  });

  it('tolerates a missing title and body', () => {
    const doc = zendeskArticleDoc({ id: 7 });
    expect(doc.sourceId).toBe('7');
    expect(doc.title).toBe('Article');
    expect(doc.content).toBe('');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
