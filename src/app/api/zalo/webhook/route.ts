import { after } from 'next/server';

import { env } from '@/configs/env';
import { safeEqual } from '@/server/http/safe-equal';
import { markUpdateSeen } from '@/server/services/zalo-link';
import { handleZaloUpdate } from '@/server/zalo/handler';
import { parseZaloUpdate } from '@/server/zalo/update';

export const maxDuration = 60;

const ack = () => Response.json({ ok: true });

export async function POST(request: Request) {
  const secret = request.headers.get('x-bot-api-secret-token') ?? '';
  if (!safeEqual(secret, env().ZALO_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ack();
  }

  const update = parseZaloUpdate(body);
  if (!update) return ack();

  let isNew: boolean;
  try {
    isNew = await markUpdateSeen(update.messageId);
  } catch (error) {
    console.error('zalo webhook: dedupe failed', error);
    return new Response(null, { status: 500 });
  }
  if (!isNew) return ack();

  after(() => handleZaloUpdate(update));
  return ack();
}
