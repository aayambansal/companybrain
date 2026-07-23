import { describe, it, expect } from 'vitest';
import { applyRerankOrder, parseOrder, parseScores, llmRerankPointwise } from './rerank.js';
import type { SearchHit } from '../types.js';
import type { LlmProvider } from '../llm/types.js';

function hit(id: string): SearchHit {
  return {
    chunkId: id,
    documentId: id,
    spaceId: 's',
    score: 0,
    scores: { fused: 0 },
    content: id,
    chunkIndex: 0,
    document: { id, title: id, sourceUrl: null, connector: 'api', tags: [] },
    metadata: {},
  };
}

describe('parseOrder', () => {
  it('extracts in-range indices from an LLM response', () => {
    expect(parseOrder('2, 0, 1', 3)).toEqual([2, 0, 1]);
    expect(parseOrder('The order is 1 then 0.', 2)).toEqual([1, 0]);
    expect(parseOrder('9, 0', 2)).toEqual([0]); // 9 out of range dropped
  });
});

describe('parseScores', () => {
  it('parses index: score lines into a scores array', () => {
    expect(parseScores('0: 8\n1: 2\n2: 9', 3)).toEqual([8, 2, 9]);
  });
  it('tolerates prose, "=" and reordering; missing default to -1', () => {
    expect(parseScores('passage 2 = 10\n0: 3', 3)).toEqual([3, -1, 10]);
  });
  it('drops out-of-range indices', () => {
    expect(parseScores('5: 9\n0: 1', 2)).toEqual([1, -1]);
  });
});

describe('llmRerankPointwise', () => {
  const hits = [hit('a'), hit('b'), hit('c')];
  function stub(reply: string, available = true): LlmProvider {
    return {
      name: 'stub',
      model: 'stub',
      available,
      async complete() {
        return reply;
      },
    } as unknown as LlmProvider;
  }

  it('sorts by score descending, original order breaking ties', async () => {
    const out = await llmRerankPointwise(stub('0: 3\n1: 9\n2: 9'), 'q', hits);
    expect(out.map((h) => h.chunkId)).toEqual(['b', 'c', 'a']); // b(9) then c(9, tie->orig) then a(3)
  });

  it('falls back to input order when no scores parse or no LLM', async () => {
    expect((await llmRerankPointwise(stub('nonsense'), 'q', hits)).map((h) => h.chunkId)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      (await llmRerankPointwise(stub('0: 9', false), 'q', hits)).map((h) => h.chunkId),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('applyRerankOrder', () => {
  const hits = [hit('a'), hit('b'), hit('c')];

  it('reorders by the given indices', () => {
    const out = applyRerankOrder(hits, [2, 0, 1]);
    expect(out.map((h) => h.chunkId)).toEqual(['c', 'a', 'b']);
  });

  it('appends hits missing from the order, in original position', () => {
    const out = applyRerankOrder(hits, [1]);
    expect(out.map((h) => h.chunkId)).toEqual(['b', 'a', 'c']);
  });

  it('ignores duplicates and out-of-range indices', () => {
    const out = applyRerankOrder(hits, [0, 0, 5, 2]);
    expect(out.map((h) => h.chunkId)).toEqual(['a', 'c', 'b']);
  });
});
