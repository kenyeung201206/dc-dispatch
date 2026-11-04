import { test } from '@playwright/test';

// Review screenshots, not assertions. Run: pnpm run screens
test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture review screenshots');

for (const lang of ['en', 'zh-hant']) {
  for (const theme of ['day', 'night']) {
    test(`capture ${lang} ${theme}`, async ({ page }, info) => {
      await page.addInitScript((t) => localStorage.setItem('dcd.theme', t), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${lang}/`);
      await page.evaluate(() => document.fonts.ready);
      // Lazy images load when scrolled to: scroll through like a reader, then wait for all of them.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(80);
      }
      await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const base = `docs/screenshots/phase2/${info.project.name}-${lang}-${theme}`;
      await page.screenshot({ path: `${base}-top.png` });
      // Chromium may drop far-off-screen images in stitched full-page captures,
      // so make the viewport as tall as the page instead.
      const vp = page.viewportSize()!;
      const full = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: vp.width, height: full });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${base}.png`, fullPage: true });
    });
  }
}
