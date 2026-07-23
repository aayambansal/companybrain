// Public surface of the CompanyBrain connectors package.

// Connectors + lookup.
export {
  connectors,
  getConnector,
  webConnector,
  sitemapConnector,
  filesConnector,
  obsidianConnector,
  rssConnector,
} from './connectors/index.js';

// Pure parse/walk helpers (unit-testable without network or fs mocking).
export { parseHtmlPage } from './connectors/web.js';
export { parseSitemap } from './connectors/sitemap.js';
export {
  walkFiles,
  resolveExtensions,
  fileToSourceDocument,
  DEFAULT_FILE_EXTENSIONS,
} from './connectors/files.js';
export { parseFrontmatter, type Frontmatter } from './connectors/obsidian.js';
export { parseRss } from './connectors/rss.js';

// Sync runner + registry framework.
export { runConnectorSync, type RunConnectorSync } from './runner.js';
export { registerAll, type ConnectorRegistry } from './registry.js';

// Re-export the connector contract types for consumers.
export type { Connector, SourceDocument, ConnectorContext, ConfigField } from '@companybrain/core';
