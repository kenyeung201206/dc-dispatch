# Deploy: private site + daily edition

End state: `https://dc-dispatch.pages.dev` opens only for your two email addresses (one-time code by email, remembered for a month), and a new edition appears every morning at 06:00 Tokyo.

Steps marked **(you)** need your own accounts or secrets; Claude must not create accounts or handle keys. Steps marked **(Claude, with your OK)** can be run for you.

## 1. Private GitHub repo — (Claude, with your OK)
```bash
gh repo create dc-dispatch --private --source . --push
gh variable set CF_PAGES_PROJECT --body dc-dispatch
gh variable set HUMOUR_LEVEL --body medium
```

## 2. Cloudflare account and Pages project — (you)
1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up (if you don't have one).
2. In this folder, log wrangler in (opens your browser) and create the project:
   ```bash
   pnpm exec wrangler login
   ```
   ```bash
   pnpm exec wrangler pages project create dc-dispatch --production-branch=main
   ```
3. First deploy from your PC:
   ```bash
   pnpm run build
   ```
   ```bash
   pnpm run deploy
   ```

## 3. Lock it down with Cloudflare Access — (you, in the dashboard)
Source: [Pages known issues → enable Access on *.pages.dev](https://developers.cloudflare.com/pages/platform/known-issues/), [One-time PIN](https://developers.cloudflare.com/cloudflare-one/identity/one-time-pin/).
1. **Zero Trust** → choose the **Free** plan if asked (Cloudflare may ask for a payment method even for the free plan).
2. **Zero Trust → Integrations → Identity providers → Add new → One-time PIN.**
3. **Workers & Pages → dc-dispatch → Settings → Enable access policy.**
4. Select **Manage** on that policy → **Access → Applications** → your project → **Configure**:
   - Under *Public hostname*, delete the `*` in **Subdomain** so it covers `dc-dispatch.pages.dev` itself (rename the application if it complains). **Save**.
   - **Session duration: 1 month.**
   - **Policy:** Action *Allow*, Include → *Emails* → your two addresses (`ALLOWED_EMAIL_1`, `ALLOWED_EMAIL_2`).
   - **Login methods:** One-time PIN.
5. Back in the Pages project → **Settings → General → Enable access policy** again, so preview URLs (`*.dc-dispatch.pages.dev`) are protected too. You should now see two Access applications.
6. Check from a private/incognito window: `https://dc-dispatch.pages.dev` must show the Cloudflare login, not the paper.

## 4. Secrets — (you)
GitHub (used by the daily job) — each command asks you to paste the value:
```bash
gh secret set CLOUDFLARE_API_TOKEN
```
```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
```
```bash
gh secret set YOUTUBE_API_KEY
```
- `CLOUDFLARE_API_TOKEN`: dashboard → My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"** or a custom token with **Account → Cloudflare Pages → Edit**.
- `CLOUDFLARE_ACCOUNT_ID`: Workers & Pages overview page, right-hand side.
- `YOUTUBE_API_KEY` is optional (creator videos).

Cloudflare Pages (used by Live Now, optional):
```bash
pnpm exec wrangler pages secret put TWITCH_CLIENT_ID --project-name dc-dispatch
```
```bash
pnpm exec wrangler pages secret put TWITCH_CLIENT_SECRET --project-name dc-dispatch
```

## 5. Start the daily job — (Claude, with your OK, or you)
```bash
gh workflow run refresh.yml
```
Then watch it in the repo's **Actions** tab. From then on it runs at 06:00 Tokyo every day, commits the edition, deploys, and fails loudly if the paper is older than 36 hours. A second workflow (`watchdog.yml`) checks twice a day. GitHub emails failures of scheduled workflows to the person who last edited the schedule — that's GitHub's own notification, nothing is sent by the site.

## 6. Phone check — (you, on each phone)
- [ ] Open `https://dc-dispatch.pages.dev` in Safari / Chrome → enter email → type the 6-digit code from the email.
- [ ] Close and reopen the browser next day: still signed in (session = 1 month).
- [ ] 中文/EN and ◐ buttons work with one tap; no sideways scrolling.
- [ ] Tap a video: plays inline; fullscreen works.
- [ ] Search 中央公園 on the Chinese page finds stories.
- [ ] Status page (footer link) shows today's refresh and green sources.
- [ ] A friend's email (or a private window without signing in) is refused.
