import {
  MAX_ZALO_IMAGE_BYTES,
  type ReceiptMediaType,
  sniffMediaType,
} from '@/server/services/receipts';

type DownloadResult =
  | { ok: true; bytes: Buffer; mediaType: ReceiptMediaType }
  | { ok: false; error: 'too_large' | 'failed' };

export async function downloadImage(url: string): Promise<DownloadResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !res.body) return { ok: false, error: 'failed' };

    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_ZALO_IMAGE_BYTES) {
      await res.body.cancel();
      return { ok: false, error: 'too_large' };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ZALO_IMAGE_BYTES) {
        await reader.cancel();
        return { ok: false, error: 'too_large' };
      }
      chunks.push(value);
    }

    const bytes = Buffer.concat(chunks);
    const mediaType = sniffMediaType(bytes);
    if (!mediaType) return { ok: false, error: 'failed' };
    return { ok: true, bytes, mediaType };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
