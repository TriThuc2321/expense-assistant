import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';

import { SwitchLocale, ThemeSwitch } from '@/components/layouts';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-bold">{t('appName')}</h1>
        <div className="flex items-center gap-1">
          <SwitchLocale />
          <ThemeSwitch />
        </div>
      </header>
    </main>
  );
}

export const metadata: Metadata = {
  title: 'Dashboard',
};
