import { describe, it, expect } from 'vitest';
import { parseRss } from './rss.js';

const RSS_2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example Blog</title>
    <link>https://example.com</link>
    <item>
      <title>First post</title>
      <link>https://example.com/first</link>
      <guid>https://example.com/first</guid>
      <description>A short &amp; sweet summary.</description>
      <content:encoded><![CDATA[<p>Full <strong>body</strong> content here.</p>]]></content:encoded>
      <pubDate>Tue, 10 Jun 2025 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second post</title>
      <link>https://example.com/second</link>
      <description>Just a description, no content:encoded.</description>
      <pubDate>Wed, 11 Jun 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <title>Atom entry</title>
    <id>urn:uuid:1234</id>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" href="https://example.com/atom-entry"/>
    <summary>The summary text.</summary>
    <content type="html">&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;</content>
    <published>2025-06-10T09:00:00Z</published>
    <updated>2025-06-12T10:30:00Z</updated>
  </entry>
</feed>`;

describe('parseRss (RSS 2.0)', () => {
  const docs = parseRss(RSS_2);

  it('parses every item', () => {
    expect(docs).toHaveLength(2);
  });

  it('extracts title, link, guid, and dates', () => {
    const first = docs[0]!;
    expect(first.title).toBe('First post');
    expect(first.sourceUrl).toBe('https://example.com/first');
    expect(first.sourceId).toBe('https://example.com/first');
    expect(first.sourceType).toBe('rss');
    expect(first.sourceCreatedAt?.toISOString()).toBe('2025-06-10T09:00:00.000Z');
  });

  it('prefers content:encoded over description and strips HTML/CDATA', () => {
    const first = docs[0]!;
    expect(first.content).toContain('Full');
    expect(first.content).toContain('body');
    expect(first.content).not.toContain('<strong>');
    expect(first.content).not.toContain('CDATA');
  });

  it('decodes entities in the summary', () => {
    expect(docs[0]!.summary).toBe('A short & sweet summary.');
  });

  it('falls back to description when content:encoded is absent', () => {
    expect(docs[1]!.content).toContain('Just a description');
  });
});

describe('parseRss (Atom)', () => {
  const docs = parseRss(ATOM);

  it('parses every entry', () => {
    expect(docs).toHaveLength(1);
  });

  it('uses id as sourceId and the alternate link as sourceUrl', () => {
    const e = docs[0]!;
    expect(e.sourceId).toBe('urn:uuid:1234');
    expect(e.sourceUrl).toBe('https://example.com/atom-entry');
  });

  it('decodes escaped HTML content', () => {
    const e = docs[0]!;
    expect(e.content).toContain('Hello');
    expect(e.content).toContain('welcome');
    expect(e.content).not.toContain('<p>');
  });

  it('maps published/updated to source dates', () => {
    const e = docs[0]!;
    expect(e.sourceCreatedAt?.toISOString()).toBe('2025-06-10T09:00:00.000Z');
    expect(e.sourceUpdatedAt?.toISOString()).toBe('2025-06-12T10:30:00.000Z');
  });
});

describe('parseRss (empty)', () => {
  it('returns an empty array for a feed with no items or entries', () => {
    expect(parseRss('<rss><channel></channel></rss>')).toEqual([]);
  });
});
