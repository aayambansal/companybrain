import { describe, it, expect, vi, afterEach } from 'vitest';
import { discordMessageDoc, discordConnector } from './discord.js';

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
      discordMessageDoc(
        { id: '2', content: 'beep boop', author: { username: 'bot', bot: true } },
        'chan-1',
      ),
    ).toBeNull();
  });
});

describe('discordConnector pull', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('re-scans from newest and does not persist a backward cursor', async () => {
    const urls: string[] = [];
    let setCursorCalled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        const before = String(url).match(/before=(\d+)/)?.[1];
        const body = before
          ? []
          : [
              { id: '3', content: 'c', author: { username: 'u' } },
              { id: '2', content: 'b', author: { username: 'u' } },
            ];
        return { ok: true, json: async () => body } as Response;
      }),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = {
      config: { botToken: 't', channelId: 'C' },
      cursor: 'STALE',
      setCursor: async () => {
        setCursorCalled = true;
      },
      log: () => {},
    } as any;
    const ids: string[] = [];
    for await (const d of discordConnector.pull(ctx)) ids.push(d.sourceId!);

    // Ignores the stale saved cursor (starts from newest), and never persists one.
    expect(urls[0]).not.toContain('before=');
    expect(setCursorCalled).toBe(false);
    expect(ids).toEqual(['C:3', 'C:2']);
  });
});
