# Going public (branch `public-launch`)

What changes when this branch is merged into `main`:

- **No password.** `functions/_middleware.ts` (the lock) is gone; anyone with the link can read the site.
- **Google can list it.** No `noindex`, `robots.txt` allows everything except `/api/`, and `pnpm run build` writes
  `dist/sitemap.xml`. Every page has a description, a canonical link and a link-preview card (Facebook, LINE, Discord).
- **Favorites are per device.** The 「誰在看？」 picker and `/api/favs` are gone. ☆ saves in the reader's own browser
  only; each device's old list carries over automatically.
- **Visitor number comes from Cloudflare Web Analytics**, read by the robot every run (`pipeline/visits.ts` →
  `data/visits.json`). The old counter (`/api/views`, KV namespace `VIEWS`) is gone. The number on the site is
  up to 2 hours behind.
- **Privacy page** at `/zh-hant/privacy/` and `/en/privacy/` (footer link 「隱私與版權」). Contact = 特工阿肥's YouTube channel.
- `/api/live` (Twitch) remembers its answer for 5 minutes, so many readers still mean few Twitch requests.

## Steps only the owner can do (in this order)

1. **Write down the current visit total** from the site's top panel (到訪次數) before merging. Tell Claude the
   number; it goes into `carriedOver` in `data/visits.json` so the count doesn't restart at 0.
2. **Turn on Web Analytics:** Cloudflare dashboard → Workers & Pages → `dc-dispatch` → Metrics → Web Analytics →
   Enable. Then Analytics & Logs → Web Analytics → open the `dc-dispatch.pages.dev` site and copy its
   **site tag** (a 32-character id; it's also in the browser address bar while that site's page is open).
   If the visitor number stays empty after a robot run, the run log says "visits update failed" with
   Cloudflare's reason — usually the wrong id here.
3. **Make a read-only token:** dashboard → My Profile → API Tokens → Create Token → Custom token →
   Permissions: *Account · Account Analytics · Read* → Account resources: your account → Create. Copy the token.
4. **Add two GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   `CF_ANALYTICS_TOKEN` = the token, `CF_WEB_ANALYTICS_SITE_TAG` = the site tag.
   `CLOUDFLARE_ACCOUNT_ID` is already there (used for deploys).
5. **Merge the branch and deploy** (Claude can do this when you say so). After the next robot run, the visitor
   number appears in the top panel.
6. **Clean up (optional, after launch):** delete the Pages secrets `SITE_PASSWORD` and `AUTH_SECRET`
   (Workers & Pages → dc-dispatch → Settings → Variables and secrets) and the KV namespace `VIEWS`.
7. **Google (optional, speeds up listing):** add the site in Google Search Console and submit
   `https://dc-dispatch.pages.dev/sitemap.xml`.

## Keep it non-commercial

No ads, no donation/Patreon buttons, no paid features. Answer removal requests quickly (see the privacy page).
