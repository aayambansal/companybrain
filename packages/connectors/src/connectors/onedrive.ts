import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me/drive';

interface OneDriveItem {
  id: string;
  name?: string;
  webUrl?: string;
  size?: number;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  '@microsoft.graph.downloadUrl'?: string;
}

interface GraphChildren {
  value?: OneDriveItem[];
  '@odata.nextLink'?: string;
}

/** Pure: turn a OneDrive item plus its text into a SourceDocument. Unit-testable. */
export function oneDriveItemToDoc(item: OneDriveItem, text: string): SourceDocument {
  const updated = item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined;
  return {
    sourceId: item.id,
    sourceType: 'onedrive',
    sourceUrl: item.webUrl,
    title: item.name ?? 'Untitled',
    content: text,
    tags: ['onedrive'],
    metadata: { itemId: item.id, mimeType: item.file?.mimeType },
    sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
  };
}

/** Pure: is this a plain-text or markdown file we can read? */
function isTextItem(item: OneDriveItem): boolean {
  if (!item.file) return false;
  const mime = item.file.mimeType ?? '';
  if (mime.startsWith('text/')) return true;
  const name = (item.name ?? '').toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
}

/** Download the text content of a file via its pre-authenticated URL or the /content endpoint. */
async function downloadText(
  item: OneDriveItem,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  if (downloadUrl) {
    const res = await fetch(downloadUrl, { signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`GET downloadUrl -> ${res.status} ${res.statusText}`);
    return res.text();
  }
  const url = `${GRAPH_BASE}/items/${item.id}/content`;
  const res = await fetch(url, { headers: { ...headers, accept: '*/*' }, signal, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

export const oneDriveConnector: Connector = {
  id: 'onedrive',
  displayName: 'OneDrive',
  description: 'Index text and markdown files from OneDrive via Microsoft Graph with an OAuth access token.',
  category: 'files',
  auth: 'oauth',
  configSchema: [
    { key: 'accessToken', label: 'OAuth access token', type: 'password', required: true, placeholder: 'eyJ0....', help: 'A Microsoft Graph OAuth 2.0 access token with the Files.Read scope.' },
    { key: 'folder', label: 'Folder path', type: 'string', required: false, placeholder: 'Documents/Notes', help: 'Optional folder path relative to the drive root. Defaults to the root.' },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.accessToken ?? '').trim();
    if (!token) throw new Error('onedrive connector: config.accessToken is required');
    const folder = String(ctx.config.folder ?? '').trim().replace(/^\/+|\/+$/g, '');
    const headers = { authorization: `Bearer ${token}` };

    const rootChildren = folder
      ? `${GRAPH_BASE}/root:/${encodeURI(folder)}:/children`
      : `${GRAPH_BASE}/root/children`;

    const queue: string[] = [rootChildren];
    while (queue.length) {
      if (ctx.signal?.aborted) return;
      let next: string | undefined = queue.shift();
      while (next) {
        if (ctx.signal?.aborted) return;
        const page = await fetchJson<GraphChildren>(next, { headers, signal: ctx.signal });
        for (const item of page.value ?? []) {
          if (ctx.signal?.aborted) return;
          if (item.folder) {
            queue.push(`${GRAPH_BASE}/items/${item.id}/children`);
          } else if (isTextItem(item)) {
            try {
              const text = await downloadText(item, headers, ctx.signal);
              yield oneDriveItemToDoc(item, text);
            } catch (err) {
              ctx.log?.('skipped onedrive file', { id: item.id, error: String(err) });
            }
          }
        }
        next = page['@odata.nextLink'];
      }
    }
  },
};
