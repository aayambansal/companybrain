import { describe, it, expect } from 'vitest';
import { applyRerankOrder, parseOrder } from './rerank.js';
import type { SearchHit } from '../types.js';

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
