import { describe, expect, it } from 'vitest';

import { sniffMediaType } from './receipts';

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
