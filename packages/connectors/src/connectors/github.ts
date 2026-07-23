import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

const DEFAULT_EXTS = ['md', 'mdx', 'markdown', 'rst', 'txt', 'adoc'];

interface TreeEntry {
  path: string;
  type: string; // 'blob' | 'tree'
  sha: string;
}

/**
 * Pure: pick indexable file paths from a git tree by extension. Skips vendored
 * and dependency directories. Unit-testable without the network.
 */
export function selectIndexablePaths(tree: TreeEntry[], extensions: string[]): string[] {
  const exts = extensions.map((e) => e.toLowerCase().replace(/^\./, ''));
  const skip = /(^|\/)(node_modules|\.git|dist|build|vendor|\.next|target)\//i;
  return tree
    .filter((e) => e.type === 'blob' && !skip.test('/' + e.path))
    .filter((e) => {
      const ext = e.path.split('.').pop()?.toLowerCase() ?? '';
      return exts.includes(ext);
    })
    .map((e) => e.path);
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } : {};
}

function decodeBase64(content: string): string {
  return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8');
}

export const githubConnector: Connector = {
  id: 'github',
  displayName: 'GitHub',
  description: 'Index docs and Markdown from a GitHub repository (public or private with a token).',
  category: 'code',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'repo',
      label: 'Repository',
      type: 'string',
      required: true,
      placeholder: 'owner/name',
      help: 'e.g. aayambansal/companybrain',
    },
    {
      key: 'token',
      label: 'Personal access token',
      type: 'password',
      required: false,
      help: 'Required for private repos. Needs read access.',
    },
    {
      key: 'branch',
      label: 'Branch',
      type: 'string',
      required: false,
      placeholder: 'default branch',
      help: 'Defaults to the repo default branch.',
    },
    {
      key: 'extensions',
      label: 'File extensions',
      type: 'string',
      required: false,
      placeholder: 'md,mdx,txt',
      help: 'Comma-separated. Defaults to docs formats.',
    },
  ],
  async *pull(ctx) {
    const repo = String(ctx.config.repo ?? '')
      .trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '');
    if (!repo.includes('/')) throw new Error('github connector: config.repo must be "owner/name"');
    const token = ctx.config.token ? String(ctx.config.token) : undefined;
    const headers = authHeaders(token);
    const extensions = String(ctx.config.extensions ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exts = extensions.length ? extensions : DEFAULT_EXTS;

    let branch = ctx.config.branch ? String(ctx.config.branch) : '';
    if (!branch) {
      const info = await fetchJson<{ default_branch: string }>(
        `https://api.github.com/repos/${repo}`,
        { headers, signal: ctx.signal },
      );
      branch = info.default_branch;
    }
    ctx.log?.('listing repo tree', { repo, branch });
    const tree = await fetchJson<{ tree: TreeEntry[]; truncated: boolean }>(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, signal: ctx.signal },
    );
    if (tree.truncated) {
      // GitHub caps a single recursive tree call (~100k entries / 7MB). Surface
      // it so a partial index of a very large repo is not mistaken for a full one.
      ctx.log?.('repo tree truncated by GitHub; some files were not indexed', { repo, branch });
    }
    const paths = selectIndexablePaths(tree.tree, exts);
    ctx.log?.('indexing files', { count: paths.length });

    for (const path of paths) {
      if (ctx.signal?.aborted) return;
      try {
        const file = await fetchJson<{ content?: string; html_url?: string; encoding?: string }>(
          `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
          { headers, signal: ctx.signal },
        );
        if (!file.content || file.encoding !== 'base64') continue;
        const content = decodeBase64(file.content);
        const isMd = /\.(md|mdx|markdown)$/i.test(path);
        yield {
          sourceId: `${repo}@${branch}:${path}`,
          sourceType: isMd ? 'markdown' : 'text',
          sourceUrl: file.html_url ?? `https://github.com/${repo}/blob/${branch}/${path}`,
          title: path.split('/').pop() ?? path,
          content,
          tags: ['github', repo],
          metadata: { repo, branch, path },
        } satisfies SourceDocument;
      } catch (err) {
        ctx.log?.('skipped file', { path, error: String(err) });
      }
    }
  },
};
