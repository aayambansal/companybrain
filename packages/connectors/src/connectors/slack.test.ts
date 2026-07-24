import { describe, it, expect, vi, afterEach } from 'vitest';
import { slackMessageDoc, slackConnector } from './slack.js';

describe('slackMessageDoc', () => {
  it('maps a normal message to a document', () => {
    const doc = slackMessageDoc(
      { type: 'message', user: 'U1', text: 'Deploy is green', ts: '1700000000.000100' },
      'C1',
    );
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('C1:1700000000.000100');
    expect(doc!.content).toBe('Deploy is green');
    expect(doc!.metadata?.user).toBe('U1');
  });

  it('skips empty messages and channel-join noise', () => {
    expect(slackMessageDoc({ type: 'message', text: '   ' }, 'C1')).toBeNull();
    expect(
      slackMessageDoc({ type: 'message', subtype: 'channel_join', text: 'joined' }, 'C1'),
    ).toBeNull();
  });

  it('keeps thread broadcasts', () => {
    const doc = slackMessageDoc(
      { type: 'message', subtype: 'thread_broadcast', text: 'shipped', ts: '1.1' },
      'C1',
    );
    expect(doc).not.toBeNull();
  });
});

describe('slackConnector pull incremental', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stub(messages: { ts: string; text: string }[], urls: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return {
          ok: true,
          json: async () => ({ ok: true, messages, response_metadata: {} }),
        } as Response;
      }),
    );
  }

  it('first sync fetches without oldest and saves the newest ts', async () => {
    const urls: string[] = [];
    const saved: string[] = [];
    stub(
      [
        { ts: '100.0', text: 'a' },
        { ts: '200.0', text: 'b' },
      ],
      urls,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = {
      config: { token: 't', channel: 'C1' },
      setCursor: async (c: string) => saved.push(c),
      log: () => {},
    } as any;
    const ids: string[] = [];
    for await (const d of slackConnector.pull(ctx)) ids.push(d.sourceId!);
    expect(ids).toEqual(['C1:100.0', 'C1:200.0']);
    expect(urls[0]).not.toContain('oldest=');
    expect(saved).toEqual(['200.0']);
  });

  it('incremental sync passes oldest and advances the cursor to the newest ts', async () => {
    const urls: string[] = [];
    const saved: string[] = [];
    stub([{ ts: '300.0', text: 'c' }], urls);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = {
      config: { token: 't', channel: 'C1' },
      cursor: '200.0',
      setCursor: async (c: string) => saved.push(c),
      log: () => {},
    } as any;
    const ids: string[] = [];
    for await (const d of slackConnector.pull(ctx)) ids.push(d.sourceId!);
    expect(ids).toEqual(['C1:300.0']);
    expect(urls[0]).toContain('oldest=200.0');
    expect(saved).toEqual(['300.0']);
  });
});
