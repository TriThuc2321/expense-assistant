import { getTranslations } from 'next-intl/server';

export default async function CategoriesPage() {
  const t = await getTranslations('nav');

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <h1 className="type-h2 text-strong">{t('categories')}</h1>
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('categories') };
}
