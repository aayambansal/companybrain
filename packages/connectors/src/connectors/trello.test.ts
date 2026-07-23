import { describe, it, expect } from 'vitest';
import { trelloCardDoc } from './trello.js';

describe('trelloCardDoc', () => {
  it('maps a card with a description', () => {
    const doc = trelloCardDoc({
      id: 'card1',
      name: 'Ship the connector',
      desc: 'Wire up Trello cards into the index.',
      url: 'https://trello.com/c/card1',
      dateLastActivity: '2024-01-15T10:00:00.000Z',
    });
    expect(doc.sourceId).toBe('card1');
    expect(doc.sourceType).toBe('trello_card');
    expect(doc.sourceUrl).toBe('https://trello.com/c/card1');
    expect(doc.title).toBe('Ship the connector');
    expect(doc.content).toBe('Ship the connector\n\nWire up Trello cards into the index.');
    expect(doc.tags).toEqual(['trello']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2024-01-15T10:00:00.000Z');
  });

  it('maps a card with no description to just its name', () => {
    const doc = trelloCardDoc({
      id: 'card2',
      name: 'A card with no body',
      desc: '',
      url: 'https://trello.com/c/card2',
    });
    expect(doc.title).toBe('A card with no body');
    expect(doc.content).toBe('A card with no body');
    expect(doc.tags).toEqual(['trello']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
