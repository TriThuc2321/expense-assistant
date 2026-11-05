import { env } from '@/configs/env';
import { todayVn } from '@/lib/dates';
import { safeEqual } from '@/server/http/safe-equal';
import { pruneAiUsage } from '@/server/services/ai-usage';
import { pruneZaloData } from '@/server/services/zalo-link';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!safeEqual(authorization, `Bearer ${env().CRON_SECRET}`)) {
    return new Response(null, { status: 401 });
  }

  await pruneZaloData();
  await pruneAiUsage(todayVn());
  return Response.json({ ok: true });
}
