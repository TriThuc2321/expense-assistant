import 'server-only';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { env } from '@/configs/env';
import { getDb } from '@/server/db';
import { session as sessionTable } from '@/server/db/schema';

import { getAuth } from '.';
import { isEmailAllowed } from './allowlist';
import { NOT_INVITED } from './hooks';

export type AppSession = {
  user: { id: string; name: string; email: string; image: string | null };
};

type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
>;

export type SessionStatus<S> =
  | { status: 'ok'; session: S }
  | { status: 'none' }
  | { status: typeof NOT_INVITED; session: S };

export function classifySession<S extends { user: { email: string } }>(
  session: S | null,
  allowed: Set<string>,
): SessionStatus<S> {
  if (!session) return { status: 'none' };
  if (!isEmailAllowed(session.user.email, allowed)) {
    return { status: NOT_INVITED, session };
  }
  return { status: 'ok', session };
}

export const getAllowedSession = cache(
  async (): Promise<SessionStatus<AuthSession>> => {
    const result = classifySession(
      await getAuth().api.getSession({ headers: await headers() }),
      env().ALLOWED_EMAILS,
    );
    // Server Components can't clear cookies, so the row is deleted instead:
    // the leftover cookie then resolves to no session and can't loop.
    if (result.status === NOT_INVITED) {
      await getDb()
        .delete(sessionTable)
        .where(eq(sessionTable.id, result.session.session.id));
    }
    return result;
  },
);

export const requireSession = cache(async (): Promise<AppSession> => {
  const result = await getAllowedSession();
  if (result.status === 'none') redirect('/login');
  if (result.status === NOT_INVITED) redirect(`/login?error=${NOT_INVITED}`);

  const { id, name, email, image } = result.session.user;
  return { user: { id, name, email, image: image ?? null } };
});
