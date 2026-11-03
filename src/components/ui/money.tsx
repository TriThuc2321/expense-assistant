import type { TxType } from '@/lib/types';

import { formatSignedVnd, formatVnd } from '@/lib/format';

type MoneyProps = {
  amount: number;
  type?: TxType;
  className?: string;
};

export function Money({ amount, type, className }: MoneyProps) {
  const text = type ? formatSignedVnd(amount, type) : formatVnd(amount);
  const classes = [
    'font-mono',
    type === 'in' ? 'text-success-text' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{text}</span>;
}
