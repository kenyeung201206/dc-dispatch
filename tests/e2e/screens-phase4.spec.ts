import { test } from '@playwright/test';

// Review screenshots of Phase 4 pages. Run: pnpm run screens
test.skip(!process.env.SCREENS, 'set SCREENS=1 to capture review screenshots');

const pages = [
  ['story-en', '/en/', '.story.lead .headline a'],
  ['story-zh', '/zh-hant/', '.story.lead .headline a'],
  ['section-community-zh', '/zh-hant/section/community/', null],
  ['glitch-board-en', '/en/section/glitch-watch/', null],
  ['patches-en', '/en/patches/', null],
  ['archive-zh', '/zh-hant/archive/', null],
] as const;

for (const [name, url, click] of pages) {
  test(`capture ${name}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url);
    if (click) await page.locator(click).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `docs/screenshots/phase4/${info.project.name}-${name}.png` });
  });
}

test('capture search-zh', async ({ page }, info) => {
  await page.goto('/zh-hant/search/');
  await page.locator('#search input').fill('中央公園');
  await page.locator('.pagefind-ui__result-link').first().waitFor();
  await page.screenshot({ path: `docs/screenshots/phase4/${info.project.name}-search-zh.png` });
});
