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
  const card = page.locator('.story[data-confidence="community"]').first();
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
