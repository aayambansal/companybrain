import { describe, it, expect } from 'vitest';
import { flattenPages, gitbookDocumentText, gitbookPageDoc } from './gitbook.js';

describe('flattenPages', () => {
  it('recursively flattens a nested page tree in order', () => {
    const tree = [
      {
        id: 'a',
        title: 'Intro',
        path: 'intro',
        pages: [
          { id: 'a1', title: 'Setup', path: 'intro/setup' },
          {
            id: 'a2',
            title: 'Config',
            path: 'intro/config',
            pages: [{ id: 'a2a', title: 'Env', path: 'intro/config/env' }],
          },
        ],
      },
      { id: 'b', title: 'Guides', path: 'guides' },
    ];
    const flat = flattenPages(tree);
    expect(flat.map((p) => p.id)).toEqual(['a', 'a1', 'a2', 'a2a', 'b']);
    expect(flat[3]).toEqual({ id: 'a2a', title: 'Env', path: 'intro/config/env' });
  });

  it('defaults missing title and path', () => {
    const flat = flattenPages([{ id: 'x' }]);
    expect(flat).toEqual([{ id: 'x', title: 'Untitled', path: '' }]);
  });
});

describe('gitbookDocumentText', () => {
  it('extracts text leaves from a nested document', () => {
    const document = {
      object: 'document',
      nodes: [
        { object: 'block', type: 'heading-1', nodes: [{ object: 'text', text: 'Overview' }] },
        { object: 'block', type: 'paragraph', nodes: [{ object: 'text', text: ' We ship weekly.' }] },
      ],
    };
    expect(gitbookDocumentText(document)).toBe('Overview We ship weekly.');
  });
});

describe('gitbookPageDoc', () => {
  it('maps a page and its text into a SourceDocument', () => {
    const doc = gitbookPageDoc({ id: 'a1', title: 'Setup', path: 'intro/setup' }, 'Install the CLI.');
    expect(doc.sourceId).toBe('a1');
    expect(doc.sourceType).toBe('gitbook');
    expect(doc.title).toBe('Setup');
    expect(doc.content).toBe('Install the CLI.');
    expect(doc.tags).toEqual(['gitbook']);
    expect(doc.metadata).toEqual({ id: 'a1', path: 'intro/setup' });
  });
});
