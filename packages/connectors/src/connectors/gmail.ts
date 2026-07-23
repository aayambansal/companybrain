import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface GmailHeader {
  name?: string;
  value?: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
}
interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailPart;
}

/** Pure: case-insensitive lookup of a header value. */
function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const lower = name.toLowerCase();
  for (const h of headers ?? []) {
    if ((h.name ?? '').toLowerCase() === lower) return h.value ?? '';
  }
  return '';
}

/** Pure: base64url-decode a Gmail body payload to UTF-8 text. */
function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

/** Pure: walk the payload parts and return the first text/plain body, decoded. */
function extractText(part: GmailPart | undefined): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const sub of part.parts ?? []) {
    const text = extractText(sub);
    if (text) return text;
  }
  return '';
}

/** Pure: turn a full Gmail message into a SourceDocument. Unit-testable. */
export function parseGmailMessage(msg: GmailMessage): SourceDocument {
  const headers = msg.payload?.headers;
  const subject = headerValue(headers, 'Subject') || '(no subject)';
  const from = headerValue(headers, 'From');
  const date = headerValue(headers, 'Date');
  const body = extractText(msg.payload).trim() || (msg.snippet ?? '').trim();

  const lines: string[] = [];
  if (from) lines.push(`From: ${from}`);
  if (date) lines.push(`Date: ${date}`);
  if (body) {
    if (lines.length) lines.push('');
    lines.push(body);
  }

  const when = date ? new Date(date) : undefined;
  return {
    sourceId: msg.id,
    sourceType: 'email',
    title: subject,
    content: lines.join('\n'),
    tags: ['gmail'],
    metadata: { from, date, threadId: msg.threadId },
    sourceCreatedAt: when && !Number.isNaN(when.getTime()) ? when : undefined,
  };
}

export const gmailConnector: Connector = {
  id: 'gmail',
  displayName: 'Gmail',
  description: 'Index Gmail messages via the Gmail REST API with an OAuth access token.',
  category: 'chat',
  auth: 'oauth',
  configSchema: [
    { key: 'accessToken', label: 'OAuth access token', type: 'password', required: true, placeholder: 'ya29....', help: 'A Google OAuth 2.0 access token with the gmail.readonly scope.' },
    { key: 'query', label: 'Search query', type: 'string', required: false, placeholder: 'in:inbox', help: 'A Gmail search string. Defaults to in:inbox.' },
    { key: 'max', label: 'Max messages', type: 'number', required: false, placeholder: '50', help: 'Maximum number of messages to fetch.' },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.accessToken ?? '').trim();
    if (!token) throw new Error('gmail connector: config.accessToken is required');
    const query = String(ctx.config.query ?? 'in:inbox').trim() || 'in:inbox';
    const max = Number(ctx.config.max ?? 0);
    const headers = { authorization: `Bearer ${token}` };

    const params = new URLSearchParams({ q: query });
    if (max > 0) params.set('maxResults', String(max));
    const list = await fetchJson<{ messages?: { id: string }[] }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers, signal: ctx.signal },
    );

    for (const m of list.messages ?? []) {
      if (ctx.signal?.aborted) return;
      const full = await fetchJson<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers, signal: ctx.signal },
      );
      yield parseGmailMessage(full);
    }
  },
};
