import type { Connector } from '@companybrain/core';
import { webConnector } from './web.js';
import { sitemapConnector } from './sitemap.js';
import { filesConnector } from './files.js';
import { obsidianConnector } from './obsidian.js';
import { rssConnector } from './rss.js';

/** Every built-in connector, in a stable order. */
export const connectors: Connector[] = [
  webConnector,
  sitemapConnector,
  filesConnector,
  obsidianConnector,
  rssConnector,
];

/** Look up a connector by its stable id. */
export function getConnector(id: string): Connector | undefined {
  return connectors.find((c) => c.id === id);
}

export { webConnector, parseHtmlPage } from './web.js';
export { sitemapConnector, parseSitemap } from './sitemap.js';
export {
  filesConnector,
  walkFiles,
  resolveExtensions,
  fileToSourceDocument,
  DEFAULT_FILE_EXTENSIONS,
} from './files.js';
export { obsidianConnector, parseFrontmatter, type Frontmatter } from './obsidian.js';
export { rssConnector, parseRss } from './rss.js';
