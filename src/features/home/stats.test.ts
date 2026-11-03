import { describe, expect, it } from 'vitest';

import { lastRangeLabel, spentDelta } from './stats';

describe('spentDelta', () => {
  it('is null without a baseline', () => {
    expect(spentDelta(100, 0)).toBeNull();
  });
  it('rounds the percent and sets direction', () => {
    expect(spentDelta(150, 100)).toEqual({ direction: 'up', percent: 50 });
    expect(spentDelta(2, 3)).toEqual({ direction: 'down', percent: 33 });
    expect(spentDelta(100, 100)).toEqual({ direction: 'flat', percent: 0 });
  });
});

describe('lastRangeLabel', () => {
  it('uses the previous month and the same day', () => {
    expect(lastRangeLabel('2026-11-03')).toBe('1–3/10');
  });
  it('clamps to the previous month length', () => {
    expect(lastRangeLabel('2026-03-31')).toBe('1–28/2');
  });
});
