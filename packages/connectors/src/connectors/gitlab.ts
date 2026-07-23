import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single GitLab issue as returned by the REST API (fields subset). */
export interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  description?: string;
  web_url?: string;
  updated_at?: string;
}

/** Pure: map a GitLab issue into a SourceDocument. Unit-testable. */
export function gitlabIssueDoc(issue: GitLabIssue): SourceDocument {
  const content = [issue.title, issue.description].filter(Boolean).join('\n\n');
  return {
    sourceId: String(issue.id),
    sourceType: 'gitlab_issue',
    sourceUrl: issue.web_url,
    title: `#${issue.iid} ${issue.title}`,
    content,
    tags: ['gitlab'],
    metadata: { id: issue.id, iid: issue.iid },
    sourceUpdatedAt: issue.updated_at ? new Date(issue.updated_at) : undefined,
  };
}

export const gitlabConnector: Connector = {
  id: 'gitlab',
  displayName: 'GitLab',
  description: 'Index issues (title + description) from a GitLab project via a personal access token.',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Personal access token',
      type: 'password',
      required: true,
      placeholder: 'glpat-...',
      help: 'A GitLab personal access token with read access to the project.',
    },
    {
      key: 'projectId',
      label: 'Project ID',
      type: 'string',
      required: true,
      placeholder: '12345 or group/project',
      help: 'The numeric project id, or the URL-encoded "group/project" path.',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'string',
      required: false,
      placeholder: 'https://gitlab.com',
      help: 'For self-hosted GitLab. Defaults to https://gitlab.com.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    const projectId = String(ctx.config.projectId ?? '').trim();
    if (!token) throw new Error('gitlab connector: config.token is required');
    if (!projectId) throw new Error('gitlab connector: config.projectId is required');
    const baseUrl = (ctx.config.baseUrl ? String(ctx.config.baseUrl) : 'https://gitlab.com').replace(/\/$/, '');
    const headers = { 'PRIVATE-TOKEN': token };

    for (let page = 1; ; page++) {
      if (ctx.signal?.aborted) return;
      const url = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues?per_page=100&page=${page}`;
      ctx.log?.('fetching gitlab issues', { projectId, page });
      const issues = await fetchJson<GitLabIssue[]>(url, { headers, signal: ctx.signal });
      if (!issues.length) return;
      for (const issue of issues) {
        if (ctx.signal?.aborted) return;
        yield gitlabIssueDoc(issue);
      }
    }
  },
};
