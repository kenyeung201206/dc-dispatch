# Deploy: private site + daily edition

End state: `https://dc-dispatch.pages.dev` asks for a password, each device stays signed in for 30 days, and a new edition appears every morning at 06:00 Tokyo.

**Why a password and not Cloudflare Access:** Access (email codes) needs Cloudflare Zero Trust, which asks for a payment card even on the free plan. On 2026-11-04 the owner chose not to add a card, so the site uses its own password lock (`functions/_middleware.ts`) on the free Pages plan instead.

## Done already
- Private GitHub repo `kenyeung201206/dc-dispatch`, CI green, repo variables `CF_PAGES_PROJECT`, `HUMOUR_LEVEL`.
- Cloudflare account; this PC is logged in with `wrangler login`; Pages project `dc-dispatch` created.

## 1. Set the site password and signing key (you, once)
Run in the project folder. The first command asks you to type the password you and your wife will use (pick something long, e.g. four random words):
```bash
pnpm exec wrangler pages secret put SITE_PASSWORD --project-name dc-dispatch
```
The second makes a random signing key and stores it without showing it to anyone:
```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | pnpm exec wrangler pages secret put AUTH_SECRET --project-name dc-dispatch
```
Without these two, the site stays closed for everyone (it shows "lock not set up").

## 2. First deploy (Claude can do this once step 1 is done)
```bash
pnpm run build
```
```bash
pnpm exec wrangler pages deploy dist --project-name=dc-dispatch --branch=main
```
Check: opening `https://dc-dispatch.pages.dev` in a private window must show the password page.

## 3. Let the daily robot deploy (you, once)
1. Cloudflare dashboard → your profile icon (top right) → **Profile → API Tokens → Create Token** → use the template **Edit Cloudflare Workers** → **Continue to summary → Create Token** → copy it.
2. Paste it when asked:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN
   ```
3. Paste your account ID (`6f0ee7ac52ac3ec17a0f423371aa80d8`) when asked:
   ```bash
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```
4. Optional keys: `gh secret set YOUTUBE_API_KEY` (creator videos); Twitch for Live Now:
   ```bash
   pnpm exec wrangler pages secret put TWITCH_CLIENT_ID --project-name dc-dispatch
   ```
   ```bash
   pnpm exec wrangler pages secret put TWITCH_CLIENT_SECRET --project-name dc-dispatch
   ```

## Changing the password later
Run step 1's first command again with a new password. Everyone is signed out and must type the new one.

## Phone check (you, on each phone)
- [ ] Open `https://dc-dispatch.pages.dev` → type the password → the paper opens.
- [ ] Tomorrow: still signed in (30 days per device).
- [ ] 中文/EN and ◐ work with one tap; no sideways scrolling.
- [ ] A video plays inline; fullscreen works.
- [ ] Search 中央公園 on the Chinese page finds stories.
- [ ] Footer → Status shows today's refresh.
- [ ] A private window without the password sees only the password page.
