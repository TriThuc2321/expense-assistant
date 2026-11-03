import { cn } from '@heroui/react';
import { Wallet } from 'lucide-react';

const TILE = {
  32: { box: 'size-8 rounded-tag', icon: 17 },
  40: { box: 'size-10 rounded-control', icon: 20 },
} as const;

export function LogoTile({ size }: { size: 32 | 40 }) {
  const tile = TILE[size];
  return (
    <div
      aria-hidden
      className={cn(
        'bg-accent text-accent-foreground flex shrink-0 items-center justify-center',
        tile.box,
      )}
    >
      <Wallet size={tile.icon} strokeWidth={1.75} />
    </div>
  );
}
