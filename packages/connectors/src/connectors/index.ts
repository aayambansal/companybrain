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
import { gmailConnector } from './gmail.js';
import { discordConnector } from './discord.js';
import { youtubeConnector } from './youtube.js';
import { hackernewsConnector } from './hackernews.js';
import { googleDriveConnector } from './googledrive.js';
import { oneDriveConnector } from './onedrive.js';
import { redditConnector } from './reddit.js';
import { telegramConnector } from './telegram.js';
import { zendeskConnector } from './zendesk.js';
import { intercomConnector } from './intercom.js';
import { trelloConnector } from './trello.js';
import { airtableConnector } from './airtable.js';
import { gitlabConnector } from './gitlab.js';
import { asanaConnector } from './asana.js';
import { readwiseConnector } from './readwise.js';
import { dropboxConnector } from './dropbox.js';
import { boxConnector } from './box.js';
import { clickupConnector } from './clickup.js';
import { todoistConnector } from './todoist.js';
import { gitbookConnector } from './gitbook.js';
import { codaConnector } from './coda.js';
import { hubspotConnector } from './hubspot.js';
import { frontConnector } from './front.js';
import { bitbucketConnector } from './bitbucket.js';
import { sentryConnector } from './sentry.js';
import { freshdeskConnector } from './freshdesk.js';
import { pipedriveConnector } from './pipedrive.js';
import { raindropConnector } from './raindrop.js';
import { wisprFlowConnector } from './wisprflow.js';
import { granolaConnector } from './granola.js';
import { fathomConnector } from './fathom.js';
import { raycastConnector } from './raycast.js';

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
  gmailConnector,
  discordConnector,
  youtubeConnector,
  hackernewsConnector,
  googleDriveConnector,
  oneDriveConnector,
  redditConnector,
  telegramConnector,
  zendeskConnector,
  intercomConnector,
  trelloConnector,
  airtableConnector,
  gitlabConnector,
  asanaConnector,
  readwiseConnector,
  raindropConnector,
  dropboxConnector,
  boxConnector,
  clickupConnector,
  todoistConnector,
  gitbookConnector,
  codaConnector,
  hubspotConnector,
  frontConnector,
  bitbucketConnector,
  sentryConnector,
  freshdeskConnector,
  pipedriveConnector,
  wisprFlowConnector,
  granolaConnector,
  fathomConnector,
  raycastConnector,
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
export { gmailConnector, parseGmailMessage } from './gmail.js';
export { discordConnector, discordMessageDoc } from './discord.js';
export { youtubeConnector, extractYoutubeId, parseTimedText } from './youtube.js';
export { hackernewsConnector, hnHitToDoc } from './hackernews.js';
export { googleDriveConnector, driveFileToDoc } from './googledrive.js';
export { oneDriveConnector, oneDriveItemToDoc } from './onedrive.js';
export { redditConnector, redditPostToDoc } from './reddit.js';
export { telegramConnector, telegramMessageDoc } from './telegram.js';
export { zendeskConnector, zendeskArticleDoc } from './zendesk.js';
export { intercomConnector, intercomArticleDoc } from './intercom.js';
export { trelloConnector, trelloCardDoc } from './trello.js';
export { airtableConnector, airtableRecordDoc } from './airtable.js';
export { gitlabConnector, gitlabIssueDoc } from './gitlab.js';
export { asanaConnector, asanaTaskDoc } from './asana.js';
export { readwiseConnector, readwiseBookDoc } from './readwise.js';
export { raindropConnector, raindropItemToDoc } from './raindrop.js';
export { dropboxConnector, dropboxEntryToDoc } from './dropbox.js';
export { boxConnector, boxItemToDoc } from './box.js';
export { clickupConnector, clickupTaskDoc } from './clickup.js';
export { todoistConnector, todoistTaskDoc } from './todoist.js';
export { gitbookConnector, flattenPages, gitbookPageDoc } from './gitbook.js';
export { codaConnector, codaPageDoc } from './coda.js';
export { hubspotConnector, hubspotNoteDoc } from './hubspot.js';
export { frontConnector, frontConversationDoc } from './front.js';
export { bitbucketConnector, bitbucketIssueDoc } from './bitbucket.js';
export { sentryConnector, sentryIssueDoc } from './sentry.js';
export { freshdeskConnector, freshdeskTicketDoc } from './freshdesk.js';
export { pipedriveConnector, pipedriveNoteDoc } from './pipedrive.js';
export { wisprFlowConnector, wisprFlowEntryDoc, parseWisprFlowExport } from './wisprflow.js';
export { granolaConnector, granolaMeetingDoc, parseGranolaExport } from './granola.js';
export { fathomConnector, fathomCallDoc, parseFathomExport } from './fathom.js';
export { raycastConnector, raycastNote } from './raycast.js';
