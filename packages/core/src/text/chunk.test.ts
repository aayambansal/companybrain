import { describe, it, expect } from 'vitest';
import { chunkText } from './chunk.js';
import { estimateTokens } from './tokens.js';

describe('chunkText', () => {
  it('returns nothing for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    const chunks = chunkText('A short note about the release process.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.content).toContain('release process');
  });

  it('splits long text into multiple ordered chunks under the target', () => {
    const para = 'The quick brown fox jumps over the lazy dog. '.repeat(60);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, { targetTokens: 100, overlapTokens: 20, maxTokens: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(estimateTokens(c.content)).toBeLessThanOrEqual(260);
      expect(c.content.length).toBeGreaterThan(0);
    });
  });

  it('produces overlap between consecutive chunks', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} has some content.`).join(' ');
    const chunks = chunkText(sentences, { targetTokens: 40, overlapTokens: 15, maxTokens: 80 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
