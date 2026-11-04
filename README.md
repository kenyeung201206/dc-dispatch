# The DC Dispatch · 華盛頓每日快報

A private, bilingual (EN / 繁體中文) daily newspaper about *Tom Clancy's The Division 2*, for two readers.
Unofficial fan project, not affiliated with Ubisoft.

**Status:** Phase 1 (skeleton). See `DIVISION2_SITE_BRIEF.md` for the full spec and `docs/` for research.

## Setup

Requires Node 24+ and pnpm 12.

```bash
pnpm install
pnpm dev          # http://localhost:4321/
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Local dev server |
| `pnpm build` | Static build into `dist/` |
| `pnpm check` | Astro + TypeScript type check |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm i18n:check` | Fails if EN and 中文 UI strings don't match key-for-key |
| `pnpm ci` | All of the above, as CI runs it |

## Configuration

Secrets are read from environment variables only. Names are listed in `.env.example`:
`YOUTUBE_API_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `ANTHROPIC_API_KEY` (optional),
`ALLOWED_EMAIL_1`, `ALLOWED_EMAIL_2`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `HUMOUR_LEVEL`.
The site builds and tests pass with none of them set.

## Layout

```
docs/       research, sources, legal
src/        Astro site (i18n/, layouts/, pages/, schema/)
scripts/    repo checks
tests/      unit tests + fixtures
public/     static files (robots.txt, Cloudflare _headers)
```

## Troubleshooting

- `pnpm: command not found` → `npm install -g pnpm@12.16.1` (no admin needed).
