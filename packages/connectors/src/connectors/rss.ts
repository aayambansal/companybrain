import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchText } from '../http.js';
import { decodeXml, tagText } from '../xml.js';

/**
 * Parse an RSS 2.0 or Atom feed into SourceDocuments. Pure and testable with
 * an inline XML string. Detects the feed flavor by whether it has `<item>`
 * (RSS) or `<entry>` (Atom) elements.
 */
export function parseRss(xml: string): SourceDocument[] {
  const items = matchBlocks(xml, 'item');
  if (items.length > 0) return items.map(parseRssItem);
  const entries = matchBlocks(xml, 'entry');
  return entries.map(parseAtomEntry);
}

function matchBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'gi');
  return xml.match(re) ?? [];
}

function parseRssItem(block: string): SourceDocument {
  const title = tagText(block, 'title');
  const link = tagText(block, 'link');
  const guid = tagText(block, 'guid');
  const description = tagText(block, 'description');
  const encoded = tagText(block, 'content:encoded');
  const date = parseDate(tagText(block, 'pubDate') ?? tagText(block, 'dc:date'));
  const rawContent = encoded ?? description ?? '';

  return {
    sourceId: guid || link || title || undefined,
    sourceType: 'rss',
    sourceUrl: link,
    title,
    content: htmlToText(rawContent),
    summary: summarize(description),
    metadata: { guid, feed: 'rss' },
    sourceCreatedAt: date,
    sourceUpdatedAt: date,
  };
}

function parseAtomEntry(block: string): SourceDocument {
  const title = tagText(block, 'title');
  const id = tagText(block, 'id');
  const link = atomLink(block);
  const summary = tagText(block, 'summary');
  const content = tagText(block, 'content') ?? summary ?? '';
  const published = parseDate(tagText(block, 'published'));
  const updated = parseDate(tagText(block, 'updated'));

  return {
    sourceId: id || link || title || undefined,
    sourceType: 'rss',
    sourceUrl: link,
    title,
    content: htmlToText(content),
    summary: summarize(summary),
    metadata: { id, feed: 'atom' },
    sourceCreatedAt: published ?? updated,
    sourceUpdatedAt: updated ?? published,
  };
}

/** Pick the best `<link href>` from an Atom entry: prefer rel="alternate". */
function atomLink(block: string): string | undefined {
  const tags = block.match(/<link\b[^>]*\/?>/gi) ?? [];
  let fallback: string | undefined;
  for (const t of tags) {
    const href = /href="([^"]*)"/i.exec(t)?.[1];
    if (!href) continue;
    const rel = /rel="([^"]*)"/i.exec(t)?.[1];
    if (!rel || rel.toLowerCase() === 'alternate') return decodeXml(href);
    if (rel.toLowerCase() === 'self') continue;
    if (!fallback) fallback = decodeXml(href);
  }
  return fallback;
}

function summarize(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const plain = htmlToText(text).replace(/\s+/g, ' ').trim();
  if (!plain) return undefined;
  return plain.length > 300 ? `${plain.slice(0, 297)}...` : plain;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const rssConnector: Connector = {
  id: 'rss',
  displayName: 'RSS / Atom',
  description: 'Index entries from an RSS 2.0 or Atom feed.',
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'feedUrl',
      label: 'Feed URL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/feed.xml',
      help: 'URL of an RSS 2.0 or Atom feed.',
    },
  ],
  async *pull(ctx) {
    const feedUrl = String(ctx.config.feedUrl ?? '').trim();
    if (!feedUrl) throw new Error('rss connector: config.feedUrl is required');
    const xml = await fetchText(feedUrl, ctx.signal);
    const docs = parseRss(xml);
    ctx.log?.('feed parsed', { entries: docs.length });
    for (const doc of docs) yield doc;
  },
};
