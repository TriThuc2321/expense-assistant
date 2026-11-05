import type { BetterAuthOptions } from 'better-auth';

import { APIError } from 'better-auth/api';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n';

export const BLOCKED = 'blocked';

type DatabaseHooks = NonNullable<BetterAuthOptions['databaseHooks']>;
type SessionCreate = NonNullable<
  NonNullable<DatabaseHooks['session']>['create']
>;

type HookContext = Parameters<NonNullable<SessionCreate['after']>>[1];

export type DatabaseHookDeps = {
  isBlocked(userId: string): Promise<boolean>;
  ensureCategories(userId: string, locale: Locale): Promise<void>;
};

export function localeFromCookieHeader(
  cookieHeader: string | null | undefined,
): Locale {
  for (const part of cookieHeader?.split(';') ?? []) {
    const [name, ...rest] = part.split('=');
    if (name?.trim() !== LOCALE_COOKIE) continue;
    const value = rest.join('=').trim();
    return LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

function blocked(): APIError {
  return new APIError('FORBIDDEN', {
    code: BLOCKED,
    message: BLOCKED,
  });
}

function cookieHeaderOf(context: HookContext) {
  return (context?.headers ?? context?.request?.headers)?.get('cookie');
}

export type AppDatabaseHooks = {
  session: { create: Required<SessionCreate> };
};

export function createDatabaseHooks(deps: DatabaseHookDeps): AppDatabaseHooks {
  return {
    session: {
      create: {
        // Blocked users can't sign in again; their live sessions are rejected
        // separately by getActiveSession().
        before: async (session) => {
          if (await deps.isBlocked(session.userId)) throw blocked();
        },
        // Seeding on every sign-in (not user.create.after) lets a failed first
        // seed heal next time, so a failure here must not abort the sign-in.
        after: async (session, context) => {
          try {
            await deps.ensureCategories(
              session.userId,
              localeFromCookieHeader(cookieHeaderOf(context)),
            );
          } catch (error) {
            console.error('Failed to seed default categories', error);
          }
        },
      },
    },
  };
}
