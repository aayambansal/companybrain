import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchText } from '../http.js';
import { decodeXml, extractTitle } from '../xml.js';

/**
 * Pure: pull the 11-character video id out of a YouTube URL, or accept a bare
 * id. Handles `youtube.com/watch?v=`, `youtu.be/`, and `/embed|/shorts|/v/`
 * forms. Unit-testable; returns null when no id is found.
 */
export function extractYoutubeId(url: string): string | null {
  const s = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1] ?? null;
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1] ?? null;
  const path = s.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
  if (path) return path[1] ?? null;
  return null;
}

/**
 * Pure: turn a YouTube `timedtext` XML transcript into plain text. Strips the
 * `<text ...>…</text>` tags, decodes HTML entities, collapses whitespace, and
 * joins the cues with newlines. Unit-testable with an inline XML string.
 */
export function parseTimedText(xml: string): string {
  const blocks = xml.match(/<text\b[^>]*>([\s\S]*?)<\/text>/gi) ?? [];
  return blocks
    .map((block) => {
      const inner = /<text\b[^>]*>([\s\S]*?)<\/text>/i.exec(block)?.[1] ?? '';
      return decodeXml(inner).replace(/\s+/g, ' ').trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
}

export const youtubeConnector: Connector = {
  id: 'youtube',
  displayName: 'YouTube',
  description:
    'Index a YouTube video: its title plus its English transcript when captions are available.',
  category: 'web',
  auth: 'none',
  configSchema: [
    {
      key: 'url',
      label: 'Video URL or ID',
      type: 'string',
      required: true,
      placeholder: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      help: 'A YouTube video URL (watch, youtu.be, embed, or shorts) or a bare 11-character video id.',
    },
  ],
  async *pull(ctx) {
    const id = extractYoutubeId(String(ctx.config.url ?? ''));
    if (!id) throw new Error('youtube connector: could not find a video id in config.url');
    const watchUrl = `https://www.youtube.com/watch?v=${id}`;
    ctx.log?.('fetching youtube video', { id });
    const page = await fetchText(watchUrl, ctx.signal);
    const title = extractTitle(page) ?? `YouTube video ${id}`;

    let transcript = '';
    try {
      const xml = await fetchText(
        `https://www.youtube.com/api/timedtext?lang=en&v=${id}`,
        ctx.signal,
      );
      transcript = parseTimedText(xml);
    } catch (err) {
      ctx.log?.('transcript unavailable', { id, error: String(err) });
    }

    yield {
      sourceId: id,
      sourceType: 'youtube',
      sourceUrl: watchUrl,
      title,
      content: transcript || title,
      tags: ['youtube'],
      metadata: { videoId: id, hasTranscript: transcript.length > 0 },
    } satisfies SourceDocument;
  },
};
