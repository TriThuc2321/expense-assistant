import type { Metadata } from 'next';

import { Button, Input } from '@heroui/react';
import { getTranslations } from 'next-intl/server';

import { SwitchLocale, ThemeSwitch } from '@/components/layouts';

export default async function Home() {
  const t = await getTranslations('common');

  return (
    <div>
      <h1>{t('welcome')}</h1>
      <Button>My Button</Button>
      <Input placeholder="Hello" />
      <ThemeSwitch />
      <SwitchLocale />
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Dashboard',
};
