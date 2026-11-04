/**
 * Home-screen icons (iOS + Android) from one picture.
 *
 *   pnpm run icons
 *
 * Source: assets/icon-source.jpg or .png (the SHD eagle seal key art). The seal is cropped as a square
 * around the centre of the picture (tune CROP below if the picture changes). Without a source file,
 * a plain SHD hexagon placeholder is used so the site always has icons.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/icons';
const BG = '#121416';
/** Square around the seal: centre (fractions of width/height) and side (fraction of the shorter side). */
const CROP = { cx: 0.5, cy: 0.5, size: 1 };

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
  const size = Math.round(Math.min(width, height) * CROP.size);
  const left = Math.max(0, Math.min(width - size, Math.round(width * CROP.cx - size / 2)));
  const top = Math.max(0, Math.min(height - size, Math.round(height * CROP.cy - size / 2)));
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
