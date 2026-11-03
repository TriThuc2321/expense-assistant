import type { BetterAuthOptions } from 'better-auth';

import { APIError } from 'better-auth/api';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from '@/i18n';

import { isEmailAllowed } from './allowlist';

export const NOT_INVITED = 'not_invited';

type DatabaseHooks = NonNullable<BetterAuthOptions['databaseHooks']>;
type UserCreate = NonNullable<NonNullable<DatabaseHooks['user']>['create']>;
type SessionCreate = NonNullable<
  NonNullable<DatabaseHooks['session']>['create']
>;

type HookContext = Parameters<NonNullable<SessionCreate['after']>>[1];

export type DatabaseHookDeps = {
  allowed: Set<string>;
  findUserEmail(userId: string): Promise<string | null>;
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

function notInvited(): APIError {
  return new APIError('FORBIDDEN', {
    code: NOT_INVITED,
    message: NOT_INVITED,
  });
}

function cookieHeaderOf(context: HookContext) {
  return (context?.headers ?? context?.request?.headers)?.get('cookie');
}

export type AppDatabaseHooks = {
  user: { create: Pick<Required<UserCreate>, 'before'> };
  session: { create: Required<SessionCreate> };
};

export function createDatabaseHooks(deps: DatabaseHookDeps): AppDatabaseHooks {
  return {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowed(user.email, deps.allowed)) throw notInvited();
        },
      },
    },
    session: {
      create: {
        // Existing users can't sign in again once removed from ALLOWED_EMAILS;
        // their live sessions are rejected separately by getAllowedSession().
        before: async (session) => {
          const email = await deps.findUserEmail(session.userId);
          if (!isEmailAllowed(email, deps.allowed)) throw notInvited();
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
