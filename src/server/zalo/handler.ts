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
import { MAX_CLAUDE_IMAGE_BYTES } from '@/server/services/receipts';
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

const MAX_TEXT = 200;

// Claude's free text has no length limit; cut it so an over-long note can't
// fail validation and drop an otherwise valid entry.
function clip(text: string | null): string | null {
  return text?.trim().slice(0, MAX_TEXT).trim() || null;
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
    store: clip(ai.store),
    note: clip(ai.note),
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
  if (!image.ok || image.bytes.length > MAX_CLAUDE_IMAGE_BYTES) {
    return REPLY.imageError;
  }

  const inputs = await readReceipt(userId, image, today);
  if (inputs.length === 0) return REPLY.noTotal;

  const txs = await createTransactions(userId, inputs, 'zalo');
  return txs.length === 1
    ? confirmReply(txs[0], today, { note: txs[0].note })
    : confirmManyReply(txs, today);
}

async function readReceipt(
  userId: string,
  image: Extract<Awaited<ReturnType<typeof downloadImage>>, { ok: true }>,
  today: string,
): Promise<TxInput[]> {
  const categories = await loadAiCategories(userId);
  if (categories.length === 0) return [];

  const receipt = await parseReceipt(image.bytes, image.mediaType, {
    today,
    categories,
  });
  if (!receipt?.isReceipt) return [];

  const inputs: TxInput[] = [];
  let fallbackId: string | undefined;
  for (const item of receipt.items) {
    if (!(item.amount > 0)) continue;
    const chosen = item.categoryId
      ? categories.find((c) => c.id === item.categoryId)
      : undefined;
    const categoryId =
      chosen?.id ??
      (fallbackId ??= await resolveCategorySlug(userId, 'shop.goods', 'out'));

    const input = txInputSchema.safeParse({
      type: chosen?.type ?? 'out',
      amount: Math.round(item.amount),
      categoryId,
      store: clip(item.store),
      note: clip(item.note),
      date: item.date,
    });
    if (input.success) inputs.push(input.data);
  }
  return inputs;
}
