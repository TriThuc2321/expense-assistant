'use client';

import { Spinner } from '@heroui/react';
import { ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

import {
  PULL_THRESHOLD,
  isDownwardPull,
  pullDistance,
  shouldStartPull,
} from './pull-gesture';

export function PullToRefresh() {
  const t = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;

    const hide = () => {
      indicator.style.transform = '';
      indicator.style.opacity = '';
      indicator.style.transition = '';
    };

    // The refresh holds the spinner in place; it only leaves once data arrived.
    if (isPending) return;
    hide();

    // Browser tabs already have their own pull-to-refresh.
    if (!window.matchMedia('(display-mode: standalone)').matches) return;

    let start: { x: number; y: number } | null = null;
    let distance = 0;

    const show = (next: number) => {
      distance = next;
      indicator.style.transition = 'none';
      indicator.style.transform = `translateY(${next}px)`;
      indicator.style.opacity = String(Math.min(1, next / PULL_THRESHOLD));
      if (arrowRef.current) {
        arrowRef.current.style.transform =
          next >= PULL_THRESHOLD ? 'rotate(180deg)' : '';
      }
    };

    const cancel = () => {
      start = null;
      distance = 0;
      hide();
    };

    const onStart = (event: TouchEvent) => {
      cancel();
      const touch = event.touches[0];
      const canStart = shouldStartPull({
        touchCount: event.touches.length,
        scrollY: window.scrollY,
        dialogOpen: document.querySelector('[role="dialog"]') !== null,
      });
      if (touch && canStart) start = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (dx === 0 && dy === 0) return;

      // Not cancelable means the browser already owns this gesture as a scroll.
      const isPulling = distance > 0 || isDownwardPull(dx, dy);
      if (event.touches.length > 1 || !event.cancelable || !isPulling) {
        cancel();
        return;
      }

      event.preventDefault();
      show(pullDistance(dy));
    };

    const onEnd = () => {
      if (!start) return;
      if (distance < PULL_THRESHOLD) {
        cancel();
        return;
      }
      start = null;
      show(PULL_THRESHOLD);
      indicator.style.transition = '';
      startTransition(() => router.refresh());
    };

    // Not passive: preventDefault is what stops iOS rubber-banding the page.
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', cancel);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
    };
  }, [isPending, router]);

  return (
    <>
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 flex justify-center opacity-0 transition-[transform,opacity] duration-200 motion-reduce:transition-none"
      >
        <div className="bg-card border-subtle text-subtle -mt-10 flex size-9 items-center justify-center rounded-full border shadow-sm">
          {isPending ? (
            <Spinner size="sm" />
          ) : (
            <ArrowDown
              ref={arrowRef}
              size={18}
              strokeWidth={1.75}
              className="transition-transform duration-150 motion-reduce:transition-none"
            />
          )}
        </div>
      </div>
      <output className="sr-only">{isPending ? t('refreshing') : ''}</output>
    </>
  );
}
