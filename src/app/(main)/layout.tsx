import { Suspense } from 'react';

import { MainShell } from '@/features/shell/main-shell';
import { ShellSkeleton } from '@/features/shell/shell-skeleton';

// Suspense lives here, not in loading.tsx: a sibling loading.tsx can't cover this
// layout's own data, and app/loading.tsx would also put the skeleton on /login.
export default function MainLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <MainShell>{children}</MainShell>
    </Suspense>
  );
}
