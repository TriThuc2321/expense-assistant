import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';

import { env } from '@/configs/env';
import { getDb } from '@/server/db';
import * as schema from '@/server/db/schema';
import { ensureDefaultCategories } from '@/server/services/categories';

import { createDatabaseHooks } from './hooks';
import { USER_ADDITIONAL_FIELDS } from './user-fields';

function createAuth() {
  const {
    APP_URL,
    BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env();

  return betterAuth({
    baseURL: APP_URL,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    socialProviders: {
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    user: { additionalFields: USER_ADDITIONAL_FIELDS },
    // Cookie Max-Age isn't refreshed by RSC renders, so the lifetime must cover normal daily use.
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    onAPIError: { errorURL: '/login' },
    databaseHooks: createDatabaseHooks({
      isBlocked: async (userId) => {
        const [row] = await getDb()
          .select({ blockedAt: schema.user.blockedAt })
          .from(schema.user)
          .where(eq(schema.user.id, userId))
          .limit(1);
        return row?.blockedAt != null;
      },
      ensureCategories: ensureDefaultCategories,
    }),
    // nextCookies must stay last so it sees cookies set by earlier plugins.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let cached: Auth | undefined;

// Built on first use so `next build` can import this module without secrets.
export function getAuth(): Auth {
  cached ??= createAuth();
  return cached;
}
