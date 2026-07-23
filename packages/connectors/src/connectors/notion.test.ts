import { describe, it, expect } from 'vitest';
import { blocksToText, notionPageTitle } from './notion.js';

describe('notionPageTitle', () => {
  it('reads the title property', () => {
    const page = {
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'Release ' }, { plain_text: 'plan' }] },
      },
    };
    expect(notionPageTitle(page)).toBe('Release plan');
  });
  it('falls back to Untitled', () => {
    expect(notionPageTitle({ properties: {} })).toBe('Untitled');
  });
});

describe('blocksToText', () => {
  it('renders headings, bullets, todos, and paragraphs', () => {
    const blocks = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Overview' }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'We ship on Thursdays.' }] } },
      {
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ plain_text: 'Tag main' }] },
      },
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Announce' }], checked: true } },
    ];
    const text = blocksToText(blocks);
    expect(text).toContain('# Overview');
    expect(text).toContain('We ship on Thursdays.');
    expect(text).toContain('- Tag main');
    expect(text).toContain('- [x] Announce');
  });
});
