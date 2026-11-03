import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pruneZaloData } from '@/server/services/zalo-link';

import { GET } from './route';

vi.mock('@/server/services/zalo-link', () => ({ pruneZaloData: vi.fn() }));

const SECRET = process.env.CRON_SECRET!;

function req(authorization?: string) {
  return new Request('http://localhost/api/cron/cleanup', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/cron/cleanup', () => {
  it('requires the bearer secret', async () => {
    for (const header of [
      undefined,
      'Bearer wrong',
      SECRET,
      `Bearer ${SECRET}x`,
    ]) {
      expect((await GET(req(header))).status).toBe(401);
    }
    expect(pruneZaloData).not.toHaveBeenCalled();
  });

  it('prunes with the right secret', async () => {
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(pruneZaloData).toHaveBeenCalledOnce();
  });
});
