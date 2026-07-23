import type { Connector, SourceDocument } from '@companybrain/core';
import { fetchJson } from '../http.js';

interface TelegramChat {
  id: number;
  title?: string;
}
interface TelegramFrom {
  id?: number;
  username?: string;
  first_name?: string;
}
interface TelegramMessage {
  message_id: number;
  text?: string;
  date?: number;
  chat: TelegramChat;
  from?: TelegramFrom;
  /** Non-text payloads (sticker, photo, etc.) are present but ignored. */
  sticker?: unknown;
}
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

/**
 * Pure: map a Telegram update into a SourceDocument, or null when it carries no
 * text message (e.g. a sticker or a service update). Unit-testable.
 */
export function telegramMessageDoc(update: TelegramUpdate): SourceDocument | null {
  const message = update.message;
  const text = message?.text;
  if (!message || !text) return null;
  return {
    sourceId: `${message.chat.id}:${message.message_id}`,
    sourceType: 'telegram',
    title: text.slice(0, 80),
    content: text,
    tags: ['telegram'],
    metadata: {
      updateId: update.update_id,
      chatId: message.chat.id,
      chatTitle: message.chat.title,
      messageId: message.message_id,
      author: message.from?.username ?? message.from?.first_name,
    },
    sourceCreatedAt: message.date ? new Date(message.date * 1000) : undefined,
  };
}

export const telegramConnector: Connector = {
  id: 'telegram',
  displayName: 'Telegram',
  description: 'Index messages from a Telegram channel or chat via a bot.',
  category: 'chat',
  auth: 'apiKey',
  configSchema: [
    {
      key: 'botToken',
      label: 'Bot token',
      type: 'password',
      required: true,
      placeholder: '123456:ABC-DEF...',
      help: 'A bot token from @BotFather. The bot must be a member of the chat.',
    },
    {
      key: 'chatId',
      label: 'Chat ID',
      type: 'string',
      required: false,
      placeholder: '-1001234567890',
      help: 'Only index messages from this chat. Leave blank to index every chat the bot sees.',
    },
  ],
  async *pull(ctx) {
    const token = String(ctx.config.botToken ?? '').trim();
    if (!token) throw new Error('telegram connector: config.botToken is required');
    const chatFilter = String(ctx.config.chatId ?? '').trim();

    const startCursor = Number(ctx.cursor);
    let offset: number | undefined = ctx.cursor && Number.isFinite(startCursor) ? startCursor : undefined;
    for (;;) {
      if (ctx.signal?.aborted) return;
      const params = new URLSearchParams({ limit: '100' });
      if (offset !== undefined) params.set('offset', String(offset));
      const res = await fetchJson<{ ok: boolean; result?: TelegramUpdate[] }>(
        `https://api.telegram.org/bot${token}/getUpdates?${params}`,
        { signal: ctx.signal },
      );
      const updates = res.result ?? [];
      if (updates.length === 0) break;

      for (const update of updates) {
        if (ctx.signal?.aborted) return;
        const doc = telegramMessageDoc(update);
        if (!doc) continue;
        if (chatFilter && String(update.message?.chat.id) !== chatFilter) continue;
        yield doc;
      }

      const last = updates[updates.length - 1];
      if (!last) break;
      offset = last.update_id + 1;
      await ctx.setCursor?.(String(offset));
    }
  },
};
