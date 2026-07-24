import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface DiscordAuthor {
  id?: string;
  username?: string;
  bot?: boolean;
}
interface DiscordMessage {
  id: string;
  content?: string;
  timestamp?: string;
  author?: DiscordAuthor;
  type?: number;
}

/** Pure: turn a Discord message into a SourceDocument, or null if not indexable. */
export function discordMessageDoc(msg: DiscordMessage, channelId: string): SourceDocument | null {
  const content = (msg.content ?? '').trim();
  if (!content || msg.author?.bot) return null;
  const when = msg.timestamp ? new Date(msg.timestamp) : undefined;
  return {
    sourceId: `${channelId}:${msg.id}`,
    sourceType: 'discord_message',
    title: content.slice(0, 80),
    content,
    tags: ['discord'],
    metadata: { channelId, messageId: msg.id, author: msg.author?.username },
    sourceCreatedAt: when && !Number.isNaN(when.getTime()) ? when : undefined,
  };
}

export const discordConnector: Connector = {
  id: 'discord',
  displayName: 'Discord',
  description: 'Index messages from a Discord channel via a bot token.',
  category: 'chat',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'botToken',
      label: 'Bot token',
      type: 'password',
      required: true,
      placeholder: 'MTA...',
      help: 'A bot token with access to the channel and the Read Message History permission.',
    },
    {
      key: 'channelId',
      label: 'Channel ID',
      type: 'string',
      required: true,
      placeholder: '123456789012345678',
      help: 'The channel to index. The bot must be a member of the server.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.botToken ?? '').trim();
    const channelId = String(ctx.config.channelId ?? '').trim();
    if (!token || !channelId)
      throw new Error('discord connector: config.botToken and config.channelId are required');
    const headers = { authorization: `Bot ${token}` };

    // Re-scan from the newest messages each sync; dedup by message id skips ones
    // already stored, so new messages are picked up. `before` is a within-sync
    // pagination cursor only: it is not persisted, because it points backward
    // through history and resuming from it would miss everything posted since.
    let before: string | undefined;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const params = new URLSearchParams({ limit: '100' });
      if (before) params.set('before', before);
      const messages = await fetchJson<DiscordMessage[]>(
        `https://discord.com/api/v10/channels/${channelId}/messages?${params}`,
        { headers, signal: ctx.signal },
      );
      if (messages.length === 0) break;

      for (const msg of messages) {
        if (ctx.signal?.aborted) return;
        const doc = discordMessageDoc(msg, channelId);
        if (doc) yield doc;
      }

      const last = messages[messages.length - 1];
      before = last?.id;
      if (!before) break;
    }
  },
};
