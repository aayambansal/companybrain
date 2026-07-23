import { describe, it, expect } from 'vitest';
import { buildPlaybookPrompt, extractTitle, generatePlaybook } from './playbook.js';
import type { SearchHit } from './types.js';
import type { LlmProvider } from './llm/types.js';

function hit(id: string, title: string, content: string): SearchHit {
  return {
    chunkId: id, documentId: id, spaceId: 's', score: 1, scores: { fused: 1 },
    content, chunkIndex: 0,
    document: { id, title, sourceUrl: null, connector: 'api', tags: [] },
    metadata: {},
  };
}
function stub(available: boolean, reply = ''): LlmProvider {
  return { name: 'stub', model: 'stub', available, async complete() { return reply; } } as unknown as LlmProvider;
}

describe('extractTitle', () => {
  it('pulls the first markdown h1', () => {
    expect(extractTitle('# Onboarding\n\nbody', 'x')).toBe('Onboarding');
  });
  it('falls back when there is no heading', () => {
    expect(extractTitle('no heading here', 'Fallback')).toBe('Fallback');
  });
});

describe('buildPlaybookPrompt', () => {
  it('includes the topic and context', () => {
    const p = buildPlaybookPrompt('Launch process', 'ctx here');
    expect(p).toContain('Launch process');
    expect(p).toContain('ctx here');
  });
});

describe('generatePlaybook', () => {
  const hits = [hit('a', 'Release process', 'We ship on Thursdays.')];

  it('uses the LLM output and extracts its title', async () => {
    const r = await generatePlaybook(stub(true, '# Shipping\n\n## Overview\nWe ship Thursdays [1].'), 'Shipping', hits);
    expect(r.title).toBe('Shipping');
    expect(r.content).toContain('We ship Thursdays [1].');
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]?.title).toBe('Release process');
  });

  it('falls back to a source outline without an LLM', async () => {
    const r = await generatePlaybook(stub(false), 'Shipping', hits);
    expect(r.content).toContain('# Shipping');
    expect(r.content).toContain('Release process [1]');
  });

  it('handles no memories gracefully', async () => {
    const r = await generatePlaybook(stub(true), 'Empty', []);
    expect(r.content).toContain('No memories found');
    expect(r.citations).toEqual([]);
  });
});
