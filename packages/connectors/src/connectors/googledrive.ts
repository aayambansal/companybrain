import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const DEFAULT_QUERY = "mimeType != 'application/vnd.google-apps.folder'";

interface DriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface DriveFileList {
  files?: DriveFile[];
  nextPageToken?: string;
}

/** Pure: turn a Drive file plus its exported text into a SourceDocument. Unit-testable. */
export function driveFileToDoc(file: DriveFile, text: string): SourceDocument {
  const updated = file.modifiedTime ? new Date(file.modifiedTime) : undefined;
  return {
    sourceId: file.id,
    sourceType: 'gdrive',
    sourceUrl: file.webViewLink,
    title: file.name ?? 'Untitled',
    content: text,
    tags: ['google-drive'],
    metadata: { fileId: file.id, mimeType: file.mimeType },
    sourceUpdatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : undefined,
  };
}

/** Pure: does this mime type look like plain text or markdown we can read as-is? */
function isTextMime(mime: string | undefined): boolean {
  return !!mime && mime.startsWith('text/');
}

/**
 * Fetch the readable text for a file, or null when it is a binary we cannot export.
 * Google Docs are exported to text/plain; text/markdown files are read via alt=media.
 */
async function exportDriveText(
  file: DriveFile,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<string | null> {
  let url: string;
  if (file.mimeType === GOOGLE_DOC_MIME) {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
  } else if (isTextMime(file.mimeType)) {
    url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  } else {
    return null;
  }
  const res = await fetch(url, { headers: { ...headers, accept: '*/*' }, signal, redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

export const googleDriveConnector: Connector = {
  id: 'googledrive',
  displayName: 'Google Drive',
  description: 'Index files from Google Drive via the Drive REST API with an OAuth access token.',
  category: 'files',
  auth: 'oauth',
  configSchema: [
    { key: 'accessToken', label: 'OAuth access token', type: 'password', required: true, placeholder: 'ya29....', help: 'A Google OAuth 2.0 access token with the drive.readonly scope.' },
    { key: 'query', label: 'Drive query', type: 'string', required: false, placeholder: DEFAULT_QUERY, help: 'A Google Drive v3 files.list query. Defaults to excluding folders.' },
    { key: 'max', label: 'Max files', type: 'number', required: false, placeholder: '50', help: 'Maximum number of files to fetch.' },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.accessToken ?? '').trim();
    if (!token) throw new Error('googledrive connector: config.accessToken is required');
    const query = String(ctx.config.query ?? DEFAULT_QUERY).trim() || DEFAULT_QUERY;
    const max = Number(ctx.config.max ?? 0);
    const headers = { authorization: `Bearer ${token}` };

    let fetched = 0;
    let pageToken: string | undefined;
    do {
      const pageSize = max > 0 ? Math.min(100, max - fetched) : 100;
      const params = new URLSearchParams({
        q: query,
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',
        pageSize: String(pageSize),
      });
      if (pageToken) params.set('pageToken', pageToken);
      const list = await fetchJson<DriveFileList>(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers, signal: ctx.signal },
      );

      for (const file of list.files ?? []) {
        if (ctx.signal?.aborted) return;
        if (max > 0 && fetched >= max) return;
        let text: string | null;
        try {
          text = await exportDriveText(file, headers, ctx.signal);
        } catch (err) {
          ctx.log?.('skipped drive file', { id: file.id, error: String(err) });
          continue;
        }
        if (text === null) {
          ctx.log?.('skipped drive file', { id: file.id, mimeType: file.mimeType });
          continue;
        }
        fetched += 1;
        yield driveFileToDoc(file, text);
      }
      pageToken = list.nextPageToken;
    } while (pageToken && (max <= 0 || fetched < max));
  },
};
