import { describe, it, expect, vi, afterEach } from 'vitest';
import { selectIndexablePaths, githubConnector } from './github.js';

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

describe('githubConnector pull', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('walks the tree and yields a document per matching file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('/git/trees/')) {
          return {
            ok: true,
            json: async () => ({
              tree: [
                { path: 'README.md', type: 'blob' },
                { path: 'docs/guide.md', type: 'blob' },
                { path: 'src/index.ts', type: 'blob' },
              ],
              truncated: false,
            }),
          } as Response;
        }
        const path = u.match(/contents\/(.+?)\?/)?.[1] ?? '';
        return {
          ok: true,
          json: async () => ({
            content: Buffer.from('body of ' + decodeURIComponent(path)).toString('base64'),
            encoding: 'base64',
            html_url: 'https://github.com/acme/app/blob/main/' + path,
          }),
        } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = {
      config: { repo: 'acme/app', branch: 'main', extensions: 'md' },
      log: () => {},
    } as any;
    const docs = [];
    for await (const d of githubConnector.pull(ctx)) docs.push(d);

    // Only the two markdown files are indexed; the .ts is filtered out.
    expect(docs.map((d) => d.sourceId)).toEqual([
      'acme/app@main:README.md',
      'acme/app@main:docs/guide.md',
    ]);
    expect(docs[0]!.content).toContain('body of README.md');
  });

  it('logs a warning when the repo tree is truncated', async () => {
    const logs: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/git/trees/')) {
          return { ok: true, json: async () => ({ tree: [], truncated: true }) } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = {
      config: { repo: 'acme/app', branch: 'main' },
      log: (m: string) => logs.push(m),
    } as any;
    const docs = [];
    for await (const d of githubConnector.pull(ctx)) docs.push(d);

    expect(docs).toHaveLength(0);
    expect(logs.some((l) => /truncat/i.test(l))).toBe(true);
  });
});
