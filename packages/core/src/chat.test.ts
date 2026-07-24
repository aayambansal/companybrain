import { describe, it, expect } from 'vitest';
import { buildContext, toCitations, extractiveAnswer, generateAnswer } from './chat.js';
import type { SearchHit } from './types.js';
import type { LlmProvider } from './llm/types.js';

function hit(id: string, title: string, content: string): SearchHit {
  return {
    chunkId: `c-${id}`,
    documentId: id,
    spaceId: 's',
    score: 1,
    scores: { fused: 1 },
    content,
    chunkIndex: 0,
    document: { id, title, sourceUrl: null, connector: 'api', tags: [] },
    metadata: {},
  };
}

describe('buildContext', () => {
  it('numbers passages with their titles and content', () => {
    const ctx = buildContext([
      hit('a', 'Release', 'ships thursday'),
      hit('b', 'Rollback', 're-run workflow'),
    ]);
    expect(ctx).toContain('[1] Release\nships thursday');
    expect(ctx).toContain('[2] Rollback\nre-run workflow');
  });
});

describe('toCitations', () => {
  it('maps hits to 1-indexed citations pointing at the document', () => {
    const cites = toCitations([hit('doc1', 'T', 'x'.repeat(300))]);
    expect(cites[0]).toMatchObject({ index: 1, chunkId: 'c-doc1', documentId: 'doc1', title: 'T' });
    expect(cites[0]!.snippet.length).toBeLessThanOrEqual(240);
  });
});

describe('extractiveAnswer', () => {
  it('reports when nothing was found', () => {
    const r = extractiveAnswer('anything?', []);
    expect(r.message).toContain('could not find');
    expect(r.citations).toEqual([]);
    expect(r.usedHits).toEqual([]);
  });

  it('stitches the top passages with citations when hits exist', () => {
    const hits = [
      hit('a', 'A', 'first'),
      hit('b', 'B', 'second'),
      hit('c', 'C', 'third'),
      hit('d', 'D', 'fourth'),
    ];
    const r = extractiveAnswer('q', hits);
    expect(r.message).toContain('first');
    expect(r.citations).toHaveLength(3); // capped at top 3
    expect(r.usedHits).toHaveLength(3);
  });
});

describe('generateAnswer LLM-error fallback', () => {
  it('returns the extractive answer when the LLM errors mid-request', async () => {
    const throwing = {
      name: 'stub',
      model: 'stub',
      available: true,
      async complete() {
        throw new Error('llm down');
      },
    } as unknown as LlmProvider;
    const hits = [hit('a', 'Release', 'ships thursday'), hit('b', 'Infra', 'postgres')];
    const r = await generateAnswer(throwing, 'when do we ship?', hits);
    expect(r.message).toContain('ships thursday');
    expect(r.usedHits.length).toBeGreaterThan(0);
    expect(r.citations.length).toBeGreaterThan(0);
  });
});
