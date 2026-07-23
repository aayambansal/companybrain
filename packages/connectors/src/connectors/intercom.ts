import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const INTERCOM_VERSION = '2.11';

interface IntercomArticle {
  id: string | number;
  title?: string;
  body?: string;
  url?: string;
  updated_at?: number | string;
}

type IntercomNext = string | { starting_after?: string } | null | undefined;

interface IntercomArticlesResponse {
  data?: IntercomArticle[];
  pages?: { next?: IntercomNext };
}

/** Pure: turn an Intercom article (HTML body) into a SourceDocument. */
export function intercomArticleDoc(article: IntercomArticle): SourceDocument {
  return {
    sourceId: String(article.id),
    sourceType: 'intercom_article',
    sourceUrl: article.url,
    title: article.title ?? 'Article',
    content: htmlToText(article.body ?? ''),
    tags: ['intercom'],
    metadata: { id: article.id },
  };
}

/** Pure: resolve the next page URL from an Intercom `pages.next` value. */
export function intercomNextUrl(next: IntercomNext, baseUrl: string): string | undefined {
  if (!next) return undefined;
  if (typeof next === 'string') return next;
  if (next.starting_after) {
    const url = new URL(baseUrl);
    url.searchParams.set('starting_after', next.starting_after);
    return url.toString();
  }
  return undefined;
}

export const intercomConnector: Connector = {
  id: 'intercom',
  displayName: 'Intercom',
  description: 'Index Intercom Help Center articles via the REST API (access token).',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'accessToken',
      label: 'Access token',
      type: 'password',
      required: true,
      help: 'Create under Intercom > Settings > Developers > Developer Hub.',
    },
  ],
  async *pull(ctx) {
    const accessToken = String(ctx.config.accessToken ?? '').trim();
    if (!accessToken) throw new Error('intercom connector: config.accessToken is required');
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'intercom-version': INTERCOM_VERSION,
    };

    const base = 'https://api.intercom.io/articles?per_page=50';
    let url: string | undefined = base;
    while (url) {
      if (ctx.signal?.aborted) return;
      const res: IntercomArticlesResponse = await fetchJson<IntercomArticlesResponse>(url, {
        headers,
        signal: ctx.signal,
      });
      for (const article of res.data ?? []) yield intercomArticleDoc(article);
      url = intercomNextUrl(res.pages?.next, base);
    }
  },
};
