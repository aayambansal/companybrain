import { describe, it, expect } from 'vitest';
import { telegramMessageDoc } from './telegram.js';

describe('telegramMessageDoc', () => {
  it('maps a text message to a document', () => {
    const doc = telegramMessageDoc({
      update_id: 42,
      message: {
        message_id: 7,
        text: 'Shipping the Telegram connector today',
        date: 1_700_000_000,
        chat: { id: -1001234567890, title: 'Eng chat' },
        from: { id: 1, username: 'alice' },
      },
    });
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('-1001234567890:7');
    expect(doc!.sourceType).toBe('telegram');
    expect(doc!.title).toBe('Shipping the Telegram connector today');
    expect(doc!.content).toBe('Shipping the Telegram connector today');
    expect(doc!.tags).toEqual(['telegram']);
    expect(doc!.metadata?.chatTitle).toBe('Eng chat');
    expect(doc!.metadata?.author).toBe('alice');
    expect(doc!.sourceCreatedAt).toBeInstanceOf(Date);
    expect(doc!.sourceCreatedAt?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('truncates the title to 80 characters', () => {
    const long = 'x'.repeat(120);
    const doc = telegramMessageDoc({
      update_id: 43,
      message: { message_id: 8, text: long, date: 1, chat: { id: 1 } },
    });
    expect(doc!.title).toHaveLength(80);
    expect(doc!.content).toBe(long);
  });

  it('returns null for a non-text update', () => {
    const doc = telegramMessageDoc({
      update_id: 44,
      message: {
        message_id: 9,
        date: 1_700_000_000,
        chat: { id: 1 },
        sticker: { file_id: 'CAACAgIAAxk...' },
      },
    });
    expect(doc).toBeNull();
    expect(telegramMessageDoc({ update_id: 45 })).toBeNull();
  });
});
