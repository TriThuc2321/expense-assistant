import { describe, expect, it } from 'vitest';

import { SPLASH_IMAGES } from './apple-splash';

describe('SPLASH_IMAGES', () => {
  it('has a light and a dark image per device', () => {
    expect(SPLASH_IMAGES).toHaveLength(20);
    expect(SPLASH_IMAGES.filter((i) => i.scheme === 'dark')).toHaveLength(10);
  });

  it('uses physical pixels for the file and logical points for the query', () => {
    const image = SPLASH_IMAGES.find(
      (i) => i.pixelWidth === 1179 && i.scheme === 'dark',
    );

    expect(image).toMatchObject({
      pixelHeight: 2556,
      url: '/icons/splash/1179x2556-dark.png',
      media:
        '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)',
    });
  });

  it('serves every image from the path the proxy leaves public', () => {
    expect(SPLASH_IMAGES.every((i) => i.url.startsWith('/icons/splash/'))).toBe(
      true,
    );
  });

  it('gives each image a unique url', () => {
    expect(new Set(SPLASH_IMAGES.map((i) => i.url)).size).toBe(20);
  });
});
