'use client';

import { Button, cn } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';

import type { NavItem } from './nav';

import { NAV_ITEMS, isNavActive } from './nav';

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const t = useTranslations('nav');
  const active = isNavActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center gap-[3px] py-1.5',
        active ? 'text-accent-text' : 'text-subtle',
      )}
    >
      <Icon size={21} strokeWidth={1.75} />
      <span className="text-[11px] leading-tight font-medium">
        {t(item.labelKey)}
      </span>
    </Link>
  );
}

export function TabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { openNew } = useTxSheet();
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <nav
      aria-label={t('main')}
      className="bg-canvas/88 border-subtle wide:hidden fixed inset-x-0 bottom-0 z-40 flex items-center border-t px-1.5 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {left.map((item) => (
        <Tab key={item.href} item={item} pathname={pathname} />
      ))}
      <div className="flex flex-1 justify-center">
        <Button
          isIconOnly
          aria-label={t('addTransaction')}
          onPress={() => openNew()}
          className="size-[46px] rounded-full"
        >
          <Plus size={22} strokeWidth={1.75} />
        </Button>
      </div>
      {right.map((item) => (
        <Tab key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
