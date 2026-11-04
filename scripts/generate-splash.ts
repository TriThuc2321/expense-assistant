import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

import type * as AppleSplash from '../src/lib/apple-splash';

// A computed URL keeps tsc from rejecting the `.ts` extension Node needs here.
const { SPLASH_BACKGROUNDS, SPLASH_IMAGES } = (await import(
  new URL('../src/lib/apple-splash.ts', import.meta.url).href
)) as typeof AppleSplash;

const LOGO_POINTS = 112;
const CORNER_RATIO = 0.225;

const source = new URL('../public/icons/icon-512.png', import.meta.url)
  .pathname;
const outDir = new URL('../public/icons/splash/', import.meta.url).pathname;

await mkdir(outDir, { recursive: true });

for (const image of SPLASH_IMAGES) {
  const size = LOGO_POINTS * image.ratio;
  const radius = Math.round(size * CORNER_RATIO);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}"/></svg>`,
  );
  const logo = await sharp(source)
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: image.pixelWidth,
      height: image.pixelHeight,
      channels: 3,
      background: SPLASH_BACKGROUNDS[image.scheme],
    },
  })
    .composite([{ input: logo }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(new URL(`../public${image.url}`, import.meta.url).pathname);
}

console.info(`Wrote ${SPLASH_IMAGES.length} splash images to ${outDir}`);
