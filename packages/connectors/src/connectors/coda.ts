import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Coda page as returned by the docs API (fields subset). */
export interface CodaPage {
  id: string;
  name: string;
  href?: string;
  browserLink?: string;
}

/** Pure: map a Coda page into a SourceDocument (name + link). Unit-testable. */
export function codaPageDoc(page: CodaPage): SourceDocument {
  return {
    sourceId: page.id,
    sourceType: 'coda',
    sourceUrl: page.browserLink,
    title: page.name,
    content: page.name,
    tags: ['coda'],
    metadata: { id: page.id },
  };
}

export const codaConnector: Connector = {
  id: 'coda',
  displayName: 'Coda',
  description: 'Index page names and links from a Coda doc via the API.',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: 'xxxx-xxxx...',
      help: 'Create a token at coda.io/account under API settings.',
    },
    {
      key: 'docId',
      label: 'Doc ID',
      type: 'string',
      required: true,
      placeholder: 'AbCDeFGH',
      help: 'The id of the Coda doc whose pages should be indexed.',
    },
  ],
  async *pull(ctx) {
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    const docId = String(ctx.config.docId ?? '').trim();
    if (!apiToken) throw new Error('coda connector: config.apiToken is required');
    if (!docId) throw new Error('coda connector: config.docId is required');
    const headers = { authorization: `Bearer ${apiToken}` };

    let pageToken: string | undefined;
    do {
      if (ctx.signal?.aborted) return;
      const params = new URLSearchParams({ limit: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetchJson<{ items?: CodaPage[]; nextPageToken?: string }>(
        `https://coda.io/apis/v1/docs/${encodeURIComponent(docId)}/pages?${params}`,
        { headers, signal: ctx.signal },
      );
      for (const page of res.items ?? []) {
        if (ctx.signal?.aborted) return;
        yield codaPageDoc(page);
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  },
};
