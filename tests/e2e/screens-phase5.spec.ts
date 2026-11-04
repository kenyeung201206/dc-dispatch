import { test } from '@playwright/test';

test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture review screenshots');

for (const [name, url] of [['watch-en', '/en/watch/'], ['watch-zh', '/zh-hant/watch/']] as const) {
  test(`capture ${name}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `docs/screenshots/phase5/${info.project.name}-${name}.png`, fullPage: true });
  });
}

test('capture front-watch-block', async ({ page }, info) => {
  await page.goto('/en/');
  await page.locator('#watch-now').scrollIntoViewIfNeeded();
  await page.waitForLoadState('networkidle');
  await page.locator('#watch-now').screenshot({ path: `docs/screenshots/phase5/${info.project.name}-front-watch.png` });
});
