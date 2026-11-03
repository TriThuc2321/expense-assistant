import type { TxType } from './types';

const vndNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(amount: number): string {
  return `${vndNumber.format(amount)} ₫`;
}

export function formatSignedVnd(amount: number, type: TxType): string {
  return `${type === 'out' ? '−' : '+'}${formatVnd(amount)}`;
}
