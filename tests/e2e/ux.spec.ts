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
  await page.keyboard.press('Shift'); // a reader is here: the page's start-at-top step stands down
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

test('Chinese readers: non-Chinese videos open with Chinese player menus and a subtitle hint', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/watch/');
  const fig = page.locator('.vf[data-cc="zh-Hant"]').first();
  test.skip((await fig.count()) === 0, 'no non-Chinese video in the current data');
  await expect(fig.locator('.cchint')).toContainText('YouTube App');
  await fig.locator('.play').click();
  await expect(fig.locator('iframe')).toHaveAttribute('src', /hl=zh-TW&cc_lang_pref=zh-Hant/);
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
  const fig = page.locator('.story-page .vf').first();
  test.skip((await fig.count()) === 0, 'story has no video');
  await expect(fig).toHaveAttribute('data-cc', 'zh-Hant');
  await expect(fig.locator('.vt')).toHaveText(/[㐀-鿿]/);
  await fig.locator('.play').click();
  await expect(fig.locator('iframe')).toHaveAttribute('src', /cc_lang_pref=zh-Hant/);
});

test('return button floats at the bottom left and stays on screen while scrolling', async ({ page }) => {
  await page.goto('/zh-hant/watch/');
  await page.keyboard.press('Shift'); // a reader is here: the page's start-at-top step stands down
  const back = page.getByRole('link', { name: '返回' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(back).toBeInViewport();
  expect(await back.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  const box = (await back.boundingBox())!;
  const vw = page.viewportSize()!;
  expect(box.x).toBeLessThan(vw.width / 2);
  expect(box.y + box.height).toBeGreaterThan(vw.height - 100);
  // Never on top of the back-to-top button
  const top = (await page.locator('[data-to-top]').boundingBox())!;
  expect(box.x + box.width).toBeLessThan(top.x);
});

test('English story, Chinese page: related Chinese videos box (only in Chinese)', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/story/kt71s5/');
  const box = page.locator('.zhvids');
  test.skip((await box.count()) === 0, 'no related Chinese video in the current data');
  await expect(box.getByRole('heading')).toHaveText('相關中文影片');
  for (const t of await box.locator('.vt').allTextContents()) expect(t).toMatch(/[㐀-鿿]/);
  await page.goto('/en/story/kt71s5/');
  await expect(page.locator('.zhvids')).toHaveCount(0);
});

test('reloading a page starts at the top; going Back returns to where you were', async ({ page, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== 'chromium', 'desktop Chrome/Edge scroll restoration (headless WebKit restores inconsistently)');
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(200);
  await page.goto('/zh-hant/section/arsenal/');
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
});

test('最新更新 box sits above the lead story, newest first, without hashtag clutter', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/');
  const box = page.locator('.latest');
  await expect(box.getByRole('heading')).toHaveText('最新更新');
  const boxTop = (await box.boundingBox())!.y;
  const leadTop = (await page.locator('.story.lead').boundingBox())!.y;
  expect(boxTop).toBeLessThan(leadTop);
  const times = await box.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime') ?? ''));
  expect([...times].sort().reverse()).toEqual(times);
  for (const h of await box.locator('li a').allTextContents()) expect(h).not.toMatch(/#\S/);
});

test('新 badges: stories since your last visit; gone once you have seen them', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/');
  // Long-ago last visit: everything from the last 3 days is new to you.
  await page.evaluate(() => {
    localStorage.setItem('dcd.lastSeen', '1');
    localStorage.removeItem('dcd.prevVisit');
  });
  await page.reload();
  const shown = page.locator('[data-new-badge]:not([hidden])');
  const ages = await shown.evaluateAll((els) => els.map((e) => Date.now() - Date.parse((e as HTMLElement).dataset.firstSeen!)));
  for (const a of ages) expect(a).toBeLessThan(72 * 3_600_000 + 60_000);
  // Seen just now (same visit): nothing new.
  await page.evaluate(() => {
    const now = String(Date.now());
    localStorage.setItem('dcd.lastSeen', now);
    localStorage.setItem('dcd.prevVisit', now);
  });
  await page.reload();
  await expect(page.locator('[data-new-badge]:not([hidden])')).toHaveCount(0);
});
