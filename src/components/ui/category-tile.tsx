import {
  Bike,
  Clapperboard,
  HeartPulse,
  House,
  ShoppingBag,
  Tag,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  house: House,
  bike: Bike,
  'shopping-bag': ShoppingBag,
  clapperboard: Clapperboard,
  'heart-pulse': HeartPulse,
  wallet: Wallet,
  tag: Tag,
};

type CategoryTileProps = {
  icon: string;
  color: string;
  size?: 38 | 44;
};

export function CategoryTile({ icon, color, size = 38 }: CategoryTileProps) {
  const Icon = ICONS[icon] ?? Tag;
  return (
    <span
      className="rounded-control inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, var(--cat-${color}) 14%, transparent)`,
        color: `var(--cat-${color})`,
      }}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
