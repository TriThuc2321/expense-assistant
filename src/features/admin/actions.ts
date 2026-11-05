'use server';

import { z } from 'zod';

import { defineAdminAction } from '@/server/action';
import { USER_ROLES } from '@/server/db/schema';
import {
  blockUser,
  deleteUser,
  setUserRole,
  unblockUser,
} from '@/server/services/users';

const idSchema = z.object({ id: z.string().min(1) });

const setRole = defineAdminAction(
  idSchema.extend({ role: z.enum(USER_ROLES) }),
  (actorId, { id, role }) => setUserRole(actorId, id, role),
);
const block = defineAdminAction(idSchema, (actorId, { id }) =>
  blockUser(actorId, id),
);
const unblock = defineAdminAction(idSchema, (actorId, { id }) =>
  unblockUser(actorId, id),
);
const remove = defineAdminAction(idSchema, (actorId, { id }) =>
  deleteUser(actorId, id),
);

export async function setUserRoleAction(input: {
  id: string;
  role: (typeof USER_ROLES)[number];
}) {
  return setRole(input);
}

export async function blockUserAction(input: { id: string }) {
  return block(input);
}

export async function unblockUserAction(input: { id: string }) {
  return unblock(input);
}

export async function deleteUserAction(input: { id: string }) {
  return remove(input);
}
