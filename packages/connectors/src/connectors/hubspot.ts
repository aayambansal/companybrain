import { htmlToText, type Connector, type SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface HubspotNote {
  id: string | number;
  properties?: {
    hs_note_body?: string;
    hs_timestamp?: string | number;
  };
}

interface HubspotNotesResponse {
  results?: HubspotNote[];
  paging?: { next?: { after?: string } };
}

/** Parse a HubSpot timestamp (ISO string or epoch-millis) into a Date. */
function hubspotDate(value: string | number | undefined): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Pure: turn a HubSpot CRM note (HTML body) into a SourceDocument. */
export function hubspotNoteDoc(note: HubspotNote): SourceDocument {
  const text = htmlToText(note.properties?.hs_note_body ?? '');
  return {
    sourceId: String(note.id),
    sourceType: 'hubspot_note',
    title: text.slice(0, 80),
    content: text,
    tags: ['hubspot'],
    metadata: { id: note.id },
    sourceCreatedAt: hubspotDate(note.properties?.hs_timestamp),
  };
}

export const hubspotConnector: Connector = {
  id: 'hubspot',
  displayName: 'HubSpot',
  description: 'Index HubSpot CRM notes via the REST API (private app token).',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    { key: 'accessToken', label: 'Access token', type: 'password', required: true, help: 'Create a private app under HubSpot > Settings > Integrations > Private Apps and copy its token.' },
  ],
  async *pull(ctx) {
    const accessToken = String(ctx.config.accessToken ?? '').trim();
    if (!accessToken) throw new Error('hubspot connector: config.accessToken is required');
    const headers = { authorization: `Bearer ${accessToken}` };

    const base = 'https://api.hubapi.com/crm/v3/objects/notes?limit=100&properties=hs_note_body,hs_timestamp';
    let url: string | undefined = base;
    while (url) {
      if (ctx.signal?.aborted) return;
      const res: HubspotNotesResponse = await fetchJson<HubspotNotesResponse>(url, { headers, signal: ctx.signal });
      for (const note of res.results ?? []) {
        const doc = hubspotNoteDoc(note);
        if (!doc.content.trim()) continue;
        yield doc;
      }
      const after = res.paging?.next?.after;
      url = after ? `${base}&after=${encodeURIComponent(after)}` : undefined;
    }
  },
};
