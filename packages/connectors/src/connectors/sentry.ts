import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Sentry issue as returned by the API (fields subset). */
export interface SentryIssue {
  id: string;
  title: string;
  culprit?: string;
  permalink?: string;
  lastSeen?: string;
  count?: number | string;
}

/** Pure: map a Sentry issue into a SourceDocument. Unit-testable. */
export function sentryIssueDoc(issue: SentryIssue): SourceDocument {
  const content = [issue.title, issue.culprit, `seen ${issue.count} times`].filter(Boolean).join('\n\n');
  return {
    sourceId: issue.id,
    sourceType: 'sentry_issue',
    sourceUrl: issue.permalink,
    title: issue.title,
    content,
    tags: ['sentry'],
    metadata: { id: issue.id, count: issue.count },
    sourceUpdatedAt: issue.lastSeen ? new Date(issue.lastSeen) : undefined,
  };
}

export const sentryConnector: Connector = {
  id: 'sentry',
  displayName: 'Sentry',
  description: 'Index issues (title + culprit) from a Sentry project via an auth token.',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Auth token',
      type: 'password',
      required: true,
      placeholder: 'sntrys_...',
      help: 'A Sentry auth token with read access to issues.',
    },
    {
      key: 'org',
      label: 'Organization',
      type: 'string',
      required: true,
      placeholder: 'my-org',
      help: 'The Sentry organization slug.',
    },
    {
      key: 'project',
      label: 'Project',
      type: 'string',
      required: true,
      placeholder: 'my-project',
      help: 'The Sentry project slug.',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'string',
      required: false,
      placeholder: 'https://sentry.io',
      help: 'For self-hosted Sentry. Defaults to https://sentry.io.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    const org = String(ctx.config.org ?? '').trim();
    const project = String(ctx.config.project ?? '').trim();
    if (!token) throw new Error('sentry connector: config.token is required');
    if (!org) throw new Error('sentry connector: config.org is required');
    if (!project) throw new Error('sentry connector: config.project is required');
    const baseUrl = (ctx.config.baseUrl ? String(ctx.config.baseUrl) : 'https://sentry.io').replace(/\/$/, '');
    const headers = { authorization: `Bearer ${token}` };

    const url = `${baseUrl}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(
      project,
    )}/issues/?query=&statsPeriod=`;
    ctx.log?.('fetching sentry issues', { org, project });
    const issues = await fetchJson<SentryIssue[]>(url, { headers, signal: ctx.signal });
    for (const issue of issues ?? []) {
      if (ctx.signal?.aborted) return;
      yield sentryIssueDoc(issue);
    }
  },
};
