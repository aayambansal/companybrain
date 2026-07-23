import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchText } from '../http.js';
import { extractTitle } from '../xml.js';

/**
 * Turn a fetched HTML page into a SourceDocument. Pure: no network/fs, so it
 * is unit-testable with an inline HTML string.
 */
export function parseHtmlPage(html: string, url: string): SourceDocument {
  return {
    sourceId: url,
    sourceType: 'web',
    sourceUrl: url,
    title: extractTitle(html) ?? url,
    content: htmlToText(html),
    metadata: { url },
  };
}

export const webConnector: Connector = {
  id: 'web',
  displayName: 'Web page',
  description: 'Fetch a single web page and index its readable text.',
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'url',
      label: 'Page URL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/handbook',
      help: 'The web page to fetch and index.',
    },
  ],
  async *pull(ctx) {
    const url = String(ctx.config.url ?? '').trim();
    if (!url) throw new Error('web connector: config.url is required');
    ctx.log?.('fetching page', { url });
    const html = await fetchText(url, ctx.signal);
    yield parseHtmlPage(html, url);
  },
};
