# R20eb runtime architecture and known integration limits

**Updated:** 2026-10-11 · **Status:** v2.3.10 stabilization CI verified (169 tests); Roll20 browser integration still needs validation.

## Source organization

Production `scripts/build.mjs` concatenates all `src/NN_*.js` modules in lexical order into one Tampermonkey IIFE. Definitions across modules share one scope. Source import order is significant for top-level initialization; function declarations can safely reference later declarations at runtime.

| Module | Responsibility |
| --- | --- |
| `00_core`, `10_roll20_bridge` | Profile storage, settings and Roll20 chat bridge |
| `14_beacon_dom`, `15_sheet_link`, `16_beacon_visible`, `17_frame_bridge` | Read-only sheet extraction and authenticated official 2024 frame messages |
| `18_sheet_access` | Find linked character and open via supported native methods; preserve hidden helper ownership |
| `18_sheet_tour` | Explicit tab imports, controlled-token discovery, profile assignment and helper lifecycle coordination |
| `18_stats_sync` | Merge cached attributes, explicit/linked token HP bar and read-only visible sheet snapshots |
| `19_radial_hud`, `20_ui`, `25_bg3_theme`, `30_events` | Combat wheel rendering, companion UI, styling and event handlers |

Full-runtime integration tests use `tests/_runtime.mjs` to load modules in exactly the same order as production. Some smaller tests intentionally load a subset to test lower-level isolation.

## Sheet-opening contract

1. Resolve character identity only from an active profile, its linked character/assignment or a unique controlled-character match. A selected token owned by a different profile is **not** a fallback.
2. Use a supported native Roll20 browser-side `showDialog` method when available.
3. If no native method works, return **false** and reveal a real clickable Journal link/instructions. Never simulate a hidden link click and claim success: the Roll20 VTT handler might not receive it.
4. An explicit player opening must reclaim, rather than close, an active auto-import helper.

## Stat-source contract

- All reads are local and read-only. No original character/health/AC fields are modified.
- A loaded character attribute model may be incomplete or stale; do not treat it as definitively authoritative.
- Auto HP-bar choice accepts only a linked attribute with a positively recognized HP name. Unlinked bars require explicit user selection.
- The visible official 2024 sheet is read without navigating tabs during background scanning. A recent visible-sheet scan temporarily protects its mapped values against stale model refreshes; source priority requires browser verification.
- Missing/nonnumeric values must not replace the previous stat, and partial reads must never discard imported attacks, spells or native action controls.
- In R20eb Sheet, Health source and Current sources provide diagnostics. Test live data before adding new field aliases.

## Remaining QA blockers

- Confirm a manual Journal link click is handled by the active Roll20 editor in both Jumpgate and legacy UI.
- With a real player-owned, controlled Nier token, compare current HP and max HP, AC, speed, initiative and all six abilities to the values visible in the original sheet.
- Verify model attribute names and timestamp/freshness against the official sheet; inspect which token bar (if any) is explicitly linked to HP.
- Test iframe, popout, closed helper, manual import and native roll buttons separately. Automated mocks cannot verify Roll20's private UI event routing.
