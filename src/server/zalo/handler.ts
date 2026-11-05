import { todayVn } from '@/lib/dates';
import { isQuestion } from '@/lib/parse-quick';
import { MAX_CLAUDE_IMAGE_BYTES } from '@/server/services/receipts';
import { receiptToInputs, textToInput } from '@/server/services/smart-entry';
import {
  createTransaction,
  createTransactions,
  undoLatestZaloTransaction,
} from '@/server/services/transactions';
import {
  findAllowedUserIdByZaloId,
  redeemLinkCode,
} from '@/server/services/zalo-link';

import { sendMessage } from './client';
import { downloadImage } from './download';
import {
  REPLY,
  confirmManyReply,
  confirmReply,
  linkedReply,
  undoneReply,
} from './replies';
import { type ZaloUpdate, classify } from './update';

export async function handleZaloUpdate(
  update: ZaloUpdate,
  now: Date = new Date(),
): Promise<void> {
  try {
    const reply = await route(update, now);
    if (reply) await sendMessage(update.chatId, reply);
  } catch (error) {
    console.error('zalo update failed', update.messageId, error);
    await sendMessage(update.chatId, REPLY.error);
  }
}

async function route(update: ZaloUpdate, now: Date): Promise<string | null> {
  const intent = classify(update);
  if (intent.kind === 'ignore') return null;

  if (intent.kind === 'link') {
    if (update.chatType === 'GROUP') return REPLY.linkInGroup;
    const linked = await redeemLinkCode(
      {
        code: intent.code,
        zaloUserId: update.fromId,
        displayName: update.fromName,
      },
      now,
    );
    return linked ? linkedReply(linked.userName) : REPLY.invalidCode;
  }

  const userId = await findAllowedUserIdByZaloId(update.fromId);
  if (!userId) return REPLY.notLinked;

  const today = todayVn(now);
  switch (intent.kind) {
    case 'undo': {
      const txs = await undoLatestZaloTransaction(userId, now);
      return txs.length > 0 ? undoneReply(txs) : REPLY.nothingToUndo;
    }
    case 'text':
      return handleText(userId, intent.text, today);
    case 'image':
      return handleImage(userId, intent.url, today);
  }
}

async function handleText(
  userId: string,
  text: string,
  today: string,
): Promise<string> {
  if (!text) return REPLY.noAmount;
  if (isQuestion(text)) return REPLY.qaSoon;
  const input = await textToInput(userId, text, today);
  if (!input) return REPLY.noAmount;

  const tx = await createTransaction(userId, input, 'zalo');
  return confirmReply(tx, today);
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

async function handleImage(
  userId: string,
  url: string,
  today: string,
): Promise<string> {
  if (!isHttpsUrl(url)) return REPLY.imageError;
  const image = await downloadImage(url);
  if (!image.ok || image.bytes.length > MAX_CLAUDE_IMAGE_BYTES) {
    return REPLY.imageError;
  }

  const inputs = await receiptToInputs(userId, image, today);
  if (inputs.length === 0) return REPLY.noTotal;

  const txs = await createTransactions(userId, inputs, 'zalo');
  return txs.length === 1
    ? confirmReply(txs[0], today, { note: txs[0].note })
    : confirmManyReply(txs, today);
}
