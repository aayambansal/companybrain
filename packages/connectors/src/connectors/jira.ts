import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface JiraIssue {
  id: string;
  key?: string;
  fields?: { summary?: string; description?: unknown };
}

/** Pure: flatten Atlassian Document Format (ADF) or a plain string into text. */
export function adfToText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: string; content?: unknown[]; type?: string };
  if (typeof n.text === 'string') return n.text;
  const inner = Array.isArray(n.content) ? n.content.map(adfToText).join('') : '';
  // Block-level nodes get a trailing newline for readability.
  return ['paragraph', 'heading', 'listItem', 'blockquote'].includes(n.type ?? '')
    ? inner + '\n'
    : inner;
}

/** Pure: map a Jira search response into SourceDocuments. */
export function parseJiraIssues(json: { issues?: JiraIssue[] }, baseUrl: string): SourceDocument[] {
  return (json.issues ?? []).map((i) => {
    const summary = i.fields?.summary ?? '';
    const desc = adfToText(i.fields?.description).trim();
    return {
      sourceId: i.id,
      sourceType: 'jira_issue',
      sourceUrl: i.key ? `${baseUrl.replace(/\/$/, '')}/browse/${i.key}` : undefined,
      title: i.key ? `${i.key}: ${summary}` : summary || 'Issue',
      content: [summary, desc].filter(Boolean).join('\n\n') || summary,
      tags: ['jira'],
      metadata: { id: i.id, key: i.key },
    } satisfies SourceDocument;
  });
}

function basicAuth(email: string, token: string): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export const jiraConnector: Connector = {
  id: 'jira',
  displayName: 'Jira',
  description: 'Index Jira issues (summary + description) via the REST API (Atlassian API token).',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-domain.atlassian.net',
    },
    {
      key: 'email',
      label: 'Account email',
      type: 'string',
      required: true,
      placeholder: 'you@company.com',
    },
    { key: 'apiToken', label: 'API token', type: 'password', required: true },
    {
      key: 'jql',
      label: 'JQL filter',
      type: 'string',
      required: false,
      placeholder: 'project = ENG ORDER BY updated DESC',
      help: 'Optional. Defaults to recently updated issues.',
    },
  ],
  async *pull(ctx) {
    const baseUrl = String(ctx.config.baseUrl ?? '')
      .trim()
      .replace(/\/$/, '');
    const email = String(ctx.config.email ?? '').trim();
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    if (!baseUrl || !email || !apiToken)
      throw new Error('jira connector: baseUrl, email, and apiToken are required');
    const jql = String(ctx.config.jql ?? 'ORDER BY updated DESC');
    const headers = { authorization: basicAuth(email, apiToken) };

    let startAt = 0;
    const maxResults = 50;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const params = new URLSearchParams({
        jql,
        startAt: String(startAt),
        maxResults: String(maxResults),
        fields: 'summary,description',
      });
      const res = await fetchJson<{ issues?: JiraIssue[]; total?: number }>(
        `${baseUrl}/rest/api/3/search?${params}`,
        { headers, signal: ctx.signal },
      );
      const docs = parseJiraIssues(res, baseUrl);
      for (const doc of docs) yield doc;
      startAt += maxResults;
      if (docs.length < maxResults) break;
    }
  },
};
