import { readFileSync, statSync, existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';
import { walkFiles } from './files.js';

export interface Frontmatter {
  tags: string[];
  body: string;
  links: string[];
}

/**
 * Parse an Obsidian note: read YAML frontmatter `tags`, strip the frontmatter
 * block from the body, and extract `[[wikilink]]` targets. Pure and testable.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  let body = text;
  let tags: string[] = [];
  if (m) {
    tags = extractYamlTags(m[1] ?? '');
    body = text.slice(m[0].length);
  }
  return { tags, body, links: extractWikiLinks(body) };
}

/** Read the `tags` (or `tag`) key from a YAML frontmatter block. */
function extractYamlTags(fm: string): string[] {
  const lines = fm.split('\n');
  const tags: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:tags|tag)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
    if (!m) continue;
    const inline = (m[1] ?? '').trim();
    if (inline) {
      // Inline forms: `[a, b]`, `a, b`, `"a"` or a single value.
      const cleaned = inline.replace(/^\[/, '').replace(/\]$/, '');
      for (const part of cleaned.split(/[,\s]+/)) {
        const t = unquote(part);
        if (t) tags.push(t);
      }
    } else {
      // Block list: contiguous `- item` lines beneath the key.
      for (let j = i + 1; j < lines.length; j++) {
        const lm = /^\s*-\s+(.+)$/.exec(lines[j] ?? '');
        if (!lm) break;
        const t = unquote(lm[1] ?? '');
        if (t) tags.push(t);
      }
    }
    break; // only the first tags key
  }
  return [...new Set(tags)];
}

/** Extract unique `[[wikilink]]` targets, dropping any `|alias` or `#heading`. */
function extractWikiLinks(body: string): string[] {
  const links: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const raw = m[1] ?? '';
    const target = (raw.split('|')[0] ?? '').split('#')[0]?.trim() ?? '';
    if (target) links.push(target);
  }
  return [...new Set(links)];
}

function unquote(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^#/, '')
    .trim();
}

export const obsidianConnector: Connector = {
  id: 'obsidian',
  displayName: 'Obsidian',
  description: 'Index Markdown notes in an Obsidian vault, with frontmatter tags and wikilinks.',
  category: 'docs',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'Vault path',
      type: 'path',
      required: true,
      placeholder: '/vault',
      help: 'Absolute path to your Obsidian vault folder.',
    },
  ],
  async *pull(ctx) {
    const root = resolve(String(ctx.config.path ?? '').trim());
    if (!root || !existsSync(root)) {
      throw new Error(`obsidian connector: vault path does not exist: ${root}`);
    }
    const files = walkFiles(root, ['md', 'markdown']);
    ctx.log?.('walked vault', { root, notes: files.length });

    for (const rel of files) {
      if (ctx.signal?.aborted) return;
      const raw = readFileSync(join(root, rel), 'utf8');
      const { tags, body, links } = parseFrontmatter(raw);
      const stat = statSync(join(root, rel));
      const doc: SourceDocument = {
        sourceId: rel,
        sourceType: 'markdown',
        title: basename(rel, extname(rel)) || rel,
        content: body,
        tags,
        metadata: { path: rel, links, vault: basename(root) },
        sourceCreatedAt: stat.birthtime,
        sourceUpdatedAt: stat.mtime,
      };
      yield doc;
    }
  },
};
