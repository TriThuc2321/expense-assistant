'use server';

import { z } from 'zod';

import { defineAction } from '@/server/action';
import {
  createCategory,
  deleteSubcategory,
} from '@/server/services/categories';

const create = defineAction(
  z.object({
    name: z.string().trim().min(1).max(40),
    parentId: z.uuid().nullable(),
  }),
  (userId, input) => createCategory(userId, input),
);

const remove = defineAction(z.object({ id: z.uuid() }), (userId, { id }) =>
  deleteSubcategory(userId, id),
);

export async function createCategoryAction(input: {
  name: string;
  parentId: string | null;
}) {
  return create(input);
}

export async function deleteSubcategoryAction(input: { id: string }) {
  return remove(input);
}
