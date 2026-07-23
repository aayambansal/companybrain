import { describe, it, expect } from 'vitest';
import { clickupTaskDoc } from './clickup.js';

describe('clickupTaskDoc', () => {
  it('maps a task, preferring text_content over description', () => {
    const doc = clickupTaskDoc({
      id: 'abc123',
      name: 'Ship the ClickUp connector',
      description: 'raw markdown body',
      text_content: 'Index tasks by name and body.',
      url: 'https://app.clickup.com/t/abc123',
      date_updated: '1716196500000',
    });
    expect(doc.sourceId).toBe('abc123');
    expect(doc.sourceType).toBe('clickup_task');
    expect(doc.sourceUrl).toBe('https://app.clickup.com/t/abc123');
    expect(doc.title).toBe('Ship the ClickUp connector');
    expect(doc.content).toBe('Ship the ClickUp connector\n\nIndex tasks by name and body.');
    expect(doc.tags).toEqual(['clickup']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.getTime()).toBe(1716196500000);
  });

  it('falls back to description when text_content is empty', () => {
    const doc = clickupTaskDoc({
      id: 'def456',
      name: 'Task with only a description',
      description: 'Some description text.',
      text_content: '',
      url: 'https://app.clickup.com/t/def456',
    });
    expect(doc.content).toBe('Task with only a description\n\nSome description text.');
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });

  it('maps a task with no body to just its name', () => {
    const doc = clickupTaskDoc({
      id: 'ghi789',
      name: 'A task with no body',
      url: 'https://app.clickup.com/t/ghi789',
    });
    expect(doc.title).toBe('A task with no body');
    expect(doc.content).toBe('A task with no body');
    expect(doc.tags).toEqual(['clickup']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
