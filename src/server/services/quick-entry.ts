import type { QuickParse } from '@/lib/parse-quick';

import { txInputSchema } from '@/features/tx-sheet/schema';

import type { TxInput } from './transactions';

import { resolveCategorySlug } from './categories';
import { ServiceError } from './errors';

export async function quickParseToInput(
  userId: string,
  parsed: QuickParse,
): Promise<TxInput> {
  const categoryId = await resolveCategorySlug(
    userId,
    parsed.categorySlug,
    parsed.type,
  );
  const input = txInputSchema.safeParse({
    type: parsed.type,
    amount: parsed.amount,
    categoryId,
    store: parsed.store,
    note: parsed.note,
    date: parsed.date,
  });
  if (!input.success) throw new ServiceError('invalid_input');
  return input.data;
}
