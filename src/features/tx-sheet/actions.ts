'use server';

import { z } from 'zod';

import { todayVn } from '@/lib/dates';
import { isQuestion, parseQuick } from '@/lib/parse-quick';
import { defineAction } from '@/server/action';
import { ServiceError } from '@/server/services/errors';
import { quickParseToInput } from '@/server/services/quick-entry';
import {
  createTransaction,
  getTransaction,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from '@/server/services/transactions';

import { txInputSchema } from './schema';

const idSchema = z.object({ id: z.uuid() });

const create = defineAction(txInputSchema, (userId, input) =>
  createTransaction(userId, input),
);

const createQuick = defineAction(
  z.object({ text: z.string().min(1) }),
  async (userId, { text }) => {
    // Re-parsed here so the date comes from the server clock, not a tab left open past midnight.
    const parsed = isQuestion(text) ? null : parseQuick(text, todayVn());
    if (!parsed) throw new ServiceError('invalid_input');
    return createTransaction(userId, await quickParseToInput(userId, parsed));
  },
);

const update = defineAction(
  txInputSchema.extend({ id: z.uuid() }),
  (userId, { id, ...input }) => updateTransaction(userId, id, input),
);

const remove = defineAction(idSchema, (userId, { id }) =>
  softDeleteTransaction(userId, id),
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

export async function updateTxAction(
  input: { id: string } & z.input<typeof txInputSchema>,
) {
  return update(input);
}

export async function deleteTxAction(input: { id: string }) {
  return remove(input);
}

export async function restoreTxAction(input: { id: string }) {
  return restore(input);
}

export async function getTxAction(input: { id: string }) {
  return get(input);
}
