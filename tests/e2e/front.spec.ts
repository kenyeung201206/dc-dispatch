import { expect, test } from '@playwright/test';

const isPhone = (w: number) => w < 768;

test('root sends the reader to a language edition', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/(en|zh-hant)\/$/);
});

test('front page renders in both languages with correct lang tags', async ({ page }) => {
  // Content changes daily, so check structure, not specific stories.
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.story.lead .headline')).toBeVisible();

  await page.goto('/zh-hant/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
  await expect(page.locator('.story.lead .headline')).toHaveText(/[㐀-鿿]|[A-Za-z]/);
});

test('language switch keeps the page and is remembered', async ({ page }) => {
  await page.goto('/en/');
  await page.locator('[data-lang-switch]:visible').first().click();
  await expect(page).toHaveURL(/\/zh-hant\/$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/zh-hant\/$/);
});

test('theme toggle switches Day/Night and survives reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'day');
  await page.locator('[data-theme-toggle]:visible').first().click();
  await expect(html).toHaveAttribute('data-theme', 'night');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'night');
});

test('follows the OS dark setting on first visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

for (const lang of ['en', 'zh-hant']) {
  test(`no horizontal scrolling (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('phone: tap targets in the sticky bar and section nav are at least 44px', async ({ page }) => {
  const w = page.viewportSize()?.width ?? 1440;
  test.skip(!isPhone(w), 'phone only');
  await page.goto('/en/');
  const targets = page.locator('[data-bar] a, [data-bar] button, nav a');
  const n = await targets.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    const box = await targets.nth(i).boundingBox();
    if (!box) continue; // off-screen tabs in the scrolling nav
    expect(Math.round(box.height), `target ${i}`).toBeGreaterThanOrEqual(44);
  }
});

test('every picture has alt text and a visible credit link', async ({ page }) => {
  await page.goto('/en/');
  const figures = page.locator('figure.photo');
  expect(await figures.count()).toBeGreaterThan(3);
  for (const fig of await figures.all()) {
    await expect(fig.locator('img')).toHaveAttribute('alt', /.+/);
    await expect(fig.locator('figcaption a')).toHaveAttribute('href', /^https:\/\//);
  }
  // Only the lead picture loads eagerly.
  await expect(page.locator('img[loading="eager"]')).toHaveCount(1);
});

test('body text is at least 16px', async ({ page }) => {
  await page.goto('/en/');
  const size = await page.locator('.story:not(.lead) .summary').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});
