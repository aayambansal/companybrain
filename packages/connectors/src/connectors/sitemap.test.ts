import { describe, it, expect } from 'vitest';
import { parseSitemap } from './sitemap.js';

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-06-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/docs?a=1&amp;b=2</loc>
  </url>
  <url>
    <loc>
      https://example.com/blog
    </loc>
  </url>
  <url>
    <loc>https://example.com/</loc>
  </url>
</urlset>`;

describe('parseSitemap', () => {
  it('extracts and de-duplicates loc entries', () => {
    const urls = parseSitemap(SITEMAP);
    expect(urls).toEqual([
      'https://example.com/',
      'https://example.com/docs?a=1&b=2',
      'https://example.com/blog',
    ]);
  });

  it('trims whitespace around multiline loc values', () => {
    const urls = parseSitemap('<urlset><url><loc>\n  https://x.test/p  \n</loc></url></urlset>');
    expect(urls).toEqual(['https://x.test/p']);
  });

  it('returns an empty array when there are no loc entries', () => {
    expect(parseSitemap('<urlset></urlset>')).toEqual([]);
  });
});
