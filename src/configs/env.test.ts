import { describe, expect, it } from 'vitest';

import { aiDailyLimit } from './env';

describe('aiDailyLimit', () => {
  it.each([
    [undefined, 100],
    ['', 100],
    ['5', 5],
  ])('aiDailyLimit(%s) = %s', (raw, want) =>
    expect(aiDailyLimit.parse(raw)).toBe(want),
  );

  it.each(['0', '-1', '1.5', 'abc'])('rejects %s', (raw) =>
    expect(aiDailyLimit.safeParse(raw).success).toBe(false),
  );
});
