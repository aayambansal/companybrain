import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Trello card as returned by the REST API (fields subset). */
export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  url?: string;
  dateLastActivity?: string;
}

/** Pure: map a Trello card into a SourceDocument. Unit-testable. */
export function trelloCardDoc(card: TrelloCard): SourceDocument {
  const content = [card.name, card.desc].filter(Boolean).join('\n\n');
  return {
    sourceId: card.id,
    sourceType: 'trello_card',
    sourceUrl: card.url,
    title: card.name,
    content,
    tags: ['trello'],
    metadata: { id: card.id },
    sourceUpdatedAt: card.dateLastActivity ? new Date(card.dateLastActivity) : undefined,
  };
}

export const trelloConnector: Connector = {
  id: 'trello',
  displayName: 'Trello',
  description: 'Index cards from a Trello board via the REST API.',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'string',
      required: true,
      placeholder: 'a1b2c3...',
      help: 'Your Trello API key (https://trello.com/app-key).',
    },
    {
      key: 'token',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: 'ATTA...',
      help: 'A Trello API token authorized for your account.',
    },
    {
      key: 'boardId',
      label: 'Board ID',
      type: 'string',
      required: true,
      placeholder: '5abbe4b7 ...',
      help: 'The id of the board whose cards should be indexed.',
    },
  ],
  async *pull(ctx) {
    const apiKey = String(ctx.config.apiKey ?? '').trim();
    const token = String(ctx.config.token ?? '').trim();
    const boardId = String(ctx.config.boardId ?? '').trim();
    if (!apiKey) throw new Error('trello connector: config.apiKey is required');
    if (!token) throw new Error('trello connector: config.token is required');
    if (!boardId) throw new Error('trello connector: config.boardId is required');

    const params = new URLSearchParams({
      key: apiKey,
      token,
      fields: 'name,desc,url,dateLastActivity',
    });
    const url = `https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/cards?${params}`;
    ctx.log?.('fetching trello cards', { boardId });
    const cards = await fetchJson<TrelloCard[]>(url, { signal: ctx.signal });
    for (const card of cards) {
      if (ctx.signal?.aborted) return;
      yield trelloCardDoc(card);
    }
  },
};
