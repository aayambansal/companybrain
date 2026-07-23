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
import { linearConnector } from './linear.js';
import { confluenceConnector } from './confluence.js';
import { jiraConnector } from './jira.js';

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
  linearConnector,
  confluenceConnector,
  jiraConnector,
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
export { linearConnector, parseLinearIssues } from './linear.js';
export { confluenceConnector, confluencePageDoc } from './confluence.js';
export { jiraConnector, parseJiraIssues, adfToText } from './jira.js';
