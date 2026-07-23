import { describe, it, expect } from 'vitest';
import { selectIndexablePaths } from './github.js';

describe('selectIndexablePaths', () => {
  const tree = [
    { path: 'README.md', type: 'blob', sha: '1' },
    { path: 'docs/guide.mdx', type: 'blob', sha: '2' },
    { path: 'src/index.ts', type: 'blob', sha: '3' },
    { path: 'node_modules/pkg/readme.md', type: 'blob', sha: '4' },
    { path: 'docs', type: 'tree', sha: '5' },
    { path: 'notes.txt', type: 'blob', sha: '6' },
  ];

  it('keeps only matching-extension blobs', () => {
    const paths = selectIndexablePaths(tree, ['md', 'mdx', 'txt']);
    expect(paths).toContain('README.md');
    expect(paths).toContain('docs/guide.mdx');
    expect(paths).toContain('notes.txt');
    expect(paths).not.toContain('src/index.ts');
  });

  it('skips vendored / dependency directories', () => {
    const paths = selectIndexablePaths(tree, ['md']);
    expect(paths).not.toContain('node_modules/pkg/readme.md');
  });

  it('ignores tree entries', () => {
    const paths = selectIndexablePaths(tree, ['md', 'mdx', 'txt']);
    expect(paths).not.toContain('docs');
  });
});
