import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const NOTION_VERSION = '2022-06-28';

interface RichText {
  plain_text?: string;
}
interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

/** Pure: flatten a page's rich_text properties into a title string. */
export function notionPageTitle(page: { properties?: Record<string, unknown> }): string {
  const props = page.properties ?? {};
  for (const value of Object.values(props)) {
    const v = value as { type?: string; title?: RichText[] };
    if (v?.type === 'title' && Array.isArray(v.title)) {
      const t = v.title
        .map((r) => r.plain_text ?? '')
        .join('')
        .trim();
      if (t) return t;
    }
  }
  return 'Untitled';
}

/** Pure: convert a list of Notion blocks into readable text. Unit-testable. */
export function blocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const body = block[block.type] as { rich_text?: RichText[] } | undefined;
    const text = (body?.rich_text ?? []).map((r) => r.plain_text ?? '').join('');
    switch (block.type) {
      case 'heading_1':
        lines.push(`# ${text}`);
        break;
      case 'heading_2':
        lines.push(`## ${text}`);
        break;
      case 'heading_3':
        lines.push(`### ${text}`);
        break;
      case 'bulleted_list_item':
      case 'numbered_list_item':
        lines.push(`- ${text}`);
        break;
      case 'to_do': {
        const checked = (body as { checked?: boolean } | undefined)?.checked ? 'x' : ' ';
        lines.push(`- [${checked}] ${text}`);
        break;
      }
      case 'quote':
        lines.push(`> ${text}`);
        break;
      case 'code':
        lines.push('```\n' + text + '\n```');
        break;
      case 'divider':
        lines.push('---');
        break;
      default:
        if (text) lines.push(text);
    }
  }
  return lines.join('\n').trim();
}

function headers(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'notion-version': NOTION_VERSION };
}

export const notionConnector: Connector = {
  id: 'notion',
  displayName: 'Notion',
  description: 'Index pages shared with a Notion internal integration.',
  category: 'docs',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Integration token',
      type: 'password',
      required: true,
      placeholder: 'secret_...',
      help: 'Create an internal integration in Notion and share pages with it.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    if (!token) throw new Error('notion connector: config.token is required');
    const h = headers(token);

    let cursor: string | undefined;
    do {
      const search = await fetchJson<{
        results: {
          id: string;
          url?: string;
          properties?: Record<string, unknown>;
          last_edited_time?: string;
        }[];
        next_cursor: string | null;
        has_more: boolean;
      }>('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: h,
        body: {
          filter: { value: 'page', property: 'object' },
          page_size: 50,
          start_cursor: cursor,
        },
        signal: ctx.signal,
      });

      for (const page of search.results) {
        if (ctx.signal?.aborted) return;
        try {
          const blocks = await fetchJson<{ results: NotionBlock[] }>(
            `https://api.notion.com/v1/blocks/${page.id}/children?page_size=100`,
            { headers: h, signal: ctx.signal },
          );
          const content = blocksToText(blocks.results);
          const title = notionPageTitle(page);
          if (!content && title === 'Untitled') continue;
          yield {
            sourceId: page.id,
            sourceType: 'notion_page',
            sourceUrl: page.url,
            title,
            content: content || title,
            tags: ['notion'],
            metadata: { pageId: page.id },
            sourceUpdatedAt: page.last_edited_time ? new Date(page.last_edited_time) : undefined,
          } satisfies SourceDocument;
        } catch (err) {
          ctx.log?.('skipped notion page', { id: page.id, error: String(err) });
        }
      }
      cursor = search.has_more ? (search.next_cursor ?? undefined) : undefined;
      if (cursor) await ctx.setCursor?.(cursor);
    } while (cursor);
  },
};
