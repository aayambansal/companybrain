import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface ZendeskArticle {
  id: number;
  title?: string;
  body?: string;
  html_url?: string;
  updated_at?: string;
}

interface ZendeskArticlesResponse {
  articles?: ZendeskArticle[];
  meta?: { has_more?: boolean };
  links?: { next?: string | null };
}

/** Pure: turn a Zendesk Help Center article (HTML body) into a SourceDocument. */
export function zendeskArticleDoc(article: ZendeskArticle): SourceDocument {
  return {
    sourceId: String(article.id),
    sourceType: 'zendesk_article',
    sourceUrl: article.html_url,
    title: article.title ?? 'Article',
    content: htmlToText(article.body ?? ''),
    tags: ['zendesk'],
    metadata: { id: article.id },
    sourceUpdatedAt: article.updated_at ? new Date(article.updated_at) : undefined,
  };
}

function basicAuth(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}/token:${apiToken}`).toString('base64');
}

export const zendeskConnector: Connector = {
  id: 'zendesk',
  displayName: 'Zendesk',
  description: 'Index Zendesk Help Center articles via the REST API (email + API token).',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'subdomain',
      label: 'Subdomain',
      type: 'string',
      required: true,
      placeholder: 'acme',
      help: 'The <subdomain> in https://<subdomain>.zendesk.com.',
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
      help: 'Create under Admin Center > Apps and integrations > APIs > Zendesk API.',
    },
  ],
  async *pull(ctx) {
    const subdomain = String(ctx.config.subdomain ?? '').trim();
    const email = String(ctx.config.email ?? '').trim();
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    if (!subdomain || !email || !apiToken)
      throw new Error('zendesk connector: subdomain, email, and apiToken are required');
    const headers = { authorization: basicAuth(email, apiToken) };

    let url: string | undefined =
      `https://${subdomain}.zendesk.com/api/v2/help_center/articles.json?page[size]=100`;
    while (url) {
      if (ctx.signal?.aborted) return;
      const res: ZendeskArticlesResponse = await fetchJson<ZendeskArticlesResponse>(url, {
        headers,
        signal: ctx.signal,
      });
      for (const article of res.articles ?? []) yield zendeskArticleDoc(article);
      url = res.meta?.has_more ? (res.links?.next ?? undefined) : undefined;
    }
  },
};
