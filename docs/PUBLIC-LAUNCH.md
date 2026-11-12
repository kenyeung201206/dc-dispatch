# Going public (branch `public-launch`)

What changes when this branch is merged into `main`:

- **No password.** The lock is gone; `functions/_middleware.ts` now only counts visits. Anyone with the link can read the site.
- **Google can list it.** No `noindex`, `robots.txt` allows everything except `/api/`, and `pnpm run build` writes
  `dist/sitemap.xml`. Every page has a description, a canonical link and a link-preview card (Facebook, LINE, Discord).
- **Favorites are per device.** The 「誰在看？」 picker and `/api/favs` are gone. ☆ saves in the reader's own browser
  only; each device's old list carries over automatically.
- **Visitor number: the same built-in counter as before** (`functions/lib/views.ts`, KV namespace `VIEWS`), live,
  same total as today. Robots (Google, Facebook previews, scripts) are not counted.
- **Privacy page** at `/zh-hant/privacy/` and `/en/privacy/` (footer link 「隱私與版權」). Contact = 特工阿肥's YouTube channel.
- `/api/live` (Twitch) remembers its answer for 5 minutes, so many readers still mean few Twitch requests.

## The counter's limit

Each visit is 2 saves to Cloudflare KV; the free plan allows 1,000 saves a day, so the number stops rising after
about **500 visits in a day** (it starts again the next day). Pages keep working; only the number pauses.
Signs you've hit it: Cloudflare dashboard → Workers & Pages → KV → `VIEWS` → Metrics shows ~1,000 writes on a day,
or the "today" number stops near 500.

If that happens, two ways out:
- **Cloudflare Web Analytics** (free, no limit, number up to 2 hours behind): already written and tested in commit
  `21d1f13` on this branch (`pipeline/visits.ts`); Claude can bring it back. Needs a read-only Cloudflare token and
  the site tag as GitHub secrets.
- **Workers Paid plan** ($5/month): raises the KV limit far beyond a fan site's traffic; no code change.

## Steps before and after launch

1. **Merge the branch and deploy** (Claude can do this when you say so).
2. **Check:** open the site in a private window: no password, the paper opens, 到訪次數 shows the same total as before.
3. **Clean up (optional):** delete the Pages secrets `SITE_PASSWORD` and `AUTH_SECRET`
   (Workers & Pages → dc-dispatch → Settings → Variables and secrets). Keep the KV namespace `VIEWS` (the counter uses it).
4. **Google (optional, speeds up listing):** add the site in Google Search Console and submit
   `https://dc-dispatch.pages.dev/sitemap.xml`.

## Keep it non-commercial

No ads, no donation/Patreon buttons, no paid features. Answer removal requests quickly (see the privacy page).
