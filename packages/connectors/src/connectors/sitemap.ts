import type { Connector } from '@companybrain/core';
import { fetchText } from '../http.js';
import { decodeXml } from '../xml.js';
import { parseHtmlPage } from './web.js';

/**
 * Extract page URLs from a sitemap XML document by reading `<loc>` entries.
 * Works for both urlset sitemaps and sitemap indexes. Pure and testable.
 */
export function parseSitemap(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const loc = decodeXml(m[1] ?? '').trim();
    if (loc) urls.push(loc);
  }
  return [...new Set(urls)];
}

export const sitemapConnector: Connector = {
  id: 'sitemap',
  displayName: 'Sitemap',
  description: 'Read a sitemap.xml and index every page it lists.',
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'sitemapUrl',
      label: 'Sitemap URL',
      type: 'url',
      required: true,
      placeholder: 'https://example.com/sitemap.xml',
      help: 'URL of a sitemap.xml (urlset or sitemap index).',
    },
    {
      key: 'limit',
      label: 'Max pages',
      type: 'number',
      required: false,
      default: 100,
      help: 'Cap the number of pages fetched per sync.',
    },
  ],
  async *pull(ctx) {
    const sitemapUrl = String(ctx.config.sitemapUrl ?? '').trim();
    if (!sitemapUrl) throw new Error('sitemap connector: config.sitemapUrl is required');
    const limit = toPositiveInt(ctx.config.limit, 100);

    const xml = await fetchText(sitemapUrl, ctx.signal);
    const urls = parseSitemap(xml).slice(0, limit);
    ctx.log?.('sitemap parsed', { total: urls.length });

    for (const url of urls) {
      if (ctx.signal?.aborted) return;
      const html = await fetchText(url, ctx.signal);
      yield parseHtmlPage(html, url);
    }
  },
};

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
