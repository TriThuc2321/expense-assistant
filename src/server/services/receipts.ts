import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '@/configs/env';

export type ReceiptMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export const MAX_ZALO_IMAGE_BYTES = 10 * 1024 * 1024;
// Anthropic rejects image blocks over 5 MB.
export const MAX_CLAUDE_IMAGE_BYTES = 5 * 1024 * 1024;

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0) {
  return prefix.every((b, i) => bytes[offset + i] === b);
}

export function sniffMediaType(bytes: Uint8Array): ReceiptMediaType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

let client: S3Client | undefined;

function getClient() {
  if (!client) {
    const e = env();
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: e.R2_ACCESS_KEY_ID,
        secretAccessKey: e.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function receiptUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key }),
    { expiresIn: 300 },
  );
}
