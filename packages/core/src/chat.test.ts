import { describe, it, expect } from 'vitest';
import {
  buildContext,
  toCitations,
  extractiveAnswer,
  generateAnswer,
  recentHistory,
  MAX_CHAT_HISTORY,
} from './chat.js';
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

describe('recentHistory', () => {
  it('returns the history unchanged when within the cap', () => {
    const h = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
    ];
    expect(recentHistory(h)).toBe(h);
  });

  it('keeps only the most recent turns when over the cap', () => {
    const h = Array.from({ length: MAX_CHAT_HISTORY + 5 }, (_, i) => ({
      role: 'user',
      content: String(i),
    }));
    const out = recentHistory(h);
    expect(out).toHaveLength(MAX_CHAT_HISTORY);
    expect(out[0]!.content).toBe('5'); // dropped the oldest 5
    expect(out[out.length - 1]!.content).toBe(String(MAX_CHAT_HISTORY + 4));
  });
});
