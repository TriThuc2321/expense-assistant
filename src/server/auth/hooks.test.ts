import { describe, expect, it, vi } from 'vitest';

import { LOCALE } from '@/i18n';

import { createDatabaseHooks, localeFromCookieHeader } from './hooks';

type Deps = Parameters<typeof createDatabaseHooks>[0];

const deps = (over: Partial<Deps> = {}) => ({
  isBlocked: vi.fn(async (_userId: string) => false),
  ensureCategories: vi.fn(async () => {}),
  ...over,
});

describe('createDatabaseHooks', () => {
  it('session.create.before blocks a blocked user', async () => {
    const h = createDatabaseHooks(deps({ isBlocked: vi.fn(async () => true) }));
    await expect(
      h.session.create.before({ userId: 'u1' } as any, null),
    ).rejects.toMatchObject({ body: { code: 'blocked' } });
  });

  it('session.create.before passes an active user', async () => {
    const d = deps();
    const h = createDatabaseHooks(d);
    await expect(
      h.session.create.before({ userId: 'u1' } as any, null),
    ).resolves.toBeUndefined();
    expect(d.isBlocked).toHaveBeenCalledWith('u1');
  });

  it('has no user hook, so anyone can sign up', () => {
    expect(createDatabaseHooks(deps())).not.toHaveProperty('user');
  });

  it('session.create.after seeds with the cookie locale', async () => {
    const d = deps();
    const h = createDatabaseHooks(d);
    await h.session.create.after(
      { userId: 'u1' } as any,
      { headers: new Headers({ cookie: 'a=1; NEXT_LOCALE=en' }) } as any,
    );
    expect(d.ensureCategories).toHaveBeenCalledWith('u1', LOCALE.EN);
  });

  it('session.create.after falls back to request headers, then the default locale', async () => {
    const d = deps();
    const h = createDatabaseHooks(d);
    await h.session.create.after(
      { userId: 'u1' } as any,
      {
        request: new Request('http://x', {
          headers: { cookie: 'NEXT_LOCALE=en' },
        }),
      } as any,
    );
    await h.session.create.after({ userId: 'u2' } as any, null);
    expect(d.ensureCategories).toHaveBeenNthCalledWith(1, 'u1', LOCALE.EN);
    expect(d.ensureCategories).toHaveBeenNthCalledWith(2, 'u2', LOCALE.VI);
  });

  it('session.create.after does not fail sign-in when seeding fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = createDatabaseHooks(
      deps({
        ensureCategories: vi.fn(async () => {
          throw new Error('db down');
        }),
      }),
    );
    await expect(
      h.session.create.after({ userId: 'u1' } as any, null),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe('localeFromCookieHeader', () => {
  it.each([
    [null, LOCALE.VI],
    [undefined, LOCALE.VI],
    ['', LOCALE.VI],
    ['NEXT_LOCALE=fr', LOCALE.VI],
    ['NEXT_LOCALE=en', LOCALE.EN],
    ['a=1; NEXT_LOCALE=vi; b=2', LOCALE.VI],
    ['XNEXT_LOCALE=en', LOCALE.VI],
  ])('localeFromCookieHeader(%s) = %s', (h, l) =>
    expect(localeFromCookieHeader(h)).toBe(l),
  );
});
