import type { Connector } from '@companybrain/core';
import { webConnector } from './web.js';
import { sitemapConnector } from './sitemap.js';
import { filesConnector } from './files.js';
import { obsidianConnector } from './obsidian.js';
import { rssConnector } from './rss.js';
import { githubConnector } from './github.js';
import { notionConnector } from './notion.js';
import { slackConnector } from './slack.js';
import { googleDocsConnector } from './googledocs.js';

/** Every built-in connector, in a stable order. */
export const connectors: Connector[] = [
  webConnector,
  sitemapConnector,
  filesConnector,
  obsidianConnector,
  rssConnector,
  githubConnector,
  notionConnector,
  slackConnector,
  googleDocsConnector,
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
  fileToSourceDocumentAsync,
  DEFAULT_FILE_EXTENSIONS,
} from './files.js';
export { obsidianConnector, parseFrontmatter, type Frontmatter } from './obsidian.js';
export { rssConnector, parseRss } from './rss.js';
export { githubConnector, selectIndexablePaths } from './github.js';
export { notionConnector, blocksToText, notionPageTitle } from './notion.js';
export { slackConnector, slackMessageDoc } from './slack.js';
export { googleDocsConnector, extractGoogleDocId } from './googledocs.js';
