import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const PER_PAGE = 50;

/** A single Raindrop.io bookmark. */
export interface RaindropItem {
  _id: number;
  title?: string;
  excerpt?: string;
  note?: string;
  link?: string;
  tags?: string[];
  created?: string;
}

/**
 * Pure: map a Raindrop bookmark into a SourceDocument, merging its title,
 * excerpt and note into the content and its tags onto the base tag.
 * Unit-testable with an inline item.
 */
export function raindropItemToDoc(item: RaindropItem): SourceDocument {
  return {
    sourceId: String(item._id),
    sourceType: 'raindrop',
    sourceUrl: item.link,
    title: item.title,
    content: [item.title, item.excerpt, item.note].filter(Boolean).join('\n\n'),
    tags: ['raindrop', ...(item.tags ?? [])],
    metadata: {
      id: item._id,
      link: item.link,
    },
    sourceCreatedAt: item.created ? new Date(item.created) : undefined,
  };
}

export const raindropConnector: Connector = {
  id: 'raindrop',
  displayName: 'Raindrop.io',
  description: 'Index bookmarks from a Raindrop.io collection.',
  category: 'web',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Test token',
      type: 'password',
      required: true,
      placeholder: 'raindrop test token',
      help: 'Create an app at https://app.raindrop.io/settings/integrations and copy its test token.',
    },
    {
      key: 'collection',
      label: 'Collection id',
      type: 'string',
      required: false,
      placeholder: '0',
      help: 'The collection id to index. Defaults to 0, which spans all bookmarks.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    if (!token) throw new Error('raindrop connector: config.token is required');
    const collection = String(ctx.config.collection ?? '0').trim() || '0';
    const headers = { authorization: `Bearer ${token}` };

    let page = 0;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const url = `https://api.raindrop.io/rest/v1/raindrops/${encodeURIComponent(collection)}?perpage=${PER_PAGE}&page=${page}`;
      ctx.log?.('fetching raindrop bookmarks', { collection, page });
      const res = await fetchJson<{ items?: RaindropItem[]; count?: number }>(url, { headers, signal: ctx.signal });
      const items = res.items ?? [];
      for (const item of items) {
        if (ctx.signal?.aborted) return;
        yield raindropItemToDoc(item);
      }
      if (items.length < PER_PAGE) break;
      page += 1;
    }
  },
};
