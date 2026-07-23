import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from './obsidian.js';

describe('parseFrontmatter', () => {
  it('reads inline array tags and strips the frontmatter', () => {
    const note = `---
title: Release process
tags: [process, release]
---
The release ships on Thursday.`;
    const { tags, body } = parseFrontmatter(note);
    expect(tags).toEqual(['process', 'release']);
    expect(body).toBe('The release ships on Thursday.');
    expect(body).not.toContain('---');
  });

  it('reads YAML block-list tags', () => {
    const note = `---
tags:
  - alpha
  - "beta"
  - #gamma
---
Body text.`;
    const { tags } = parseFrontmatter(note);
    expect(tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('reads a comma-separated single-line value', () => {
    const note = `---
tags: one, two, three
---
x`;
    expect(parseFrontmatter(note).tags).toEqual(['one', 'two', 'three']);
  });

  it('extracts unique wikilink targets, dropping aliases and headings', () => {
    const note = `See [[Alpha]], [[Beta|the beta note]] and [[Gamma#Section]]. Also [[Alpha]] again.`;
    const { links } = parseFrontmatter(note);
    expect(links).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('handles a note with no frontmatter', () => {
    const note = `Just a plain note with a [[Link]].`;
    const { tags, body, links } = parseFrontmatter(note);
    expect(tags).toEqual([]);
    expect(body).toBe(note);
    expect(links).toEqual(['Link']);
  });

  it('deduplicates tags', () => {
    const note = `---
tags: [a, a, b]
---
x`;
    expect(parseFrontmatter(note).tags).toEqual(['a', 'b']);
  });
});
