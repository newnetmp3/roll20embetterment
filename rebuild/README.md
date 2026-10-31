# R20eb v4 — clean rebuild preview

This is an **independent, from-scratch implementation** under `rebuild/`. The shipping v3 Firefox extension, signed update feed, current release workflow, and legacy userscript are untouched. It does **not** claim to have fixed v3's live Roll20 DM-session acceptance problems.

## Principles

- **Roll20 D&D 2024 only.** The main Roll20 editor and its official advanced-sheet host have separate minimal content scripts.
- **No Roll20 Mod API, Roll20 Pro requirement, remote service, guessed macros or synthetic dice rolls.** All character information comes from current page models or rendered official sheets.
- **Player mode:** exact selected token → represented character → Controlled By verification. Native actions require a live, source-observed official button in an extension-owned sheet.
- **DM sheet mode:** a single manually opened, exact-ID-verifiable official sheet is read only; never changes its tabs.
- **Journal previews:** authorized DM Journal entries and controlled player characters can be preloaded serially. Preview mode is read-only; no token ownership is fabricated.
- **Quiet private preloading:** only a newly created, exact-ID-verified Roll20 dialog can be moved off-screen/closed. Any manually opened dialog defers scanning. A missing close control restores the owned sheet visibly.
- **Startup race:** the sheet reader answers `hello` with its session and name; the editor waits for an authenticated ready response. Private imports allow approximately 12–26 seconds for lazy Roll20 content.
- **Fail closed:** unsupported Jumpgate selection APIs, unverified names, absent actions, conflicting permissions or empty sheets are diagnostics, not successful imports.
- **No network requests or telemetry.** The preview retains imported snapshots in memory, separated by campaign.

## Build locally

Node.js 20+ and `zip`:

```bash
cd rebuild
npm test
npm run build
```

Unsigned development packages are in `rebuild/dist/r20eb-v4-firefox-unsigned.zip` and `r20eb-v4-chrome-unsigned.zip`. Do not install simultaneously with v3; both create a Roll20 HUD. For temporary Firefox testing use `about:debugging` → This Firefox → Load Temporary Add-on → `rebuild/dist/firefox/manifest.json`. Temporary Firefox add-ons will not survive a restart.

## Current acceptance limitations

This is a first functional **alpha**. Real Jumpgate may not expose `window.jumpgate.tabletop.getSelection`; in that case selection and movement are intentionally unavailable. Some 2024 Vue controls may lack a unique native button and are observation-only. DM private opener, cross-origin reader, entire 2024 tab traversal, manual-sheet priority, actual chat-card parity and extension behavior at 1080p/1440p **require real browser validation**. Unit tests do not establish those outcomes. No Mozilla-signed XPI or production update feed is created until verified.
