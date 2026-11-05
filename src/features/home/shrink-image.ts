import { MAX_SCAN_BYTES } from '@/features/tx-sheet/schema';

// Long enough to keep small receipt print legible for the model.
const MAX_EDGE = 2000;
const QUALITIES = [0.85, 0.7, 0.55];

export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

// Null when the browser cannot decode the file, or it stays over the limit.
export async function shrinkImage(file: File): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  Object.assign(canvas, fitWithin(bitmap.width, bitmap.height, MAX_EDGE));
  const context = canvas.getContext('2d');
  if (!context) return null;
  // JPEG has no alpha, so transparent screenshots would otherwise turn black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of QUALITIES) {
    const blob = await toJpeg(canvas, quality);
    if (blob && blob.size <= MAX_SCAN_BYTES) {
      return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
    }
  }
  return null;
}
