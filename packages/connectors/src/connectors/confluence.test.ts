import { describe, it, expect } from 'vitest';
import { confluencePageDoc } from './confluence.js';

describe('confluencePageDoc', () => {
  it('maps a Confluence page to a SourceDocument and builds the web URL', () => {
    const doc = confluencePageDoc(
      {
        id: '123',
        title: 'Runbook',
        body: { storage: { value: '<p>Restart the <b>service</b>.</p>' } },
        _links: { webui: '/spaces/ENG/pages/123' },
      },
      'https://acme.atlassian.net/',
    );
    expect(doc.sourceId).toBe('123');
    expect(doc.sourceType).toBe('confluence_page');
    expect(doc.title).toBe('Runbook');
    expect(doc.content).toContain('Restart the service.');
    expect(doc.content).not.toContain('<p>');
    expect(doc.sourceUrl).toBe('https://acme.atlassian.net/wiki/spaces/ENG/pages/123');
    expect(doc.tags).toEqual(['confluence']);
  });

  it('handles a missing body, title, and link', () => {
    const doc = confluencePageDoc({ id: '9' }, 'https://x.atlassian.net');
    expect(doc.title).toBe('Page');
    expect(doc.content).toBe('');
    expect(doc.sourceUrl).toBeUndefined();
  });
});
