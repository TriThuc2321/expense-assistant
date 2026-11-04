export const PULL_THRESHOLD = 64;
export const PULL_MAX = 96;

const RESISTANCE = 0.5;

export function pullDistance(fingerDelta: number): number {
  return Math.min(PULL_MAX, Math.max(0, fingerDelta) * RESISTANCE);
}

export function shouldStartPull({
  touchCount,
  scrollY,
  dialogOpen,
}: {
  touchCount: number;
  scrollY: number;
  dialogOpen: boolean;
}): boolean {
  return touchCount === 1 && scrollY <= 0 && !dialogOpen;
}

export function isDownwardPull(dx: number, dy: number): boolean {
  return dy > 0 && dy > Math.abs(dx);
}
