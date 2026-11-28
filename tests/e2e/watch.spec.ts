import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Keep tests offline: never actually load YouTube/Twitch players or thumbnails. */
async function blockThirdParty(page: Page) {
  await page.route(/(youtube-nocookie\.com|ytimg\.com|twitch\.tv|jtvnw\.net)/, (r) => r.abort());
}

const liveStream = {
  login: 'agent_one',
  name: 'Agent One',
  title: 'Dark Zone runs <script>alert(1)</script>',
  viewers: 1234,
  startedAt: '2026-11-04T00:00:00Z',
  thumbnail: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_agent_one-440x248.jpg',
  language: 'en',
};

test('YouTube facade loads no player until tapped, then plays inline from youtube-nocookie', async ({ page }) => {
  await blockThirdParty(page);
  const frames: string[] = [];
  page.on('request', (r) => r.url().includes('youtube-nocookie.com') && frames.push(r.url()));
  await page.goto('/en/watch/');
  await expect(page.locator('.vod .vf iframe')).toHaveCount(0);
  expect(frames).toHaveLength(0);
  await page.locator('.vod .vf .play').click();
  const iframe = page.locator('.vod .vf iframe');
  await expect(iframe).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?autoplay=1&playsinline=1/);
  await expect(iframe).toHaveAttribute('allow', /fullscreen/);
  await expect(page.locator('.vod .yt')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/);
});

test('Chinese page uses the regional upload when Ubisoft has one', async ({ page }) => {
  // Data changes daily: pick any listed video that has a zh-TW regional twin.
  const videos = JSON.parse(readFileSync('data/videos.json', 'utf8')).videos as { id: string; idZh?: string; title: string; titleZh?: string }[];
  const zhTitles = (JSON.parse(readFileSync('data/translations.zh.json', 'utf8')).videos ?? {}) as Record<string, string>;
  // Chinese pages only list videos with a Chinese title, so a brand-new upload without one is not a fair pick.
  const pair = videos.find((v) => v.idZh && (v.titleZh || /[\u3400-\u9fff]/.test(v.title) || zhTitles[v.id]));
  test.skip(!pair, 'no regional pair in the current data');
  await blockThirdParty(page);
  await page.goto('/en/watch/');
  await expect(page.locator(`.vf[data-yt="${pair!.id}"]`).first()).toBeAttached();
  await page.goto('/zh-hant/watch/');
  await expect(page.locator(`.vf[data-yt="${pair!.idZh}"]`).first()).toBeAttached();
  await expect(page.locator(`.vf[data-yt="${pair!.id}"]`)).toHaveCount(0);
});

test('Live Now: unavailable state when the live service is missing', async ({ page }) => {
  await blockThirdParty(page);
  await page.goto('/en/watch/');
  const live = page.locator('[data-live]');
  await expect(live).toHaveAttribute('data-status', 'error');
  await expect(live.locator('[data-state]')).toHaveText(/unavailable/);
  await expect(live.locator('.more a')).toHaveAttribute('href', /twitch\.tv\/directory/);
});

test('Live Now: offline state', async ({ page }) => {
  await blockThirdParty(page);
  await page.route('**/api/live', (r) => r.fulfill({ json: { status: 'offline', streams: [], clips: [], fetchedAt: '' } }));
  await page.goto('/zh-hant/watch/');
  await expect(page.locator('[data-live] [data-state]')).toHaveText(/沒有特工在直播/);
});

test('Live Now: live cards play inline with the right Twitch parent, text is not injected as HTML', async ({ page }) => {
  await blockThirdParty(page);
  await page.route('**/api/live', (r) => r.fulfill({ json: { status: 'live', streams: [liveStream], clips: [], fetchedAt: '' } }));
  await page.goto('/en/watch/');
  const card = page.locator('[data-live] .lc').first();
  await expect(card.locator('.badge')).toHaveText('LIVE');
  await expect(card.locator('.views')).toHaveText(/1,234 watching/);
  await expect(card.locator('.lt')).toHaveText(/<script>alert\(1\)<\/script>/); // shown as text, not run
  await expect(page.locator('[data-live] script')).toHaveCount(0);
  await card.locator('.play').click();
  await expect(card.locator('iframe')).toHaveAttribute('src', /^https:\/\/player\.twitch\.tv\/\?channel=agent_one&parent=localhost&autoplay=true$/);
});

test('front page has a Watch Now block linking to the full page', async ({ page }) => {
  await blockThirdParty(page);
  await page.goto('/en/');
  await expect(page.locator('#watch-now .vf').first()).toBeVisible();
  await page.locator('#watch-now .all').click();
  await expect(page).toHaveURL(/\/en\/watch\/$/);
});
