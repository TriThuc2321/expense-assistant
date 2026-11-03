import { getTranslations } from 'next-intl/server';

import { LogoutButton } from '@/features/settings/logout-button';

export default async function SettingsPage() {
  const t = await getTranslations('nav');

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <h1 className="type-h2 text-strong">{t('settings')}</h1>
      <LogoutButton />
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('settings') };
}
