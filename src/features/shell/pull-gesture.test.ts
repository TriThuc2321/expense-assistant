import { describe, expect, it } from 'vitest';

import {
  PULL_MAX,
  PULL_THRESHOLD,
  isDownwardPull,
  pullDistance,
  shouldStartPull,
} from './pull-gesture';

describe('pullDistance', () => {
  it('is zero when the finger has not moved down', () => {
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(-40)).toBe(0);
  });

  it('moves slower than the finger', () => {
    expect(pullDistance(40)).toBeLessThan(40);
    expect(pullDistance(40)).toBeGreaterThan(0);
  });

  it('never exceeds the maximum', () => {
    expect(pullDistance(10_000)).toBe(PULL_MAX);
  });

  it('can reach the refresh threshold', () => {
    expect(PULL_MAX).toBeGreaterThan(PULL_THRESHOLD);
    expect(pullDistance(PULL_THRESHOLD * 2)).toBe(PULL_THRESHOLD);
  });
});

describe('shouldStartPull', () => {
  const ready = { touchCount: 1, scrollY: 0, dialogOpen: false };

  it('starts with one finger at the top of the page', () => {
    expect(shouldStartPull(ready)).toBe(true);
  });

  it('allows the negative scroll offset of an iOS bounce', () => {
    expect(shouldStartPull({ ...ready, scrollY: -12 })).toBe(true);
  });

  it('ignores multi-touch', () => {
    expect(shouldStartPull({ ...ready, touchCount: 2 })).toBe(false);
  });

  it('ignores touches once the page is scrolled', () => {
    expect(shouldStartPull({ ...ready, scrollY: 1 })).toBe(false);
  });

  it('ignores touches while a dialog is open', () => {
    expect(shouldStartPull({ ...ready, dialogOpen: true })).toBe(false);
  });
});

describe('isDownwardPull', () => {
  it('accepts a mostly vertical downward move', () => {
    expect(isDownwardPull(2, 10)).toBe(true);
    expect(isDownwardPull(-2, 10)).toBe(true);
  });

  it('rejects upward moves', () => {
    expect(isDownwardPull(0, -10)).toBe(false);
  });

  it('rejects mostly horizontal moves', () => {
    expect(isDownwardPull(12, 4)).toBe(false);
    expect(isDownwardPull(-12, 4)).toBe(false);
  });
});
