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

export const MAX_RECEIPT_ITEMS = 20;

const SYSTEM_PROMPT = `You extract VND transactions from a photo: a Vietnamese receipt or bill, a bank transfer receipt, or a screenshot listing several transactions (bank or e-wallet history).
"isReceipt" is false when the image shows no payment, bill or money transfer; then "items" is empty.
"items" has one entry per separate transaction:
- A single receipt, bill or transfer receipt is exactly one item whose "amount" is the grand total actually paid or transferred. Never split a bill into its line items.
- A screenshot listing several transfers or payments has one item per listed transaction. Skip balances, subtotals and summary rows, and never list the same transaction twice.
"amount" is a positive integer in VND (no separators, no sign).
"store" is the shop name, or for a transfer the other party (recipient for money out, sender for money in), or null.
"note" is a short summary: items bought like "Phở bò, trà đá ×2", or the transfer message; null if none.
"date" is that transaction's date as YYYY-MM-DD, or null when unreadable.
"categoryId" is the single best category id from the list in the user message, matching the money direction: an "in" category for money received, an "out" category for money spent or sent. Null if nothing fits.
Categories are listed as "id — Parent › Child (out|in)".`;

export type ParsedReceiptItem = {
  amount: number;
  store: string | null;
  date: string;
  categoryId: string | null;
  note: string | null;
};

export type ParsedReceipt = {
  isReceipt: boolean;
  items: ParsedReceiptItem[];
};

export async function parseReceipt(
  image: Buffer,
  mediaType: ReceiptMediaType,
  ctx: { today: string; categories: AiCategory[] },
): Promise<ParsedReceipt | null> {
  const schema = z.object({
    isReceipt: z.boolean(),
    items: z.array(
      z.object({
        amount: z.number(),
        store: z.string().nullable(),
        date: z.string().nullable(),
        categoryId: z.enum(categoryIds(ctx.categories)).nullable(),
        note: z.string().nullable(),
      }),
    ),
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
    items: out.items.slice(0, MAX_RECEIPT_ITEMS).map((item) => ({
      amount: item.amount,
      store: item.store,
      date: normalizeAiDate(item.date, ctx.today),
      categoryId: item.categoryId,
      note: item.note,
    })),
  };
}
