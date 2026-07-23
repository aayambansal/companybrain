import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface SlackMessage {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
}

/** Pure: turn a Slack message into a SourceDocument, or null if not indexable. */
export function slackMessageDoc(msg: SlackMessage, channel: string): SourceDocument | null {
  const text = (msg.text ?? '').trim();
  if (!text || (msg.subtype && msg.subtype !== 'thread_broadcast')) return null;
  const who = msg.user ?? msg.bot_id ?? 'unknown';
  const when = msg.ts ? new Date(Number(msg.ts) * 1000) : undefined;
  return {
    sourceId: `${channel}:${msg.ts}`,
    sourceType: 'slack_message',
    title: text.slice(0, 80),
    content: text,
    tags: ['slack', channel],
    metadata: { channel, user: who, ts: msg.ts, threadTs: msg.thread_ts },
    sourceCreatedAt: when,
  };
}

export const slackConnector: Connector = {
  id: 'slack',
  displayName: 'Slack',
  description: 'Index messages from a Slack channel via a bot token.',
  category: 'chat',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'token',
      label: 'Bot token',
      type: 'password',
      required: true,
      placeholder: 'xoxb-...',
      help: 'A bot token with channels:history and channels:read scopes.',
    },
    {
      key: 'channel',
      label: 'Channel ID',
      type: 'string',
      required: true,
      placeholder: 'C0123456789',
      help: 'The channel to index. Invite the bot to it first.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.token ?? '').trim();
    const channel = String(ctx.config.channel ?? '').trim();
    if (!token || !channel)
      throw new Error('slack connector: config.token and config.channel are required');
    const auth = { authorization: `Bearer ${token}` };

    let cursor: string | undefined = ctx.cursor ?? undefined;
    do {
      const params = new URLSearchParams({ channel, limit: '200' });
      if (cursor) params.set('cursor', cursor);
      const res = await fetchJson<{
        ok: boolean;
        error?: string;
        messages?: SlackMessage[];
        response_metadata?: { next_cursor?: string };
      }>(`https://slack.com/api/conversations.history?${params}`, {
        headers: auth,
        signal: ctx.signal,
      });
      if (!res.ok) throw new Error(`slack: ${res.error ?? 'request failed'}`);

      for (const msg of res.messages ?? []) {
        if (ctx.signal?.aborted) return;
        const doc = slackMessageDoc(msg, channel);
        if (doc) yield doc;
      }
      cursor = res.response_metadata?.next_cursor || undefined;
      if (cursor) await ctx.setCursor?.(cursor);
    } while (cursor);
  },
};
