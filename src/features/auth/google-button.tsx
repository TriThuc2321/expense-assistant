'use client';

import { Button, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';

import { authClient } from '@/lib/auth-client';

export function GoogleButton() {
  const t = useTranslations('auth');
  const [isPending, setIsPending] = useState(false);

  async function signIn() {
    setIsPending(true);
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/login',
    });
    if (error) setIsPending(false);
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      fullWidth
      isPending={isPending}
      onPress={signIn}
    >
      {({ isPending }) => (
        <>
          {isPending ? (
            <Spinner color="current" size="sm" />
          ) : (
            <FcGoogle size={20} />
          )}
          {t('continueWithGoogle')}
        </>
      )}
    </Button>
  );
}
