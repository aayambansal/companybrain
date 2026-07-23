import { describe, it, expect } from 'vitest';
import { bitbucketIssueDoc } from './bitbucket.js';

describe('bitbucketIssueDoc', () => {
  it('maps an issue with a body', () => {
    const doc = bitbucketIssueDoc({
      id: 17,
      title: 'Add Bitbucket connector',
      content: { raw: "Index a repo's issues into the brain." },
      links: { html: { href: 'https://bitbucket.org/acme/web/issues/17' } },
      updated_on: '2024-05-02T08:15:00.000Z',
    });
    expect(doc.sourceId).toBe('17');
    expect(doc.sourceType).toBe('bitbucket_issue');
    expect(doc.sourceUrl).toBe('https://bitbucket.org/acme/web/issues/17');
    expect(doc.title).toBe('#17 Add Bitbucket connector');
    expect(doc.content).toBe("Add Bitbucket connector\n\nIndex a repo's issues into the brain.");
    expect(doc.tags).toEqual(['bitbucket']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2024-05-02T08:15:00.000Z');
  });

  it('maps an issue with no body to just its title', () => {
    const doc = bitbucketIssueDoc({
      id: 3,
      title: 'A title with no body',
      links: { html: { href: 'https://bitbucket.org/acme/web/issues/3' } },
    });
    expect(doc.title).toBe('#3 A title with no body');
    expect(doc.content).toBe('A title with no body');
    expect(doc.tags).toEqual(['bitbucket']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
