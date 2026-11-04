/**
 * Home-screen icons (iOS + Android) from one picture.
 *
 *   pnpm run icons
 *
 * Source: assets/icon-source.jpg or .png (the SHD eagle seal key art). The seal is cropped as a square
 * from the lower part of the picture (tune CROP below if the picture changes). Without a source file,
 * a plain SHD hexagon placeholder is used so the site always has icons.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/icons';
const BG = '#121416';
/** Square around the seal, as fractions of the picture's width/height. */
const CROP = { left: 0.1, top: 0.3, size: 0.8 };

const PLACEHOLDER = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <polygon points="256,86 403,171 403,341 256,426 109,341 109,171" fill="none" stroke="#ff6d10" stroke-width="40"/>
  <polygon points="256,176 334,221 334,291 256,336 178,291 178,221" fill="#ff6d10"/>
</svg>`);

async function sourceSquare(): Promise<Buffer> {
  const file = ['assets/icon-source.jpg', 'assets/icon-source.jpeg', 'assets/icon-source.png', 'assets/icon-source.webp'].find(existsSync);
  if (!file) {
    console.log('No assets/icon-source.* found: using the placeholder icon.');
    return sharp(PLACEHOLDER).resize(1024, 1024).png().toBuffer();
  }
  const { width = 0, height = 0 } = await sharp(file).metadata();
  const size = Math.min(Math.round(width * CROP.size), height - Math.round(height * CROP.top));
  const left = Math.round(width * CROP.left);
  const top = Math.round(height * CROP.top);
  console.log(`Icon from ${file} (${width}×${height}), seal square ${size}px at ${left},${top}`);
  return sharp(file).extract({ left, top, width: size, height: size }).resize(1024, 1024).png().toBuffer();
}

/** Full-bleed square (the phone rounds or masks the corners itself). */
const full = (src: Buffer, px: number, name: string) => sharp(src).resize(px, px).flatten({ background: BG }).png().toFile(`${OUT}/${name}`);

/** Android "maskable": artwork kept inside the central 80% safe zone so any mask shape keeps the seal whole. */
async function maskable(src: Buffer, px: number, name: string) {
  const inner = Math.round(px * 0.8);
  const art = await sharp(src).resize(inner, inner).png().toBuffer();
  const pad = Math.round((px - inner) / 2);
  return sharp({ create: { width: px, height: px, channels: 4, background: BG } })
    .composite([{ input: art, left: pad, top: pad }])
    .png()
    .toFile(`${OUT}/${name}`);
}

await mkdir(OUT, { recursive: true });
const src = await sourceSquare();
await Promise.all([
  full(src, 180, 'apple-touch-icon.png'),
  sharp(src).resize(180, 180).flatten({ background: BG }).png().toFile('public/apple-touch-icon.png'),
  full(src, 192, 'icon-192.png'),
  full(src, 512, 'icon-512.png'),
  full(src, 32, 'favicon-32.png'),
  maskable(src, 512, 'maskable-512.png'),
]);
console.log(`Icons written to ${OUT}/`);
