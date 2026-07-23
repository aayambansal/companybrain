import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';

/**
 * One meeting from a Granola export. Granola takes AI notes on your calls; you
 * can export your notes history as JSON. Field names differ across versions, so
 * every reasonable alias is accepted and normalized below.
 */
export interface GranolaMeeting {
  id?: string | number;
  title?: string;
  name?: string;
  /** The generated summary / notes. */
  summary?: string;
  notes?: string;
  /** The full transcript, when present. */
  transcript?: string;
  content?: string;
  attendees?: string[];
  participants?: string[];
  date?: string | number;
  createdAt?: string | number;
  created_at?: string | number;
  startedAt?: string | number;
  url?: string;
}

function names(m: GranolaMeeting): string[] {
  const list = m.attendees ?? m.participants ?? [];
  return list.map((n) => String(n).trim()).filter(Boolean);
}

function when(m: GranolaMeeting): Date | undefined {
  const raw = m.date ?? m.createdAt ?? m.created_at ?? m.startedAt;
  if (raw == null) return undefined;
  if (typeof raw === 'number') {
    const d = new Date(raw < 1e12 ? raw * 1000 : raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Pure: turn one Granola meeting into a SourceDocument. Notes/summary lead, the
 * transcript follows, attendees become tags. Unit-testable with an inline meeting.
 */
export function granolaMeetingDoc(meeting: GranolaMeeting, index: number): SourceDocument | null {
  const title = (meeting.title ?? meeting.name ?? '').trim();
  const body = [meeting.summary ?? meeting.notes, meeting.transcript ?? meeting.content]
    .map((s) => (s == null ? '' : String(s).trim()))
    .filter(Boolean)
    .join('\n\n');
  if (!body && !title) return null;

  const attendees = names(meeting);
  const at = when(meeting);
  const tags = ['granola', ...attendees.map((n) => n.toLowerCase())];

  return {
    sourceId: String(meeting.id ?? at?.toISOString() ?? `granola-${index}`),
    sourceType: 'granola_meeting',
    sourceUrl: meeting.url,
    title: title || 'Meeting notes',
    content: body || title,
    tags: [...new Set(tags)],
    metadata: { attendees, meetingDate: at?.toISOString() },
    sourceCreatedAt: at,
    sourceUpdatedAt: at,
  };
}

/** Accept a bare array or a common wrapper, and return the meetings. */
export function parseGranolaExport(raw: string): GranolaMeeting[] {
  const data: unknown = JSON.parse(raw);
  if (Array.isArray(data)) return data as GranolaMeeting[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['meetings', 'notes', 'documents', 'items', 'sessions']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as GranolaMeeting[];
    }
  }
  throw new Error(
    'granola connector: export is not an array or a known wrapper ({ meetings: [...] })',
  );
}

export const granolaConnector: Connector = {
  id: 'granola',
  displayName: 'Granola',
  description:
    'Index your Granola meeting notes and transcripts, one searchable memory per meeting.',
  category: 'chat',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'Notes export',
      type: 'path',
      required: true,
      placeholder: '/exports/granola-notes.json',
      help: 'Absolute path to a Granola notes export (JSON).',
    },
  ],
  async *pull(ctx) {
    const path = String(ctx.config.path ?? '').trim();
    if (!path || !existsSync(path))
      throw new Error(`granola connector: export file does not exist: ${path}`);
    const meetings = parseGranolaExport(readFileSync(path, 'utf8'));
    ctx.log?.('parsed granola export', { path: basename(path), meetings: meetings.length });
    let i = 0;
    for (const m of meetings) {
      if (ctx.signal?.aborted) return;
      const doc = granolaMeetingDoc(m, i++);
      if (doc) yield doc;
    }
  },
};
