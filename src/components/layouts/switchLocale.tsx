'use client';

import {
  Button,
  Dropdown,
  Label,
  cn,
  DropdownPopover,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import type { Locale } from '@/i18n';

import { FlagUSIcon, FlagVNIcon } from '@/assets/icons';
import { LOCALE } from '@/constants/locale';
import { setUserLocale } from '@/i18n/actions';

export default function SwitchLocale() {
  const t = useTranslations('locale');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const iconClasses =
    'text-xs size-5 text-default-500 pointer-events-none shrink-0';

  const onSwitchLocale = (next: Locale) => {
    if (next === locale) return;
    startTransition(() => setUserLocale(next));
  };

  return (
    <Dropdown>
      <Button
        variant="tertiary"
        isIconOnly
        isPending={isPending}
        className="rounded-full"
      >
        {locale === LOCALE.VI ? (
          <FlagVNIcon className={iconClasses} />
        ) : (
          <FlagUSIcon className={iconClasses} />
        )}
      </Button>

      <DropdownPopover placement="bottom right">
        <DropdownMenu aria-label="Switch locale">
          <DropdownItem
            id={LOCALE.VI}
            textValue={t('vi')}
            className={cn({
              'bg-secondary/25 font-bold': locale === LOCALE.VI,
            })}
            onPress={() => onSwitchLocale(LOCALE.VI)}
          >
            <Label className="flex items-center gap-2">
              <FlagVNIcon className={iconClasses} />
              {t('vi')}
            </Label>
          </DropdownItem>
          <DropdownItem
            id={LOCALE.EN}
            textValue={t('en')}
            className={cn({
              'bg-secondary/25 font-bold': locale === LOCALE.EN,
            })}
            onPress={() => onSwitchLocale(LOCALE.EN)}
          >
            <Label className="flex items-center gap-2">
              <FlagUSIcon className={iconClasses} />
              {t('en')}
            </Label>
          </DropdownItem>
        </DropdownMenu>
      </DropdownPopover>
    </Dropdown>
  );
}
