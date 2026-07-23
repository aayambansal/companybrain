import { describe, it, expect } from 'vitest';
import { parseGmailMessage } from './gmail.js';

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
