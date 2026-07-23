import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface LinearIssue {
  id: string;
  identifier?: string;
  title?: string;
  description?: string;
  url?: string;
  updatedAt?: string;
}

/** Pure: map a Linear GraphQL issues response into SourceDocuments. */
export function parseLinearIssues(json: { data?: { issues?: { nodes?: LinearIssue[] } } }): SourceDocument[] {
  const nodes = json.data?.issues?.nodes ?? [];
  return nodes.map((n) => ({
    sourceId: n.id,
    sourceType: 'linear_issue',
    sourceUrl: n.url,
    title: n.identifier ? `${n.identifier}: ${n.title ?? ''}`.trim() : (n.title ?? 'Issue'),
    content: [n.title, n.description].filter(Boolean).join('\n\n') || (n.title ?? ''),
    tags: ['linear'],
    metadata: { id: n.id, identifier: n.identifier },
    sourceUpdatedAt: n.updatedAt ? new Date(n.updatedAt) : undefined,
  }));
}

const QUERY = `query($after: String) {
  issues(first: 100, after: $after) {
    nodes { id identifier title description url updatedAt }
    pageInfo { hasNextPage endCursor }
  }
}`;

export const linearConnector: Connector = {
  id: 'linear',
  displayName: 'Linear',
  description: 'Index Linear issues (title + description) via a personal API key.',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    { key: 'apiKey', label: 'API key', type: 'password', required: true, placeholder: 'lin_api_...', help: 'A Linear personal API key (Settings > API).' },
  ],
  async *pull(ctx) {
    const apiKey = String(ctx.config.apiKey ?? '').trim();
    if (!apiKey) throw new Error('linear connector: config.apiKey is required');
    let after: string | undefined;
    do {
      const res = await fetchJson<{
        data?: { issues?: { nodes?: LinearIssue[]; pageInfo?: { hasNextPage: boolean; endCursor: string } } };
      }>('https://api.linear.app/graphql', {
        method: 'POST',
        headers: { authorization: apiKey },
        body: { query: QUERY, variables: { after } },
        signal: ctx.signal,
      });
      for (const doc of parseLinearIssues(res)) {
        if (ctx.signal?.aborted) return;
        yield doc;
      }
      const page = res.data?.issues?.pageInfo;
      after = page?.hasNextPage ? page.endCursor : undefined;
    } while (after);
  },
};
