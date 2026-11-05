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

test('story pages: an English video story asks for Chinese subtitles on the Chinese page', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  const { readFileSync, readdirSync } = await import('node:fs');
  // Any English video story that has Chinese (from the feed or our translations).
  const zhTitled = JSON.parse(readFileSync('data/translations.zh.json', 'utf8')).items as Record<string, unknown>;
  let id: string | undefined;
  for (const f of readdirSync('data/editions'))
    for (const i of JSON.parse(readFileSync(`data/editions/${f}`, 'utf8')).items)
      if (!id && i.videoId && i.lang_orig === 'en' && (i.headline_zhHant !== 'pending' || i.id in zhTitled)) id = i.id;
  test.skip(!id, 'no English video story in the current data');
  await page.goto(`/zh-hant/story/${id}/`);
  const fig = page.locator('.story-page .vf');
  test.skip((await fig.count()) === 0, 'story has no video');
  await expect(fig).toHaveAttribute('data-cc', 'zh-Hant');
  await expect(fig.locator('.vt')).toHaveText(/[㐀-鿿]/);
  await fig.locator('.play').click();
  await expect(fig.locator('iframe')).toHaveAttribute('src', /cc_lang_pref=zh-Hant/);
});
