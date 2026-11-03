import { describe, expect, it } from 'vitest';

import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  it('formats m:ss', () => {
    expect(formatCountdown(599_400)).toBe('9:59');
    expect(formatCountdown(5_000)).toBe('0:05');
  });

  it('clamps at zero', () => {
    expect(formatCountdown(-1)).toBe('0:00');
  });
});
