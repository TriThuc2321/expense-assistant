import type { Metadata } from 'next';

import { buttonVariants } from '@heroui/react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FaGoogle } from 'react-icons/fa';

import { LogoIcon } from '@/assets/icons';
import { SwitchLocale, ThemeSwitch } from '@/components/layouts';

export default async function Page() {
  const t = await getTranslations('auth');

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <SwitchLocale />
        <ThemeSwitch />
      </div>

      <div className="mb-8">
        <LogoIcon className="h-8" />
      </div>

      <div className="mb-12 text-center">
        <h1 className="text-foreground mb-2 text-3xl font-bold">
          {t('welcomeBack')}
        </h1>
        <p className="text-default-700 max-w-md text-lg">
          {t('welcomeSubtitle')}
        </p>
      </div>

      <Link
        href=""
        prefetch={false}
        className={buttonVariants({ size: 'lg', fullWidth: true })}
      >
        <FaGoogle className="h-5 w-5 text-white" />
        {t('continueWithGoogle')}
      </Link>

      <p className="text-default-600 mt-4 text-center text-sm">
        {t('loginFooter')}
      </p>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Login',
};
