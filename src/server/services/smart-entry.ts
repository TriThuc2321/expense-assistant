import { txInputSchema } from '@/features/tx-sheet/schema';
import { parseQuick } from '@/lib/parse-quick';
import { type AiCategory, aiCategoryOptions } from '@/server/ai/categories';
import { parseReceipt } from '@/server/ai/parse-receipt';
import { parseText } from '@/server/ai/parse-text';

import type { ReceiptMediaType } from './receipts';
import type { TxInput } from './transactions';

import { consumeAiCall } from './ai-usage';
import { listCategories, resolveCategorySlug } from './categories';
import { ServiceError } from './errors';
import { quickParseToInput } from './quick-entry';

const MAX_TEXT = 200;

// The model's free text has no length limit; cut it so an over-long note can't
// fail validation and drop an otherwise valid entry.
function clip(text: string | null): string | null {
  return text?.trim().slice(0, MAX_TEXT).trim() || null;
}

async function loadAiCategories(userId: string): Promise<AiCategory[]> {
  return aiCategoryOptions(await listCategories(userId));
}

export async function textToInput(
  userId: string,
  text: string,
  today: string,
): Promise<TxInput | null> {
  const parsed = parseQuick(text, today);
  if (!parsed) return null;

  const input = await quickParseToInput(userId, parsed);
  return parsed.confidence === 'low'
    ? refineWithAi(userId, text, today, input)
    : input;
}

// Amount and date stay from parseQuick: deterministic and server-dated, so
// the model only picks what the keyword table could not.
async function refineWithAi(
  userId: string,
  text: string,
  today: string,
  input: TxInput,
): Promise<TxInput> {
  const categories = await loadAiCategories(userId);
  if (categories.length === 0) return input;
  if (!(await consumeAiCall(userId, today))) return input;

  let ai: Awaited<ReturnType<typeof parseText>> = null;
  try {
    ai = await parseText(text, { today, categories });
  } catch (error) {
    console.error('parseText failed', error);
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

export async function receiptToInputs(
  userId: string,
  image: { bytes: Buffer; mediaType: ReceiptMediaType },
  today: string,
): Promise<TxInput[]> {
  const categories = await loadAiCategories(userId);
  if (categories.length === 0) return [];
  if (!(await consumeAiCall(userId, today))) {
    throw new ServiceError('ai_limit_reached');
  }

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
