import { describe, it, expect, vi } from 'vitest';
import { CompanyBrainRetriever } from './index.js';
import type { CompanyBrain } from '@companybrain/sdk';

function mockClient() {
  return {
    search: vi.fn(async () => ({
      hits: [
        {
          document: { title: 'Release', sourceUrl: 'https://x', connector: 'api' },
          content: 'ship thursdays',
          score: 0.9,
          documentId: 'd1',
          chunkId: 'c1',
        },
      ],
    })),
  } as unknown as CompanyBrain;
}

// Exercise the mapping directly, without LangChain's callback-manager wrapper.
type Retrieve = { _getRelevantDocuments: (q: string) => Promise<Array<{ pageContent: string; metadata: Record<string, unknown> }>> };

describe('CompanyBrainRetriever', () => {
  it('maps search hits to documents with metadata and passes options through', async () => {
    const client = mockClient();
    const retriever = new CompanyBrainRetriever({ client, k: 3, space: 'eng' });
    const docs = await (retriever as unknown as Retrieve)._getRelevantDocuments('how do we release?');
    expect(docs).toHaveLength(1);
    expect(docs[0]!.pageContent).toBe('ship thursdays');
    expect(docs[0]!.metadata).toMatchObject({
      documentId: 'd1',
      chunkId: 'c1',
      title: 'Release',
      source: 'https://x',
      connector: 'api',
      score: 0.9,
    });
    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'how do we release?', limit: 3, space: 'eng', mode: 'hybrid' }),
    );
  });

  it('defaults k to 6 and mode to hybrid', async () => {
    const client = mockClient();
    const retriever = new CompanyBrainRetriever({ client });
    await (retriever as unknown as Retrieve)._getRelevantDocuments('q');
    expect(client.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 6, mode: 'hybrid' }));
  });
});
