import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';

export const DEFAULT_FILE_EXTENSIONS = ['md', 'markdown', 'mdx', 'txt'];

/**
 * Recursively list files under `root`, returning paths relative to `root`
 * (POSIX-style separators). Dotfiles and dot-directories are skipped. If
 * `extensions` is given, only files with those extensions are returned.
 * Pure over the filesystem: testable against a temp dir.
 */
export function walkFiles(root: string, extensions?: string[]): string[] {
  const exts =
    extensions && extensions.length > 0
      ? new Set(extensions.map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase()))
      : null;
  const out: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (exts && !exts.has(extname(entry.name).toLowerCase())) continue;
        out.push(relative(root, full).split('\\').join('/'));
      }
    }
  };

  walk(root);
  return out.sort();
}

/** Parse the `extensions` config value, which may be an array or a CSV string. */
export function resolveExtensions(value: unknown): string[] {
  if (Array.isArray(value)) {
    const list = value.map((v) => String(v).trim()).filter(Boolean);
    return list.length > 0 ? list : DEFAULT_FILE_EXTENSIONS;
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_FILE_EXTENSIONS;
}

const MARKDOWN_EXTS = new Set(['.md', '.markdown', '.mdx']);

export function fileToSourceDocument(root: string, rel: string): SourceDocument {
  const full = join(root, rel);
  const content = readFileSync(full, 'utf8');
  const stat = statSync(full);
  const isMarkdown = MARKDOWN_EXTS.has(extname(rel).toLowerCase());
  return {
    sourceId: rel,
    sourceType: isMarkdown ? 'markdown' : 'text',
    title: basename(rel, extname(rel)) || rel,
    content,
    metadata: { path: rel },
    sourceCreatedAt: stat.birthtime,
    sourceUpdatedAt: stat.mtime,
  };
}

export const filesConnector: Connector = {
  id: 'files',
  displayName: 'Local files',
  description: 'Recursively index text and Markdown files in a folder on the host.',
  category: 'files',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'Folder path',
      type: 'path',
      required: true,
      placeholder: '/data/docs',
      help: 'Absolute path to a folder the server can read.',
    },
    {
      key: 'extensions',
      label: 'File extensions',
      type: 'string',
      required: false,
      placeholder: 'md,txt',
      help: 'Comma-separated extensions to include. Default: md, markdown, mdx, txt.',
    },
  ],
  async *pull(ctx) {
    const root = resolve(String(ctx.config.path ?? '').trim());
    if (!root || !existsSync(root)) {
      throw new Error(`files connector: path does not exist: ${root}`);
    }
    const extensions = resolveExtensions(ctx.config.extensions);
    const files = walkFiles(root, extensions);
    ctx.log?.('walked folder', { root, files: files.length });

    for (const rel of files) {
      if (ctx.signal?.aborted) return;
      yield fileToSourceDocument(root, rel);
    }
  },
};
