import { test } from '@playwright/test';

test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture review screenshots');
const dir = 'docs/screenshots/intel';

test('capture arsenal intel zh', async ({ page }, info) => {
  await page.goto('/zh-hant/section/arsenal/');
  await page.locator('.intel-block').screenshot({ path: `${dir}/${info.project.name}-arsenal-zh.png` });
});
test('capture front sidebar intel en', async ({ page }, info) => {
  await page.goto('/en/');
  await page.locator('.side').screenshot({ path: `${dir}/${info.project.name}-sidebar-en.png` });
});
test('capture builds section zh', async ({ page }, info) => {
  await page.goto('/zh-hant/section/builds/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${dir}/${info.project.name}-builds-zh.png`, fullPage: true });
});

test('capture guide picks', async ({ page }, info) => {
  await page.goto('/zh-hant/section/builds/');
  await page.waitForLoadState('networkidle');
  await page.locator('#guides').screenshot({ path: `${dir}/${info.project.name}-guides-zh.png` });
  await page.goto('/zh-hant/');
  await page.waitForLoadState('networkidle');
  await page.locator('.side').screenshot({ path: `${dir}/${info.project.name}-sidebar-zh.png` });
});
