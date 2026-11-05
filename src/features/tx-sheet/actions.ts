'use server';

import { z } from 'zod';

import { todayVn } from '@/lib/dates';
import { isQuestion } from '@/lib/parse-quick';
import { defineAction } from '@/server/action';
import { MAX_RECEIPT_ITEMS } from '@/server/ai/parse-receipt';
import { ServiceError } from '@/server/services/errors';
import { sniffMediaType } from '@/server/services/receipts';
import { receiptToInputs, textToInput } from '@/server/services/smart-entry';
import {
  createTransaction,
  createTransactions,
  getTransaction,
  restoreTransaction,
  softDeleteTransaction,
  softDeleteTransactions,
  updateTransaction,
} from '@/server/services/transactions';

import { MAX_SCAN_BYTES, txInputSchema } from './schema';

const idSchema = z.object({ id: z.uuid() });

const create = defineAction(txInputSchema, (userId, input) =>
  createTransaction(userId, input),
);

const createQuick = defineAction(
  z.object({ text: z.string().min(1) }),
  async (userId, { text }) => {
    // Re-parsed here so the date comes from the server clock, not a tab left open past midnight.
    const input = isQuestion(text)
      ? null
      : await textToInput(userId, text, todayVn());
    if (!input) throw new ServiceError('invalid_input');
    return createTransaction(userId, input);
  },
);

const scanReceipt = defineAction(
  z.object({ image: z.instanceof(File) }),
  async (userId, { image }) => {
    if (image.size > MAX_SCAN_BYTES) throw new ServiceError('invalid_image');
    const bytes = Buffer.from(await image.arrayBuffer());
    const mediaType = sniffMediaType(bytes);
    if (!mediaType) throw new ServiceError('invalid_image');

    const inputs = await receiptToInputs(
      userId,
      { bytes, mediaType },
      todayVn(),
    );
    if (inputs.length === 0) throw new ServiceError('no_total');

    const txs = await createTransactions(userId, inputs);
    return { ids: txs.map((tx) => tx.id) };
  },
);

const update = defineAction(
  txInputSchema.extend({ id: z.uuid() }),
  (userId, { id, ...input }) => updateTransaction(userId, id, input),
);

const remove = defineAction(idSchema, (userId, { id }) =>
  softDeleteTransaction(userId, id),
);

const removeMany = defineAction(
  z.object({ ids: z.array(z.uuid()).min(1).max(MAX_RECEIPT_ITEMS) }),
  (userId, { ids }) => softDeleteTransactions(userId, ids),
);

const restore = defineAction(idSchema, (userId, { id }) =>
  restoreTransaction(userId, id),
);

const get = defineAction(
  idSchema,
  (userId, { id }) => getTransaction(userId, id),
  { refresh: false },
);

export async function createTxAction(input: z.input<typeof txInputSchema>) {
  return create(input);
}

export async function createQuickTxAction(input: { text: string }) {
  return createQuick(input);
}

export async function scanReceiptAction(formData: FormData) {
  // Validated by the action's schema; FormData entries are untyped.
  return scanReceipt({ image: formData.get('image') as File });
}

export async function updateTxAction(
  input: { id: string } & z.input<typeof txInputSchema>,
) {
  return update(input);
}

export async function deleteTxAction(input: { id: string }) {
  return remove(input);
}

export async function deleteManyTxAction(input: { ids: string[] }) {
  return removeMany(input);
}

export async function restoreTxAction(input: { id: string }) {
  return restore(input);
}

export async function getTxAction(input: { id: string }) {
  return get(input);
}
