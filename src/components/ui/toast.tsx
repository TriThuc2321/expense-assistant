'use client';

import { Toast, toast } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

const TOAST_TIMEOUT_MS = 3200;
const TOAST_WIDTH = 380;

// showToast is callable outside React, so the localized label is captured from the mounted toaster.
let undoLabel = 'Hoàn tác';

export function AppToaster() {
  const t = useTranslations('common');
  const label = t('undo');

  useEffect(() => {
    undoLabel = label;
  }, [label]);

  return <Toast.Provider placement="top" width={TOAST_WIDTH} />;
}

export function showToast({
  title,
  onUndo,
}: {
  title: string;
  onUndo?: () => void;
}): void {
  const id = toast(title, {
    timeout: TOAST_TIMEOUT_MS,
    actionProps: onUndo
      ? {
          children: undoLabel,
          variant: 'ghost',
          onPress: () => {
            onUndo();
            toast.close(id);
          },
        }
      : undefined,
  });
}
