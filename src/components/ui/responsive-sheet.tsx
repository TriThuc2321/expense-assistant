'use client';

import type { ReactNode } from 'react';

import { Button, Drawer, Modal } from '@heroui/react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useIsWide } from '@/hooks/use-is-wide';

type ResponsiveSheetProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

const SCRIM_BLUR = 'backdrop-blur-[3px]';

export function ResponsiveSheet({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
}: ResponsiveSheetProps) {
  const t = useTranslations('common');
  const isWide = useIsWide();

  const closeButton = (
    <Button isIconOnly slot="close" variant="ghost" aria-label={t('close')}>
      <X size={20} strokeWidth={1.75} />
    </Button>
  );

  if (isWide) {
    return (
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable
        variant="blur"
        className={SCRIM_BLUR}
      >
        <Modal.Container>
          <Modal.Dialog className="rounded-modal w-full max-w-[560px]">
            <Modal.Header className="flex items-center justify-between gap-3">
              <Modal.Heading className="type-h4">{title}</Modal.Heading>
              {closeButton}
            </Modal.Header>
            <Modal.Body>{children}</Modal.Body>
            {footer ? <Modal.Footer>{footer}</Modal.Footer> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
  }

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      variant="blur"
      className={SCRIM_BLUR}
    >
      <Drawer.Content placement="bottom">
        <Drawer.Dialog className="rounded-t-sheet w-full rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Drawer.Handle />
          <Drawer.Header className="flex items-center justify-between gap-3">
            <Drawer.Heading className="type-h4">{title}</Drawer.Heading>
            {closeButton}
          </Drawer.Header>
          <Drawer.Body>{children}</Drawer.Body>
          {footer ? <Drawer.Footer>{footer}</Drawer.Footer> : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
