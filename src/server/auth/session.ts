import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { getAuth } from '.';

export type AppSession = {
  user: { id: string; name: string; email: string; image: string | null };
};

export const requireSession = cache(async (): Promise<AppSession> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const { id, name, email, image } = session.user;
  return { user: { id, name, email, image: image ?? null } };
});
