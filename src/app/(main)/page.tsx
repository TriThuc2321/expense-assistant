import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { SwitchLocale, ThemeSwitch } from '@/components/layouts';
import { QuickEntry } from '@/features/home/quick-entry';
import { RecentList } from '@/features/home/recent-list';
import { StatCards } from '@/features/home/stat-cards';
import { UserAvatar } from '@/features/shell/user-avatar';
import { todayVn } from '@/lib/dates';
import { requireSession } from '@/server/auth/session';
import {
  monthSummary,
  recentTransactions,
} from '@/server/services/transactions';

// Vietnamese names put the given name last ("Nguyễn Minh" → "Minh").
function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? fullName;
}

export default async function Home() {
  const { user } = await requireSession();
  const today = todayVn();
  const [t, format, summary, recent] = await Promise.all([
    getTranslations('home'),
    getFormatter(),
    monthSummary(user.id, today),
    recentTransactions(user.id, 6),
  ]);

  const dateOverline = format.dateTime(await getNow(), {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="type-overline text-subtle">{dateOverline}</div>
          <h1 className="type-h2 text-strong mt-1">
            {t('greeting', { name: givenName(user.name) })}
          </h1>
        </div>
        <div className="wide:hidden flex items-center gap-1">
          <SwitchLocale />
          <ThemeSwitch />
          <Link href="/settings" className="ml-1 flex">
            <UserAvatar user={user} size="md" />
          </Link>
        </div>
      </header>
      <QuickEntry />
      <StatCards today={today} summary={summary} />
      <RecentList txs={recent} today={today} />
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('home') };
}
