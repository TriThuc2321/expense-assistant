'use client';

import { Button } from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { FlagUSIcon, FlagVNIcon } from '@/assets/icons';
import { LOCALE } from '@/constants/locale';
import { setUserLocale } from '@/i18n/actions';

export default function SwitchLocale() {
  const t = useTranslations('locale');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const iconClasses =
    'text-xs size-5 text-default-500 pointer-events-none shrink-0';

  const onToggle = () => {
    const next = locale === LOCALE.VI ? LOCALE.EN : LOCALE.VI;
    startTransition(() => setUserLocale(next));
  };

  return (
    <Button
      variant="tertiary"
      isIconOnly
      aria-label={t('switch')}
      isPending={isPending}
      className="rounded-full"
      onPress={onToggle}
    >
      {locale === LOCALE.VI ? (
        <FlagVNIcon className={iconClasses} />
      ) : (
        <FlagUSIcon className={iconClasses} />
      )}
    </Button>
  );
}
