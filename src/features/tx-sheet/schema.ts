import { z } from 'zod';

// Stays under the 4mb server action body limit in next.config.ts.
export const MAX_SCAN_BYTES = 3 * 1024 * 1024;

const optionalText = z
  .string()
  .nullable()
  .transform((v) => v?.trim() || null)
  .pipe(z.string().max(200).nullable());

export const txInputSchema = z.object({
  type: z.enum(['out', 'in']),
  amount: z.number().int().min(1).max(1e12),
  categoryId: z.string().min(1),
  store: optionalText,
  note: optionalText,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function parseAmountText(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function formatAmountText(n: number): string {
  return n > 0 ? n.toLocaleString('vi-VN') : '';
}
