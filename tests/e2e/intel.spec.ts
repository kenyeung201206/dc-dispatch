import { expect, test } from '@playwright/test';

test('front page shows Exotic Intel with status and a link to the full list', async ({ page }) => {
  await page.goto('/en/');
  const box = page.locator('.intel').first();
  await expect(box.locator('li').first()).toBeVisible();
  await expect(box.locator('.st').first()).toHaveText(/Live|On PTS|Announced|Spotted/);
  await page.getByRole('link', { name: 'All exotic intel →' }).click();
  await expect(page).toHaveURL(/\/en\/section\/arsenal\/$/);
  await expect(page.locator('.intel.full li').first()).toBeVisible();
});

test('Chinese page shows exotic intel with Chinese status labels', async ({ page }) => {
  await page.goto('/zh-hant/section/arsenal/');
  await expect(page.locator('.intel.full .st').first()).toHaveText(/已上線|PTS 測試中|官方公布|社群發現/);
});

test('巴哈 community stories show a COMMUNITY stamp and stay readable in English (Chinese text, translation pending)', async ({ page }) => {
  await page.goto('/en/section/builds/');
  // A 巴哈 story specifically (YouTube videos are community stories too, and may come first).
  const card = page.locator('.story[data-confidence="community"]:has(.source a[href*="forum.gamer.com.tw"])').first();
  await expect(card.locator('.stamp')).toHaveText('Community');
  await expect(card.locator('.headline')).toHaveAttribute('lang', 'zh-Hant-TW');
  await expect(card.getByText('Translation pending')).toBeVisible();
  await expect(card.locator('.source a').first()).toHaveAttribute('href', /^https:\/\/forum\.gamer\.com\.tw\/C\.php\?bsn=24460&snA=\d+$/);
});

test('Guide Picks: front-page list links to playable guides on the Builds page', async ({ page }) => {
  await page.route(/(youtube-nocookie\.com|ytimg\.com)/, (r) => r.abort());
  await page.goto('/zh-hant/');
  const first = page.locator('.mini .row').first();
  await expect(first).toContainText('灰帽特工');
  await first.click();
  await expect(page).toHaveURL(/\/zh-hant\/section\/builds\/#guide-yt-/);
  const card = page.locator('.cards .card').first();
  await expect(card.locator('.until')).toHaveText(/^至 /);
  await card.locator('.vf .play').click();
  await expect(card.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\//);
});

test('特工情報站 page (was 攻略): missions 1→11 in order, each linking to its own post', async ({ page }) => {
  await page.goto('/zh-hant/guides/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('特工情報站');
  await expect(page.locator('.subtitle')).toHaveText('獵捕偵查任務・兌換碼・灰帽特工最新消息');
  await expect(page.getByRole('link', { name: '查看灰帽特工全部貼文 ↗' })).toHaveAttribute('href', /youtube\.com\/@.+\/posts$/);
  // The finished Y8S3 season (a new season's list may sit above it, still filling up).
  const y8s3 = page.locator('section.series', { has: page.locator('#s-y8s3-manhunt-scouts') });
  const slots = y8s3.locator('.steps > .slot');
  await expect(slots).toHaveCount(11);
  await expect(y8s3.locator('.steps > .slot.empty')).toHaveCount(0);
  await expect(slots.nth(0).locator('.n')).toHaveText('1');
  await expect(slots.nth(0)).toContainText('公開處決');
  await expect(slots.nth(0).locator('.src a')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/post\/Ugkx/);
  await expect(slots.nth(10)).toHaveClass(/final/);
  await expect(slots.nth(10).locator('.todo li')).toHaveCount(3);
  await expect(y8s3.locator('.prog')).toContainText('已收錄 11 / 11');
});

test('灰帽特工 posts are sorted into newspaper sections, codes are shown, section links work', async ({ page }) => {
  await page.goto('/zh-hant/guides/');
  const groups = page.locator('.group');
  await expect(groups.first()).toBeVisible();
  for (const cat of await groups.evaluateAll((els) => els.map((e) => e.getAttribute('data-cat')))) {
    await expect(page.locator(`.group[data-cat="${cat}"] h3 a`)).toHaveAttribute('href', new RegExp(`/zh-hant/(section/${cat}/|watch/|)$`));
  }
  const codes = page.locator('#post-redeem-codes-2026 .codes code');
  if (await codes.count()) await expect(codes.first()).toHaveText(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
});

test('Agent Intel is the 2nd, highlighted nav button and opens the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop nav');
  await page.goto('/en/');
  await expect(page.locator('.snav li').nth(1).locator('a')).toHaveClass(/intel-nav/);
  await page.locator('.snav').getByRole('link', { name: /Agent Intel/ }).click();
  await expect(page).toHaveURL(/\/en\/guides\/$/);
  await expect(page.locator('section.series', { has: page.locator('#s-y8s3-manhunt-scouts') }).locator('.steps > .slot').nth(10)).toContainText('Black Tusk');
});

test('Chinese pages: exotics and patch notes are in Chinese, English originals stay on English pages', async ({ page }) => {
  await page.goto('/zh-hant/section/arsenal/');
  const names = page.locator('.intel .name strong');
  await expect(names.first()).toHaveText(/[㐀-鿿]/);
  for (const q of await page.locator('.intel .quote').allTextContents()) expect(q).toMatch(/[㐀-鿿]/);
  await page.goto('/zh-hant/patches/');
  for (const c of await page.locator('.diff td').allTextContents()) expect(c).toMatch(/[㐀-鿿]/);
  await expect(page.locator('.patch .title').first()).toHaveText(/[㐀-鿿]/);
  await page.goto('/en/section/arsenal/');
  await expect(page.locator('.intel .name strong').first()).toHaveText(/^[^㐀-鿿]+$/);
});
