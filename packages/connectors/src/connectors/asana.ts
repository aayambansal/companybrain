import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Asana task as returned by the REST API (fields subset). */
export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  permalink_url?: string;
  modified_at?: string;
}

interface AsanaTasksResponse {
  data?: AsanaTask[];
  next_page?: { offset: string } | null;
}

/** Pure: map an Asana task into a SourceDocument. Unit-testable. */
export function asanaTaskDoc(task: AsanaTask): SourceDocument {
  const content = [task.name, task.notes].filter(Boolean).join('\n\n');
  return {
    sourceId: task.gid,
    sourceType: 'asana_task',
    sourceUrl: task.permalink_url,
    title: task.name,
    content,
    tags: ['asana'],
    metadata: { gid: task.gid },
    sourceUpdatedAt: task.modified_at ? new Date(task.modified_at) : undefined,
  };
}

export const asanaConnector: Connector = {
  id: 'asana',
  displayName: 'Asana',
  description: 'Index tasks (name + notes) from an Asana project via a personal access token.',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'accessToken',
      label: 'Personal access token',
      type: 'password',
      required: true,
      placeholder: '1/1234...',
      help: 'An Asana personal access token (Settings > Apps > Developer apps).',
    },
    {
      key: 'projectId',
      label: 'Project ID',
      type: 'string',
      required: true,
      placeholder: '1200000000000000',
      help: 'The gid of the Asana project whose tasks should be indexed.',
    },
  ],
  async *pull(ctx) {
    const accessToken = String(ctx.config.accessToken ?? '').trim();
    const projectId = String(ctx.config.projectId ?? '').trim();
    if (!accessToken) throw new Error('asana connector: config.accessToken is required');
    if (!projectId) throw new Error('asana connector: config.projectId is required');
    const headers = { authorization: `Bearer ${accessToken}` };

    let offset: string | undefined;
    do {
      if (ctx.signal?.aborted) return;
      let url = `https://app.asana.com/api/1.0/projects/${encodeURIComponent(projectId)}/tasks?opt_fields=name,notes,permalink_url,modified_at&limit=100`;
      if (offset) url += `&offset=${encodeURIComponent(offset)}`;
      ctx.log?.('fetching asana tasks', { projectId });
      const res = await fetchJson<AsanaTasksResponse>(url, { headers, signal: ctx.signal });
      for (const task of res.data ?? []) {
        if (ctx.signal?.aborted) return;
        yield asanaTaskDoc(task);
      }
      offset = res.next_page?.offset;
    } while (offset);
  },
};
