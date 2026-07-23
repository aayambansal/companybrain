import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';

/**
 * One call from a Fathom export. Fathom records and transcribes meetings; you
 * can export your call history (with summaries, action items, and transcripts)
 * as JSON. Field aliases across versions are normalized below.
 */
export interface FathomCall {
  id?: string | number;
  title?: string;
  meeting_title?: string;
  summary?: string;
  transcript?: string;
  content?: string;
  /** Action items, if the export includes them. */
  action_items?: string[];
  actionItems?: string[];
  invitees?: string[];
  attendees?: string[];
  recorded_at?: string | number;
  recordedAt?: string | number;
  date?: string | number;
  url?: string;
  share_url?: string;
}

function attendeesOf(c: FathomCall): string[] {
  return (c.invitees ?? c.attendees ?? []).map((n) => String(n).trim()).filter(Boolean);
}

function recordedAt(c: FathomCall): Date | undefined {
  const raw = c.recorded_at ?? c.recordedAt ?? c.date;
  if (raw == null) return undefined;
  if (typeof raw === 'number') {
    const d = new Date(raw < 1e12 ? raw * 1000 : raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Pure: turn one Fathom call into a SourceDocument. Summary leads, action items
 * are listed, the transcript follows. Unit-testable with an inline call.
 */
export function fathomCallDoc(call: FathomCall, index: number): SourceDocument | null {
  const title = (call.title ?? call.meeting_title ?? '').trim();
  const actions = call.action_items ?? call.actionItems ?? [];
  const parts: string[] = [];
  if (call.summary) parts.push(String(call.summary).trim());
  if (actions.length) parts.push('Action items:\n' + actions.map((a) => `- ${a}`).join('\n'));
  const transcript = (call.transcript ?? call.content ?? '').trim();
  if (transcript) parts.push('Transcript:\n' + transcript);
  const body = parts.filter(Boolean).join('\n\n');
  if (!body && !title) return null;

  const attendees = attendeesOf(call);
  const at = recordedAt(call);
  return {
    sourceId: String(call.id ?? at?.toISOString() ?? `fathom-${index}`),
    sourceType: 'fathom_call',
    sourceUrl: call.share_url ?? call.url,
    title: title || 'Recorded call',
    content: body || title,
    tags: [...new Set(['fathom', ...attendees.map((n) => n.toLowerCase())])],
    metadata: { attendees, actionItems: actions, recordedAt: at?.toISOString() },
    sourceCreatedAt: at,
    sourceUpdatedAt: at,
  };
}

export function parseFathomExport(raw: string): FathomCall[] {
  const data: unknown = JSON.parse(raw);
  if (Array.isArray(data)) return data as FathomCall[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['calls', 'recordings', 'meetings', 'items']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as FathomCall[];
    }
  }
  throw new Error('fathom connector: export is not an array or a known wrapper ({ calls: [...] })');
}

export const fathomConnector: Connector = {
  id: 'fathom',
  displayName: 'Fathom',
  description: 'Index your Fathom call recordings, one searchable memory per call (summary, action items, transcript).',
  category: 'chat',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'Call export',
      type: 'path',
      required: true,
      placeholder: '/exports/fathom-calls.json',
      help: 'Absolute path to a Fathom call-history export (JSON).',
    },
  ],
  async *pull(ctx) {
    const path = String(ctx.config.path ?? '').trim();
    if (!path || !existsSync(path)) throw new Error(`fathom connector: export file does not exist: ${path}`);
    const calls = parseFathomExport(readFileSync(path, 'utf8'));
    ctx.log?.('parsed fathom export', { path: basename(path), calls: calls.length });
    let i = 0;
    for (const c of calls) {
      if (ctx.signal?.aborted) return;
      const doc = fathomCallDoc(c, i++);
      if (doc) yield doc;
    }
  },
};
