import { describe, it, expect } from 'vitest';
import { asanaTaskDoc } from './asana.js';

describe('asanaTaskDoc', () => {
  it('maps a task with notes', () => {
    const doc = asanaTaskDoc({
      gid: '1201234567890',
      name: 'Ship the Asana connector',
      notes: 'Index tasks by name and notes.',
      permalink_url: 'https://app.asana.com/0/1201234567890/1209876543210',
      modified_at: '2024-05-20T09:15:00.000Z',
    });
    expect(doc.sourceId).toBe('1201234567890');
    expect(doc.sourceType).toBe('asana_task');
    expect(doc.sourceUrl).toBe('https://app.asana.com/0/1201234567890/1209876543210');
    expect(doc.title).toBe('Ship the Asana connector');
    expect(doc.content).toBe('Ship the Asana connector\n\nIndex tasks by name and notes.');
    expect(doc.tags).toEqual(['asana']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2024-05-20T09:15:00.000Z');
  });

  it('maps a task with no notes to just its name', () => {
    const doc = asanaTaskDoc({
      gid: '1209999999999',
      name: 'A task with no body',
      notes: '',
      permalink_url: 'https://app.asana.com/0/1201234567890/1209999999999',
    });
    expect(doc.title).toBe('A task with no body');
    expect(doc.content).toBe('A task with no body');
    expect(doc.tags).toEqual(['asana']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
