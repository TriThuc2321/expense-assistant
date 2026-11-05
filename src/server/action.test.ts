import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { requireSession } from '@/server/auth/session';
import { ServiceError } from '@/server/services/errors';

import { defineAction } from './action';

vi.mock('@/server/auth/session', () => ({ requireSession: vi.fn() }));
vi.mock('next/cache', () => ({ refresh: vi.fn() }));

const { refresh } = await import('next/cache');
const schema = z.object({ n: z.number() });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue({
    user: { id: 'u1', name: 'A', email: 'a@x.com', image: null, role: 'user' },
  });
});

describe('defineAction', () => {
  it('returns invalid_input without calling the handler', async () => {
    const handler = vi.fn();
    const res = await defineAction(schema, handler)({ n: 'x' } as never);
    expect(res).toEqual({ ok: false, error: 'invalid_input' });
    expect(handler).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('maps ServiceError to its code', async () => {
    const res = await defineAction(schema, async () => {
      throw new ServiceError('not_found');
    })({ n: 1 });
    expect(res).toEqual({ ok: false, error: 'not_found' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('maps unexpected errors to unknown', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await defineAction(schema, async () => {
      throw new Error('boom');
    })({ n: 1 });
    expect(res).toEqual({ ok: false, error: 'unknown' });
    expect(refresh).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('passes the session user id and refreshes once on success', async () => {
    const handler = vi.fn(async () => 42);
    const res = await defineAction(schema, handler)({ n: 1 });
    expect(handler).toHaveBeenCalledWith('u1', { n: 1 });
    expect(res).toEqual({ ok: true, data: 42 });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('skips refresh when options.refresh is false', async () => {
    const res = await defineAction(schema, async () => 1, { refresh: false })({
      n: 1,
    });
    expect(res).toEqual({ ok: true, data: 1 });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lets a redirect from requireSession propagate', async () => {
    const err = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });
    vi.mocked(requireSession).mockRejectedValue(err);
    const handler = vi.fn();
    await expect(defineAction(schema, handler)({ n: 1 })).rejects.toBe(err);
    expect(handler).not.toHaveBeenCalled();
  });
});
