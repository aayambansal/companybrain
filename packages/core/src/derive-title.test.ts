import { describe, it, expect } from 'vitest';
import { deriveTitle } from './memory.js';

describe('deriveTitle', () => {
  it('uses the first non-empty, trimmed line', () => {
    expect(deriveTitle('\n\n  Release process  \nmore text')).toBe('Release process');
  });

  it('caps the title at 120 characters', () => {
    const long = 'x'.repeat(200);
    expect(deriveTitle(long)).toHaveLength(120);
  });

  it('falls back to "Untitled" for blank content', () => {
    expect(deriveTitle('')).toBe('Untitled');
    expect(deriveTitle('   \n  \n')).toBe('Untitled');
  });
});
