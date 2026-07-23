import { describe, it, expect } from 'vitest';
import { adfToText } from './jira.js';

describe('adfToText', () => {
  it('returns plain strings and text-node text as-is', () => {
    expect(adfToText('hello')).toBe('hello');
    expect(adfToText({ type: 'text', text: 'world' })).toBe('world');
  });

  it('returns empty string for null or non-object nodes', () => {
    expect(adfToText(null)).toBe('');
    expect(adfToText(42)).toBe('');
  });

  it('joins a content array and adds a newline after block nodes', () => {
    const para = { type: 'paragraph', content: [{ type: 'text', text: 'a line' }] };
    expect(adfToText(para)).toBe('a line\n');
  });

  it('does not add a newline for inline nodes', () => {
    const inline = { type: 'text', content: [{ type: 'text', text: 'x' }], text: undefined };
    // text is undefined so it recurses into content; type 'text' is not block-level.
    expect(adfToText(inline)).toBe('x');
  });

  it('walks a nested document, newlining each block', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
      ],
    };
    expect(adfToText(doc)).toBe('Title\nBody text\n');
  });
});
