# R20eb architecture — shared runtime, Player Character, and DM Sheet

**Updated:** 2026-10-29 · **Target:** Firefox v3.10.25 source refactor · **Browser QA:** pending.  
The shipped Firefox runtime is built from `v3/` plus `extension/firefox/`. The older `src/` tree and its v2-style sheet/radial HUD code are retained for historic tests and compatibility work; **they are not bundled in the current Firefox or Chrome v3 extensions**.

## Modes are data-source contexts, not inferred Roll20 roles

| Mode | How it becomes active | Permitted data/action scope |
| --- | --- | --- |
| `player-character` | Most recently selected token whose represented character and **Controlled By** permission are verified via the Roll20 editor | Source-bound token position/movement; character-specific private official sheet reader; existing, verified Roll20 native actions only |
| `dm-sheet` | One explicitly opened, visible, uniquely identified official 2024 PC sheet/dialog; may be available even when `Campaign.characters` is not hydrated | **Read-only** current visible sheet tab and HUD display. No inferred token control; do not navigate or hide manually opened sheet, open Journal entries, or invoke privileged DM APIs |
| `unbound` | No verified selected token or uniquely open sheet | No imported character is assumed. Previously stored snapshots remain staged, not rendered |

A person who is a GM can still select a verified token; a player can still open a sheet. The source mode indicates what R20eb can *verify*, **not** whether the browser user holds Roll20's GM role. The UI labels the active source. Source mode does not bypass independent native-action permission checks.

## v3 modules, in compiled order

| File | Responsibility |
| --- | --- |
| `00_capture.js` | Bounded read-only extraction/normalization, provenance, safe DOM values |
| `10_reader.js` | Authenticated cross-origin official 2024 sheet reader and message/ready bridge |
| `20_ui.js` | Shared importer panel, current-game storage, snapshot staging, render lifecycle |
| `21_native.js` | Verified Roll20 action adapters and authenticated private sheet ownership; must not forge game actions |
| `22_hud.js` | Shared HUD, entries, rendering, controls, keyboard and menu state |
| `23_token.js` | **Shared** Jumpgate selection discovery, source model/permission checks, game-scoped exact-ID character snapshot cache; no mode arbitration |
| `24_dm.js` | **DM Sheet**: recognize explicitly visible official character dialogs, bind exact-ID display, invalidate closed dialogs; choose only that reader and gate read-only sync |
| `24_player.js` | **Player Character**: apply verified token selection, rebase movement, isolate character HUD/settings, choose only permitted private sync |
| `25_auto.js` | **Shared importer engine**: cache-safe merge, authenticated scan, timers/health refresh; dispatches reader choice and identity guards into role modules; manual opt-in fallback retained |
| `26_session.js` | **Only mode coordinator**: selection precedence, session mode/label, campaign navigation and cleanup, polling entry point |
| `30_boot.js` | Editor/official-sheet boot; starts bridge, UI, auto-import and token watcher after modules load |

All definitions live in one build-time IIFE in the specified order; this is **not** an ES-module import system. Each role module names only its role's behavior, with the coordinator deciding when to invoke it. Do not add new DM branches into the Jumpgate low-level adapter or scatter selected-token logic through the sheet reader.

## Session transitions and privacy

- A **fresh verified token** takes precedence over an unchanged DM dialog. An explicitly opened **new** DM dialog can supersede an unchanged older map-token selection. A last-seen dialog latch prevents 400-ms flip-flopping. Closing and reopening that dialog is a new selection.
- On campaign change, discard active token, visible DM ID, pending role targeting, per-character in-memory caches, authenticated reader/popout registrations, native preview, and local turn/movement context. Load only new-game settings. No source cross-game reuse.
- An imported DM sheet is cached using its verified **game + exact character ID + matching name**, never promoted to a name-only legacy player snapshot. A player token verifies the character ID before reusing its cached values.
- Each async scan checks its generation and source identity before publishing. Manual DM reads never switch official sheet tabs, hide a dialog or silently borrow an earlier player-private reader. Scans can fail closed if official reader identity is missing.
- Player sync can navigate **only** a reader opened and owned by R20eb for that verified character; a manually opened official sheet is not an owned helper.
- UI indicators for Action, Bonus, Reaction and End Turn remain local, not Roll20 initiative controls. Movement tracks a selected verified token even after local End Turn; in DM sheet mode, no map movement access is inferred.

## Firefox-only modules

The build inserts `extension/firefox/turn-economy.js`, `movement-tracker.js`, `theme-manager.js`, `debug-window.js`, `battlefield-layout.js`, `panel-drag.js`, and `sheet-visibility.js` **before** `30_boot.js`. They own local turn/movement/UI state, themes and styling, consolidated Debug and safe manual-sheet visibility. Preserve original theme selection, taskbar orientation, click-only cascading menus, focused action-list scroll, and separately draggable panels.

## Build and test boundaries

- `scripts/build.mjs` builds the separately versioned optional userscript from v3. `scripts/lib/extension-builder.mjs` builds Firefox and Chrome. Both enforce the **same explicitly reviewed ordered list of v3 source files**; a new module requires a deliberate bundler update.
- `npm run check:firefox` builds both userscript and Firefox unsigned package, runs all Node tests, validates generated JavaScript. CI checks that the committed userscript matches the generated one.
- The `src/` tree is a separate **legacy** implementation. Legacy tests still run, but new work must target `v3/` and Firefox-specific modules, **not** silently mix old v2 bridge/profile behavior into v3.
- Mozilla unlisted signing, signed XPI publication, and `updates.json` digest are separate from CI. Green CI is not proof of real Roll20 Jumpgate, native roll, or DM browser acceptance.

## Follow-up design work

1. Verify current-player and GM scenarios in real Roll20: selected token changes, DM-opened level-7 sheet, same-name PCs, close/reopen, two simultaneous dialogs, and no cross-game cache.
2. To import **all** DM sheet tabs without interfering with a manually open sheet, design a distinct authenticated, character-ID-bound *DM-owned private reader* with explicit lifecycle, permission and duplicate-session tests. **Not implemented.**
3. Native action parity requires real source-bound evidence. Never silently turn unsupported buttons into fake sheet actions. Track unmapped calls in the Debug window and live test each.
4. Consider deprecating the non-shipped `src/` tree only after confirming the remaining legacy tests/documentation have replacements; do not remove during a role-splitting release.
