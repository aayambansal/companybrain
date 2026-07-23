import { readFileSync, statSync, existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';
import { walkFiles } from './files.js';

/**
 * Pure: derive a note's title. Prefer a leading Markdown `# heading`, else the
 * first non-empty line, else the filename. Returns { title, body } with the
 * title line stripped from the body when it came from the content.
 */
export function raycastNote(text: string, fallbackTitle: string): { title: string; body: string } {
  const lines = text.split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx === -1) return { title: fallbackTitle, body: '' };
  const first = lines[firstIdx]!.trim();
  const heading = /^#{1,6}\s+(.+)$/.exec(first);
  if (heading) {
    const body = lines
      .slice(firstIdx + 1)
      .join('\n')
      .trim();
    return { title: heading[1]!.trim(), body };
  }
  // First line is plain text: use it as the title but keep the full body.
  const title = first.length > 80 ? `${first.slice(0, 77)}...` : first;
  return { title, body: text.trim() };
}

export const raycastConnector: Connector = {
  id: 'raycast',
  displayName: 'Raycast',
  description: 'Index your Raycast notes and snippets, one searchable memory per note.',
  category: 'docs',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'Notes folder',
      type: 'path',
      required: true,
      placeholder: '/exports/raycast-notes',
      help: 'Absolute path to a folder of exported Raycast notes (Markdown or text files).',
    },
  ],
  async *pull(ctx) {
    const root = resolve(String(ctx.config.path ?? '').trim());
    if (!root || !existsSync(root))
      throw new Error(`raycast connector: notes folder does not exist: ${root}`);
    const files = walkFiles(root, ['md', 'markdown', 'txt']);
    ctx.log?.('walked raycast notes', { root, notes: files.length });

    for (const rel of files) {
      if (ctx.signal?.aborted) return;
      const raw = readFileSync(join(root, rel), 'utf8');
      const { title, body } = raycastNote(raw, basename(rel, extname(rel)) || rel);
      if (!body && !title) continue;
      const stat = statSync(join(root, rel));
      const doc: SourceDocument = {
        sourceId: rel,
        sourceType: 'raycast_note',
        title,
        content: body || title,
        tags: ['raycast'],
        metadata: { path: rel },
        sourceCreatedAt: stat.birthtime,
        sourceUpdatedAt: stat.mtime,
      };
      yield doc;
    }
  },
};
