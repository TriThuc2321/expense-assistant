import { getTranslations } from 'next-intl/server';

import { AddCategoryCard } from '@/features/categories/add-category-card';
import { CategoryCard } from '@/features/categories/category-card';
import { requireSession } from '@/server/auth/session';
import { listCategories } from '@/server/services/categories';

export default async function CategoriesPage() {
  const t = await getTranslations('nav');
  const session = await requireSession();
  const categories = await listCategories(session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <h1 className="type-h2 text-strong">{t('categories')}</h1>
      <AddCategoryCard roots={categories} />
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('categories') };
}
