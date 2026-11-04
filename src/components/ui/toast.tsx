'use client';

import { Toast, toast } from '@heroui/react';
import { useTranslations } from 'next-intl';

const TOAST_TIMEOUT_MS = 3200;
const TOAST_WIDTH = 380;

export function AppToaster() {
  return (
    <Toast.Provider
      placement="top"
      width={TOAST_WIDTH}
      className="top-[calc(1rem+env(safe-area-inset-top))]"
    />
  );
}

type ShowToastOptions = { title: string; onUndo?: () => void };

export function useToast(): { show: (opts: ShowToastOptions) => void } {
  const t = useTranslations('common');

  function show({ title, onUndo }: ShowToastOptions) {
    const id = toast(title, {
      timeout: TOAST_TIMEOUT_MS,
      description: 'Bob sent you an invitation to join HeroUI team',
      actionProps: onUndo
        ? {
            children: t('undo'),
            variant: 'ghost',
            className: 'col-start-3 row-start-1',
            onPress: () => {
              onUndo();
              toast.close(id);
            },
          }
        : undefined,
    });
  }

  return { show };
}
