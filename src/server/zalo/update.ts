import { z } from 'zod';

import { ZALO_BOT_NAME } from './config';

export type ZaloUpdate = {
  messageId: string;
  chatId: string;
  chatType: 'PRIVATE' | 'GROUP';
  fromId: string;
  fromName: string;
  event: 'text' | 'image' | 'other';
  text: string | null;
  photoUrl: string | null;
};

const schema = z.object({
  event_name: z.string().optional(),
  message: z.object({
    message_id: z.string().min(1),
    text: z.string().nullish(),
    caption: z.string().nullish(),
    photo_url: z.string().nullish(),
    from: z.object({
      id: z.string().min(1),
      is_bot: z.boolean().optional(),
      display_name: z.string().nullish(),
    }),
    chat: z.object({
      id: z.string().min(1),
      chat_type: z.enum(['PRIVATE', 'GROUP']),
    }),
  }),
});

export function parseZaloUpdate(body: unknown): ZaloUpdate | null {
  const root =
    body && typeof body === 'object' && 'result' in body && body.result
      ? body.result
      : body;
  const parsed = schema.safeParse(root);
  if (!parsed.success) return null;
  const { event_name, message } = parsed.data;
  if (message.from.is_bot) return null;

  const event =
    event_name === 'message.text.received'
      ? 'text'
      : event_name === 'message.image.received'
        ? 'image'
        : 'other';

  return {
    messageId: message.message_id,
    chatId: message.chat.id,
    chatType: message.chat.chat_type,
    fromId: message.from.id,
    fromName: message.from.display_name ?? '',
    event,
    text: (event === 'image' ? message.caption : message.text) ?? null,
    photoUrl: message.photo_url ?? null,
  };
}

export function stripMention(
  text: string,
  botName: string = ZALO_BOT_NAME,
): string {
  const name = botName.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .normalize('NFC')
    .replace(new RegExp(`@${name}`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Intent =
  | { kind: 'link'; code: string }
  | { kind: 'undo' }
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string }
  | { kind: 'ignore' };

export function classify(update: ZaloUpdate): Intent {
  if (update.event === 'image') {
    return update.photoUrl
      ? { kind: 'image', url: update.photoUrl }
      : { kind: 'ignore' };
  }
  if (update.event !== 'text') return { kind: 'ignore' };

  const text = stripMention(update.text ?? '');
  const link = /^\/link(?:\s+(\S+))?$/i.exec(text);
  if (link) return { kind: 'link', code: link[1] ?? '' };
  if (/^\/undo$/i.test(text)) return { kind: 'undo' };
  return { kind: 'text', text };
}
