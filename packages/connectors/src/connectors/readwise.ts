import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single highlight within a Readwise book/article. */
export interface ReadwiseHighlight {
  id: number;
  text: string;
  note?: string;
  updated?: string;
}

/** A "book" (or article/podcast) grouping its highlights, from the export API. */
export interface ReadwiseBook {
  user_book_id?: number;
  title: string;
  author?: string;
  source_url?: string;
  highlights?: ReadwiseHighlight[];
}

/** The paginated payload from the Readwise export endpoint. */
export interface ReadwiseExport {
  results?: ReadwiseBook[];
  nextPageCursor?: string | null;
}

/**
 * Pure: group a Readwise book's highlights into a single SourceDocument. The
 * content is an author line followed by each highlight's text (and note, when
 * present), joined by blank lines. Unit-testable with an inline book.
 */
export function readwiseBookDoc(book: ReadwiseBook): SourceDocument {
  const parts: string[] = [];
  if (book.author) parts.push(`by ${book.author}`);
  for (const highlight of book.highlights ?? []) {
    const block = highlight.note ? `${highlight.text}\n\nNote: ${highlight.note}` : highlight.text;
    if (block) parts.push(block);
  }
  return {
    sourceId: String(book.user_book_id ?? book.title),
    sourceType: 'readwise',
    sourceUrl: book.source_url,
    title: book.title,
    content: parts.join('\n\n'),
    tags: ['readwise'],
    metadata: {
      userBookId: book.user_book_id,
      author: book.author,
      highlightCount: (book.highlights ?? []).length,
    },
  };
}

export const readwiseConnector: Connector = {
  id: 'readwise',
  displayName: 'Readwise',
  description: 'Index your Readwise highlights, grouped one document per book or article.',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Access token',
      type: 'password',
      required: true,
      placeholder: 'readwise access token',
      help: 'Get your token from https://readwise.io/access_token.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    if (!token) throw new Error('readwise connector: config.token is required');
    const headers = { authorization: `Token ${token}` };

    let cursor: string | undefined;
    do {
      const params = new URLSearchParams();
      if (cursor) params.set('pageCursor', cursor);
      const qs = params.toString();
      const url = `https://readwise.io/api/v2/export/${qs ? `?${qs}` : ''}`;
      ctx.log?.('fetching readwise export', { cursor });
      const res = await fetchJson<ReadwiseExport>(url, { headers, signal: ctx.signal });
      for (const book of res.results ?? []) {
        if (ctx.signal?.aborted) return;
        yield readwiseBookDoc(book);
      }
      cursor = res.nextPageCursor ?? undefined;
      if (cursor) await ctx.setCursor?.(cursor);
    } while (cursor);
  },
};
