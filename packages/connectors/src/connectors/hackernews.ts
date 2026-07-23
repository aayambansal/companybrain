import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single hit from the Algolia Hacker News search API. */
export interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
}

/**
 * Pure: map an Algolia HN hit into a SourceDocument. Falls back to the HN item
 * permalink when the story has no external url. Unit-testable.
 */
export function hnHitToDoc(hit: HnHit): SourceDocument {
  return {
    sourceId: hit.objectID,
    sourceType: 'hackernews',
    sourceUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title,
    content: [hit.title, hit.url, hit.story_text].filter(Boolean).join('\n\n'),
    tags: ['hackernews'],
    metadata: {
      objectID: hit.objectID,
      author: hit.author,
      points: hit.points,
      comments: hit.num_comments,
    },
    sourceCreatedAt: hit.created_at ? new Date(hit.created_at) : undefined,
  };
}

export const hackernewsConnector: Connector = {
  id: 'hackernews',
  displayName: 'Hacker News',
  description: 'Index Hacker News stories matching a search query or submitted by a user, via the Algolia HN API.',
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'query',
      label: 'Search query',
      type: 'string',
      required: false,
      placeholder: 'self-hosted memory',
      help: 'Full-text query for HN stories. Leave blank to index only a user.',
    },
    {
      key: 'user',
      label: 'Username',
      type: 'string',
      required: false,
      placeholder: 'pg',
      help: 'Only include stories submitted by this HN username.',
    },
  ],
  async *pull(ctx) {
    const query = String(ctx.config.query ?? '').trim();
    const user = String(ctx.config.user ?? '').trim();
    if (!query && !user) throw new Error('hackernews connector: config.query or config.user is required');
    const params = new URLSearchParams({
      query,
      tags: user ? `story,author_${user}` : 'story',
      hitsPerPage: '50',
    });
    const url = `https://hn.algolia.com/api/v1/search?${params.toString()}`;
    ctx.log?.('searching hacker news', { query, user });
    const res = await fetchJson<{ hits?: HnHit[] }>(url, { signal: ctx.signal });
    for (const hit of res.hits ?? []) {
      if (ctx.signal?.aborted) return;
      yield hnHitToDoc(hit);
    }
  },
};
