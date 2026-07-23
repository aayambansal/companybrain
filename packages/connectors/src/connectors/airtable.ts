import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

/** A single Airtable record as returned by the REST API. */
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime?: string;
}

/** Render a single field value into a readable string for a content line. */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => renderValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Pure: map an Airtable record into a SourceDocument. Unit-testable. */
export function airtableRecordDoc(record: AirtableRecord, titleField: string): SourceDocument {
  const fields = record.fields ?? {};

  let title: string | undefined;
  const named = fields[titleField];
  if (named !== null && named !== undefined && named !== '') {
    title = renderValue(named);
  } else {
    for (const value of Object.values(fields)) {
      if (typeof value === 'string' && value) {
        title = value;
        break;
      }
    }
  }
  if (!title) title = record.id;

  const content = Object.entries(fields)
    .map(([key, value]) => `${key}: ${renderValue(value)}`)
    .join('\n');

  return {
    sourceId: record.id,
    sourceType: 'airtable',
    title,
    content,
    tags: ['airtable'],
    metadata: { fields },
    sourceCreatedAt: record.createdTime ? new Date(record.createdTime) : undefined,
  };
}

interface AirtablePage {
  records: AirtableRecord[];
  offset?: string;
}

export const airtableConnector: Connector = {
  id: 'airtable',
  displayName: 'Airtable',
  description: 'Index records from an Airtable table via a personal access token.',
  category: 'other',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'apiToken',
      label: 'Personal access token',
      type: 'password',
      required: true,
      placeholder: 'pat...',
      help: 'An Airtable personal access token with data.records:read scope.',
    },
    {
      key: 'baseId',
      label: 'Base ID',
      type: 'string',
      required: true,
      placeholder: 'app...',
      help: 'The id of the base containing the table.',
    },
    {
      key: 'table',
      label: 'Table',
      type: 'string',
      required: true,
      placeholder: 'Tasks',
      help: 'The table name or id to index.',
    },
    {
      key: 'titleField',
      label: 'Title field',
      type: 'string',
      required: false,
      default: 'Name',
      placeholder: 'Name',
      help: 'The field to use as the document title. Defaults to "Name".',
    },
  ],
  async *pull(ctx) {
    const apiToken = String(ctx.config.apiToken ?? '').trim();
    const baseId = String(ctx.config.baseId ?? '').trim();
    const table = String(ctx.config.table ?? '').trim();
    const titleField = String(ctx.config.titleField ?? 'Name').trim() || 'Name';
    if (!apiToken) throw new Error('airtable connector: config.apiToken is required');
    if (!baseId) throw new Error('airtable connector: config.baseId is required');
    if (!table) throw new Error('airtable connector: config.table is required');

    const headers = { authorization: `Bearer ${apiToken}` };
    const base = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`;

    let offset: string | undefined;
    do {
      const params = new URLSearchParams({ pageSize: '100' });
      if (offset) params.set('offset', offset);
      const url = `${base}?${params}`;
      ctx.log?.('fetching airtable records', { baseId, table, offset });
      const page = await fetchJson<AirtablePage>(url, { headers, signal: ctx.signal });
      for (const record of page.records ?? []) {
        if (ctx.signal?.aborted) return;
        yield airtableRecordDoc(record, titleField);
      }
      offset = page.offset;
    } while (offset);
  },
};
