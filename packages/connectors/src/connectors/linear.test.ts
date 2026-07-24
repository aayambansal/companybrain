import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLinearIssues, linearConnector } from './linear.js';

describe('parseLinearIssues', () => {
  it('returns an empty array for an empty response', () => {
    expect(parseLinearIssues({})).toEqual([]);
    expect(parseLinearIssues({ data: { issues: { nodes: [] } } })).toEqual([]);
  });

  it('maps an issue node to a SourceDocument', () => {
    const [doc] = parseLinearIssues({
      data: {
        issues: {
          nodes: [
            {
              id: 'iss_1',
              identifier: 'ENG-42',
              title: 'Fix the sync',
              description: 'The runner drops docs.',
              url: 'https://linear.app/x/ENG-42',
              updatedAt: '2026-02-01T00:00:00Z',
            },
          ],
        },
      },
    });
    expect(doc!.sourceId).toBe('iss_1');
    expect(doc!.sourceType).toBe('linear_issue');
    expect(doc!.title).toBe('ENG-42: Fix the sync');
    expect(doc!.content).toContain('Fix the sync');
    expect(doc!.content).toContain('The runner drops docs.');
    expect(doc!.tags).toEqual(['linear']);
    expect(doc!.sourceUpdatedAt?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('falls back to the title (or "Issue") when there is no identifier', () => {
    const [a] = parseLinearIssues({
      data: { issues: { nodes: [{ id: '1', title: 'Just a title' }] } },
    });
    expect(a!.title).toBe('Just a title');
    const [b] = parseLinearIssues({ data: { issues: { nodes: [{ id: '2' }] } } });
    expect(b!.title).toBe('Issue');
  });
});

describe('linearConnector pull pagination', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the GraphQL endCursor across pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const after = body.variables?.after;
        if (after === 'C2') {
          return {
            ok: true,
            json: async () => ({
              data: {
                issues: {
                  nodes: [{ id: 'i2', identifier: 'ENG-2', title: 'Add' }],
                  pageInfo: { hasNextPage: false, endCursor: 'C3' },
                },
              },
            }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            data: {
              issues: {
                nodes: [{ id: 'i1', identifier: 'ENG-1', title: 'Fix', description: 'd1' }],
                pageInfo: { hasNextPage: true, endCursor: 'C2' },
              },
            },
          }),
        } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = { config: { apiKey: 'lin_x' }, log: () => {} } as any;
    const ids: string[] = [];
    for await (const d of linearConnector.pull(ctx)) ids.push(d.sourceId!);

    expect(ids).toEqual(['i1', 'i2']);
  });
});
