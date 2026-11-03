import { ChevronRight, Tags } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { LogoutButton } from '@/features/settings/logout-button';
import { ThemeSwitchRow } from '@/features/settings/theme-switch-row';
import { UserAvatar } from '@/features/shell/user-avatar';
import { requireSession } from '@/server/auth/session';
import { listCategories } from '@/server/services/categories';

const cardClass =
  'bg-card border-subtle rounded-card overflow-hidden border shadow-sm';

export default async function SettingsPage() {
  const { user } = await requireSession();
  const [t, tNav, roots] = await Promise.all([
    getTranslations('settings'),
    getTranslations('nav'),
    listCategories(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <h1 className="type-h2 text-strong">{tNav('settings')}</h1>

      <div className={`${cardClass} flex items-center gap-3 p-4`}>
        <UserAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="type-body-sm text-strong truncate font-medium">
            {user.name}
          </div>
          <div className="type-caption text-subtle truncate">
            {t('account', { email: user.email })}
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <Link
          href="/categories"
          className="hover:bg-hover focus-visible:outline-accent flex items-center gap-3 px-4 py-3.5 focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <Tags size={18} strokeWidth={1.75} className="text-subtle" />
          <span className="type-body-sm text-strong flex-1">
            {tNav('categories')}
          </span>
          <span className="type-caption text-muted">{roots.length}</span>
          <ChevronRight size={16} strokeWidth={1.75} className="text-subtle" />
        </Link>
      </div>

      <div className={cardClass}>
        <ThemeSwitchRow />
      </div>

      <LogoutButton />
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('settings') };
}
