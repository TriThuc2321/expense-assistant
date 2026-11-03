'use client';

import { Button } from '@heroui/react';
import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { authClient } from '@/lib/auth-client';

export function LogoutButton() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const signOut = async () => {
    setIsPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        toast.show({ title: t('errors.unknown') });
        return;
      }
      router.replace('/login');
    } catch {
      toast.show({ title: t('errors.unknown') });
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
      {t('settings.logout')}
    </Button>
  );
}
