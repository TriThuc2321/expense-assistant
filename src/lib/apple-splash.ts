// Run directly by scripts/generate-splash.ts under Node's type stripping, so
// this file can't use the `@/` alias or TS-only runtime syntax like enums.

// Logical (point) sizes of portrait iPhones; iOS matches on these exactly.
const DEVICES = [
  { width: 375, height: 667, ratio: 2 },
  { width: 375, height: 812, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 896, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 440, height: 956, ratio: 3 },
];

export const SPLASH_BACKGROUNDS = { light: '#f4f6f9', dark: '#05070f' };

const SCHEMES = ['light', 'dark'] as const;

export const SPLASH_IMAGES = DEVICES.flatMap(({ width, height, ratio }) =>
  SCHEMES.map((scheme) => {
    const pixelWidth = width * ratio;
    const pixelHeight = height * ratio;
    return {
      scheme,
      ratio,
      pixelWidth,
      pixelHeight,
      // Under public/icons/ because iOS fetches these without the session cookie
      // and src/proxy.ts only exempts that folder from the login redirect.
      url: `/icons/splash/${pixelWidth}x${pixelHeight}-${scheme}.png`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`,
    };
  }),
);
