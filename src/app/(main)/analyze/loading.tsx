import { Skeleton } from '@heroui/react';

const CARD = 'bg-card border-subtle rounded-card border p-4 shadow-sm';

export default function Loading() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-[1120px] flex-col gap-4"
    >
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="flex items-center justify-between">
        <Skeleton className="rounded-control h-10 w-36" />
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${CARD} space-y-3`}>
            <Skeleton className="h-3 w-20 rounded-lg" />
            <Skeleton className="h-7 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="wide:grid wide:grid-cols-2 flex flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className={`${CARD} space-y-4`}>
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="mx-auto h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
