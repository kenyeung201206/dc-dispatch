import { test } from '@playwright/test';

test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture review screenshots');
const dir = 'docs/screenshots/phase6';

for (const lang of ['en', 'zh-hant']) {
  test(`capture back page ${lang}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${lang}/`);
    await page.locator('#back-page').scrollIntoViewIfNeeded();
    await page.locator('#back-page').screenshot({ path: `${dir}/${info.project.name}-backpage-${lang}.png` });
  });
}

test('capture hunter mode', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');
  await page.evaluate(() => (document.documentElement.dataset.mask = 'hunter'));
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${dir}/${info.project.name}-hunter.png` });
});

test('capture 404', async ({ page }, info) => {
  await page.goto('/en/nowhere/');
  await page.screenshot({ path: `${dir}/${info.project.name}-404.png` });
});

test('print PDF', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium' || info.project.name !== 'desktop-chromium', 'PDF needs desktop Chromium');
  await page.goto('/en/');
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) await page.evaluate((t) => window.scrollTo(0, t), y);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30_000 });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${dir}/print-en.pdf`, format: 'A4', printBackground: true });
});
