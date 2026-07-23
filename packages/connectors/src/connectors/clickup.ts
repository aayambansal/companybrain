import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single ClickUp task as returned by API v2 (fields subset). */
export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  url?: string;
  date_updated?: string;
}

interface ClickUpTasksResponse {
  tasks?: ClickUpTask[];
  last_page?: boolean;
}

/** Pure: map a ClickUp task into a SourceDocument. Unit-testable. */
export function clickupTaskDoc(task: ClickUpTask): SourceDocument {
  const content = [task.name, task.text_content || task.description].filter(Boolean).join('\n\n');
  return {
    sourceId: task.id,
    sourceType: 'clickup_task',
    sourceUrl: task.url,
    title: task.name,
    content,
    tags: ['clickup'],
    metadata: { id: task.id },
    sourceUpdatedAt: task.date_updated ? new Date(Number(task.date_updated)) : undefined,
  };
}

export const clickupConnector: Connector = {
  id: 'clickup',
  displayName: 'ClickUp',
  description: 'Index tasks (name + description) from a ClickUp list via a personal token.',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: 'pk_...',
      help: 'A ClickUp personal API token (Settings > Apps).',
    },
    {
      key: 'listId',
      label: 'List ID',
      type: 'string',
      required: true,
      placeholder: '901234567',
      help: 'The id of the ClickUp list whose tasks should be indexed.',
    },
  ],
  async *pull(ctx) {
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    const listId = String(ctx.config.listId ?? '').trim();
    if (!apiToken) throw new Error('clickup connector: config.apiToken is required');
    if (!listId) throw new Error('clickup connector: config.listId is required');
    const headers = { authorization: apiToken };

    let page = 0;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const url = `https://api.clickup.com/api/v2/list/${encodeURIComponent(listId)}/task?page=${page}`;
      ctx.log?.('fetching clickup tasks', { listId, page });
      const res = await fetchJson<ClickUpTasksResponse>(url, { headers, signal: ctx.signal });
      for (const task of res.tasks ?? []) {
        if (ctx.signal?.aborted) return;
        yield clickupTaskDoc(task);
      }
      if (res.last_page) return;
      page += 1;
    }
  },
};
