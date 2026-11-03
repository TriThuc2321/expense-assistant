import 'server-only';
import type { z } from 'zod';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';

import type { ActionResult } from '@/lib/action-result';

import { requireSession } from '@/server/auth/session';
import { ServiceError } from '@/server/services/errors';

export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (userId: string, input: z.infer<S>) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const session = await requireSession();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    try {
      const data = await handler(session.user.id, parsed.data);
      refresh();
      return { ok: true, data };
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof ServiceError) return { ok: false, error: err.code };
      console.error(err);
      return { ok: false, error: 'unknown' };
    }
  };
}
