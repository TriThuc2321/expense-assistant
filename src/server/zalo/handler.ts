import type { TxInput } from '@/server/services/transactions';

import { txInputSchema } from '@/features/tx-sheet/schema';
import { todayVn } from '@/lib/dates';
import { isQuestion, parseQuick } from '@/lib/parse-quick';
import { type AiCategory, aiCategoryOptions } from '@/server/ai/categories';
import { parseReceipt } from '@/server/ai/parse-receipt';
import { parseText } from '@/server/ai/parse-text';
import {
  listCategories,
  resolveCategorySlug,
} from '@/server/services/categories';
import { quickParseToInput } from '@/server/services/quick-entry';
import { deleteReceipt, putReceipt } from '@/server/services/receipts';
import {
  createTransaction,
  undoLatestZaloTransaction,
} from '@/server/services/transactions';
import {
  findUserIdByZaloId,
  redeemLinkCode,
} from '@/server/services/zalo-link';

import { sendMessage } from './client';
import { downloadImage } from './download';
import { REPLY, confirmReply, linkedReply, undoneReply } from './replies';
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

  const userId = await findUserIdByZaloId(update.fromId);
  if (!userId) return REPLY.notLinked;

  const today = todayVn(now);
  switch (intent.kind) {
    case 'undo': {
      const tx = await undoLatestZaloTransaction(userId, now);
      return tx ? undoneReply(tx) : REPLY.nothingToUndo;
    }
    case 'text':
      return handleText(userId, intent.text, today);
    case 'image':
      return handleImage(userId, intent.url, today);
  }
}

async function loadAiCategories(userId: string): Promise<AiCategory[]> {
  return aiCategoryOptions(await listCategories(userId));
}

async function handleText(
  userId: string,
  text: string,
  today: string,
): Promise<string> {
  if (!text) return REPLY.noAmount;
  if (isQuestion(text)) return REPLY.qaSoon;
  const parsed = parseQuick(text, today);
  if (!parsed) return REPLY.noAmount;

  let input = await quickParseToInput(userId, parsed);
  if (parsed.confidence === 'low') {
    input = await refineWithClaude(userId, text, today, input);
  }
  const tx = await createTransaction(userId, input, 'zalo');
  return confirmReply(tx, today);
}

// Amount and date stay from parseQuick: deterministic and server-dated, so
// Claude only picks what the keyword table could not.
async function refineWithClaude(
  userId: string,
  text: string,
  today: string,
  input: TxInput,
): Promise<TxInput> {
  const categories = await loadAiCategories(userId);
  if (categories.length === 0) return input;

  let ai: Awaited<ReturnType<typeof parseText>> = null;
  try {
    ai = await parseText(text, { today, categories });
  } catch (error) {
    console.error('zalo parseText failed', error);
  }
  if (!ai) return input;

  const refined = txInputSchema.safeParse({
    ...input,
    type: ai.type,
    categoryId: ai.categoryId,
    store: ai.store,
    note: ai.note,
  });
  return refined.success ? refined.data : input;
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
  if (!image.ok) return REPLY.imageError;

  const key = await putReceipt(userId, image.bytes, image.mediaType);
  try {
    const reply = await saveReceipt(userId, key, image, today);
    if (!reply) await deleteReceipt(key);
    return reply ?? REPLY.noTotal;
  } catch (error) {
    await deleteReceipt(key);
    throw error;
  }
}

async function saveReceipt(
  userId: string,
  key: string,
  image: Extract<Awaited<ReturnType<typeof downloadImage>>, { ok: true }>,
  today: string,
): Promise<string | null> {
  const categories = await loadAiCategories(userId);
  if (categories.length === 0) return null;

  const receipt = await parseReceipt(image.bytes, image.mediaType, {
    today,
    categories,
  });
  if (!receipt || !receipt.isReceipt || !receipt.total) return null;

  const chosen = receipt.categoryId
    ? categories.find((c) => c.id === receipt.categoryId)
    : undefined;
  const categoryId =
    chosen?.id ?? (await resolveCategorySlug(userId, 'shop.goods', 'out'));

  const input = txInputSchema.safeParse({
    type: chosen?.type ?? 'out',
    amount: receipt.total,
    categoryId,
    store: receipt.store,
    note: receipt.note,
    date: receipt.date,
  });
  if (!input.success) return null;

  const tx = await createTransaction(userId, input.data, 'zalo', key);
  return confirmReply(tx, today, { note: receipt.note });
}
