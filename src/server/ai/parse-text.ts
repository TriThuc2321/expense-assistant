import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import type { TxType } from '@/lib/types';

import {
  type AiCategory,
  categoryIds,
  categoryLines,
  normalizeAiDate,
} from './categories';
import { getOpenAI } from './client';
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

  const response = await getOpenAI().responses.parse({
    model: AI_MODEL,
    reasoning: { effort: 'low' },
    text: { format: zodTextFormat(schema, 'expense') },
    instructions: SYSTEM_PROMPT,
    input: `Today: ${ctx.today}\n\nCategories:\n${categoryLines(ctx.categories)}\n\nMessage:\n${text}`,
  });

  // Null on refusal or incomplete output as well as on a missing parse.
  const out = response.output_parsed;
  if (!out) return null;
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
