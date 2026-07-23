import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const API_BASE = 'https://api.box.com/2.0';

interface BoxItem {
  type?: string;
  id?: string;
  name?: string;
  modified_at?: string;
}

interface BoxItems {
  entries?: BoxItem[];
}

/** Pure: turn a Box item plus its text into a SourceDocument. Unit-testable. */
export function boxItemToDoc(item: BoxItem, text: string): SourceDocument {
  const updated = item.modified_at ? new Date(item.modified_at) : undefined;
  return {
    sourceId: item.id,
    sourceType: 'box',
    title: item.name ?? 'Untitled',
    content: text,
    tags: ['box'],
    metadata: { fileId: item.id },
    sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
  };
}

/** Pure: is this a plain-text or markdown file we can read as-is? */
function isTextItem(item: BoxItem): boolean {
  if (item.type !== 'file') return false;
  const name = (item.name ?? '').toLowerCase();
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown');
}

/** Download the raw text content of a file via the Box content endpoint. */
async function downloadText(
  item: BoxItem,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${API_BASE}/files/${item.id}/content`;
  const res = await fetch(url, {
    signal,
    redirect: 'follow',
    headers: { ...headers, accept: '*/*' },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

export const boxConnector: Connector = {
  id: 'box',
  displayName: 'Box',
  description: 'Index text and markdown files from Box via the API v2 with an OAuth access token.',
  category: 'files',
  auth: 'oauth',
  configSchema: [
    {
      key: 'accessToken',
      label: 'OAuth access token',
      type: 'password',
      required: true,
      placeholder: 'eyJ0....',
      help: 'A Box OAuth 2.0 access token with read access.',
    },
    {
      key: 'folderId',
      label: 'Folder ID',
      type: 'string',
      required: false,
      placeholder: '0',
      help: 'Optional Box folder ID to index. Defaults to the root folder (0).',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.accessToken ?? '').trim();
    if (!token) throw new Error('box connector: config.accessToken is required');
    const rootId = String(ctx.config.folderId ?? '').trim() || '0';
    const headers = { authorization: `Bearer ${token}` };

    const queue: string[] = [rootId];
    while (queue.length) {
      if (ctx.signal?.aborted) return;
      const folderId = queue.shift()!;
      const params = new URLSearchParams({ fields: 'id,name,type,modified_at', limit: '1000' });
      const page = await fetchJson<BoxItems>(`${API_BASE}/folders/${folderId}/items?${params}`, {
        headers,
        signal: ctx.signal,
      });
      for (const item of page.entries ?? []) {
        if (ctx.signal?.aborted) return;
        if (item.type === 'folder' && item.id) {
          queue.push(item.id);
        } else if (isTextItem(item)) {
          try {
            const text = await downloadText(item, headers, ctx.signal);
            yield boxItemToDoc(item, text);
          } catch (err) {
            ctx.log?.('skipped box file', { id: item.id, error: String(err) });
          }
        }
      }
    }
  },
};
