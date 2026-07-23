import { describe, it, expect } from 'vitest';
import { buildDigestPrompt, generateDigest } from './digest.js';
import type { Memory } from './types.js';
import type { LlmProvider } from './llm/types.js';

function mem(id: string, title: string, content: string): Memory {
  return {
    id, spaceId: 's', title, content, summary: null, connector: 'api',
    sourceType: 'text', sourceUrl: null, tags: [], metadata: {},
    status: 'indexed', createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
  };
}
function stub(available: boolean, reply = ''): LlmProvider {
  return { name: 'stub', model: 'stub', available, async complete() { return reply; } } as unknown as LlmProvider;
}

describe('buildDigestPrompt', () => {
  it('numbers items with titles and snippets', () => {
    const p = buildDigestPrompt([{ title: 'Launch', snippet: 'moved to Thu' }, { title: null, snippet: '' }]);
    expect(p).toContain('1. Launch — moved to Thu');
    expect(p).toContain('2. Untitled');
  });
});

describe('generateDigest', () => {
  const mems = [mem('a', 'Launch date', 'moved to Thursday'), mem('b', 'Brand palette', 'cobalt + amber')];

  it('uses the LLM summary and returns memory refs', async () => {
    const r = await generateDigest(stub(true, '- Launch moved to Thursday\n- New brand palette'), mems);
    expect(r.summary).toContain('Launch moved to Thursday');
    expect(r.count).toBe(2);
    expect(r.memories.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('falls back to a plain list without an LLM', async () => {
    const r = await generateDigest(stub(false), mems);
    expect(r.summary).toContain('Recently added');
    expect(r.summary).toContain('Launch date');
  });

  it('handles nothing recent', async () => {
    const r = await generateDigest(stub(true), []);
    expect(r.count).toBe(0);
    expect(r.summary).toContain('Nothing new');
  });
});
