'use client';

import { Button } from '@heroui/react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

export function LogoutButton() {
  const t = useTranslations('settings');
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const signOut = async () => {
    setIsPending(true);
    try {
      await authClient.signOut();
      router.replace('/login');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="secondary"
      fullWidth
      isPending={isPending}
      onPress={signOut}
    >
      <LogOut size={18} strokeWidth={1.75} />
      {t('logout')}
    </Button>
  );
}
