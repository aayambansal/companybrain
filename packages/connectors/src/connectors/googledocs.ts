import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchText } from '../http.js';

/**
 * Pure: pull the document id out of a Google Docs URL or accept a bare id.
 * Unit-testable. Returns null if nothing that looks like an id is found.
 */
export function extractGoogleDocId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1] ?? null;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return null;
}

export const googleDocsConnector: Connector = {
  id: 'googledocs',
  displayName: 'Google Docs',
  description:
    'Index a Google Doc via its plain-text export. The doc must be shared so anyone with the link can view.',
  category: 'docs',
  auth: 'none',
  configSchema: [
    {
      key: 'url',
      label: 'Google Doc URL or ID',
      type: 'string',
      required: true,
      placeholder: 'https://docs.google.com/document/d/…/edit',
      help: 'Share the doc as "anyone with the link can view", then paste its URL.',
    },
    {
      key: 'title',
      label: 'Title',
      type: 'string',
      required: false,
      help: 'Optional title override.',
    },
  ],
  async *pull(ctx) {
    const id = extractGoogleDocId(String(ctx.config.url ?? ''));
    if (!id) throw new Error('googledocs connector: could not find a document id in config.url');
    const exportUrl = `https://docs.google.com/document/d/${id}/export?format=txt`;
    ctx.log?.('exporting google doc', { id });
    const content = await fetchText(exportUrl, ctx.signal);
    yield {
      sourceId: id,
      sourceType: 'google_doc',
      sourceUrl: `https://docs.google.com/document/d/${id}/edit`,
      title:
        (ctx.config.title ? String(ctx.config.title) : '') ||
        content
          .split('\n')
          .find((l) => l.trim())
          ?.slice(0, 120) ||
        'Google Doc',
      content,
      tags: ['google-docs'],
      metadata: { docId: id },
    } satisfies SourceDocument;
  },
};
