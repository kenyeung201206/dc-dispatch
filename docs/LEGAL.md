# Legal & policy summary

Not legal advice. Researched 2026-11-04. Each rule below is enforced in code (see "Enforcement").

## Ubisoft
- **No dedicated fan-site / brand-usage policy was found.** The only public creator policy is the [Ubisoft Video Policy](https://www.ubisoft.com/en-us/videopolicy.html) (last updated 01/2016): non-commercial fan content encouraged; "simple duplication of our official trailers … is not in keeping" with it; no charging for access; questions → videorights@ubisoft.com.
- **Our stance (updated 2026-11-04, owner's decision):** the site was private when this was decided; it is now public and non-commercial (2026-11-12, owner's decision to keep everything). It shows **Ubisoft's own published promotional images** — Steam store screenshots and the header images of official Ubisoft news posts.
  - Loaded directly from Ubisoft/Steam servers (`shared.akamai.steamstatic.com`, `staticctf.ubisoft.com`), not copied into the repo; shown unmodified (crop-to-fit only).
  - Every picture carries a visible "Photo: Ubisoft ↗" credit linking to where it was published (`data/images.json`, enforced by schema).
  - Generic gameplay shots used on a story they don't come from are labelled **"File photo / 資料照片"**; non-Division-2 stories (Franchise Desk) never get Division 2 file photos.
  - **Never:** images extracted from the game's installed files, fan art without permission, or making the site public with these images. If the site is ever shared publicly, swap to original art first.
  - Copyright still applies to private use; this is a low-risk, owner-accepted choice, not a licence.
- Trailers are shown only through the official YouTube embed of Ubisoft's own upload.
- **Footer disclaimer (EN):** "Unofficial fan project. Not affiliated with, endorsed or sponsored by Ubisoft. Tom Clancy's The Division 2 and related marks are trademarks of Ubisoft Entertainment. Non-commercial, no ads." (was "Private and non-commercial." before going public)
- **Footer disclaimer (zh-Hant):** 「非官方粉絲專案，與 Ubisoft 無任何隸屬、背書或贊助關係。《全境封鎖 2》及相關商標為 Ubisoft Entertainment 所有。非商業用途，沒有廣告。」
- No official wording exists to copy, so this is our own text.

## YouTube API Services ([Developer Policies](https://developers.google.com/youtube/terms/developer-policies))
- Stored API data: refresh or delete within **30 days** (III.E.4). → pipeline re-validates or drops video metadata older than 30 days.
- Don't download/cache video, don't alter/obscure/overlay the player, ads or links (III.E.1, III.I). → official iframe only, nothing overlays it after click.
- Attribute YouTube as source; link YouTube ToS and Google Privacy Policy (III.A.1–2, III.F.2). → About/Privacy page + credit under each video.
- Made-for-Kids videos: tracking off (III.E.4.j). → skip `madeForKids=true` videos entirely.
- One API project per client, never expose key (III.D.1). → key only in GitHub Actions secret.

### How Watch Now complies (Phase 5)
- Players load only after a tap; playback starts from that tap (the reader pressing play), never on page load. Official players only (`youtube-nocookie.com/embed`, `player.twitch.tv`, `clips.twitch.tv`); nothing overlays a running player.
- **Deviation from the brief:** video **thumbnails** come from YouTube/Twitch image servers (`i.ytimg.com`, `static-cdn.jtvnw.net`) before the tap, lazily when scrolled into view. They set no cookies. Copying them to our server would mean storing YouTube content, which the API terms restrict.
- Every video shows channel credit + "Watch on YouTube/Twitch ↗". Watch page links the YouTube Terms of Service and Google Privacy Policy.
- Video metadata is re-checked every run and deleted if not re-confirmed within 30 days; made-for-kids videos are skipped. Twitch data is fetched on demand (5-minute cache), never stored.
- Twitch `parent` = the page's own hostname at run time, so it is always correct for localhost, preview and production.

## Twitch ([Embed docs](https://dev.twitch.tv/docs/embed/), [Developer Agreement](https://legal.twitch.com/legal/developer-agreement))
- Embeds need HTTPS and `parent=` for every serving domain; nothing may cover the player. → `parent` list from config (prod, preview, localhost).
- Unauthenticated Helix data (streams, games): community/staff posts indicate a **24-hour** storage limit (Schedule 1 wording **unverified**). → live data fetched on demand; clip metadata purged after 24 h.

## Reddit ([Data API Terms](https://redditinc.com/policies/data-api-terms))
- RSS ends 2026-11-13; public API closes to new users 2026-10-31 and fully by March 2027. → **no ingestion**; manual links only. No Reddit content used for AI.

## Fandom wiki
- Text is CC BY-SA 3.0. → only used to cross-check glossary terms; any reused text credited + link.

## Our own privacy
- Public since branch `public-launch` (see docs/PUBLIC-LAUNCH.md): no password, listed on Google, privacy page at /privacy/. Built-in visit counter (totals only, a plain "1" visit cookie, robots not counted); favorites stay in the reader's browser; no third-party requests until a video is clicked (pictures load from Ubisoft/Steam with no referrer).

## Enforcement in code (Phase 1+)
- Schema: every item requires `sourceUrl`; every media item requires `license` + `attribution` → CI fails otherwise.
- Summary length ≤ 80 words; quotes ≤ 25 words — checked by unit test.
- Retention job: YouTube metadata > 30 days re-validated/dropped; Twitch data > 24 h dropped.
- CSP allows frames only from `www.youtube-nocookie.com`, `player.twitch.tv`, `clips.twitch.tv`.

## Community & creator sources (added 2026-11-04)
- **巴哈姆特:** robots.txt allows the board list and threads. We show only a post's title, the board's own short preview (≤ 60 characters) and a link — never full posts, never usernames, never uploaded images. The site's terms page could not be loaded, so use stays minimal; if 巴哈 objects or its terms forbid it, remove the `bahamut` source.
- **Facebook:** not used. Its robots.txt prohibits automated collection without Meta's written permission.
- **Division Wiki:** CC BY-SA 3.0 — quotes ≤ 25 words, credited "The Division Wiki (CC BY-SA)" with a link.
- **YouTube creator videos:** shown only through the official embed after a tap, with channel credit; same 30-day rule as above. Video stories are removed from archived editions after 30 days (`scrubOldYoutube`).
- **Labels:** creator/forum content is stamped COMMUNITY; leak/datamine/unreleased titles are stamped RUMOUR / 傳聞. Neither ever appears as official.

## AI summaries (optional)
- With `ANTHROPIC_API_KEY`, public source text (articles, video descriptions, first forum post) is sent to the Anthropic API to write short original summaries. No personal data is sent.
- Prompts treat source text as untrusted data; replies must match a strict schema; the model may not add facts and must say "unconfirmed" for community/rumour items. Stories show "AI summary of the source — check the original".
- Daily spend cap (`AI_DAILY_BUDGET_USD`, default US$0.50) and a content-hash cache (`data/ai-cache.json`) so nothing is summarised twice.
