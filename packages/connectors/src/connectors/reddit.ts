import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** The `data` payload of a single Reddit listing child (a post). */
export interface RedditPost {
  id?: string;
  title?: string;
  selftext?: string;
  url?: string;
  permalink?: string;
  created_utc?: number;
  subreddit?: string;
  author?: string;
}

/** A single child in a Reddit listing (`{ kind, data }`). */
export interface RedditChild {
  data?: RedditPost;
}

/**
 * Pure: map a Reddit listing child into a SourceDocument, or null when the post
 * has no title. Unit-testable with an inline listing child.
 */
export function redditPostToDoc(child: RedditChild): SourceDocument | null {
  const data = child.data;
  if (!data?.title) return null;
  const content = [data.title, data.selftext].filter(Boolean).join('\n\n');
  const tags = ['reddit', data.subreddit].filter((t): t is string => Boolean(t));
  return {
    sourceId: data.id,
    sourceType: 'reddit',
    sourceUrl: data.permalink ? `https://www.reddit.com${data.permalink}` : data.url,
    title: data.title,
    content,
    tags,
    metadata: {
      id: data.id,
      subreddit: data.subreddit,
      author: data.author,
      url: data.url,
    },
    sourceCreatedAt: data.created_utc ? new Date(data.created_utc * 1000) : undefined,
  };
}

export const redditConnector: Connector = {
  id: 'reddit',
  displayName: 'Reddit',
  description: "Index posts from a subreddit or a user via Reddit's public JSON API.",
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'subreddit',
      label: 'Subreddit',
      type: 'string',
      required: false,
      placeholder: 'programming',
      help: 'The subreddit to index (without the r/ prefix). Leave blank to index a user.',
    },
    {
      key: 'user',
      label: 'Username',
      type: 'string',
      required: false,
      placeholder: 'spez',
      help: 'Index submissions by this Reddit user instead of a subreddit.',
    },
    {
      key: 'sort',
      label: 'Sort',
      type: 'select',
      required: false,
      default: 'hot',
      options: [
        { label: 'Hot', value: 'hot' },
        { label: 'New', value: 'new' },
        { label: 'Top', value: 'top' },
        { label: 'Rising', value: 'rising' },
      ],
      help: 'How to order subreddit posts. Defaults to hot.',
    },
    {
      key: 'limit',
      label: 'Limit',
      type: 'number',
      required: false,
      placeholder: '25',
      help: 'Maximum number of posts to fetch.',
    },
  ],
  async *pull(ctx) {
    const subreddit = String(ctx.config.subreddit ?? '').trim();
    const user = String(ctx.config.user ?? '').trim();
    if (!subreddit && !user) {
      throw new Error('reddit connector: config.subreddit or config.user is required');
    }
    const sort = String(ctx.config.sort ?? 'hot').trim() || 'hot';
    const rawLimit = Number(ctx.config.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 25;
    const params = new URLSearchParams({ limit: String(limit) });
    const url = user
      ? `https://www.reddit.com/user/${encodeURIComponent(user)}/submitted.json?${params}`
      : `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${encodeURIComponent(sort)}.json?${params}`;
    ctx.log?.('fetching reddit', { subreddit, user, sort, limit });
    const res = await fetchJson<{ data?: { children?: RedditChild[] } }>(url, {
      signal: ctx.signal,
    });
    for (const child of res.data?.children ?? []) {
      if (ctx.signal?.aborted) return;
      const doc = redditPostToDoc(child);
      if (doc) yield doc;
    }
  },
};
