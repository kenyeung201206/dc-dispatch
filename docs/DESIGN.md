# Design — The DC Dispatch

Direction **A2: broadsheet + SHD HUD rail** (picked 2026-11-04 from `docs/mockups/mastheads.html`).
Newsprint by day, HUD by night. Print typography in a tactical world.

## Tokens (`src/styles/tokens.css`)

| Token | Day | Night | Use |
|---|---|---|---|
| `--shd` | `#FF6D10` | same | Fills, rules, emblem, large text only (approx. SHD orange, not verified against in-game UI) |
| `--shd-ink` | `#A84300` (5.5:1) | `#FF8A3D` (7.9:1) | Small orange text |
| `--on-shd` | `#111` (6.4:1) | same | Text on orange fills |
| `--paper` / `--paper-2` | `#F3EEE3` / `#E9E2D2` | `#121416` / `#1B1E21` | Backgrounds |
| `--ink` / `--ink-soft` | `#1B1A17` / `#4A463F` | `#E8E4DA` / `#B3ADA2` | Text |
| `--hazard` | `#F2C200` | same | Glitch Watch |
| `--dz-red` | `#B3261E` | `#FF5A4E` | Dark Zone, ban risk, satire labels |
| `--panel` | `#17191B` | same | HUD rail (always dark) |

Contrast ratios are calculated estimates; automated axe checks come in Phase 8.

## Type
- **Headlines:** Playfair Display 700/900 (OFL)
- **Body:** Libre Caslon Text 400/400i/700 (OFL), 17px base, line-height 1.6
- **HUD labels:** IBM Plex Mono 400/600 (OFL)
- **Chinese:** Noto Serif TC 500/900 (OFL), line-height 1.75, `line-break: strict`, `text-autospace`
- Self-hosted via Fontsource. Latin fonts load only the `latin` subset; Noto Serif TC ships ~100 `unicode-range` slices, so a page downloads only the glyphs it uses.

## Layout
- Mobile first. 360px: compact sticky bar (emblem, name, 中/EN, ◐) → full masthead → ticker → sticky, swipeable section tabs → single column.
- ≥768px: sticky bar hidden; masthead is title + 290px HUD rail; 2-column story grids.
- ≥1024px: 8/4 split (lead + sidebar), 3-column story rows with column rules, section tabs wrap.
- Tap targets ≥ 44px, body ≥ 16px, no horizontal scroll, safe-area insets (all checked by Playwright).

## Components
| Component | Notes |
|---|---|
| `Masthead` | A2 title + HUD rail (edition, date, season/TU, D.C. weather gag), plus phone sticky bar |
| `Ticker` | Top headlines + one ISAC joke. Pauses on hover/focus. Reduced motion → static, swipeable line |
| `SectionNav` | Sticky tab bar; hazard/red markers on Glitch Watch and Dark Zone |
| `StoryCard` | `lead` (drop cap / 首字強調), `standard`, `brief`. Always shows confidence stamp + source link. Chinese falls back to English + 「翻譯待補」 |
| `Stamp` | OFFICIAL (green), REPORTED (grey), RUMOUR (red, dashed) |
| `SideBox` | HUD corner brackets; `hazard` and `satire` tones. Satire is always labelled |
| `Photo` | Official game picture (`data/images.json`): `lead` (eager, full size, SHD brackets), `card`, `banner`. Always shows "Photo: Ubisoft ↗"; generic shots say "File photo / 資料照片". Day edition mutes colour slightly for a newsprint feel. Phones get the 600px file for cards/banners |
| `LeadArt` | Original SVG, used only when the lead story has no picture |
| `Hex` | Original emblem — deliberately not the SHD logo |

## Rules
- Facts and jokes never share a box. Jokes live in: ticker tail, section taglines, empty states, weather gag, Agent of the Day, Back Page.
- No Ubisoft logos, key art or game assets.
- Motion: only the ticker moves; everything respects `prefers-reduced-motion`.

## Not yet (later phases)
Print stylesheet, bilingual side-by-side mode, PWA, video facades, AI art pack, Easter eggs.
