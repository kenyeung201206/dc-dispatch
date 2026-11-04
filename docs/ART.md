# Art & identity (Phase 6)

## What the identity is built from today
- **Original vector/CSS art (ours, no licence issues):** hex emblem (deliberately not the SHD logo), SHD corner brackets, hex-grid and scan-line backgrounds, paper grain, the lead-story HUD skyline illustration (used when a story has no picture), the Nerf-O-Meter gauge, stamps, redaction bars, the Hunter-mask theme.
- **Official Ubisoft pictures** (owner's decision 2026-11-04, see `LEGAL.md`): Steam store screenshots, Ubisoft news images and YouTube thumbnails, always credited.

## AI-generated art: not built yet (needs a decision)
Kickoff choice 3 did not include an image-generation key, so no generator is wired up and nothing was generated.
The brief's plan (§9.2) is still ready to do on request:
1. Research current providers (quality, price per image, commercial/licence terms, safety rules, text rendering), recommend one primary + one fallback.
2. Small adapter in `pipeline/media/` with keys from env only, prompt-hash cache, budget cap, `--dry-run`.
3. Generate the **core identity pack once** (masthead texture, section banners, agent silhouettes, D.C. scenes, empty-state art), review together, commit; label every image "AI-generated" in captions, alt text and `public/img/attribution.json`.

With official pictures now on every page, AI art is optional — mainly useful for section banners in sections with no recent screenshots, the Back Page, and a 100% original look if the site ever becomes public.
