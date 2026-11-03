import { getFormatter, getNow, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { SwitchLocale, ThemeSwitch } from '@/components/layouts';
import { UserAvatar } from '@/features/shell/user-avatar';
import { requireSession } from '@/server/auth/session';

// Vietnamese names put the given name last ("Nguyễn Minh" → "Minh").
function givenName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? fullName;
}

export default async function Home() {
  const { user } = await requireSession();
  const t = await getTranslations('home');
  const format = await getFormatter();

  const today = format.dateTime(await getNow(), {
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
          <div className="type-overline text-subtle">{today}</div>
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
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('home') };
}
