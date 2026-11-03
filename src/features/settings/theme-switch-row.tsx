'use client';

import { Switch } from '@heroui/react';
import { Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export function ThemeSwitchRow() {
  const t = useTranslations('settings');
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Moon size={18} strokeWidth={1.75} className="text-subtle" />
      <span className="type-body-sm text-strong flex-1">{t('darkMode')}</span>
      {mounted ? (
        <Switch
          size="sm"
          aria-label={t('darkMode')}
          isSelected={resolvedTheme === 'dark'}
          onChange={(on) => setTheme(on ? 'dark' : 'light')}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      ) : (
        <span className="h-[18px] w-8" aria-hidden />
      )}
    </div>
  );
}
