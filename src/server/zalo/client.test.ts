import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendMessage } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('sendMessage', () => {
  it('posts parse_mode html to the fixed bot', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, result: {} }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('chat1', '<p>hi</p>');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://bot-api.zaloplatforms.com/bottest-zalo-bot-token/sendMessage',
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      chat_id: 'chat1',
      text: '<p>hi</p>',
      parse_mode: 'html',
    });
  });

  it('swallows failures without leaking the token', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: false, description: 'bad' })),
    );
    await expect(sendMessage('c', 'x')).resolves.toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom test-zalo-bot-token');
      }),
    );
    await expect(sendMessage('c', 'x')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      'test-zalo-bot-token',
    );
    error.mockRestore();
  });
});
