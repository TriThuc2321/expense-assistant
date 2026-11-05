import 'server-only';
import type { z } from 'zod';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';

import type { ActionResult } from '@/lib/action-result';

import { requireSession } from '@/server/auth/session';
import { ServiceError } from '@/server/services/errors';

type ActionOptions = { refresh?: boolean };

async function runAction<S extends z.ZodType, T>(
  schema: S,
  handler: (userId: string, input: z.infer<S>) => Promise<T>,
  options: ActionOptions,
  userId: string,
  input: z.input<S>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const data = await handler(userId, parsed.data);
    if (options.refresh !== false) refresh();
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ServiceError) return { ok: false, error: err.code };
    console.error(err);
    return { ok: false, error: 'unknown' };
  }
}

export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (userId: string, input: z.infer<S>) => Promise<T>,
  options: ActionOptions = {},
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const session = await requireSession();
    return runAction(schema, handler, options, session.user.id, input);
  };
}

export function defineAdminAction<S extends z.ZodType, T>(
  schema: S,
  handler: (actorId: string, input: z.infer<S>) => Promise<T>,
  options: ActionOptions = {},
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const session = await requireSession();
    if (session.user.role !== 'admin') return { ok: false, error: 'forbidden' };
    return runAction(schema, handler, options, session.user.id, input);
  };
}
