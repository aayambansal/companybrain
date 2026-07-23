import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface ConfluencePage {
  id: string;
  title?: string;
  body?: { storage?: { value?: string } };
  _links?: { webui?: string };
}

/** Pure: turn a Confluence page (storage HTML) into a SourceDocument. */
export function confluencePageDoc(page: ConfluencePage, baseUrl: string): SourceDocument {
  const html = page.body?.storage?.value ?? '';
  const webui = page._links?.webui
    ? baseUrl.replace(/\/$/, '') + '/wiki' + page._links.webui
    : undefined;
  return {
    sourceId: page.id,
    sourceType: 'confluence_page',
    sourceUrl: webui,
    title: page.title ?? 'Page',
    content: htmlToText(html),
    tags: ['confluence'],
    metadata: { id: page.id },
  };
}

function basicAuth(email: string, token: string): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export const confluenceConnector: Connector = {
  id: 'confluence',
  displayName: 'Confluence',
  description: 'Index Confluence pages via the REST API (Atlassian API token).',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-domain.atlassian.net',
      help: 'Your Atlassian site URL.',
    },
    {
      key: 'email',
      label: 'Account email',
      type: 'string',
      required: true,
      placeholder: 'you@company.com',
    },
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      help: 'Create at id.atlassian.com > Security > API tokens.',
    },
  ],
  async *pull(ctx) {
    const baseUrl = String(ctx.config.baseUrl ?? '')
      .trim()
      .replace(/\/$/, '');
    const email = String(ctx.config.email ?? '').trim();
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    if (!baseUrl || !email || !apiToken)
      throw new Error('confluence connector: baseUrl, email, and apiToken are required');
    const headers = { authorization: basicAuth(email, apiToken) };

    let start = 0;
    const limit = 50;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const res = await fetchJson<{ results?: ConfluencePage[]; size?: number }>(
        `${baseUrl}/wiki/rest/api/content?type=page&expand=body.storage&limit=${limit}&start=${start}`,
        { headers, signal: ctx.signal },
      );
      const pages = res.results ?? [];
      for (const page of pages) yield confluencePageDoc(page, baseUrl);
      if (pages.length < limit) break;
      start += limit;
    }
  },
};
