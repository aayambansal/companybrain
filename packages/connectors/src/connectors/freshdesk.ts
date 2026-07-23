import { type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface FreshdeskTicket {
  id: number;
  subject?: string;
  description_text?: string;
  created_at?: string;
}

/** Pure: turn a Freshdesk ticket into a SourceDocument. */
export function freshdeskTicketDoc(ticket: FreshdeskTicket, domain: string): SourceDocument {
  return {
    sourceId: String(ticket.id),
    sourceType: 'freshdesk_ticket',
    sourceUrl: `https://${domain}.freshdesk.com/a/tickets/${ticket.id}`,
    title: ticket.subject,
    content: [ticket.subject, ticket.description_text].filter(Boolean).join('\n\n'),
    tags: ['freshdesk'],
    metadata: { id: ticket.id },
    sourceCreatedAt: ticket.created_at ? new Date(ticket.created_at) : undefined,
  };
}

function basicAuth(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:X`).toString('base64');
}

export const freshdeskConnector: Connector = {
  id: 'freshdesk',
  displayName: 'Freshdesk',
  description: 'Index Freshdesk support tickets via the REST API (domain + API key).',
  category: 'chat',
  auth: 'apiKey',
  configSchema: [
    { key: 'domain', label: 'Domain', type: 'string', required: true, placeholder: 'acme', help: 'The <domain> in https://<domain>.freshdesk.com.' },
    { key: 'apiKey', label: 'API key', type: 'password', required: true, help: 'Find under Freshdesk > Profile settings > Your API Key.' },
  ],
  async *pull(ctx) {
    const domain = String(ctx.config.domain ?? '').trim();
    const apiKey = String(ctx.config.apiKey ?? '').trim();
    if (!domain || !apiKey) throw new Error('freshdesk connector: domain and apiKey are required');
    const headers = { authorization: basicAuth(apiKey) };

    for (let page = 1; ; page++) {
      if (ctx.signal?.aborted) return;
      const url = `https://${domain}.freshdesk.com/api/v2/tickets?per_page=100&page=${page}`;
      const tickets = await fetchJson<FreshdeskTicket[]>(url, { headers, signal: ctx.signal });
      if (!tickets.length) return;
      for (const ticket of tickets) yield freshdeskTicketDoc(ticket, domain);
    }
  },
};
