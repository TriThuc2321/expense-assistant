import { z } from 'zod';

import { getAllowedSession } from '@/server/auth/session';
import { ServiceError } from '@/server/services/errors';
import { receiptUrl } from '@/server/services/receipts';
import { getTransaction } from '@/server/services/transactions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAllowedSession();
  if (result.status !== 'ok') return new Response(null, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response(null, { status: 404 });
  }

  let key: string | null;
  try {
    key = (await getTransaction(result.session.user.id, id)).receiptKey;
  } catch (error) {
    if (error instanceof ServiceError)
      return new Response(null, { status: 404 });
    throw error;
  }
  if (!key) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: await receiptUrl(key),
      'Cache-Control': 'private, no-store',
    },
  });
}
