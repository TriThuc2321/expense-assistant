import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import type { ReceiptMediaType } from '@/server/services/receipts';

import {
  type AiCategory,
  categoryIds,
  categoryLines,
  normalizeAiDate,
} from './categories';
import { getOpenAI } from './client';
import { AI_MODEL } from './config';

const SYSTEM_PROMPT = `You extract one VND expense from a photo of a Vietnamese receipt.
"isReceipt" is false when the image is not a receipt or bill.
"total" is the grand total actually paid, as an integer in VND (no separators); null if unreadable.
"store" is the shop name, or null. "note" is a short item summary like "Phở bò, trà đá ×2", or null.
"date" is the receipt date as YYYY-MM-DD, or null when unreadable.
"categoryId" is the single best category id from the list in the user message, or null when it is not a receipt.
Categories are listed as "id — Parent › Child (out|in)".`;

export type ParsedReceipt = {
  isReceipt: boolean;
  total: number | null;
  store: string | null;
  date: string;
  categoryId: string | null;
  note: string | null;
};

export async function parseReceipt(
  image: Buffer,
  mediaType: ReceiptMediaType,
  ctx: { today: string; categories: AiCategory[] },
): Promise<ParsedReceipt | null> {
  const schema = z.object({
    isReceipt: z.boolean(),
    total: z.number().nullable(),
    store: z.string().nullable(),
    date: z.string().nullable(),
    categoryId: z.enum(categoryIds(ctx.categories)).nullable(),
    note: z.string().nullable(),
  });

  const response = await getOpenAI().responses.parse({
    model: AI_MODEL,
    reasoning: { effort: 'low' },
    text: { format: zodTextFormat(schema, 'receipt') },
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_image',
            detail: 'auto',
            image_url: `data:${mediaType};base64,${image.toString('base64')}`,
          },
          {
            type: 'input_text',
            text: `Today: ${ctx.today}\n\nCategories:\n${categoryLines(ctx.categories)}`,
          },
        ],
      },
    ],
  });

  // Null on refusal or incomplete output as well as on a missing parse.
  const out = response.output_parsed;
  if (!out) return null;

  return {
    isReceipt: out.isReceipt,
    total: out.total,
    store: out.store,
    date: normalizeAiDate(out.date, ctx.today),
    categoryId: out.categoryId,
    note: out.note,
  };
}
