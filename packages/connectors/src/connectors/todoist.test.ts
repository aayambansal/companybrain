import { describe, it, expect } from 'vitest';
import { todoistTaskDoc } from './todoist.js';

describe('todoistTaskDoc', () => {
  it('maps a task with a description', () => {
    const doc = todoistTaskDoc({
      id: '2995104339',
      content: 'Ship the Todoist connector',
      description: 'Index tasks by content and description.',
      url: 'https://todoist.com/showTask?id=2995104339',
      created_at: '2024-05-20T09:15:00.000000Z',
    });
    expect(doc.sourceId).toBe('2995104339');
    expect(doc.sourceType).toBe('todoist_task');
    expect(doc.sourceUrl).toBe('https://todoist.com/showTask?id=2995104339');
    expect(doc.title).toBe('Ship the Todoist connector');
    expect(doc.content).toBe('Ship the Todoist connector\n\nIndex tasks by content and description.');
    expect(doc.tags).toEqual(['todoist']);
    expect(doc.sourceCreatedAt).toBeInstanceOf(Date);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2024-05-20T09:15:00.000Z');
  });

  it('maps a task with no description to just its content', () => {
    const doc = todoistTaskDoc({
      id: '2995104340',
      content: 'A task with no body',
      description: '',
      url: 'https://todoist.com/showTask?id=2995104340',
    });
    expect(doc.title).toBe('A task with no body');
    expect(doc.content).toBe('A task with no body');
    expect(doc.tags).toEqual(['todoist']);
    expect(doc.sourceCreatedAt).toBeUndefined();
  });
});
