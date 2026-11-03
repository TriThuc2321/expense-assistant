import { getTranslations } from 'next-intl/server';

export default async function TransactionsPage() {
  const t = await getTranslations('nav');

  return (
    <div className="mx-auto w-full max-w-[880px]">
      <h1 className="type-h2 text-strong">{t('transactions')}</h1>
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('transactions') };
}
