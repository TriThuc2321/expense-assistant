import { Suspense } from 'react';

import { Sidebar } from '@/features/shell/sidebar';
import { TabBar } from '@/features/shell/tab-bar';
import { TxSheetHost } from '@/features/shell/tx-sheet-host';
import { TxSheetProvider } from '@/features/tx-sheet/tx-sheet-provider';
import { todayVn } from '@/lib/dates';
import { requireSession } from '@/server/auth/session';
import { listCategories } from '@/server/services/categories';

export default async function MainLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireSession();
  const categories = await listCategories(user.id);

  return (
    <TxSheetProvider categories={categories} today={todayVn()}>
      <div className="flex min-h-dvh items-start">
        {/* The installed iOS app draws under a translucent status bar; this keeps scrolled content from colliding with the clock. */}
        <div
          aria-hidden
          className="bg-app/88 wide:hidden pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] backdrop-blur-md"
        />
        <Sidebar user={user} />
        {/* Narrow bottom padding = 24px content gap + 66px tab bar + safe area. */}
        <main className="wide:px-8 wide:pt-8 wide:pb-12 min-w-0 flex-1 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(90px+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <TabBar />
        <Suspense>
          <TxSheetHost />
        </Suspense>
      </div>
    </TxSheetProvider>
  );
}
