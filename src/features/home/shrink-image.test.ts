import { describe, expect, it } from 'vitest';

import { fitWithin } from './shrink-image';

describe('fitWithin', () => {
  it('scales the longest edge down to the limit, keeping the ratio', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 });
  });

  it('never upscales a small image', () => {
    expect(fitWithin(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });
});
