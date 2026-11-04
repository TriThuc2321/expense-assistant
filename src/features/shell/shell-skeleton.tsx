import { Skeleton } from '@heroui/react';

// Narrow bottom padding = 24px content gap + 66px tab bar + safe area.
export const MAIN_CLASS =
  'wide:px-8 wide:pt-8 wide:pb-12 min-w-0 flex-1 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(90px+env(safe-area-inset-bottom))]';

const CARD_CLASS = 'bg-card border-subtle rounded-card border p-4 shadow-sm';
const STAT_CARDS = [0, 1];
const RECENT_ROWS = [0, 1, 2, 3];

// Must stay free of data and client context: it is what streams before auth runs.
export function ShellSkeleton() {
  return (
    <div aria-hidden className="flex min-h-dvh items-start">
      <div className="rounded-panel bg-canvas border-subtle wide:block sticky top-3 m-3 hidden h-[calc(100dvh-24px)] w-[248px] shrink-0 border shadow-sm" />
      <div className={MAIN_CLASS}>
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32 rounded-lg" />
              <Skeleton className="h-7 w-44 rounded-lg" />
            </div>
            <Skeleton className="size-10 rounded-full" />
          </div>
          <div className={`${CARD_CLASS} space-y-4`}>
            <Skeleton className="h-3 w-40 rounded-lg" />
            <Skeleton className="rounded-control h-11 w-full" />
            <Skeleton className="h-7 w-3/4 rounded-lg" />
            <Skeleton className="h-7 w-2/3 rounded-lg" />
          </div>
          <div className="wide:grid-cols-2 grid gap-3">
            {STAT_CARDS.map((card) => (
              <div key={card} className={`${CARD_CLASS} space-y-3`}>
                <Skeleton className="h-3 w-28 rounded-lg" />
                <Skeleton className="h-6 w-24 rounded-lg" />
              </div>
            ))}
          </div>
          <div className={`${CARD_CLASS} space-y-4`}>
            {RECENT_ROWS.map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/5 rounded-lg" />
                  <Skeleton className="h-3 w-1/4 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-canvas/88 border-subtle wide:hidden fixed inset-x-0 bottom-0 z-40 h-[calc(66px+env(safe-area-inset-bottom))] border-t" />
    </div>
  );
}
