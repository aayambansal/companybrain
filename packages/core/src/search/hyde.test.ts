import { describe, it, expect } from 'vitest';
import { hydePrompt, blendVectors } from './hyde.js';

describe('hydePrompt', () => {
  it('embeds the query and asks for a confident passage', () => {
    const p = hydePrompt('does vitamin D reduce cancer risk?');
    expect(p).toContain('does vitamin D reduce cancer risk?');
    expect(p.toLowerCase()).toContain('passage');
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
