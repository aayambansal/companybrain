import { describe, it, expect, vi } from 'vitest';
import { companyBrainOpenAITools, runCompanyBrainTool, COMPANYBRAIN_TOOL_NAMES } from './index.js';
import type { CompanyBrain } from '@companybrain/sdk';

describe('companyBrainOpenAITools', () => {
  it('returns three valid OpenAI function tools', () => {
    const tools = companyBrainOpenAITools();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.function.name).sort()).toEqual([...COMPANYBRAIN_TOOL_NAMES].sort());
    for (const t of tools) {
      expect(t.type).toBe('function');
      expect(t.function.parameters).toHaveProperty('type', 'object');
    }
  });
});

describe('runCompanyBrainTool', () => {
  const client = {
    search: vi.fn(async () => ({ hits: [{ document: { title: 'Release', sourceUrl: null }, content: 'ship thursdays', score: 0.9 }] })),
    chat: vi.fn(async () => ({ message: 'We ship on Thursdays.', citations: [{ title: 'Release', sourceUrl: null }] })),
    memories: { add: vi.fn(async () => ({ id: 'm1', status: 'indexed' })) },
  } as unknown as CompanyBrain;

  it('runs search_memory', async () => {
    const out = (await runCompanyBrainTool(client, 'search_memory', { query: 'release' })) as unknown[];
    expect(out).toHaveLength(1);
    expect((out[0] as { title: string }).title).toBe('Release');
  });

  it('runs ask_memory', async () => {
    const out = (await runCompanyBrainTool(client, 'ask_memory', { question: 'when?' })) as { answer: string };
    expect(out.answer).toContain('Thursdays');
  });

  it('runs add_memory', async () => {
    const out = (await runCompanyBrainTool(client, 'add_memory', { content: 'x' })) as { id: string };
    expect(out.id).toBe('m1');
  });

  it('throws on unknown tool', async () => {
    await expect(runCompanyBrainTool(client, 'nope', {})).rejects.toThrow();
  });
});
