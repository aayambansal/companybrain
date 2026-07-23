import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAIEmbeddingProvider } from './openai.js';

function stubFetch(dim: number) {
  const calls: any[] = [];
  const fn = vi.fn(async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: Array(dim).fill(0.1) }] }),
    } as any;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenAIEmbeddingProvider dimensions', () => {
  it('requests a reduced width for text-embedding-3-large so it fits storage', () => {
    const p = new OpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'text-embedding-3-large', dimensions: 1536 });
    expect(p.dimensions).toBe(1536);
  });

  it('sends the dimensions param for text-embedding-3-* models', async () => {
    const calls = stubFetch(1536);
    const p = new OpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'text-embedding-3-large', dimensions: 1536 });
    await p.embed(['hello']);
    expect(calls[0].model).toBe('text-embedding-3-large');
    expect(calls[0].dimensions).toBe(1536);
  });

  it('omits dimensions for models that do not support it (ada-002)', async () => {
    const calls = stubFetch(1536);
    const p = new OpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'text-embedding-ada-002', dimensions: 1536 });
    await p.embed(['hello']);
    expect('dimensions' in calls[0]).toBe(false);
  });

  it('defaults 3-small to its native 1536', () => {
    const p = new OpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'text-embedding-3-small' });
    expect(p.dimensions).toBe(1536);
  });
});
