import { expect, test } from '@playwright/test';

test('Back Page is labelled satire in both languages', async ({ page }) => {
  await page.goto('/en/');
  const bp = page.locator('#back-page');
  await expect(bp.getByText('SATIRE').first()).toBeVisible();
  await expect(bp.locator('.gauge')).toBeVisible();
  await expect(bp.locator('.horo dt')).toHaveCount(6);
  await page.goto('/zh-hant/');
  await expect(page.locator('#back-page').getByText('諷刺').first()).toBeVisible();
});

test('word scramble reveals the answer', async ({ page }) => {
  await page.goto('/en/');
  const box = page.locator('#back-page details');
  await box.locator('summary').click();
  await expect(box.locator('.answer')).toBeVisible();
});

test('Konami code toggles the Hunter mask theme', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard easter egg');
  await page.goto('/en/');
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
    await page.keyboard.press(k);
  }
  await expect(page.locator('html')).toHaveAttribute('data-mask', 'hunter');
  await expect(page.locator('[data-toast]')).toHaveText(/Hunter protocol engaged/);
});

test('five quick taps on the masthead hex toggle Hunter mode (phones)', async ({ page }) => {
  await page.goto('/zh-hant/');
  const hex = page.locator('.masthead [data-hex]');
  // force: tap immediately like a person (WebKit otherwise waits ~1s per click for the scan animation)
  for (let i = 0; i < 5; i++) await hex.click({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-mask', 'hunter');
  await expect(page.locator('[data-toast]')).toHaveText(/獵人模式啟動/);
});

test('404 page is bilingual and links home', async ({ page }) => {
  const res = await page.goto('/en/no-such-sector/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This sector has been Rogue-ified.' })).toBeVisible();
  await expect(page.getByText('此區域已遭叛變特工佔領。')).toBeVisible();
  await page.getByRole('link', { name: '回到今日報紙' }).click();
  await expect(page).toHaveURL(/\/zh-hant\/$/);
});

test('hidden /classified page declassifies on focus', async ({ page }) => {
  await page.goto('/classified/');
  const bar = page.locator('.r').first();
  await bar.focus();
  await expect(bar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('rumours are blurred until focused', async ({ page }) => {
  await page.goto('/styleguide/');
  const rumour = page.locator('[data-confidence="rumour"] .summary').first();
  await expect(rumour).toHaveCSS('filter', /blur/);
  await rumour.focus();
  await expect(rumour).toHaveCSS('filter', 'none');
});

test('print layout hides UI chrome and uses newspaper columns', async ({ page }) => {
  await page.goto('/en/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.snav')).toBeHidden();
  await expect(page.locator('.ticker')).toBeHidden();
  await expect(page.locator('#watch-now')).toBeHidden();
  await expect(page.locator('.secondary')).toHaveCSS('column-count', '3');
});
