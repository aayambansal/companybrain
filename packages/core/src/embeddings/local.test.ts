import { describe, it, expect } from 'vitest';
import { LocalEmbeddingProvider } from './local.js';
import { reciprocalRankFusion } from '../search/rrf.js';

describe('LocalEmbeddingProvider', () => {
  const provider = new LocalEmbeddingProvider(1536);

  it('produces vectors of the configured dimension', async () => {
    const [v] = await provider.embed(['hello world']);
    expect(v).toHaveLength(1536);
  });

  it('is deterministic', async () => {
    const [a] = await provider.embed(['the release ships on thursday']);
    const [b] = await provider.embed(['the release ships on thursday']);
    expect(a).toEqual(b);
  });

  it('is L2-normalized', async () => {
    const [v] = await provider.embed(['some arbitrary text about vectors']);
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('scores similar text higher than dissimilar text', async () => {
    const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
    const q = await provider.embedQuery('when do we release software');
    const [near] = await provider.embed(['our software release schedule and cadence']);
    const [far] = await provider.embed(['the office coffee machine is broken again']);
    expect(cos(q, near!)).toBeGreaterThan(cos(q, far!));
  });
});

describe('reciprocalRankFusion', () => {
  it('rewards items ranked highly across lists', () => {
    const a = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const b = [{ id: 'y' }, { id: 'x' }, { id: 'w' }];
    const fused = reciprocalRankFusion([{ items: a }, { items: b }], (i) => i.id);
    // x and y appear in both lists near the top; they should win.
    expect(['x', 'y']).toContain(fused[0]!.item.id);
  });
});
