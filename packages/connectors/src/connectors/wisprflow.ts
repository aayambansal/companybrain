import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { Connector, SourceDocument } from '@companybrain/core';

/**
 * One dictated "flow" from Wispr Flow's history export. The app writes voice
 * dictations to a local history you can export as JSON; field names have
 * shifted across versions, so every alias is accepted and normalized below.
 */
export interface WisprFlowEntry {
  id?: string | number;
  /** The transcribed text of the dictation. */
  text?: string;
  transcript?: string;
  content?: string;
  /** The app or window the dictation was spoken into. */
  app?: string;
  application?: string;
  context?: string;
  /** When it was dictated. */
  timestamp?: string | number;
  createdAt?: string | number;
  created_at?: string | number;
  date?: string | number;
  /** Length of the recording, in milliseconds. */
  durationMs?: number;
  duration_ms?: number;
  wordCount?: number;
  word_count?: number;
  language?: string;
  lang?: string;
}

/** Pull the transcript text out of an entry, whatever the export called it. */
function entryText(entry: WisprFlowEntry): string {
  return String(entry.text ?? entry.transcript ?? entry.content ?? '').trim();
}

/** Pull the app/context label out of an entry, if the export recorded one. */
function entryApp(entry: WisprFlowEntry): string | undefined {
  const app = entry.app ?? entry.application ?? entry.context;
  const s = app == null ? '' : String(app).trim();
  return s || undefined;
}

/** Normalize any of the timestamp aliases to a Date, or undefined. */
function entryDate(entry: WisprFlowEntry): Date | undefined {
  const raw = entry.timestamp ?? entry.createdAt ?? entry.created_at ?? entry.date;
  if (raw == null) return undefined;
  // Numeric epochs may be seconds or milliseconds; treat < 1e12 as seconds.
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Pure: turn one Wispr Flow dictation into a SourceDocument. The title is a
 * short prefix of the transcript so voice notes are recognizable in a list;
 * the app it was dictated into becomes a tag. Unit-testable with an inline
 * entry.
 */
export function wisprFlowEntryDoc(entry: WisprFlowEntry, index: number): SourceDocument | null {
  const text = entryText(entry);
  if (!text) return null;

  const app = entryApp(entry);
  const when = entryDate(entry);
  const firstLine = (text.split(/\r?\n/)[0] ?? text).trim();
  const title = firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;

  const tags = ['wispr-flow'];
  if (app) tags.push(app.toLowerCase());

  const words = entry.wordCount ?? entry.word_count ?? text.split(/\s+/).filter(Boolean).length;

  return {
    sourceId: String(entry.id ?? when?.toISOString() ?? `wispr-${index}`),
    sourceType: 'wispr_flow',
    title: title || 'Voice dictation',
    content: text,
    tags,
    metadata: {
      app,
      wordCount: words,
      durationMs: entry.durationMs ?? entry.duration_ms,
      language: entry.language ?? entry.lang,
    },
    sourceCreatedAt: when,
    sourceUpdatedAt: when,
  };
}

/** Accept a bare array, or the common wrapper keys, and return the entries. */
export function parseWisprFlowExport(raw: string): WisprFlowEntry[] {
  const data: unknown = JSON.parse(raw);
  if (Array.isArray(data)) return data as WisprFlowEntry[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['flows', 'history', 'entries', 'items', 'dictations', 'transcripts']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as WisprFlowEntry[];
    }
  }
  throw new Error('wispr flow connector: export is not an array or a known wrapper ({ flows: [...] })');
}

export const wisprFlowConnector: Connector = {
  id: 'wisprflow',
  displayName: 'Wispr Flow',
  description: 'Index your Wispr Flow voice dictations, one searchable note per flow.',
  category: 'other',
  auth: 'path',
  configSchema: [
    {
      key: 'path',
      label: 'History export',
      type: 'path',
      required: true,
      placeholder: '/exports/wispr-flow-history.json',
      help: 'Absolute path to a Wispr Flow history export (JSON). Export it from Wispr Flow, then point this here.',
    },
  ],
  async *pull(ctx) {
    const path = String(ctx.config.path ?? '').trim();
    if (!path || !existsSync(path)) {
      throw new Error(`wispr flow connector: export file does not exist: ${path}`);
    }
    const entries = parseWisprFlowExport(readFileSync(path, 'utf8'));
    ctx.log?.('parsed wispr flow export', { path: basename(path), entries: entries.length });

    let index = 0;
    for (const entry of entries) {
      if (ctx.signal?.aborted) return;
      const doc = wisprFlowEntryDoc(entry, index++);
      if (doc) yield doc;
    }
  },
};
