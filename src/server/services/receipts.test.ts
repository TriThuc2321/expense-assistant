import { S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { putReceipt, sniffMediaType } from './receipts';

afterEach(() => vi.restoreAllMocks());

describe('sniffMediaType', () => {
  it('recognises the four image types and rejects others', () => {
    expect(sniffMediaType(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toBe(
      'image/jpeg',
    );
    expect(sniffMediaType(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 1))).toBe(
      'image/png',
    );
    expect(sniffMediaType(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 9))).toBe(
      'image/gif',
    );
    const webp = new TextEncoder().encode('RIFF1234WEBPVP8 ');
    expect(sniffMediaType(webp)).toBe('image/webp');
    expect(
      sniffMediaType(new TextEncoder().encode('RIFF1234WAVEfmt ')),
    ).toBeNull();
    expect(sniffMediaType(Uint8Array.of(1, 2, 3))).toBeNull();
  });
});

describe('putReceipt', () => {
  it('writes under receipts/{userId}/ with the media type', async () => {
    const send = vi
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(async () => ({}) as never);
    const key = await putReceipt('u1', Buffer.from('x'), 'image/png');
    expect(key).toMatch(/^receipts\/u1\/[0-9a-f-]{36}\.png$/);
    const cmd = send.mock.calls[0][0] as unknown as {
      input: { Bucket: string; Key: string; ContentType: string };
    };
    expect(cmd.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: key,
      ContentType: 'image/png',
    });
  });
});
