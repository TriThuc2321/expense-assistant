import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import type { TxType } from '@/lib/types';

import {
  type AiCategory,
  categoryIds,
  categoryLines,
  normalizeAiDate,
} from './categories';
import { getAnthropic } from './client';
import { AI_MODEL } from './config';

const SYSTEM_PROMPT = `You extract exactly one expense or income, in VND, from a Vietnamese chat message.
Amounts are integers in VND: "45k" = 45000, "1,5tr" = 1500000, "2 triệu" = 2000000.
Choose the single best category from the list in the user message and answer with its id.
"store" is the shop or payee if mentioned, otherwise null. "note" is a short description, otherwise null.
"date" is YYYY-MM-DD; resolve relative words ("hôm qua", "hôm kia") against today's date given in the user message, and use today when no date is mentioned.
Categories are listed as "id — Parent › Child (out|in)": out = expense, in = income.`;

export type ParsedText = {
  type: TxType;
  amount: number;
  categoryId: string;
  store: string | null;
  note: string | null;
  date: string;
};

export async function parseText(
  text: string,
  ctx: { today: string; categories: AiCategory[] },
): Promise<ParsedText | null> {
  const schema = z.object({
    amount: z.number(),
    categoryId: z.enum(categoryIds(ctx.categories)),
    store: z.string().nullable(),
    note: z.string().nullable(),
    date: z.string().nullable(),
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
        content: `Today: ${ctx.today}\n\nCategories:\n${categoryLines(ctx.categories)}\n\nMessage:\n${text}`,
      },
    ],
  });

  if (message.stop_reason === 'refusal' || !message.parsed_output) return null;
  const out = message.parsed_output;
  const category = ctx.categories.find((c) => c.id === out.categoryId);
  if (!category) return null;

  return {
    type: category.type,
    amount: out.amount,
    categoryId: out.categoryId,
    store: out.store,
    note: out.note,
    date: normalizeAiDate(out.date, ctx.today),
  };
}
