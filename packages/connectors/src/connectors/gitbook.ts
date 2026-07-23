import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A node in the GitBook space content page tree (fields subset). */
export interface GitbookPage {
  id: string;
  title?: string;
  path?: string;
  pages?: GitbookPage[];
}

/** A flattened GitBook page reference. */
export interface FlatPage {
  id: string;
  title: string;
  path: string;
}

/** Pure: recursively flatten the GitBook page tree into a flat list. */
export function flattenPages(pages: GitbookPage[]): FlatPage[] {
  const out: FlatPage[] = [];
  for (const page of pages ?? []) {
    out.push({ id: page.id, title: page.title ?? 'Untitled', path: page.path ?? '' });
    if (page.pages && page.pages.length) out.push(...flattenPages(page.pages));
  }
  return out;
}

/** Pure: recursively extract readable text from a GitBook document node. */
export function gitbookDocumentText(document: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (typeof obj.text === 'string' && obj.text) parts.push(obj.text);
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'text') continue;
        walk(value);
      }
    }
  };
  walk(document);
  return parts.join('').trim();
}

/** Pure: map a GitBook page plus its extracted text into a SourceDocument. */
export function gitbookPageDoc(page: FlatPage, text: string): SourceDocument {
  return {
    sourceId: page.id,
    sourceType: 'gitbook',
    title: page.title,
    content: text,
    tags: ['gitbook'],
    metadata: { id: page.id, path: page.path },
  };
}

export const gitbookConnector: Connector = {
  id: 'gitbook',
  displayName: 'GitBook',
  description: 'Index pages from a GitBook space via the API.',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: 'gb_api_...',
      help: 'Create a personal access token at app.gitbook.com > Developer settings.',
    },
    {
      key: 'spaceId',
      label: 'Space ID',
      type: 'string',
      required: true,
      placeholder: 'abc123...',
      help: 'The id of the GitBook space to index.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    const spaceId = String(ctx.config.spaceId ?? '').trim();
    if (!token) throw new Error('gitbook connector: config.token is required');
    if (!spaceId) throw new Error('gitbook connector: config.spaceId is required');
    const headers = { authorization: `Bearer ${token}` };

    ctx.log?.('fetching gitbook content tree', { spaceId });
    const tree = await fetchJson<{ pages?: GitbookPage[] }>(
      `https://api.gitbook.com/v1/spaces/${encodeURIComponent(spaceId)}/content`,
      { headers, signal: ctx.signal },
    );
    const pages = flattenPages(tree.pages ?? []);

    for (const page of pages) {
      if (ctx.signal?.aborted) return;
      let text = '';
      try {
        const res = await fetchJson<{ document?: unknown }>(
          `https://api.gitbook.com/v1/spaces/${encodeURIComponent(spaceId)}/content/page/${encodeURIComponent(page.id)}`,
          { headers, signal: ctx.signal },
        );
        text = gitbookDocumentText(res.document);
      } catch (err) {
        ctx.log?.('skipped gitbook page body', { id: page.id, error: String(err) });
      }
      if (!text) text = [page.title, page.path].filter(Boolean).join('\n');
      yield gitbookPageDoc(page, text);
    }
  },
};
