import type { Metadata } from 'next';

import { Alert } from '@heroui/react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { GoogleButton } from '@/features/auth/google-button';
import { LogoTile } from '@/features/shell/logo-tile';
import { BLOCKED } from '@/server/auth/hooks';
import { getActiveSession } from '@/server/auth/session';

export default async function Page({ searchParams }: PageProps<'/login'>) {
  const [t, tCommon, { error }, session] = await Promise.all([
    getTranslations('auth'),
    getTranslations('common'),
    searchParams,
    getActiveSession(),
  ]);

  if (session.status === 'ok') redirect('/');

  const errorKey = !error
    ? null
    : error === BLOCKED
      ? 'blocked'
      : 'google_login_failed';

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-2.5">
        <LogoTile size={40} />
        <span className="type-h3 text-strong">{tCommon('appName')}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="type-overline text-subtle font-mono uppercase">
          {t('overline')}
        </div>
        <h1 className="type-h1 text-strong text-pretty">{t('headline')}</h1>
        <p className="type-body text-muted">{t('subtitle')}</p>
      </div>

      {errorKey && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t(`errors.${errorKey}`)}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}

      <div className="bg-card border-subtle rounded-card flex flex-col gap-3.5 border p-5 shadow-sm">
        <GoogleButton />
        <p className="type-caption text-subtle text-center">{t('footer')}</p>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('login') };
}
