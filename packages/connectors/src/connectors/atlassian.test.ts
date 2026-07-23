import { describe, it, expect } from 'vitest';
import { parseLinearIssues } from './linear.js';
import { confluencePageDoc } from './confluence.js';
import { parseJiraIssues, adfToText } from './jira.js';

describe('parseLinearIssues', () => {
  it('maps issues with identifier + description', () => {
    const docs = parseLinearIssues({
      data: {
        issues: {
          nodes: [
            {
              id: '1',
              identifier: 'ENG-12',
              title: 'Fix login',
              description: 'It breaks on Safari',
              url: 'https://linear.app/x/ENG-12',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
      },
    });
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe('ENG-12: Fix login');
    expect(docs[0]!.content).toContain('Safari');
    expect(docs[0]!.sourceId).toBe('1');
  });
});

describe('confluencePageDoc', () => {
  it('converts storage HTML to text and builds a webui link', () => {
    const doc = confluencePageDoc(
      {
        id: '99',
        title: 'Runbook',
        body: { storage: { value: '<p>Restart the <b>API</b> pod.</p>' } },
        _links: { webui: '/spaces/OPS/pages/99' },
      },
      'https://acme.atlassian.net',
    );
    expect(doc.title).toBe('Runbook');
    expect(doc.content).toContain('Restart the');
    expect(doc.sourceUrl).toBe('https://acme.atlassian.net/wiki/spaces/OPS/pages/99');
  });
});

describe('adfToText', () => {
  it('flattens ADF nodes and plain strings', () => {
    expect(adfToText('plain')).toBe('plain');
    const adf = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    };
    expect(adfToText(adf).trim()).toBe('Hello world');
  });
});

describe('parseJiraIssues', () => {
  it('maps issues with key and ADF description', () => {
    const docs = parseJiraIssues(
      {
        issues: [
          {
            id: '5',
            key: 'ENG-7',
            fields: {
              summary: 'Ship it',
              description: {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ASAP' }] }],
              },
            },
          },
        ],
      },
      'https://acme.atlassian.net',
    );
    expect(docs[0]!.title).toBe('ENG-7: Ship it');
    expect(docs[0]!.content).toContain('ASAP');
    expect(docs[0]!.sourceUrl).toBe('https://acme.atlassian.net/browse/ENG-7');
  });
});
