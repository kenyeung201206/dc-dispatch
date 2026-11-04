import { expect, test } from '@playwright/test';

const desktopOnly = (w?: number) => (w ?? 1440) < 768;

test('front page headline opens its story page with sources', async ({ page }) => {
  await page.goto('/en/');
  const lead = page.locator('.story.lead .headline a');
  const title = (await lead.textContent())!.trim();
  await lead.click();
  await expect(page).toHaveURL(/\/en\/story\/[a-z0-9]+\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.locator('.sources a[href^="https://"]').first()).toBeVisible();
  await expect(page.locator('.cta')).toHaveAttribute('href', /^https:\/\//);
});

test('language switch on a story page keeps the same story', async ({ page }) => {
  await page.goto('/en/');
  const href = await page.locator('.story.lead .headline a').getAttribute('href');
  await page.goto(href!);
  await page.locator('[data-lang-switch]:visible').first().click();
  await expect(page).toHaveURL(href!.replace('/en/', '/zh-hant/'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-TW');
});

for (const lang of ['en', 'zh-hant']) {
  test(`section nav and topic filter work (${lang})`, async ({ page }) => {
    await page.goto(`/${lang}/section/community/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const entries = page.locator('.entry');
    const total = await entries.count();
    expect(total).toBeGreaterThan(1);
    const chip = page.locator('[data-filters] button[data-key="tags"]').first();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const visible = await page.locator('.entry:visible').count();
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(total);
    await page.locator('[data-filters] button[data-key=""]').click();
    await expect(page.locator('.entry:visible')).toHaveCount(total);
  });
}

test('glitch board shows status and first-seen date', async ({ page }) => {
  await page.goto('/en/section/glitch-watch/');
  await expect(page.locator('.gstate').first()).toBeVisible();
  await expect(page.getByText(/First seen/).first()).toBeVisible();
});

test('archive calendar links to the latest edition', async ({ page }) => {
  await page.goto('/zh-hant/archive/');
  await page.locator('.day.has').first().click();
  await expect(page).toHaveURL(/\/zh-hant\/$/);
});

test('patch tracker lists title updates with number changes', async ({ page }) => {
  await page.goto('/en/patches/');
  await expect(page.locator('#tu-y8s3-3 .ver')).toHaveText('TU Y8S3.3');
  await expect(page.locator('.diff tr.up').first()).toBeVisible();
  await expect(page.locator('.links a[href^="https://www.ubisoft.com/"]').first()).toBeVisible();
});

test('search finds stories in English', async ({ page }) => {
  await page.goto('/en/search/');
  await page.locator('#search input').fill('crossplay');
  const result = page.locator('.pagefind-ui__result-link').first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute('href', /\/en\/story\//);
});

test('search finds stories in Chinese', async ({ page }) => {
  await page.goto('/zh-hant/search/');
  await page.locator('#search input').fill('掉寶');
  const result = page.locator('.pagefind-ui__result-link').first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute('href', /\/zh-hant\/story\//);
});

test('desktop: nav has archive, patch tracker and search', async ({ page }) => {
  test.skip(desktopOnly(page.viewportSize()?.width), 'desktop nav check');
  await page.goto('/en/');
  for (const name of ['Archive', 'Patch Tracker', /Search/]) {
    await expect(page.locator('.snav').getByRole('link', { name })).toBeVisible();
  }
});
