import { describe, it, expect, vi, afterEach } from 'vitest';
import { freshdeskTicketDoc, freshdeskConnector } from './freshdesk.js';

describe('freshdeskTicketDoc', () => {
  const ticket = {
    id: 42,
    subject: 'Cannot log in',
    description_text: 'The password reset email never arrives.',
    created_at: '2024-01-16T03:20:00Z',
  };

  it('maps the fields onto a SourceDocument', () => {
    const doc = freshdeskTicketDoc(ticket, 'acme');
    expect(doc.sourceId).toBe('42');
    expect(doc.sourceType).toBe('freshdesk_ticket');
    expect(doc.sourceUrl).toBe('https://acme.freshdesk.com/a/tickets/42');
    expect(doc.title).toBe('Cannot log in');
    expect(doc.tags).toEqual(['freshdesk']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-01-16T03:20:00.000Z');
  });

  it('joins the subject and description into the content', () => {
    const doc = freshdeskTicketDoc(ticket, 'acme');
    expect(doc.content).toBe('Cannot log in\n\nThe password reset email never arrives.');
  });

  it('drops falsy parts when building the content', () => {
    const doc = freshdeskTicketDoc({ id: 7, subject: 'Only a subject' }, 'acme');
    expect(doc.content).toBe('Only a subject');
  });

  it('tolerates a missing subject, description, and timestamp', () => {
    const doc = freshdeskTicketDoc({ id: 9 }, 'acme');
    expect(doc.sourceId).toBe('9');
    expect(doc.content).toBe('');
    expect(doc.sourceUrl).toBe('https://acme.freshdesk.com/a/tickets/9');
    expect(doc.sourceCreatedAt).toBeUndefined();
  });
});

describe('freshdeskConnector pull pagination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('walks pages until an empty page and yields every ticket', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const page = Number(String(url).match(/[?&]page=(\d+)/)?.[1] ?? '1');
        const body =
          page === 1
            ? [
                { id: 1, subject: 'A' },
                { id: 2, subject: 'B' },
              ]
            : [];
        return { ok: true, json: async () => body } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = { config: { domain: 'acme', apiKey: 'k' }, log: () => {} } as any;
    const ids: string[] = [];
    for await (const d of freshdeskConnector.pull(ctx)) ids.push(d.sourceId!);

    expect(ids).toEqual(['1', '2']);
  });
});
