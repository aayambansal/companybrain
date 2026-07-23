import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface PipedriveNote {
  id: string | number;
  content?: string;
  add_time?: string;
}

interface PipedriveNotesResponse {
  data?: PipedriveNote[];
  additional_data?: {
    pagination?: {
      more_items_in_collection?: boolean;
      next_start?: number | null;
    };
  };
}

/** Parse a Pipedrive timestamp ('YYYY-MM-DD HH:MM:SS', UTC) into a Date. */
function pipedriveDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Pure: turn a Pipedrive note (HTML content) into a SourceDocument. */
export function pipedriveNoteDoc(note: PipedriveNote): SourceDocument {
  const text = htmlToText(note.content ?? '');
  return {
    sourceId: String(note.id),
    sourceType: 'pipedrive_note',
    title: text.slice(0, 80),
    content: text,
    tags: ['pipedrive'],
    metadata: { id: note.id },
    sourceCreatedAt: pipedriveDate(note.add_time),
  };
}

export const pipedriveConnector: Connector = {
  id: 'pipedrive',
  displayName: 'Pipedrive',
  description: 'Index Pipedrive CRM notes via the REST API (domain + API token).',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    { key: 'domain', label: 'Domain', type: 'string', required: true, placeholder: 'acme', help: 'The <domain> in https://<domain>.pipedrive.com.' },
    { key: 'apiToken', label: 'API token', type: 'password', required: true, help: 'Find under Pipedrive > Settings > Personal preferences > API.' },
  ],
  async *pull(ctx) {
    const domain = String(ctx.config.domain ?? '').trim();
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    if (!domain || !apiToken) throw new Error('pipedrive connector: domain and apiToken are required');

    let start: number | undefined = 0;
    while (start !== undefined) {
      if (ctx.signal?.aborted) return;
      const url = `https://${domain}.pipedrive.com/api/v1/notes?limit=100&start=${start}&api_token=${encodeURIComponent(apiToken)}`;
      const res: PipedriveNotesResponse = await fetchJson<PipedriveNotesResponse>(url, { signal: ctx.signal });
      for (const note of res.data ?? []) {
        const doc = pipedriveNoteDoc(note);
        if (!doc.content.trim()) continue;
        yield doc;
      }
      const pagination = res.additional_data?.pagination;
      start = pagination?.more_items_in_collection && pagination.next_start != null ? pagination.next_start : undefined;
    }
  },
};
