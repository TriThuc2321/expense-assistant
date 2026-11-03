import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

import { env } from '@/configs/env';

export type ReceiptMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export const MAX_ZALO_IMAGE_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<ReceiptMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

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

export async function putReceipt(
  userId: string,
  bytes: Buffer,
  mediaType: ReceiptMediaType,
): Promise<string> {
  const key = `receipts/${userId}/${randomUUID()}.${EXTENSIONS[mediaType]}`;
  await getClient().send(
    new PutObjectCommand({
      Bucket: env().R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: mediaType,
    }),
  );
  return key;
}

export async function deleteReceipt(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: env().R2_BUCKET, Key: key }),
    );
  } catch (error) {
    console.error('deleteReceipt failed', key, error);
  }
}

export function receiptUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key }),
    { expiresIn: 300 },
  );
}
