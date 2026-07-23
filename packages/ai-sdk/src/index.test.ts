import { describe, it, expect, vi } from 'vitest';
import { companyBrainTools } from './index.js';
import type { CompanyBrain } from '@companybrain/sdk';

function mockClient() {
  return {
    search: vi.fn(async () => ({
      hits: [
        {
          document: { title: 'Release', sourceUrl: null },
          content: 'ship thursdays',
          score: 0.9123,
          documentId: 'd1',
        },
      ],
    })),
    chat: vi.fn(async () => ({
      message: 'We ship on Thursdays.',
      citations: [{ title: 'Release', sourceUrl: 'https://x' }],
    })),
    memories: { add: vi.fn(async () => ({ id: 'm1', status: 'indexed' })) },
  } as unknown as CompanyBrain;
}

type Exec = (args: Record<string, unknown>, opts?: unknown) => Promise<unknown>;

describe('companyBrainTools', () => {
  it('exposes the three memory tools', () => {
    const tools = companyBrainTools(mockClient());
    expect(Object.keys(tools).sort()).toEqual(['addMemory', 'askMemory', 'searchMemory']);
  });

  it('searchMemory maps hits and rounds the score to three places', async () => {
    const tools = companyBrainTools(mockClient());
    const out = (await (tools.searchMemory.execute as Exec)({ query: 'release' }, {})) as Array<
      Record<string, unknown>
    >;
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      title: 'Release',
      content: 'ship thursdays',
      documentId: 'd1',
      source: null,
    });
    expect(out[0]!.score).toBe(0.912);
  });

  it('askMemory returns the answer and mapped citations', async () => {
    const tools = companyBrainTools(mockClient());
    const out = (await (tools.askMemory.execute as Exec)({ question: 'when?' }, {})) as {
      answer: string;
      citations: unknown[];
    };
    expect(out.answer).toContain('Thursdays');
    expect(out.citations).toEqual([{ title: 'Release', source: 'https://x' }]);
  });

  it('addMemory forwards to the client and returns id and status', async () => {
    const tools = companyBrainTools(mockClient());
    const out = await (tools.addMemory.execute as Exec)({ content: 'remember this' }, {});
    expect(out).toEqual({ id: 'm1', status: 'indexed' });
  });

  it('scopes every tool to the configured space', async () => {
    const client = mockClient();
    const tools = companyBrainTools(client, { space: 'eng' });
    await (tools.searchMemory.execute as Exec)({ query: 'x' }, {});
    expect(client.search).toHaveBeenCalledWith(expect.objectContaining({ space: 'eng' }));
  });
});
