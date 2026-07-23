import { describe, it, expect } from 'vitest';
import { hydePrompt, blendVectors, hypotheticalDocuments } from './hyde.js';
import type { LlmProvider } from '../llm/types.js';

function stubLlm(available: boolean): LlmProvider {
  let n = 0;
  return {
    name: 'stub', model: 'stub', available,
    async complete() { return `passage ${n++}`; },
  } as unknown as LlmProvider;
}

describe('hydePrompt', () => {
  it('embeds the query and asks for a confident passage', () => {
    const p = hydePrompt('does vitamin D reduce cancer risk?');
    expect(p).toContain('does vitamin D reduce cancer risk?');
    expect(p.toLowerCase()).toContain('passage');
  });
});

describe('hypotheticalDocuments', () => {
  it('returns n passages when the LLM is available', async () => {
    expect(await hypotheticalDocuments(stubLlm(true), 'q', 3)).toHaveLength(3);
  });
  it('returns none without an LLM or with n<1', async () => {
    expect(await hypotheticalDocuments(stubLlm(false), 'q', 3)).toEqual([]);
    expect(await hypotheticalDocuments(stubLlm(true), 'q', 0)).toEqual([]);
  });
});

describe('blendVectors', () => {
  it('averages equal-length vectors element-wise', () => {
    expect(blendVectors([[1, 3], [3, 5]])).toEqual([2, 4]);
  });

  it('ignores empty vectors', () => {
    expect(blendVectors([[2, 2], []])).toEqual([2, 2]);
    expect(blendVectors([[], []])).toEqual([]);
  });

  it('skips mismatched-length vectors rather than corrupting the sum', () => {
    expect(blendVectors([[1, 1], [9, 9, 9]])).toEqual([1, 1]);
  });
});
