'use client';

import { Button } from '@heroui/react';
import { MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { ActionResult } from '@/lib/action-result';

import { useToast } from '@/components/ui/toast';

import { createLinkCodeAction, unlinkZaloAction } from './actions';
import { formatCountdown } from './countdown';

type IssuedCode = { code: string; expiresAt: number };

export function ZaloLinkCard({
  link,
}: {
  link: { displayName: string } | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const [issuedRaw, setIssued] = useState<IssuedCode | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, setIsPending] = useState(false);

  const issued = link ? null : issuedRaw;
  const msLeft = issued ? issued.expiresAt - now : 0;
  const expired = issued !== null && msLeft <= 0;
  const active = issued !== null && !expired;

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [active, router]);

  const run = async <T,>(
    action: () => Promise<ActionResult<T>>,
    onOk: (data: T) => void,
  ) => {
    setIsPending(true);
    try {
      const res = await action();
      if (!res.ok) {
        toast.show({ title: t(`errors.${res.error}`) });
        return;
      }
      onOk(res.data);
    } catch {
      toast.show({ title: t('errors.unknown') });
    } finally {
      setIsPending(false);
    }
  };

  const create = () =>
    run(createLinkCodeAction, ({ code, expiresAt }) => {
      setNow(Date.now());
      setIssued({ code, expiresAt: new Date(expiresAt).getTime() });
    });

  const unlink = () =>
    run(unlinkZaloAction, () => {
      setIssued(null);
      toast.show({ title: t('settings.zalo.unlinked') });
    });

  return (
    <div className="bg-card border-subtle rounded-card flex flex-col gap-3 overflow-hidden border p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <MessageSquare
          size={18}
          strokeWidth={1.75}
          className="text-subtle"
          aria-hidden
        />
        <h2 className="type-body-sm text-strong font-medium">
          {t('settings.zalo.title')}
        </h2>
      </div>

      {link ? (
        <>
          <p className="type-body-sm text-body">
            {t('settings.zalo.linkedAs', { name: link.displayName })}
          </p>
          <Button
            variant="secondary"
            className="self-start"
            isPending={isPending}
            onPress={unlink}
          >
            {t('settings.zalo.unlink')}
          </Button>
        </>
      ) : (
        <>
          <p className="type-caption text-muted">{t('settings.zalo.body')}</p>
          {issued && !expired ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-strong font-mono text-[28px] font-medium tracking-[0.12em]">
                {issued.code}
              </div>
              <p className="type-caption text-muted">
                {t.rich('settings.zalo.hint', {
                  command: `/link ${issued.code}`,
                  cmd: (chunks) => <span className="font-mono">{chunks}</span>,
                })}
              </p>
              <p className="type-caption text-subtle" aria-live="off">
                {t('settings.zalo.expiresIn', {
                  time: formatCountdown(msLeft),
                })}
              </p>
            </div>
          ) : expired ? (
            <div className="flex flex-col items-start gap-2">
              <p className="type-caption text-muted">
                {t('settings.zalo.expired')}
              </p>
              <Button
                variant="secondary"
                isPending={isPending}
                onPress={create}
              >
                {t('settings.zalo.newCode')}
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              className="self-start"
              isPending={isPending}
              onPress={create}
            >
              {t('settings.zalo.create')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
