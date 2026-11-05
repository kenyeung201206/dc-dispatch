import { expect, test } from '@playwright/test';

test('view counter: hidden when the counter is off, shown in the banner when it answers', async ({ page }) => {
  await page.goto('/zh-hant/');
  await expect(page.locator('[data-views]')).toBeHidden();
  await page.route('**/api/views', (r) => r.fulfill({ json: { status: 'ok', total: 1234, today: 12 } }));
  await page.goto('/zh-hant/');
  await expect(page.locator('[data-views] dd')).toHaveText('1,234 次（今日 12）');
});

test('floating back-to-top button appears after scrolling and returns to the top', async ({ page }) => {
  await page.goto('/zh-hant/watch/');
  const btn = page.locator('[data-to-top]');
  await expect(btn).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(btn).toBeVisible();
  await expect(btn).toHaveAccessibleName('回到頂端');
  await btn.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
});

test('return button: goes back to the previous page, or to the section when opened directly', async ({ page }) => {
  await page.goto('/zh-hant/section/arsenal/');
  const first = page.locator('.story .headline a').first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(href!);
  await page.getByRole('link', { name: '返回' }).click();
  await expect(page).toHaveURL(/\/zh-hant\/section\/arsenal\/$/);

  await page.goto(href!); // fresh visit: no page to go back to
  await expect(page.getByRole('link', { name: '返回' })).toHaveAttribute('href', /\/zh-hant\/(section\/[a-z-]+\/)?$/);
  await page.goto('/zh-hant/');
  await expect(page.getByRole('link', { name: '返回' })).toHaveCount(0); // not on the front page
});

test('Chinese readers get Traditional Chinese subtitles on non-Chinese videos', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/watch/');
  const fig = page.locator('.vf[data-cc="zh-Hant"]').first();
  test.skip((await fig.count()) === 0, 'no non-Chinese video in the current data');
  await fig.locator('.play').click();
  await expect(fig.locator('iframe')).toHaveAttribute('src', /cc_load_policy=1&cc_lang_pref=zh-Hant&hl=zh-TW&enablejsapi=1/);
  await page.goto('/en/watch/');
  await expect(page.locator('.vf[data-cc]')).toHaveCount(0);
});
