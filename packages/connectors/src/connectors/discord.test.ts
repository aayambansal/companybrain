import { describe, it, expect } from 'vitest';
import { discordMessageDoc } from './discord.js';

describe('discordMessageDoc', () => {
  it('maps a normal message to a document', () => {
    const doc = discordMessageDoc(
      {
        id: '999',
        content: 'Shipping the new connector today',
        timestamp: '2026-07-22T18:30:00.000Z',
        author: { id: 'u1', username: 'alice', bot: false },
      },
      'chan-1',
    );
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('chan-1:999');
    expect(doc!.sourceType).toBe('discord_message');
    expect(doc!.title).toBe('Shipping the new connector today');
    expect(doc!.content).toBe('Shipping the new connector today');
    expect(doc!.tags).toEqual(['discord']);
    expect(doc!.metadata?.author).toBe('alice');
    expect(doc!.sourceCreatedAt).toBeInstanceOf(Date);
  });

  it('skips empty messages and bot noise', () => {
    expect(discordMessageDoc({ id: '1', content: '   ' }, 'chan-1')).toBeNull();
    expect(
      discordMessageDoc({ id: '2', content: 'beep boop', author: { username: 'bot', bot: true } }, 'chan-1'),
    ).toBeNull();
  });
});
