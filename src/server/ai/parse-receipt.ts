import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import type { ReceiptMediaType } from '@/server/services/receipts';

import {
  type AiCategory,
  categoryIds,
  categoryLines,
  normalizeAiDate,
} from './categories';
import { getAnthropic } from './client';
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

  const message = await getAnthropic().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 2048,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: image.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `Today: ${ctx.today}\n\nCategories:\n${categoryLines(ctx.categories)}`,
          },
        ],
      },
    ],
  });

  if (message.stop_reason === 'refusal' || !message.parsed_output) return null;
  const out = message.parsed_output;

  return {
    isReceipt: out.isReceipt,
    total: out.total,
    store: out.store,
    date: normalizeAiDate(out.date, ctx.today),
    categoryId: out.categoryId,
    note: out.note,
  };
}
