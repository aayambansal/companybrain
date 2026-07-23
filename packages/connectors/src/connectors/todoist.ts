import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Todoist task as returned by REST API v2 (fields subset). */
export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  url?: string;
  created_at?: string;
}

/** Pure: map a Todoist task into a SourceDocument. Unit-testable. */
export function todoistTaskDoc(task: TodoistTask): SourceDocument {
  const content = [task.content, task.description].filter(Boolean).join('\n\n');
  return {
    sourceId: task.id,
    sourceType: 'todoist_task',
    sourceUrl: task.url,
    title: task.content,
    content,
    tags: ['todoist'],
    metadata: { id: task.id },
    sourceCreatedAt: task.created_at ? new Date(task.created_at) : undefined,
  };
}

export const todoistConnector: Connector = {
  id: 'todoist',
  displayName: 'Todoist',
  description: 'Index active tasks (content + description) from Todoist via a personal token.',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: '0123456789abcdef...',
      help: 'A Todoist API token (Settings > Integrations > Developer).',
    },
    {
      key: 'projectId',
      label: 'Project ID',
      type: 'string',
      required: false,
      placeholder: '2203306141',
      help: 'Optional: restrict indexing to a single Todoist project id.',
    },
  ],
  async *pull(ctx) {
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    const projectId = String(ctx.config.projectId ?? '').trim();
    if (!apiToken) throw new Error('todoist connector: config.apiToken is required');
    const headers = { authorization: `Bearer ${apiToken}` };

    let url = 'https://api.todoist.com/rest/v2/tasks';
    if (projectId) url += `?project_id=${encodeURIComponent(projectId)}`;
    ctx.log?.('fetching todoist tasks', { projectId: projectId || undefined });
    const tasks = await fetchJson<TodoistTask[]>(url, { headers, signal: ctx.signal });
    for (const task of tasks) {
      if (ctx.signal?.aborted) return;
      yield todoistTaskDoc(task);
    }
  },
};
