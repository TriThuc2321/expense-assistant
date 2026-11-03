import { buttonVariants } from '@heroui/react';
import { MessageSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function ZaloCard() {
  const t = await getTranslations('home');
  return (
    <div
      className="rounded-card flex flex-col gap-1.5 border px-[18px] py-4"
      style={{
        background: 'var(--accent-soft)',
        borderColor: 'var(--accent-border)',
      }}
    >
      <div className="type-overline text-accent-text flex items-center gap-1.5">
        <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
        <span>{t('zaloTitle')}</span>
      </div>
      <p className="type-caption text-muted">{t('zaloBody')}</p>
      <Link
        href="/settings"
        className={
          buttonVariants({ size: 'sm', variant: 'secondary' }) +
          ' mt-1 self-start'
        }
      >
        {t('zaloLink')}
      </Link>
    </div>
  );
}
