import { type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface FrontConversation {
  id: string;
  subject?: string;
  created_at?: number;
  _links?: { self?: string };
}

interface FrontConversationsResponse {
  _results?: FrontConversation[];
  _pagination?: { next?: string | null };
}

/** Pure: turn a Front conversation into a SourceDocument (subject-only MVP). */
export function frontConversationDoc(conv: FrontConversation): SourceDocument {
  return {
    sourceId: String(conv.id),
    sourceType: 'front_conversation',
    sourceUrl: conv._links?.self,
    title: conv.subject || 'Conversation',
    content: conv.subject || '',
    tags: ['front'],
    metadata: { id: conv.id },
    sourceCreatedAt: conv.created_at ? new Date(conv.created_at * 1000) : undefined,
  };
}

export const frontConnector: Connector = {
  id: 'front',
  displayName: 'Front',
  description: 'Index Front conversation subjects via the REST API (API token).',
  category: 'chat',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      help: 'Create under Front > Settings > Developers > API tokens.',
    },
  ],
  async *pull(ctx) {
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    if (!apiToken) throw new Error('front connector: config.apiToken is required');
    const headers = { authorization: `Bearer ${apiToken}` };

    let url: string | undefined = 'https://api2.frontapp.com/conversations?limit=100';
    while (url) {
      if (ctx.signal?.aborted) return;
      const res: FrontConversationsResponse = await fetchJson<FrontConversationsResponse>(url, {
        headers,
        signal: ctx.signal,
      });
      for (const conv of res._results ?? []) yield frontConversationDoc(conv);
      url = res._pagination?.next ?? undefined;
    }
  },
};
