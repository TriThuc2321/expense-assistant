'use server';

import { z } from 'zod';

import { defineAction } from '@/server/action';
import { createLinkCode, unlinkZalo } from '@/server/services/zalo-link';

const create = defineAction(
  z.object({}),
  async (userId) => {
    const { code, expiresAt } = await createLinkCode(userId);
    return { code, expiresAt: expiresAt.toISOString() };
  },
  { refresh: false },
);

const unlink = defineAction(z.object({}), (userId) => unlinkZalo(userId));

export async function createLinkCodeAction() {
  return create({});
}

export async function unlinkZaloAction() {
  return unlink({});
}
