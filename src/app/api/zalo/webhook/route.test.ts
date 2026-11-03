import { after } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markUpdateSeen } from '@/server/services/zalo-link';
import { handleZaloUpdate } from '@/server/zalo/handler';

import { POST } from './route';

vi.mock('next/server', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  after: vi.fn(),
}));
vi.mock('@/server/zalo/handler', () => ({ handleZaloUpdate: vi.fn() }));
vi.mock('@/server/services/zalo-link', () => ({ markUpdateSeen: vi.fn() }));

const SECRET = process.env.ZALO_WEBHOOK_SECRET!;

const BODY = {
  event_name: 'message.text.received',
  message: {
    message_id: 'm1',
    date: 1,
    message_type: 'CHAT_TEXT',
    text: 'ăn phở 45k',
    from: { id: 'u1', display_name: 'An', is_bot: false },
    chat: { id: 'c1', chat_type: 'PRIVATE' },
  },
};

function req(body: unknown, secret: string | null = SECRET) {
  return new Request('http://localhost/api/zalo/webhook', {
    method: 'POST',
    headers: secret === null ? {} : { 'x-bot-api-secret-token': secret },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(markUpdateSeen).mockResolvedValue(true);
});

describe('POST /api/zalo/webhook', () => {
  it('rejects a wrong or missing secret with 401', async () => {
    expect((await POST(req(BODY, 'wrong'))).status).toBe(401);
    expect((await POST(req(BODY, SECRET + 'x'))).status).toBe(401);
    expect((await POST(req(BODY, null))).status).toBe(401);
    expect(markUpdateSeen).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it('acks malformed bodies with 200 and does nothing', async () => {
    for (const body of ['not json', { hello: 'world' }]) {
      const res = await POST(req(body));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    }
    expect(markUpdateSeen).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it('acks duplicates without scheduling work', async () => {
    vi.mocked(markUpdateSeen).mockResolvedValue(false);
    const res = await POST(req(BODY));
    expect(res.status).toBe(200);
    expect(markUpdateSeen).toHaveBeenCalledWith('m1');
    expect(after).not.toHaveBeenCalled();
  });

  it('answers 500 without scheduling work when dedupe fails', async () => {
    vi.mocked(markUpdateSeen).mockRejectedValue(new Error('db down'));
    const res = await POST(req(BODY));
    expect(res.status).toBe(500);
    expect(after).not.toHaveBeenCalled();
  });

  it('schedules the handler in after() for a new update', async () => {
    const res = await POST(req(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(handleZaloUpdate).not.toHaveBeenCalled();

    const callback = vi.mocked(after).mock.calls[0]![0] as () => unknown;
    await callback();
    expect(handleZaloUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'm1', chatId: 'c1', fromId: 'u1' }),
    );
  });
});
