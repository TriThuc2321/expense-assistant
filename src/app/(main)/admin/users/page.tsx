import { getTranslations } from 'next-intl/server';

import { UserCard } from '@/features/admin/user-card';
import { requireAdmin } from '@/server/auth/session';
import { listUsers } from '@/server/services/users';

export default async function AdminUsersPage() {
  const { user } = await requireAdmin();
  const [t, users] = await Promise.all([getTranslations('nav'), listUsers()]);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <h1 className="type-h2 text-strong">{t('users')}</h1>
      {users.map((u) => (
        <UserCard key={u.id} user={u} isSelf={u.id === user.id} />
      ))}
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('users') };
}
