'use server';

import { z } from 'zod';

import { defineAction } from '@/server/action';
import { resolveCategorySlug } from '@/server/services/categories';
import {
  createTransaction,
  getTransaction,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from '@/server/services/transactions';

import { txInputSchema } from './schema';

const idSchema = z.object({ id: z.string().min(1) });

const create = defineAction(txInputSchema, (userId, input) =>
  createTransaction(userId, input),
);

const createQuick = defineAction(
  txInputSchema
    .omit({ categoryId: true })
    .extend({ categorySlug: z.string().min(1) }),
  async (userId, { categorySlug, ...rest }) => {
    const categoryId = await resolveCategorySlug(userId, categorySlug);
    return createTransaction(userId, { ...rest, categoryId });
  },
);

const update = defineAction(
  txInputSchema.extend({ id: z.string().min(1) }),
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

export async function createQuickTxAction(input: {
  type: 'out' | 'in';
  amount: number;
  categorySlug: string;
  store: string | null;
  note: string | null;
  date: string;
}) {
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
