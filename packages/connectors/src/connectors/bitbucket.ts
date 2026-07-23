import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Bitbucket Cloud issue as returned by the REST API v2 (fields subset). */
export interface BitbucketIssue {
  id: number;
  title: string;
  content?: { raw?: string };
  links?: { html?: { href?: string } };
  updated_on?: string;
}

/** A page of issues from the Bitbucket Cloud API. `next` is a full URL, if present. */
export interface BitbucketIssuesPage {
  values: BitbucketIssue[];
  next?: string;
}

/** Pure: map a Bitbucket issue into a SourceDocument. Unit-testable. */
export function bitbucketIssueDoc(issue: BitbucketIssue): SourceDocument {
  const content = [issue.title, issue.content?.raw].filter(Boolean).join('\n\n');
  return {
    sourceId: String(issue.id),
    sourceType: 'bitbucket_issue',
    sourceUrl: issue.links?.html?.href,
    title: `#${issue.id} ${issue.title}`,
    content,
    tags: ['bitbucket'],
    metadata: { id: issue.id },
    sourceUpdatedAt: issue.updated_on ? new Date(issue.updated_on) : undefined,
  };
}

export const bitbucketConnector: Connector = {
  id: 'bitbucket',
  displayName: 'Bitbucket',
  description: 'Index issues (title + body) from a Bitbucket Cloud repository via an app password.',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'username',
      label: 'Username',
      type: 'string',
      required: true,
      placeholder: 'your-username',
      help: 'Your Bitbucket account username.',
    },
    {
      key: 'appPassword',
      label: 'App password',
      type: 'password',
      required: true,
      placeholder: 'ATBB...',
      help: 'A Bitbucket app password with read access to issues.',
    },
    {
      key: 'workspace',
      label: 'Workspace',
      type: 'string',
      required: true,
      placeholder: 'my-workspace',
      help: 'The workspace (team or account) that owns the repository.',
    },
    {
      key: 'repo',
      label: 'Repository',
      type: 'string',
      required: true,
      placeholder: 'my-repo',
      help: 'The repository slug within the workspace.',
    },
  ],
  async *pull(ctx) {
    const username = String(ctx.config.username ?? '').trim();
    const appPassword = String(ctx.config.appPassword ?? '').trim();
    const workspace = String(ctx.config.workspace ?? '').trim();
    const repo = String(ctx.config.repo ?? '').trim();
    if (!username) throw new Error('bitbucket connector: config.username is required');
    if (!appPassword) throw new Error('bitbucket connector: config.appPassword is required');
    if (!workspace) throw new Error('bitbucket connector: config.workspace is required');
    if (!repo) throw new Error('bitbucket connector: config.repo is required');

    const auth = 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64');
    const headers = { authorization: auth };

    let url: string | undefined = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(
      workspace,
    )}/${encodeURIComponent(repo)}/issues?pagelen=50`;

    while (url) {
      if (ctx.signal?.aborted) return;
      ctx.log?.('fetching bitbucket issues', { workspace, repo });
      const page: BitbucketIssuesPage = await fetchJson<BitbucketIssuesPage>(url, {
        headers,
        signal: ctx.signal,
      });
      for (const issue of page.values ?? []) {
        if (ctx.signal?.aborted) return;
        yield bitbucketIssueDoc(issue);
      }
      url = page.next;
    }
  },
};
