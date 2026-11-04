# Sources register

Checked 2026-11-04. Reliability: A = official, B = established press/creator, C = community. Re-check every source quarterly or when it fails.

| Source | URL | Access method | Terms | Rate limit / auth | Update freq | Lang | Rel. | Decision |
|---|---|---|---|---|---|---|---|---|
| Steam News API | `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2221490` | Official JSON API (no key) | [Steam Web API Terms](https://steamcommunity.com/dev/apiterms) | Be polite: 1 call/run | Several/week | EN (+ third-party RU press) | A (feedname `steam_community_announcements`) / B (others) | **Use** — filter by feedname; non-official feeds tagged "reported" |
| Steam news RSS | `https://store.steampowered.com/feeds/news/app/2221490/` | RSS | Same | — | Same | EN | A | Fallback if API fails |
| Ubisoft TD2 news (EN) | https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates | HTML (robots.txt allows) | [Ubisoft Terms of Use](https://legal.ubisoft.com/) | 1 req/day, generic UA | Weekly | EN | A | **Use** — titles, dates, links only; no full-text republish |
| Ubisoft TD2 news (zh-TW) | https://www.ubisoft.com/zh-tw/game/the-division/the-division-2/news-updates | HTML | Same | 1 req/day | Weekly; some posts EN-only | zh-Hant | A | **Use** — official Chinese titles + glossary terms |
| Ubisoft Division franchise news | https://www.ubisoft.com/en-us/game/the-division/news-updates | HTML | Same | 1 req/day | Weekly | EN | A | **Use** for Franchise Desk |
| Ubisoft support (TD2) | https://www.ubisoft.com/en-us/help/the-division-2 | HTML | Same | 1 req/day | Irregular | EN | A | Use for known issues / server status (Phase 3 parse test) |
| YouTube Data API v3 | https://developers.google.com/youtube/v3 | Official API (`YOUTUBE_API_KEY`) | [Developer Policies](https://developers.google.com/youtube/terms/developer-policies) | 10k units/day default; use `playlistItems` (1 unit), `videos` (1 unit) | Daily | EN/various | A/B | **Use** — channel allowlist in `data/sources.json` |
| Twitch Helix | https://dev.twitch.tv/docs/api/ | Official API (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`) | [Developer Agreement](https://legal.twitch.com/legal/developer-agreement) | App token; ~800 points/min | Live | various | A | **Use** — on-demand via Pages Function; clips daily |
| Twitch category | https://www.twitch.tv/directory/category/tom-clancys-the-division-2 | — | — | — | — | — | — | Link target |
| Reddit r/thedivision, r/division2 | https://www.reddit.com/r/thedivision/ | RSS until **2026-11-13**, then none | [Data API Terms](https://redditinc.com/policies/data-api-terms) | New API access closed 2026-10-31 | — | EN | C | **Manual link only** |
| Ubisoft forums | https://discussions.ubisoft.com/ | — | — | — | **Closed** (redirects to Discord) | — | — | **Reject** |
| Ubisoft / Division Discord | https://discord.gg/ubisoftofficial | Not scrapable | Discord ToS | — | — | — | — | Manual link only |
| X @TheDivisionGame | https://x.com/TheDivisionGame | Paid API | X Developer Terms | — | Daily | EN | A | Manual link only |
| Division fandom wiki | https://thedivision.fandom.com/ | HTML 403 to bots; MediaWiki API OK | CC BY-SA 3.0 | — | Community | EN | C | Manual link + glossary cross-check (with attribution) |
| Massgate.org | https://massgate.org/ | — | — | — | Unreachable (expired TLS) | — | — | **Reject** |

## YouTube channel allowlist (to fill in Phase 5)
Each channel will be checked for: active in last 60 days, uploads are `status.embeddable=true` and public. Candidates: official Tom Clancy's The Division channel and Ubisoft channel (trailers), plus well-known Division creators. **Not yet verified; nothing gets listed until it is.**
