'use client';

import { Button, cn } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { AppSession } from '@/server/auth/session';

import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';

import { LogoTile } from './logo-tile';
import { NAV_ITEMS, isNavActive } from './nav';
import { UserAvatar } from './user-avatar';

export function Sidebar({ user }: { user: AppSession['user'] }) {
  const t = useTranslations();
  const pathname = usePathname();
  const { openNew } = useTxSheet();

  return (
    <aside className="rounded-panel bg-canvas border-subtle wide:flex sticky top-3 m-3 hidden h-[calc(100dvh-24px)] w-[248px] shrink-0 flex-col gap-[18px] overflow-hidden border px-3.5 py-5 shadow-sm">
      <div className="flex items-center gap-2.5 px-1.5">
        <LogoTile size={32} />
        <span className="type-h4 text-strong flex-1">
          {t('common.appName')}
        </span>
      </div>

      <Button fullWidth onPress={() => openNew()}>
        <Plus size={18} strokeWidth={1.75} />
        {t('nav.addTransaction')}
      </Button>

      <nav aria-label={t('nav.main')} className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const active = isNavActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-tag flex items-center gap-3 px-2.5 py-[9px] text-[15px] leading-normal font-medium transition-colors',
                active
                  ? 'bg-selected text-accent-text'
                  : 'text-body hover:bg-hover',
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{t(`nav.${labelKey}`)}</span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/settings"
        className="border-subtle mt-auto flex items-center gap-2.5 border-t px-1.5 pt-2.5"
      >
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="type-label text-strong truncate">{user.name}</div>
          <div className="type-caption text-subtle truncate">{user.email}</div>
        </div>
      </Link>
    </aside>
  );
}
