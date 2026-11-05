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

test('返回 goes one page back; 頭版 always goes to the front page', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|staticctf\.ubisoft\.com|steamstatic\.com)/, (r) => r.abort());
  const floating = page.locator('.floatnav');
  // front page → 武器與裝備 → story: 返回 lands on 武器與裝備, 頭版 on the front page
  await page.goto('/zh-hant/');
  await page.goto('/zh-hant/section/arsenal/');
  const first = page.locator('.story .headline a').first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(href!);
  await floating.getByRole('link', { name: '返回' }).click();
  await expect(page).toHaveURL(/\/zh-hant\/section\/arsenal\/$/);
  await page.goForward();
  await expect(page).toHaveURL(href!);
  await floating.getByRole('link', { name: '頭版' }).click();
  await expect(page).toHaveURL(/\/zh-hant\/$/);

  await page.goto(href!); // fresh visit: no page to go back to
  await expect(floating.getByRole('link', { name: '返回' })).toHaveAttribute('href', /\/zh-hant\/(section\/[a-z-]+\/)?$/);
  await expect(floating.getByRole('link', { name: '頭版' })).toHaveAttribute('href', /\/zh-hant\/$/);
  await page.goto('/zh-hant/');
  await expect(floating).toHaveCount(0); // not on the front page
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

test('返回 and 頭版 float at the bottom left and stay on screen while scrolling', async ({ page }) => {
  await page.goto('/zh-hant/watch/');
  await page.keyboard.press('Shift'); // a reader is here: the page's start-at-top step stands down
  const back = page.locator('.floatnav').getByRole('link', { name: '返回' });
  const home = page.locator('.floatnav').getByRole('link', { name: '頭版' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await expect(back).toBeInViewport();
  await expect(home).toBeInViewport();
  expect(await page.locator('.floatnav').evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  const backBox = (await back.boundingBox())!;
  const box = (await home.boundingBox())!; // the right-hand one of the pair
  expect(backBox.x + backBox.width).toBeLessThanOrEqual(box.x); // side by side, not overlapping
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

test('最新更新: 顯示更多 opens 10 more at a time, grouped by day, then 收合 folds back', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/');
  const visible = page.locator('.latest li:not(.day):not([hidden])');
  const btn = page.locator('[data-latest-more]');
  test.skip((await btn.count()) === 0, 'six or fewer recent stories');
  await expect(visible).toHaveCount(6);
  await expect(page.locator('.latest li.day').first()).toBeVisible();
  const total = await page.locator('.latest li:not(.day)').count();
  await expect(btn).toHaveText(`顯示更多（再 ${Math.min(10, total - 6)} 則）`);
  while ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  await expect(visible).toHaveCount(total);
  await expect(btn).toHaveText('收合');
  // Every visible story row sits under a visible day heading.
  const order = await page.locator('.latest li:not([hidden])').evaluateAll((els) => els.map((e) => (e.classList.contains('day') ? 'D' : 'S')).join(''));
  expect(order.startsWith('D')).toBe(true);
  await btn.click();
  await expect(visible).toHaveCount(6);
});

test('masthead banner: a random Division 2 picture, never the same twice in a row, with credit', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route(/(staticctf\.ubisoft\.com|steamstatic\.com)/, (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  const title = page.locator('.masthead .title');
  const ids: string[] = [];
  for (let k = 0; k < 3; k++) {
    await page.goto('/zh-hant/');
    await expect(title).toHaveClass(/has-bg/);
    ids.push((await page.evaluate(() => localStorage.getItem('dcd.bannerBg'))) ?? '');
  }
  expect(ids[0]).not.toBe(ids[1]);
  expect(ids[1]).not.toBe(ids[2]);
  await expect(title.locator('.bg-credit a')).toHaveAttribute('href', /^https:\/\//);
  await expect(title.locator('.title-name')).toHaveCSS('color', 'rgb(243, 238, 227)');
});

test('收藏: ☆ asks who is reading once, saves, shows in 我的收藏, and removes', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|staticctf\.ubisoft\.com|steamstatic\.com)/, (r) => r.abort());
  // Stand-in for /api/favs (the real one runs on Cloudflare): one list per name, newest first.
  const lists = new Map<string, { id: string; at: string }[]>();
  await page.route('**/api/favs**', async (r) => {
    const req = r.request();
    if (req.method() === 'POST') {
      const { who, id, on } = req.postDataJSON();
      const rest = (lists.get(who) ?? []).filter((f) => f.id !== id);
      lists.set(who, on ? [{ id, at: new Date().toISOString() }, ...rest] : rest);
      return r.fulfill({ json: { status: 'ok', favs: lists.get(who) } });
    }
    const who = new URL(req.url()).searchParams.get('who') ?? '';
    return r.fulfill({ json: { status: 'ok', favs: lists.get(who) ?? [] } });
  });

  await page.goto('/zh-hant/section/arsenal/');
  const card = page.locator('.story').first();
  const href = await card.locator('.headline a').getAttribute('href');
  const star = card.locator('[data-fav]');
  await expect(star).toHaveAttribute('aria-label', '加入收藏');
  await star.click();
  await expect(page.getByRole('dialog', { name: '誰在看？' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button')).toHaveText(['阿肥', 'Alice', 'Andy哥', 'Keroro', '取消']);
  await page.getByRole('button', { name: 'Andy哥', exact: true }).click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(star).toHaveText('★');
  expect(lists.get('Andy哥')?.length).toBe(1);

  // The story page shows it as saved too, and the second star never asks again.
  await page.goto(href!);
  await expect(page.locator('.favrow [data-fav]')).toHaveAttribute('aria-pressed', 'true');
  // This device remembers who it belongs to: another ☆ saves straight away, no question.
  await page.goto('/zh-hant/section/arsenal/');
  await page.locator('.story [data-fav]').nth(1).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.story [data-fav]').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.story [data-fav]').nth(1).click(); // undo, so 我的收藏 below has one story
  await expect(page.locator('.story [data-fav]').nth(1)).toHaveAttribute('aria-pressed', 'false');

  // 我的收藏 from the top bar / rail
  await page.goto('/zh-hant/favorites/');
  await expect(page.getByText('目前使用者：Andy哥')).toBeVisible();
  const row = page.locator('[data-favlist] li');
  await expect(row).toHaveCount(1);
  await expect(row.locator('h2 a')).toHaveAttribute('href', href!);
  await row.locator('[data-fav]').click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText('還沒有收藏')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
