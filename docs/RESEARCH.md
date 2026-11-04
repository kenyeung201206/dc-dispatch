# Research findings — Phase 0

Researched 2026-11-04 (Asia/Tokyo). Everything below was checked live today unless marked **Unverified**.

## Kickoff decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Hosting | A → changed 2026-11-04: Cloudflare Pages + **own password lock** (Access/Zero Trust wanted a payment card; owner declined) |
| 2 | Refresh runner | A — GitHub Actions, 06:00 Asia/Tokyo (21:00 UTC previous day) |
| 3 | API keys | A — YouTube Data API + Twitch only. **No Anthropic, no image-gen key** |
| 4 | Chinese | A — Traditional Chinese, Taiwan terms (`zh-Hant-TW`) |
| 5 | Humour | A — Medium |
| 6 | Visual | A — Newsprint broadsheet + SHD orange, Day edition default (3 masthead mockups in Phase 2) |
| 7 | Profiles | A — "Me" and "Wife" |
| 8 | Ranking | A — All-round |

**Consequence of no Anthropic key:** EN summaries fall back to short extracts (≤ 80 words, ≤ 25-word quote rule still enforced). zh-Hant summaries cannot be generated; they come from (1) official Ubisoft zh-TW articles when one exists, (2) glossary-driven headline templates for structured items (patch, event dates), otherwise (3) a visible **「翻譯待補 / translation pending」** flag. Adding `ANTHROPIC_API_KEY` later switches on full bilingual summaries with no code change.

## 2.1 Game state (as of 2026-11-04)

- **Current:** Year 8, Season 3 **"Red Horizon"** (Cleaners-focused season), announced 2026-08-26. [Ubisoft](https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates/4mrYiFPIyKpzpoqshDQk80/the-division-2-red-horizon)
- **Latest Title Update:** **TU Y8S3.3** — notes posted 2026-11-02, live 2026-11-03 (described as the last TU of Red Horizon by [Sportskeeda](https://www.sportskeeda.com/mmo/the-division-2-title-update-y8s3-3-patch-notes-crossplay-master-climax-mission); not stated by Ubisoft). [Official notes](https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates/7L8TlD1Hv0XC1prOD8mdte/tuy8s33-crossplay-rollout-conflict-improvements-more)
  - **Crossplay rollout:** Nov 3 UI/icons only → **Nov 10** PC moves to new servers, PC leaderboards reset → **Nov 17** PS/Xbox join, crossplay on by default (toggle at character select). Clan cap 50 → 100.
  - **Master Climax Mission** (Nov 3): first Master clear guarantees *Loaded for Bear* exotic gloves.
  - **Shepherd Event:** Nov 17 – Nov 26 (6 projects; Malinois named Mk16 on final project).
  - Conflict scoreboard/marks rework; PvP weapon/talent tuning (details in a separate PvP post, not yet read).
  - Stretch Goals paused this season.
  - **Known issue:** Climax Mission can stay locked after all HVT Manhunt scouts — workaround: relog.
- **New DLC:** **Echoes of Central Park** (《全境封鎖 2 - 中央公園的迴響》), released 2026-11-03; horror-tinged story + endgame + skill variants. [Ubisoft](https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates/4yCTNp7RZ1Fdm1kMKYgndg/the-division-2-echoes-of-central-park-dlc-is-available-now)
- **Previous:** TU Y8S3.2 (2026-10-13) — Red Moon Unleashed event, ran Oct 15 – Nov 3. [Ubisoft](https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates/7uzKuy4iB0MtOJfsXAr3TO/tuy8s32-red-moon-unleashed-creator-collaboration-escalation-updates-more)
- **Roadmap for Year 9 / next season:** **Not found.** Nothing official yet; site will say so rather than guess.
- **Other Division titles (Franchise Desk):**
  - *The Division Resurgence* — launched on mobile 2026-03-31 ([MobileSyrup](https://mobilesyrup.com/2026/03/31/ubisoft-the-division-resurgence-mobile-launch/)); PC/Steam dates differ between sources → **Unverified**.
  - *The Division Heartland* — cancelled (2024). [Wikipedia](https://en.wikipedia.org/wiki/Tom_Clancy%27s_The_Division_Heartland)
  - *The Division 3* — in development at Massive; no date. **Rumour-level for any details.**

## 2.2 Sources — summary (full table in [SOURCES.md](SOURCES.md))

| Source | Status | Decision |
|---|---|---|
| Steam News API (`ISteamNews`, app **2221490**) | ✅ JSON works, no key; official posts carry `feedname=steam_community_announcements` and mirror Ubisoft patch notes | **Primary official feed** |
| Ubisoft news pages (EN + **zh-TW**) | ✅ 200, robots.txt allows; zh-TW has official Chinese titles for *some* posts | **Use** (HTML, polite, once/day) — key source for Chinese |
| Ubisoft forums | ❌ **Closed**; redirect to Discord | Reject |
| Reddit r/thedivision, r/division2 | ⚠️ RSS works today (one 429), but **Reddit ends RSS 2026-11-13** and stopped new API sign-ups 2026-10-31 ([heise](https://www.heise.de/en/news/Reddit-to-shut-down-RSS-feeds-and-public-API-11473400.html), [TechRepublic](https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/)) | **Manual links only** |
| Massgate.org | ❌ Expired TLS cert / unreachable | Reject |
| Division fandom wiki | HTML blocks bots (403); MediaWiki API works; CC BY-SA | Manual link + glossary cross-check only |
| X / Twitter @TheDivisionGame | Paid API | Manual link only |
| YouTube Data API v3 | Key provided by you | **Use** (allowlisted channels, `playlistItems` = 1 quota unit; avoid `search` = 100 units) |
| Twitch Helix | Key provided by you | **Use** (game id looked up at runtime, not hard-coded) |
| Discord | Not scrapable | Manual link only |

**Community gap:** with Reddit and the Ubisoft forums gone, *Community Pulse* has no automated source. Options for Phase 3: Steam community announcements/press feeds from the same API (third-party press, labelled "reported"), plus YouTube creator uploads. Glitch Watch will rely on official known-issues lists and creators; forum-style glitch reports will be thinner.

## 2.3 Tech verification

| Tool | Current version (npm, today) | Note |
|---|---|---|
| Astro | 7.4.5 (published 2026-11-02) | Static output + islands; built-in i18n routing |
| Pagefind | 1.6.0 | Static bilingual search, no server |
| Zod | 4.6.7 | Schema validation |
| Playwright | 1.64.1 | Desktop + iPhone/Pixel emulation |
| Node | v24.19.0 installed | ✅ |
| pnpm | **not installed** | Enable with `corepack enable` (I'll ask before running) |
| git | 2.55 installed; **this folder is not a repo yet** | Need a private GitHub repo for Actions |

**Recommendation: Astro + TypeScript** over Eleventy (weaker TS/islands story) and Next static export (heavier JS, wrong tool for a static paper).

## 2.4 Legal / policy (full detail in [LEGAL.md](LEGAL.md))

- **Ubisoft:** no dedicated fan-site/brand policy found. Only the [Video Policy](https://www.ubisoft.com/en-us/videopolicy.html) (2016): allows non-commercial fan content, forbids plain re-uploads of trailers, no paywalls. → We use **no Ubisoft logos, key art or ripped assets**; link out to official images instead.
- **YouTube API ToS:** 30-day max for stored API data, must refresh; no altering/obscuring the player; must link YouTube ToS + Google Privacy Policy; one key per project.
- **Twitch:** embed needs `parent=<domain>` and HTTPS; nothing may overlap the player. Developer Agreement reportedly limits unauthenticated Helix data to **24 h** storage → live data must be fetched fresh (see plan).
- **Reddit:** moot after Nov 13 — links only.

## Blocking issues

None blocking. Two things you should know:
1. **Chinese quality without an Anthropic key will be patchy** (official zh-TW where available, else "pending"). Cost with a key would be a few US cents per day.
2. **"Live Now" can't be a 06:00 snapshot** (stale + 24 h rule). Plan: a tiny Cloudflare Pages Function behind Access that calls Helix on demand with a 5-minute cache. Free tier covers it.

## Unverified / to confirm later
- Cloudflare Access free tier = 50 users, one-time-PIN email login, session up to 1 month — secondary sources only; verify in Phase 7.
- Twitch Developer Agreement Schedule 1 exact wording on storage.
- Resurgence PC/Steam dates.
