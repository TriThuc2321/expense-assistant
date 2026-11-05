import 'server-only';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import type { UserRole } from '@/lib/types';

import { getDb } from '@/server/db';
import { session as sessionTable } from '@/server/db/schema';

import { getAuth } from '.';
import { BLOCKED } from './hooks';

export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: UserRole;
  };
};

type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
>;

export type SessionStatus<S> =
  | { status: 'ok'; session: S }
  | { status: 'none' }
  | { status: typeof BLOCKED; session: S };

export function classifySession<
  S extends { user: { blockedAt?: Date | null } },
>(session: S | null): SessionStatus<S> {
  if (!session) return { status: 'none' };
  if (session.user.blockedAt) return { status: BLOCKED, session };
  return { status: 'ok', session };
}

export const getActiveSession = cache(
  async (): Promise<SessionStatus<AuthSession>> => {
    const result = classifySession(
      await getAuth().api.getSession({ headers: await headers() }),
    );
    // Server Components can't clear cookies, so the row is deleted instead:
    // the leftover cookie then resolves to no session and can't loop.
    if (result.status === BLOCKED) {
      await getDb()
        .delete(sessionTable)
        .where(eq(sessionTable.id, result.session.session.id));
    }
    return result;
  },
);

export const requireSession = cache(async (): Promise<AppSession> => {
  const result = await getActiveSession();
  if (result.status === 'none') redirect('/login');
  if (result.status === BLOCKED) redirect(`/login?error=${BLOCKED}`);

  const { id, name, email, image, role } = result.session.user;
  return {
    user: {
      id,
      name,
      email,
      image: image ?? null,
      role: role === 'admin' ? 'admin' : 'user',
    },
  };
});

export const requireAdmin = cache(async (): Promise<AppSession> => {
  const session = await requireSession();
  if (session.user.role !== 'admin') notFound();
  return session;
});
