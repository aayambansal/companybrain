import { describe, it, expect } from 'vitest';
import { airtableRecordDoc } from './airtable.js';

describe('airtableRecordDoc', () => {
  it('uses the title field and renders fields as lines', () => {
    const doc = airtableRecordDoc(
      {
        id: 'rec1',
        fields: {
          Name: 'Launch plan',
          Status: 'In progress',
          Priority: 3,
        },
        createdTime: '2024-02-01T09:30:00.000Z',
      },
      'Name',
    );
    expect(doc.sourceId).toBe('rec1');
    expect(doc.sourceType).toBe('airtable');
    expect(doc.title).toBe('Launch plan');
    expect(doc.content).toBe('Name: Launch plan\nStatus: In progress\nPriority: 3');
    expect(doc.tags).toEqual(['airtable']);
    expect(doc.metadata?.fields).toEqual({
      Name: 'Launch plan',
      Status: 'In progress',
      Priority: 3,
    });
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-02-01T09:30:00.000Z');
  });

  it('falls back to the first string field when the title field is missing', () => {
    const doc = airtableRecordDoc(
      { id: 'rec2', fields: { Count: 7, Label: 'Fallback title' } },
      'Name',
    );
    expect(doc.title).toBe('Fallback title');
    expect(doc.content).toBe('Count: 7\nLabel: Fallback title');
  });

  it('falls back to the record id when there is no usable field', () => {
    const doc = airtableRecordDoc({ id: 'rec3', fields: { Count: 0 } }, 'Name');
    expect(doc.title).toBe('rec3');
  });
});
