import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const LIST_URL = 'https://api.dropboxapi.com/2/files/list_folder';
const CONTINUE_URL = 'https://api.dropboxapi.com/2/files/list_folder/continue';
const DOWNLOAD_URL = 'https://content.dropboxapi.com/2/files/download';

interface DropboxEntry {
  '.tag'?: string;
  id?: string;
  name?: string;
  path_lower?: string;
  client_modified?: string;
}

interface DropboxList {
  entries?: DropboxEntry[];
  cursor?: string;
  has_more?: boolean;
}

/** Pure: turn a Dropbox entry plus its text into a SourceDocument. Unit-testable. */
export function dropboxEntryToDoc(entry: DropboxEntry, text: string): SourceDocument {
  const updated = entry.client_modified ? new Date(entry.client_modified) : undefined;
  return {
    sourceId: entry.id,
    sourceType: 'dropbox',
    title: entry.name ?? 'Untitled',
    content: text,
    tags: ['dropbox'],
    metadata: { fileId: entry.id, path: entry.path_lower },
    sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
  };
}

/** Pure: is this a plain-text or markdown file we can read as-is? */
function isTextEntry(entry: DropboxEntry): boolean {
  if (entry['.tag'] !== 'file') return false;
  const name = (entry.name ?? '').toLowerCase();
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown');
}

/** Download the raw text content of a file via the Dropbox content endpoint. */
async function downloadText(
  entry: DropboxEntry,
  token: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(DOWNLOAD_URL, {
    method: 'POST',
    signal,
    redirect: 'follow',
    headers: {
      authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: entry.path_lower ?? '' }),
    },
  });
  if (!res.ok) throw new Error(`POST ${DOWNLOAD_URL} -> ${res.status} ${res.statusText}`);
  return res.text();
}

export const dropboxConnector: Connector = {
  id: 'dropbox',
  displayName: 'Dropbox',
  description:
    'Index text and markdown files from Dropbox via the API v2 with an OAuth access token.',
  category: 'files',
  auth: 'oauth',
  configSchema: [
    {
      key: 'accessToken',
      label: 'OAuth access token',
      type: 'password',
      required: true,
      placeholder: 'sl....',
      help: 'A Dropbox OAuth 2.0 access token with the files.content.read scope.',
    },
    {
      key: 'path',
      label: 'Folder path',
      type: 'string',
      required: false,
      placeholder: '/Notes',
      help: 'Optional folder path to index. Defaults to the root.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.accessToken ?? '').trim();
    if (!token) throw new Error('dropbox connector: config.accessToken is required');
    const path = String(ctx.config.path ?? '').trim();
    const headers = { authorization: `Bearer ${token}` };

    let list = await fetchJson<DropboxList>(LIST_URL, {
      method: 'POST',
      headers,
      body: { path, recursive: true },
      signal: ctx.signal,
    });

    while (true) {
      for (const entry of list.entries ?? []) {
        if (ctx.signal?.aborted) return;
        if (!isTextEntry(entry)) continue;
        try {
          const text = await downloadText(entry, token, ctx.signal);
          yield dropboxEntryToDoc(entry, text);
        } catch (err) {
          ctx.log?.('skipped dropbox file', { id: entry.id, error: String(err) });
        }
      }
      if (!list.has_more || !list.cursor) break;
      if (ctx.signal?.aborted) return;
      list = await fetchJson<DropboxList>(CONTINUE_URL, {
        method: 'POST',
        headers,
        body: { cursor: list.cursor },
        signal: ctx.signal,
      });
    }
  },
};
