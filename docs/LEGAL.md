# Legal & policy summary

Not legal advice. Researched 2026-11-04. Each rule below is enforced in code (see "Enforcement").

## Ubisoft
- **No dedicated fan-site / brand-usage policy was found.** The only public creator policy is the [Ubisoft Video Policy](https://www.ubisoft.com/en-us/videopolicy.html) (last updated 01/2016): non-commercial fan content encouraged; "simple duplication of our official trailers … is not in keeping" with it; no charging for access; questions → videorights@ubisoft.com.
- **Our stance (conservative):** no Ubisoft logos, key art, box art, character art or ripped game assets on the site. Official images are **linked, not copied**. Trailers are shown only through the official YouTube embed of Ubisoft's own upload.
- **Footer disclaimer (EN):** "Unofficial fan project. Not affiliated with, endorsed or sponsored by Ubisoft. Tom Clancy's The Division 2 and related marks are trademarks of Ubisoft Entertainment. Private and non-commercial."
- **Footer disclaimer (zh-Hant):** 「非官方粉絲專案，與 Ubisoft 無任何隸屬、背書或贊助關係。《全境封鎖 2》及相關商標為 Ubisoft Entertainment 所有。僅供私人、非商業用途。」
- No official wording exists to copy, so this is our own text.

## YouTube API Services ([Developer Policies](https://developers.google.com/youtube/terms/developer-policies))
- Stored API data: refresh or delete within **30 days** (III.E.4). → pipeline re-validates or drops video metadata older than 30 days.
- Don't download/cache video, don't alter/obscure/overlay the player, ads or links (III.E.1, III.I). → official iframe only, nothing overlays it after click.
- Attribute YouTube as source; link YouTube ToS and Google Privacy Policy (III.A.1–2, III.F.2). → About/Privacy page + credit under each video.
- Made-for-Kids videos: tracking off (III.E.4.j). → skip `madeForKids=true` videos entirely.
- One API project per client, never expose key (III.D.1). → key only in GitHub Actions secret.

## Twitch ([Embed docs](https://dev.twitch.tv/docs/embed/), [Developer Agreement](https://legal.twitch.com/legal/developer-agreement))
- Embeds need HTTPS and `parent=` for every serving domain; nothing may cover the player. → `parent` list from config (prod, preview, localhost).
- Unauthenticated Helix data (streams, games): community/staff posts indicate a **24-hour** storage limit (Schedule 1 wording **unverified**). → live data fetched on demand; clip metadata purged after 24 h.

## Reddit ([Data API Terms](https://redditinc.com/policies/data-api-terms))
- RSS ends 2026-11-13; public API closes to new users 2026-10-31 and fully by March 2027. → **no ingestion**; manual links only. No Reddit content used for AI.

## Fandom wiki
- Text is CC BY-SA 3.0. → only used to cross-check glossary terms; any reused text credited + link.

## Our own privacy
- Private (Cloudflare Access), `noindex`, `robots.txt` Disallow: /, no analytics, no third-party requests until a video is clicked.

## Enforcement in code (Phase 1+)
- Schema: every item requires `sourceUrl`; every media item requires `license` + `attribution` → CI fails otherwise.
- Summary length ≤ 80 words; quotes ≤ 25 words — checked by unit test.
- Retention job: YouTube metadata > 30 days re-validated/dropped; Twitch data > 24 h dropped.
- CSP allows frames only from `www.youtube-nocookie.com`, `player.twitch.tv`, `clips.twitch.tv`.
