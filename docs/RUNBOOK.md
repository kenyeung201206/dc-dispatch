# Runbook

## Daily refresh
`pnpm run refresh` fetches the sources, builds `data/editions/<Tokyo date>.json` and updates `data/images.json`.
Scheduled every 3 hours from 06:00 Asia/Tokyo by GitHub Actions. Safe to re-run: the same day's file is rebuilt (same edition number).

`pnpm run refresh:dry` does the same from recorded fixtures (`tests/fixtures/sources/`), with no network, and writes to `.dry-run/`. CI runs it on every push.

Pipeline steps (`pipeline/`):
1. **Fetch:** `http.ts`. Allowlisted HTTPS hosts only, 20 s timeout, 2 retries with backoff, ETag/Last-Modified cache in `data/cache/http/`.
2. **Parse:** `sources/steam.ts` (Steam News API JSON) and `sources/ubisoft.ts` (the `__PRELOADED_STATE__` JSON on Ubisoft news pages, EN + zh-TW).
3. **Dedupe:** `dedupe.ts`. Same canonical URL, or ≥ 70% title overlap within 3 days. The Ubisoft copy wins and other copies are listed as "also reported by".
4. **Classify and score:** `classify.ts`, `score.ts`. Rules and weights are in `config.ts`.
5. **Summarise:** `summarize.ts`. Without an AI key, the summary is a ≤ 25-word quote, shown in quotation marks with the source name. Chinese comes only from Ubisoft's official zh-TW article; otherwise it shows "翻譯待補". Known issues in patch notes become Glitch Watch items.
6. **Assemble:** `edition.ts`. Applies `data/overrides.json`. Keeps yesterday's items for a source that failed. Keeps active glitches for 60 days, marks updated stories, uses a 21-day window, and refuses to publish an empty edition.

## Site pages
- `/<lang>/` today, `/<lang>/edition/<date>/` past editions, `/<lang>/archive/` calendar
- `/<lang>/section/<category>/` section pages with confidence/topic filters (Glitch Watch = glitch board with status)
- `/<lang>/story/<id>/` story pages with sources, related stories and a translation-report link
- `/<lang>/patches/` Patch Notes Tracker from `data/patches.json` (pipeline keeps every TU it sees)
- `/<lang>/search/` Pagefind, one index per language; only story pages are indexed

## When a source breaks
- The log shows `"source failed"` or `"no items parsed (layout change?)"`. The edition still publishes with yesterday's items for that source, and `sources[].ok=false`.
- **Ubisoft:** check that the page still contains `window.__PRELOADED_STATE__` and that articles still have `id/title/date/button`. Fix `sources/ubisoft.ts`, then re-record the fixture with the real page.
- **Steam:** the API is stable. Check app id `2221490` and the `feedname` for official posts.

## Editor overrides (`data/overrides.json`)
Hand-written fixes keyed by item id. Ids are printed in the edition JSON and stay stable, because they're a hash of the source URL. You can set `headline_zhHant`, `summary_zhHant`, `whyItMatters_*`, `summary_en` + `summaryKind: "original"`, `riskNote_zhHant`, `banRisk`, `category`, or `hide: true`.
Use this for Chinese until `ANTHROPIC_API_KEY` is added, and to correct a misfiled or wrong story.

## Adding a source
1. Add it to `SOURCES` in `pipeline/config.ts`, and its host to `ALLOWED_HOSTS`.
2. Write `pipeline/sources/<name>.ts` returning `RawItem[]`. Validate the input with Zod and never `eval`.
3. Record a fixture in `tests/fixtures/sources/`, add a parser test, and register the source in `PARSERS` / `FIXTURES` in `refresh.ts`.
4. Record it in `docs/SOURCES.md`, including its terms of service.

## New season / title update
Update `SEASON` in `pipeline/config.ts`. The TU label is detected automatically from patch-note titles.

## Glossary
Edit `data/glossary.json`. Only set `verified: true` with an official Ubisoft zh-TW link (a test enforces this).

## Watch Now
- `data/videos.json` is rebuilt every refresh: official videos from Ubisoft's pages (no key) + allowlisted channels (`data/video-channels.json`, needs `YOUTUBE_API_KEY`). Every video is re-checked with YouTube oEmbed; unconfirmed ones vanish after 30 days.
- Live Now calls `/api/live` (`functions/api/live.ts`), which needs `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` in the Cloudflare Pages environment. Until deployed (Phase 7) the page shows "live list unavailable" with a link to Twitch.
- The refresh reads keys from `.env` (`node --env-file-if-exists=.env`) locally and from GitHub Actions secrets in CI.

## Intel sources
- **巴哈:** `pipeline/sources/bahamut.ts` reads the board list; if the layout changes the log says "Bahamut board layout changed" and the edition still publishes. Fixture: `tests/fixtures/sources/bahamut.html`.
- **Exotic Intel:** `pipeline/exotics.ts` → `data/exotics.json` (kept 120 days). Official from Ubisoft tables/mentions; "Spotted" from the wiki category.
- **Creator scan:** `searches` in `data/video-channels.json` (each costs 100 YouTube quota units/day).
- **AI summaries:** set `ANTHROPIC_API_KEY` (GitHub secret). Optional repo variables: `AI_MODEL` (default `claude-opus-5-5`), `AI_DAILY_BUDGET_USD` (default 0.50). Spend appears on the Status page.

## 攻略精選 / Guide Picks
- **Automatic:** new videos from `guideCreators` in `data/video-channels.json` (currently 灰帽特工, channel UCJ2qGCBwyN8d2l9aoWkyShw). Needs `YOUTUBE_API_KEY`.
- **Editor picks:** `data/picks.json`. For a YouTube community post, add `{"kind":"post","url":…,"title":…,"channelName":…,"channelUrl":…,"summary_zhHant":"our own words","added":"YYYY-MM-DD"}`. Never paste the creator's text; YouTube posts can't be read automatically (no API; scraping is against YouTube's terms).
- **Expiry:** `until` if given; else the matched event's end date (`data/events.json`, `match` words in the title); else 60 days. The daily rebuild removes expired guides. Events are also read automatically from Ubisoft notes ("EVENT … From November 17 to November 26").

## Keys
Names are in `.env.example`. None are needed for Phase 3. Rotate a key by replacing it in your `.env` and in GitHub Actions secrets; never commit it.
