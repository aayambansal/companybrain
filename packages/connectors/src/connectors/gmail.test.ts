import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseGmailMessage, gmailConnector } from './gmail.js';

// A text/plain body, base64url-encoded the way the Gmail API returns it.
const bodyText = 'Deploy went out at 3pm.\nLet me know if anything looks off.';
const bodyData = Buffer.from(bodyText, 'utf8').toString('base64url');

const sampleMessage = {
  id: 'msg-123',
  threadId: 'thread-9',
  snippet: 'Deploy went out at 3pm.',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'Subject', value: 'Release is live' },
      { name: 'From', value: 'Alice <alice@example.com>' },
      { name: 'Date', value: 'Wed, 22 Jul 2026 15:00:00 -0700' },
    ],
    parts: [
      { mimeType: 'text/plain', body: { data: bodyData } },
      {
        mimeType: 'text/html',
        body: { data: Buffer.from('<p>ignored</p>', 'utf8').toString('base64url') },
      },
    ],
  },
};

describe('parseGmailMessage', () => {
  it('maps subject, from, date, and decoded body into a document', () => {
    const doc = parseGmailMessage(sampleMessage);
    expect(doc.sourceId).toBe('msg-123');
    expect(doc.sourceType).toBe('email');
    expect(doc.title).toBe('Release is live');
    expect(doc.tags).toEqual(['gmail']);
    expect(doc.content).toContain('From: Alice <alice@example.com>');
    expect(doc.content).toContain('Date: Wed, 22 Jul 2026 15:00:00 -0700');
    expect(doc.content).toContain('Deploy went out at 3pm.');
    expect(doc.content).toContain('Let me know if anything looks off.');
    expect(doc.metadata?.threadId).toBe('thread-9');
    expect(doc.sourceCreatedAt).toBeInstanceOf(Date);
  });

  it('falls back to the snippet and a placeholder subject when there is no body', () => {
    const doc = parseGmailMessage({
      id: 'm2',
      snippet: 'just a snippet',
      payload: { headers: [] },
    });
    expect(doc.title).toBe('(no subject)');
    expect(doc.content).toContain('just a snippet');
  });
});

function msg(id: string) {
  return {
    id,
    threadId: 't',
    snippet: 'body',
    payload: { headers: [{ name: 'Subject', value: 'Subject ' + id }], parts: [] },
  };
}

// Drive the connector's pull() to prove it paginates over nextPageToken.
describe('gmailConnector pull pagination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows nextPageToken to fetch messages across all pages', async () => {
    const listCalls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/messages?')) {
          listCalls.push(u);
          if (u.includes('pageToken=P2')) {
            return { ok: true, json: async () => ({ messages: [{ id: 'c' }] }) } as Response;
          }
          return {
            ok: true,
            json: async () => ({ messages: [{ id: 'a' }, { id: 'b' }], nextPageToken: 'P2' }),
          } as Response;
        }
        const id = u.match(/messages\/([^?]+)/)?.[1] ?? 'x';
        return { ok: true, json: async () => msg(id) } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = { config: { accessToken: 'tok', max: 0 }, log: () => {} } as any;
    const ids: string[] = [];
    for await (const d of gmailConnector.pull(ctx)) ids.push(d.sourceId!);

    expect(ids).toEqual(['a', 'b', 'c']);
    expect(listCalls.length).toBe(2);
  });

  it('stops at the configured max without fetching further', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/messages?')) {
          return {
            ok: true,
            json: async () => ({
              messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
              nextPageToken: 'P2',
            }),
          } as Response;
        }
        const id = u.match(/messages\/([^?]+)/)?.[1] ?? 'x';
        return { ok: true, json: async () => msg(id) } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = { config: { accessToken: 'tok', max: 2 }, log: () => {} } as any;
    const ids: string[] = [];
    for await (const d of gmailConnector.pull(ctx)) ids.push(d.sourceId!);

    expect(ids).toEqual(['a', 'b']);
  });
});
