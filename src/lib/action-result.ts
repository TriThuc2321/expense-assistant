import type { ServiceErrorCode } from '@/server/services/errors';

export type ActionErrorCode =
  | ServiceErrorCode
  | 'invalid_input'
  | 'forbidden'
  | 'unknown';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode };
