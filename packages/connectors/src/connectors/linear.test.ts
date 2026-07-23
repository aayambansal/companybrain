import { describe, it, expect } from 'vitest';
import { parseLinearIssues } from './linear.js';

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
