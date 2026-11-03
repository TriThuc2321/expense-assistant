import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadImage } from './download';

afterEach(() => vi.unstubAllGlobals());

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];

describe('downloadImage', () => {
  it('sniffs jpeg served as application/octet-stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(Uint8Array.from(JPEG), {
            headers: { 'content-type': 'application/octet-stream' },
          }),
      ),
    );
    const r = await downloadImage('https://x/y');
    expect(r).toMatchObject({ ok: true, mediaType: 'image/jpeg' });
  });

  it('rejects by content-length without reading the body', async () => {
    const pull = vi.fn();
    const body = new ReadableStream({ pull }, { highWaterMark: 0 });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(body, {
            headers: { 'content-length': String(11 * 1024 * 1024) },
          }),
      ),
    );
    expect(await downloadImage('https://x/y')).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(pull).not.toHaveBeenCalled();
  });

  it('aborts a stream that passes 10 MB', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled += 1;
          controller.enqueue(new Uint8Array(1024 * 1024));
          if (pulled >= 12) controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body)),
    );
    expect(await downloadImage('https://x/y')).toEqual({
      ok: false,
      error: 'too_large',
    });
    expect(pulled).toBeLessThan(12);
  });

  it('fails on non-image bytes and on HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('hello')),
    );
    expect(await downloadImage('https://x/y')).toEqual({
      ok: false,
      error: 'failed',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 404 })),
    );
    expect(await downloadImage('https://x/y')).toEqual({
      ok: false,
      error: 'failed',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom');
      }),
    );
    expect(await downloadImage('https://x/y')).toEqual({
      ok: false,
      error: 'failed',
    });
  });
});
