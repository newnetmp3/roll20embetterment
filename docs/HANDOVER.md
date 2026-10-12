# R20 Embetterment — Rolling Development Handover

**Updated:** 2026-10-12  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Current verified feature baseline:** `614fa130b404df9eb3c85a1fe9f81f10d8995e32` (v3.1.7, merged PR #44).  
**Latest completed milestone:** v3.1.7 screenshot-based unlabeled Inventory minus/count/plus recognition, improved row selection, dirty events and diagnostic label (PR #44, 257 tests passed).  
**Known unresolved issues:** v3.1.7 Crowbar quantity-zero removal is now user-verified. HUD v1 requires real Floorp interaction QA; cards are intentionally read-only until native Roll20 actions are verified. Fully closed-sheet Journal opening and some AC/speed/save/slot mappings remain.  
**Pending:** Confirm live approximately one-second HP detection with mounted controls, background opening from Journal, and authoritative AC/speed values.  

## Resume process

1. Fetch `docs/HANDOVER.md` and `docs/ROADMAP.md` from GitHub main. Verify latest SHA, open PRs, build version and GitHub Actions.
2. Implement meaningful, tested slices from the roadmap rather than tiny one-off commits.
3. **Update both documents in every development PR** with implemented behavior, verifiable tests/CI, remaining problems and next action.
4. Edit the current v3 modules under `v3/`; `src/` contains legacy code. `roll20-embetterment.user.js` is generated with `npm run build`.
5. Run `npm run check` and require green Actions before merging. Keep the handover factual and refresh the baseline after each merge.

## Existing implementation (v2.3.2)

- Modular player-first D&D 5e userscript with BG3-inspired, token-following concentric wheel.
- Guided sheet tour, 2024 advanced attribute harvesting, authenticated iframe/popout bridge, controlled-token auto-import, hidden helper-sheet registration.
- Official 2024 native button roll execution for weapons/spells/skills/saves/tools/features/hit dice, and legacy 2014 macro support.
- Local-only resource reminders/notes; character sheets are not modified.

## v2.3.3 delivery (PR #16)

- Expose native weapon Attack and Damage controls from the Sheet panel alongside the complete native-roll inventory.
- Make the searchable command palette able to invoke official sheet-roll references without synthesizing formulas; prefer official Skills/Saves with existing local fallback.
- Preserve legacy commands, secure frame identity validation, and read-only character access.
- Add regression tests for UI button availability, palette results, bridge dispatch and safe fallback.
- Refresh version metadata, README and generated Tampermonkey distribution.

**CI verified:** PR #16 head `5de47e95b73155dc0f4049f42d6ab372cd94d92c` passed **128 tests, 0 failures**, generated-userscript check and JavaScript syntax check. Baseline v2.3.2 PR #15 passed 125 tests.  
**Remaining live testing:** Official Jumpgate / 2024 iframe/popout, closed-sheet helper, selected token identity and legacy 2014. Automated DOM mocks do not replace these checks.

## v2.3.4 delivery (PR #17)

- Use per-character-and-roll in-flight guards to avoid repeating the same 2024 sheet action before completion.
- Show screen-reader-accessible rolling / received / error state in the app; disable matching Sheet-panel roll buttons while busy.
- Release guards after successful/failed requests, with retries enabled; clear completed feedback automatically.
- Preserve the native authenticated Roll20 frame bridge and read-only character sheet semantics.
- **Verified CI:** 130 tests passed, 0 failures, generated userscript and JavaScript syntax checks green (head `ed32372c5ba2fc6994df36c7f21f29b4037d419b`).

## v2.3.5 delivery (PR #18, CI verified)

- Separate **Cast in Roll20** (working command required), **Mark cast (local)** (explicit local record), **Roll attack / Roll damage** (native verified sheet controls), and **Use slot (local)** (manual expenditure).
- Share local casting classification (Action / Bonus Action / Reaction only for explicitly labeled casting times) across wheel, Sheet/Spells panel, palette and macros. Unknown casting times are not guessed.
- Local concentration reminder is set only on explicit Mark cast or successfully sent legacy cast commands; native 2024 attack/damage rolls leave reminders and slots untouched.
- Add regression tests for native 2024 spell without a cast command, bonus/reaction/ritual economy, successful/failed legacy commands, UI and palette.
- **CI verified:** PR #18 head `6249f818de42ed1201a7d3942e8e3fa5ac5e4bea`: **136 tests passed, 0 failed**, generated userscript clean and JavaScript syntax check green. **Pending:** live Jumpgate iframe/popout and legacy 2014 browser QA. The merge SHA is not embedded here: verify the current `main` ref when resuming.

## Next milestone

Improve wheel keyboard accessibility and command-palette navigation; continue live official 2024 iframe, popout, closed-sheet helper and legacy 2014 verification.

**Rolling policy:** Update this file and `docs/ROADMAP.md` in the same PR for each completed feature slice.

## v2.3.6 completed (PR #19)

- Each visible combat wheel ring offers a Tab entry, roving keyboard focus, arrow/Home/End navigation, Enter/Space selection, and Escape to step back without affecting text editing.
- Palette exposes active option to assistive technology, keyboard Home/End/Page navigation and graceful empty results. Escape closes palette before touching the wheel state.
- Regression coverage includes keyboard radial expansion/focus, preserved Escape precedence, and screen-reader combobox semantics.
- **CI verified:** PR #19 head `9111715701503dc2f601a620187c39e81943b87e`: **140 tests passed, 0 failed**, distribution regeneration clean and JS syntax valid. **Remaining:** live keyboard QA on Firefox/Tampermonkey/Jumpgate and mouse/keyboard parity. Verify merged main SHA when resuming.

**Next:** Continue live 2014/2024 sheet integration matrix and release/install automation. Keep this handover and the roadmap synchronized on each milestone.

## v2.3.7 — live screenshot feedback and isolation repairs (PR #20, CI verified)

- Reported in Firefox/Roll20 screenshots: automatic imports exposed Advanced Tools → Attributes, original sheet could not be manually opened, and minimized wheel toolbar was stuck at screen corner.
- Automatic imports now **never tour a player-opened sheet**, instead seed visible character-model attributes and defer full import to an explicitly requested tour or a future safe hidden helper.
- Temporary helper openings are pre-shielded before showDialog creates React/legacy UI. An identifiable helper is hidden, read and closed with its original inline style and interaction restored; unsuccessful helper creation is closed.
- Added explicit **Open original Roll20 sheet** to R20eb Sheet UI, the wheel footer, and the minimized dock. A player manually reopening a helper reclaims its window; background cleanup will not close it.
- Minimized dock includes a draggable grip and per-campaign persisted position. Buttons never initiate drag.
- Added regression tests for visibility shielding, restore/close, existing/manual-sheet ownership, interrupted helpers, and dragging. No actual Roll20 browser QA can be performed in this runtime; user live retest required.
- **CI verified:** PR #20 head `33c62715e1d09e2e31beb76aa38e03084026483e`, 150 passing tests, zero failures; generated userscript matches source and JavaScript syntax check passed. **Pending:** live Firefox/Jumpgate validation of the exact screenshots and workflows. For the post-merge baseline, re-fetch `main` HEAD rather than assuming this feature commit is the squash SHA.

**Next:** Test full import, manually reopened character window, external 2024 popout, helper after logout/reload, and toolbar drag on desktop/mobile; then continue priority 9 live integration matrix.

## v2.3.8 — Live character stats and compact wheel (PR #21, CI verified)

- Removed “Choose an action” wheel footer. Added compact AC, speed and initiative readout alongside current/max and temporary HP.
- Fixed one-time import behavior: imported characters previously never refreshed cached stats. Each scan now reads loaded Roll20 model attributes and merges available HP, max HP, temp HP, AC, speed, initiative, scores, modifiers, saves, skills, coins and details without reopening Advanced Tools.
- Preserves full imports: does not replace spells, attacks, native sheet rolls, notes or manually tracked spell use during a partial model refresh. Blank/invalid values do not reset stats. Added 2014/2024 aliases.
- Home now displays the six ability scores and modifiers, initiative, proficiency and level with a model-update indicator.
- **CI verified:** PR #21 head `11c71b80fd9b2244a10af10292fe294a951ceb6b` ran **155 tests, 155 passed, 0 failed**. Generated userscript is consistent with source. **Live Roll20 browser QA remains:** confirm exact named fields, changing HP/AC/speed and alternate character sheets. After merge, fetch the new main SHA rather than assuming the PR head.

**Next:** Verify actual current HP/AC/speed on a live character, and which fields Roll20 exposes in each edition. Only expand edition-specific adapters using tested markup; never manufacture missing values.

## v2.3.9 — Sheet opening and live-stat source fixes (PR #22, CI verified)

- Live screenshot showed the Roll20 button emitted “Select a controlled character token or open its sheet from the Roll20 Journal” even while Nier's linked profile and combat wheel were active.
- Root cause: opening previously *required* `character.view.showDialog`; current Roll20 character models do not always expose that method. Linked IDs and token assignments were ignored in this case.
- Resolve character ID from the current profile, selected assignment, unique mapped profile assignment, or unique exact controlled-character name. Reject malformed IDs and ambiguous matches.
- Preserve native in-editor sheet opening and hidden-helper ownership where supported. Otherwise activate Roll20's special in-game journal character link from the light DOM; never use window.open/new tab because Roll20 intercepts these links inside the VTT.
- Preserve the automatic importer isolation. Regression tests cover native methods, the in-VTT journal-link dispatch, ambiguous/missing IDs, safe link rendering, token-bar HP mapping, and fresh-versus-stale stat precedence.
- **CI verified:** PR #22 head `39605329cc10e3a6c8e8788de3a5ff2caaeb6f78` passed **167 tests, zero failures**; generated userscript matched and JavaScript checks passed. **Remaining:** verify VTT Journal handler dispatch and actual Roll20 2024/2014 HP/AC/speed values in Firefox; the tests cannot prove Roll20's private event interception.

**Next:** Verify clicking Roll20 from the expanded wheel or minimized dock opens Nier's actual sheet inside the VTT; compare official 2024 and legacy 2014 behavior and inspect R20eb's Sheet → Health source (Auto/Token Bar 1/2/3) and stat provenance. The v2.3.9 PR is merged; no browser verification was available in the development environment.

- Additional user feedback: current HP/AC/speed still inaccurate after v2.3.8. Added nonintrusive three-source reconciliation (model / linked-or-selected token HP bar / visible official sheet), a per-character HP source selector (Auto/Bar 1/2/3), and source diagnostics in Sheet UI. An open sheet's more recent stats are held for 45s to avoid flicker from stale attribute models between 15s read-only frame scans. Unknown/unlinked bars are never silently assumed to be HP. Manual browser verification remains because token bar setup and 2024 form data vary by campaign.

## v2.3.10 — Stabilization and source cleanup (PR #24 merged)

- Split the oversized `src/18_sheet_tour.js` into three single-purpose files: `src/18_sheet_access.js`, `src/18_sheet_tour.js`, and `src/18_stats_sync.js`. Production build uses lexical source order and runtime function declarations, with no new external dependencies or storage migration.
- Centralized full-runtime test module discovery via `tests/_runtime.mjs`, mirroring `scripts/build.mjs`. Added a module-structure regression test to catch missing/duplicate implementations.
- Removed fake success from the synthetic, programmatically clicked Roll20 Journal anchor. When native opening APIs are absent, R20eb shows the Sheet panel with a *real player-clickable link*, and clearly reports that automatic opening was unavailable.
- The selected token's character ID is only eligible when the token belongs to the active R20eb profile. This avoids sending a click to another player's/NPC's sheet.
- Corrected the linked-token-HP attribute-name normalizer for spaces, hyphens and dots, with a regression fixture.
- No claims of fixing live stat freshness or modern Jumpgate UI behavior. Known limitations: native opener unverified in modern Roll20; attribute model vs. visible sheet vs. token-bar precedence still needs actual browser tracing; React fields may not exist in the cached attributes model.
- **Verified:** PR #24 final head `9cda8e3de6b7e80dd4ecd911fe59e21a0a96349c`; merged as `1148313473bee5c6da3dbe434de8f22a3ecc3367`. GitHub Actions: 169 tests passed, 0 failed; `npm run check` and generated userscript consistency green.

**Next:** Capture a controlled, read-only comparison for Nier (HP, AC, movement, initiative, six abilities) that records exact source names without sensitive tokens; verify the authoritative Roll20 values before extending mappings. Review `docs/ARCHITECTURE.md` first.

## v2.3.11 — Nier stat mismatch correction (PR #26 merged, CI verified)

**User evidence:** Two screenshots from 2026-10-11 show official 2024 Nier sheet at 82/84 HP, AC 17, speed 55 ft, initiative +2.14, and six ability scores (18/14/15/12/15/10), while R20eb had 69/84 HP, AC 10, speed 30 ft, initiative +0 and blank scores.

**Root causes identified in code:**

1. `mergeBeaconSnapshot` previously preserved stale *named* values over newer visible 2024 text even in a confirmed live read.
2. `autoRefreshVisibleSheetStats` then unconditionally applied linked token-bar health over the visible character HP, even if the bar was stale or represented something else.
3. `autoCandidateForCharacter` ignored embedded 2024 iframes with no character ID (but a visible exact player-character name), preventing nonintrusive live refresh.
4. Initiative +2.14 had no visible text parser and the HUD truncated decimal values.

**Changes:** Trusted live 2024 scans opt in to a visible-value-first merge; visible HP takes precedence over token bars, which are now fallbacks; ID-less embedded candidates may match via unique exact character name and unique controlled-character identity; parse and render decimal initiative. Add screenshot-based regression fixtures and ambiguity checks. Named-first remains default for legacy data. This remains a read-only import.

**CI verified:** PR #26 code head `e1036ce8f7263303d382c19a107ccec07a8dc708` passed **173 tests, 0 failures**, JavaScript validation and generated Tampermonkey distribution consistency. A screenshot-based regression also exposed stale token HP overriding a recent visible-sheet read; this was fixed before CI went green. **Live Firefox/Jumpgate QA remains required**: mocks cannot confirm iframe matching and postMessage from Roll20 itself. Merged main commit `7b9ed80ea3a9920ede5da4a90845dc7f6fa7f47a`.


## v2.3.12 — Editable 2024 stat controls and frame fallback (PR #28, CI verified)

- The 2026-10-11 VTT HTML capture contains a **hidden headless 2024 iframe**, not the player's actual sheet control values; it cannot establish that a character sheet is open or reveal fresh HP.
- The existing visible-sheet parser read `innerText` only. Numeric inputs in the official 2024 HIT POINTS panel and inline ability rows are not part of `innerText`, so HP and score imports can be missing even while the sheet is open.
- Added a read-only bounded HP panel input reader (Current/Max/Temp), known `.inline-ability` score/roll-button reader and official initiative roll-button fallback. Hidden inputs and unsupported/invalid values are rejected; no page background traversal or sheet writes.
- When a live player-owned official frame returns named attributes but no parsed visible stats, import the named stats rather than treating it as empty. Token bar HP is only a fallback for genuinely missing frame fields; do not set freshness protection for named-only snapshots.
- Added regression tests for input values absent from `innerText`, invisible controls and named-frame HP taking precedence over stale token-bar values.
- **CI verified:** PR #28 head `a1bc636c8deafed83cc82fbafc3ed97bb63d245d`, **176 tests, 0 failures**, `npm run check` and generated-userscript consistency green (Actions run 38174945102). Live Firefox/Jumpgate retest remains required because the shared HTML is the VTT shell, not the iframe's internal form markup. Do not declare live HP correct until visual QA.

## v2.3.13 — Official 2024 Vue HP/ability incrementer fix (PR #29, CI verified)

- Live Floorp iframe element samples: `<input id="hp-current" data-testid="utility-incrementer__input" role="spinbutton" type="text" title="Current Hitpoints" value="82" aria-valuemax="84">`, and a hashed-ID `<input data-testid="utility-incrementer__input" title="STR" value="18">`. These form values are not represented by `innerText`.
- The previous bounded HP panel and `.inline-ability` parser can miss these actual controls. Added read-only title/ID/test-ID recognition, uses `aria-valuemax` as max HP only when a separate max-HP control is unavailable, and preserves existing fallback extraction.
- Removed the early return for sheets with empty `innerText`, so visible input-only scans can update the profile. Reject hidden/invalid/spoofed inputs; avoid overwriting directly identified scores with row-derived guesses.
- Regression fixtures exercise current 82/max 84, STR 18, explicit max/temp precedence and hidden/invalid controls. Version `2.3.13`; generated distribution updated.
- **CI verified:** GitHub Actions run 38176978583 on code head `08de26c442a1849faa9124ee3ed129354e8ea7fd`: **179 tests passed, 0 failed**, build and userscript syntax passed. **Pending:** real Floorp/official Roll20 2024 iframe validation. Confirm HUD reflects 82/84 and STR 18, then modify a live HP value and ensure it refreshes; do not claim production correctness solely from mocks.

## v3.0.0 — Independent importer rebuild

**Reason:** Actual official D&D 2024 imports in Floorp still failed after v2.3.13, despite 179 passing tests. Stop using the v2 importer. The production build now includes only new files under v3/; previous src/ modules remain unexecuted for comparison and archival tests.

**Architecture:** 00_capture.js captures bounded current rendered DOM controls/cards and their provenance, 10_reader.js authenticates iframe communication and explicitly traverses tabs, 20_ui.js shows source selector, coverage, fields, diagnostics, and export, 30_boot.js starts only v3. No old HUD, token HP fallback or background profile cache runs. The example control id hp-current, title Current Hitpoints, value 82, aria-valuemax 84 and a dynamic-ID STR title with value 18 are used in regression tests.

**Scope:** read-only current-tab and explicitly requested full-tab imports. Collect labeled combat stats, abilities, modifiers, saves, skills, slot values, spells, attacks, inventory, features, resources, and unrecognized labeled observations. An explicit warning marks offscreen/virtualized content as potentially incomplete. New per-campaign storage is separate from v2.

**CI VERIFIED:** v3 branch build head c05312ce1822dda6cf39095a6aff7fd1251c1fb8, GitHub Actions 38182938287: 189 tests passed, 0 failures (10 new v3 tests plus 179 retained v2 regression tests); generated bundle consistency and JavaScript syntax passed. **Pending:** crucial live Floorp/official 2024 iframe verification. The prior combat wheel and D&D 2014 support were deliberately excluded until the new data source works. On resume, fetch main HEAD and PR status, inspect snapshot diagnostics, then update both handover and roadmap. Do not equate passing mocks with working Roll20 integration.

## v3.0.1 — Importer buttons inert (2026-10-12)

**Live user report:** The official sheet becomes detectable once opened, but importer buttons appear to do nothing. **Confirmed root cause in v3 code:** `r3UIRefresh()` references `getElementById('r3-title')`, but UI markup only defines `id="r3-toggle"`. The method throws TypeError while refreshing selection and busy state, before the asynchronous import command can be issued. Refresh and Show/Hide failed for the same reason. This is independent of the iframe data adapter.

**Fix:** Point refresh at the real toggle button; wrap user click handlers to report unexpected exceptions in the panel. Newly added `tests/v3-ui.test.mjs` simulates a mounted Shadow DOM panel with an official iframe, checks selection and enabled actions, toggles, dispatches scan requests, verifies results and error states, and tests the visible exception fallback. **194 tests now pass** (189 previous + five UI integration-style tests). Generated bundle must match the new version. **Still pending:** Actual Floorp click-to-iframe-to-UI verification; do not claim browser integration works from mocks alone.

## v3.0.2 — Skill/object type crash during active sheet read (2026-10-12)

**Live Floorp failure after v3.0.1:** The selected sheet was `Nier (iframe)`, and a scan returned `Import failed: s[kind].some is not a function`. The provided ~685 KiB HTML is the **outer Roll20 editor body**, confirming `Character sheet for Nier` on `advanced-sheets.production.roll20preflight.net/dnd2024byroll20/` (and a second matching iframe), not the inside cross-origin sheet body. No further HTML is needed to fix this type crash.

**Confirmed cause:** `R3_CATEGORIES.skills` was included in `r3Cards()`, which calls `.some()` on category arrays. But `r3Empty().skills` is a keyed object, populated by `r3VisibleStats()`. A visible skill row would trigger a fatal TypeError before a snapshot could reach the editor. **Fix:** Exclude `skills` from named-card category scanning, retain proper skill bonus extraction from visible labeled rows, add defensive `Array.isArray` checks during capture and merging, add two type/skill regressions, and regenerate version 3.0.2.

**Next:** confirm CI and merge; manually validate actual Floorp current-tab import and then all-tabs capture, paying particular attention to skill values and available HP/spell controls. Passing tests must not be misrepresented as browser verification.

## v3.0.3 — Inventory and embedded resource capture / tab traversal (2026-10-12)

**Live report:** "inventory and resources both report none found when using import all tabs" after v3.0.2. The only previously uploaded HTML is Roll20's *outer* editor; it confirms the 2024 sheet iframe is mounted but does not include the inner inventory or resource markup. Do **not** assert the real CSS selectors were confirmed by the screenshot/outer HTML.

**Source audit found:**
1. The previous inventory category only recognized narrow selectors (.inventory-item/.equipment-item/data-testid variants). Many modern list rows may expose a generic named .span--item-row-title rather than those wrappers. Added a *tab-scoped* Inventory adapter to avoid treating spell/action item-rows as inventory.
2. The resource category only recognized standalone .resource-item rows. Roll20's documented 2024 UI puts charge/checkbox resource trackers *inside* features, inventory items, and actions, so added a read-only nested resource control adapter. Records visible checked/total checkbox observations; never interprets checked as "available" because semantics can vary.
3. Import all tabs took an early slice of 14 tab elements including nested filters and held stale DOM node references through Vue rerenders, so primary Inventory/Features tabs could be skipped entirely. Now captures tab identities, resolves fresh nodes on every click, prioritizes main views, restores original selection by identity, and explicitly logs whether Inventory was visited.

**Regression fixtures:** generic item-row titles (with negative Combat-context check), embedded features resource controls with no guessed remaining count, and a simulated Vue-replaced tab list with 17 filter tabs before Inventory, checking traversal and restore. The UI displays observed checkbox state and includes resource counts in progress.

**Verification:** Pending final GitHub Actions checks. **Still unverified live:** exact 2024 iframe DOM shape, number of virtualized inventory rows, and real resource checkbox semantics. If counts remain zero, the next evidence should be a bounded inner-iframe DOM probe or the exported importer JSON with Diagnostics (not another entire editor body).

**New user direction:** Once import is working properly, rebuild the UI using a Foundry VTT plugin as the design framework. Priority remains correct read-only stats/spells/inventory/resources first. No plugin file or URL is currently identifiable in the visible task context; request the exact module reference before implementation, and verify license before copying code/assets. Design adapters must not depend on the Foundry runtime.
 
## v3.0.4 — Non-disruptive importer refresh (October 12, 2026)

**Reported live issue:** Importer focus refreshes reset scroll during reading. **Cause:** `r3UIRefresh()` replaces `#r3-results.innerHTML` on every focus, recreating nested scrolling elements and closing expanded entries.

**Implementation:** Repaint results only when the selected category or imported snapshot actually changes. Remember per-category nested scroll positions and expanded entry keys, and retain outer panel scroll during genuine redraws. Avoid rewriting the sheet selector if its available choices did not change; still update buttons, busy state and status normally.

**Verification:** Added focus/Refresh and category/expanded-item regression tests with a scrolling VM UI fixture. Verify final GitHub CI outcome. Live Floorp interaction and data completeness remain to be checked.
 
## v3.0.5 — Evidence-led extraction improvements from real Nier export (2026-10-12)

**Real end-to-end imported snapshot received:** 82/84 HP, six ability scores, initiative +2.14, proficiency +3, 18 skills, 5 spells, 22 attacks, 37 inventory items and 34 features across Current view, Combat, Spells, Inventory, Features & Traits, Notes and About. The scanner reached the tabs previously reported empty. **Still missing:** resource records (0), temp HP (despite labeled 0 observation), all six modifiers, all saves, all slots, AC and speed. Export also had 114 raw control observations, 777 rejected controls and 58 unclassified controls.

**Root causes and changes:** The 2024 resource UI exposes genuinely named `input[type=range]` sliders (Second Wind, Action Surge, Unleash Incarnation, Fleet-Footed Resources, Healer's Kit), but the prior adapter only searched special CSS resource-tracker wrappers. Read these as named **observed slider positions** with explicit unknown used/remaining semantics, deduplicated across tabs. Recognize `Temp / tempHP` and official copper/silver/electrum/gold/platinum labels. Restrict spell attribute parsing to the short header and explicit field labels; do not extract `range` or `duration` from narrative phrases or automatically assert false concentration/ritual.

**Important safety boundary:** The export also shows persistent unlabeled UUID text controls containing 17 and 55, plausibly armor class and movement speed, but provides no trustworthy semantic linkage. Do not hardcode these UUIDs or infer field identity from numeric matches. A *targeted* parent element/accessible label sample is needed for them. Saving throws, modifiers and slots remain unverified. No full user-supplied JSON was added to the repo; tests use only minimal synthetic observations.

**Validation:** New fixtures cover real anonymized label/value patterns, slider dedup/semantics, safe handling of anonymous 17/55, and avoidance of false spell fields. Check GitHub CI before merging and verify against a fresh Floorp export after installing v3.0.5.


## v3.0.6 — Second live Nier export, targeted diagnostics and spell syntax (October 12, 2026)

The second JSON at 20:17 UTC independently verifies v3.0.5: HP 82/84, temporary HP 0, 5 coin denominations, 5 named slider resources, 18 skills, 5 spells, 22 attacks, 37 inventory items and 34 features across 7 sheet views. Unclassified controls fell from 58 to 36. Still missing actual AC/speed, saving throws, ability modifiers and spell slots.

Definite bug in the real spell export: Power Word Pain's `CON 11 Action V` was parsed as `11 Action`. Limit compact numeric casting shorthand to `1 action`, read official V/S/M and R/C tokens immediately after casting time, and add tests for this spell, Detect Magic and Blade of Disaster.

Unlabeled 17/55 fields have changing UUIDs between exports; do not hardcode IDs or infer AC/speed from the numbers. Add read-only support for `aria-labelledby` and short, local, at-most-2-string context hints for otherwise unnamed numeric inputs. Exported Nier character JSON is not checked in. These hints do not auto-classify a value. Actual saving throw/modifier/slot adapters remain follow-up work. New browser import required to see additional diagnostic hints.

## v3.1.0 — Opt-in background automatic importer (October 12, 2026)

**User request:** Automatically import Nier without opening the sheet and clicking Import all tabs. The latest v3.0.6 JSON verifies 82/84 HP, 3 spells (Druidcraft, Detect Magic, Lesser Restoration), 20 attacks, 37 inventory entries, 34 features, 5 resources and 18 skills. Power Word Pain and Blade of Disaster were deliberately removed; do not treat their absence as a regression.

**Real HTML inspection:** The Roll20 outer editor document has a character-specific dialog `[data-characterid]`, wrapping a named iframe `iframe_<characterid>`, but its `src` matches the generic `headless_sheet_frame_dnd2024byroll20`. The URL itself carries no character ID. Blindly cloning this URL does *not* establish the official character handshake. Implemented `v3/25_auto.js` as an **opt-in** per-game controller: match only the selected imported character and its recorded character ID; locate the exact Roll20 journal row when exposed, dispatch the normal double-click to open it, move only a dialog opened by the controller outside the viewport without display:none, request full scan no more than every 5 minutes and current scan no more than every 30 seconds, preserve old full-catalog results on partial scans, restore moved dialog when disabled. User-owned visible dialog scans do not change tabs. Retain manual buttons and add visible status feedback for missing journal DOM, not silently pretend it worked.

**Safety/limitations:** No private Roll20 APIs or arbitrary network calls, never clone the generic headless iframe, never scan a mismatching character or overwrite profile with empty/nonmatching snapshots. Journal DOM varies by Roll20 build, and the auto-open path has not been proven in live Floorp. Require browser QA to verify discovery, offscreen layout, named identity, update cadence, and recovery from unsupported journal UI. Keep `docs/ROADMAP.md` current.

**CI:** GitHub Actions run 38305794819 (commit 02e9383749f3a39c89a6a33b41c4657e8fa88ca9): **214 tests passed, zero failures**, including six additional automatic-import/visibility/identity/race-condition cases. Generated userscript matches source. **Manual QA still required** for synthetic journal double-click, character sheet iframe handshake, and whether Floorp retains usable offscreen rendering.


## v3.1.1 — Fast read-only HP watch and stricter automatic import (October 12, 2026)

**User request:** Bring HP refresh closer to one second while progressing the v3.1.0 automatic importer.

- The old auto timer ticked every 8 seconds and requested expensive current-tab scans no more often than every 30 seconds. Added separate `hp` bridge scan mode with a 1-second scheduling interval, 2.5-second timeout and bounded input-only reader. It reads explicitly labeled mounted HP, max and temporary HP; does not traverse tabs, invent missing values, or write to Roll20.
- HP-only updates modify just observed health fields, preserve the existing full spell/attack/inventory/resource catalog, and do not repaint unchanged UI. Skip fast checks while manual/full import is active; protect in-flight results across disable/re-enable using an epoch. Full background scans remain at most once per five minutes, current-tab scans at most once per 30 seconds.
- Automatic sheet selection now rejects conflicting character IDs even when the display name matches; unknown/duplicate name matches must be unique. Once a known character ID is selected, don't silently repin a different ID. A journal-open request records preexisting dialogs so only a newly created one may be moved offscreen. The Journal synthetic double-click and official iframe handshake are **still unverified live**, so this is not a claim that background opening is fixed in Floorp.
- New regression fixtures cover input-only HP, invalid/hidden values, capture isolation, fast mode dispatch, catalog retention, unchanged UI, late response suppression, conflicting identities and timer cadence. **CI verified:** PR #38 GitHub Actions run 38307657964 passed **221 tests, zero failures**, `npm run check`, JavaScript syntax and generated-userscript consistency at code head `c170f664b59cecb8603858d551cb4d38da1b9eee`. Live Floorp remains outstanding.

**Live Floorp checklist:** Update Tampermonkey from the production generated script once the PR is merged; confirm Nier's displayed HP changes within roughly 1–2 seconds with the official sheet mounted (allow for browser throttling). Test damage/healing and temp HP, sheet on another tab, disabled auto mode, and Journal closed/visible. Watch whether the auto-open creates a truly new owned dialog; if Roll20 suppresses synthetic events or unmounts HP outside Combat, log that specific limitation without substituting guessed token HP. Continue to collect exact DOM evidence for AC 17/speed 55/slots/saves, not the removed spells Power Word Pain or Blades of Disaster.

**Next milestone:** Retest auto-open and fast health source in actual Floorp/Jumpgate, then target any reproducible Journal DOM failures without private APIs or unwanted sheet visibility; only then advance Foundry-inspired HUD redesign.

**Post-merge checkpoint:** PR #38 merged into `main` as `00bb39c9eb2aa3c2ea2fc71564f23ea454682647`. Final PR head GitHub Actions run 38307749208 passed `npm run check` and generated-userscript diff. Production userscript on main is v3.1.1. Resume with real Floorp/Jumpgate QA; do not call automatic opening or sub-second latency proven without live evidence.

**2026-10-12 user live feedback:** After installing/testing v3.1.1, user reports the updates "look to be updating fine." Treat this as positive qualitative confirmation of observed refreshing, **not** a measured one-second latency test and **not** proof of unattended closed-sheet Journal opening. Next specifically verify whether automatic import still operates with the original sheet closed and following a page reload; if not, capture visible Auto-sync status and address the journal-handshake failure. Do not regress the working HP watch.


## v3.1.2 — Official 2024 popout live-sync regression (October 12, 2026)

**Live user report:** v3.1.1 HP updates in a mounted sheet, but **stop when the player pops the official Roll20 character sheet into its own browser window**. This supersedes the previously positive general HP report for the popout case.

**Confirmed root cause in source:** `r3Candidates()` already knew authenticated official popouts via cross-origin `ready` messages from the child window; however `r3AutoCandidate()` filtered candidates to `type==='iframe'`, excluding every registered popout from both the one-second HP watch and the 30-second current-view refresh. Also, when an official popout sent an early generic name before Vue loaded, subsequent `ready` announcements never updated the registered candidate name.

**Implementation:** Accept official popup readers authenticated by the existing strict-origin, session-scoped `postMessage` bridge; prefer a unique, exact-named live popout over the matching embedded iframe when both remain open. Refuse same-named multiple popouts or explicitly conflicting IDs, never navigate a user-owned popout's tabs or move it offscreen, and prune closed windows so a new popout can reconnect. Refresh already registered candidate names from subsequent official `ready` announcements, with bounded registry and session collision checks. Keep one-second HP-only request cadence, 30-second current-tab and five-minute script-owned background full scan behavior. Retain previous spell/inventory catalog during HP-only updates.

**Automated QA:** Regression tests for real popout candidate selection, opener reader request/response, live HP routing and storage, partial imports, late Vue identity, closure/reconnect, forged origin, same-name ambiguity and stale responses. **CI verified:** PR #39 head `bd015316dcefc2fcf39f4bdaa9fb7b77db7bfcb4`, GitHub Actions run 38310552374 passed **228 tests, zero failures**, `npm run check` and generated userscript consistency. No claim of verified Floorp popout repair until user tests v3.1.2 in their browser.

**Live check after merge:** Update Tampermonkey in Roll20 editor and official popup; keep opener/editor open; pop out Nier and change HP twice. Look for v3 auto status “Popout sheet current import updated” and a current HP change in the R20eb panel, ideally within 1–2 seconds. Test when popup is focused and when Roll20 editor is focused, close/reopen popup, and check that inventory/spells persist. If zero updates, determine whether `ready` appears in sheet selector; if not, verify official popup script injection/opener relationship before changing source-matching assumptions. Browser background throttling may increase latency.

**Next:** Verify official popup runtime, Journal auto-open when the sheet is fully closed, then remaining AC/speed/saves/slots adapters; only then resume Foundry-inspired combat HUD.

**Post-merge checkpoint (2026-10-12):** PR #39 merged into `main` as `4f812a74a74d7b510628d08e78ecbffe89abbfc4`. The final PR-head GitHub Actions run 38310601659 passed with 228 tests, no failures, generated-userscript check green. Production script is v3.1.2. User's popout bug is **implemented/fixed in code, but awaiting user confirmation in live Roll20/Floorp**. Next confirm popup-to-opener handshake and HP updates without closing/reopening the sheet; if still failing, capture the actual popout URL and whether it retains opener before changing cross-window transport.

**2026-10-12 live user validation of v3.1.2:** User explicitly confirms **"popout Hp update works"**. Mark automatic HP refresh through a popped-out official character sheet as **user-verified working** (latency not measured). This supports working popout-to-editor messaging and the bounded HP scan in the user's Roll20 environment. It does **not** verify that every other field refreshes or every sheet tab imports automatically. Player-owned popouts only receive current-tab refreshes (~30-second gate) plus HP-only watch (~1-second best-effort), not automated tab traversal; full-tab import remains manual in this mode. Still pending: live popout Import all tabs, current-tab fields beyond HP, preserving catalog on state changes, automatic Journal opening with no sheet mounted, AC/speed/save/slot mappings, browser throttling/reconnect. Next validate a second changing statistic and manual Import all tabs in the same popout, then tackle the remaining source gaps. No code changes in this documentation-only checkpoint.

**2026-10-12 live full-popout-import verification:** Following the successful official popped-out-sheet HP-sync test, the user confirms that **Import all tabs from the popped-out Nier sheet is successful**. Mark the cross-window full **manual** import workflow as user-verified, in addition to continuous HP sync. Do not overstate this as a complete validation of individual stats/cards, correct AC 17/speed 55/saves/slots, or unattended full-tab updates: `Import all tabs` is manually triggered, and Auto-sync never silently flips tabs in a player-owned popout. No code change or CI run was needed for this live QA checkpoint. **Next:** verify ordinary non-HP changes via the current-tab auto scan; test fully closed sheet and page-reload Journal opening; inspect exact evidence for unmapped attributes; then continue the Foundry-inspired combat HUD.


## v3.1.3 — Non-HP current-view auto refresh (2026-10-12)

**Baseline:** v3.1.2 merged at `4f812a74a74d7b510628d08e78ecbffe89abbfc4`; user verified popout HP watch and manual `Import all tabs` from a popup. **Confirmed code defect:** `r3AutoStoreSnapshot` rejected any auto-scan with no `snapshot.stats`, even when the currently mounted Inventory, Features, Skills or Spells tab returned real structured character data. Thus non-HP auto refresh could remain stale while manual import worked.

**Implementation:** Replace stats-only validation with bounded recognized-data validation across stats, abilities, modifiers, saves, skills, slots and named card categories. Blank/unrecognized results and identity mismatches still cannot overwrite an existing complete snapshot. Current view merges same-key updated entries and non-HP maps into the full profile, preserving off-tab data; the full `all` scan alone can replace an old catalog. Shorten current-view interval gate from 30 to 12 seconds with an eight-second scheduler (normally ~16-second effective cadence). Keep HP-only reads at ~1 second and all-tabs background traversal limited to script-owned windows and five-minute cadence. Never switch tabs in user-owned popouts.

**QA:** Added regression tests for statless Inventory update, changed resources/skills/slots, authoritative full replacement, empty/mismatched snapshot rejection and shorter current-view polling. Corrected a separately exposed shallow-merge defect in spell-slot records: updating remaining slots now preserves maximum slots. **CI verified:** PR #40 head `b935969598c0d9f45dc224ad9006f7e6dc5c079d`, GitHub Actions run 38313102450, **233 tests passed, zero failed**, `npm run check`, regenerated userscript diff clean. Final PR documentation/head CI and merge still pending. **Live non-HP refresh still pending:** change a visible resource slider or item count on the popped-out Nier sheet while Auto-sync is enabled; verify it propagates to R20eb without a manual import within roughly 16–24 seconds (background throttling possible). Old off-tab/deleted item removal and complete unsupervised Journal opening are not claimed fixed.

**Next:** Address any real current-view refresh failures; test fully closed-sheet Journal opening after reload with the Journal sidebar loaded; inspect precise labels for AC 17, speed 55, saves and slots without guessing UUID fields; only then advance Foundry-inspired combat HUD work.

**v3.1.3 post-merge checkpoint (2026-10-12):** PR #40 merged to `main` as `018584ffd46d7ba281c7ecddf9c78827cfbc7524`. Final PR-head GitHub Actions run 38313162355 passed all checks (233 tests, zero failures, clean generated userscript). Source and production bundle are v3.1.3. No live Floorp non-HP automatic-update confirmation yet. Next practical test: with Nier's sheet popped out on Inventory or Features, change a visible named value, leave Auto-sync enabled and do not click Import; verify R20eb changes within ~16–24s. Full Journal auto-opening without any sheet remains unverified.


## v3.1.4 — Event-driven current-view sync (October 12, 2026)

**User observation:** The ~16-second non-HP refresh delay is excessive when the user changes a field locally. This delay was a conservative polling throttle for the heavy current-view DOM scan, **not a required backend/network latency**. The v3.1.3 ~one-second HP watch is distinct and already live-verified on Nier's popout.

**Implementation:** In the official sheet's `v3/10_reader.js`, listen to capture-phase `input`/`change` events and clicks on recognized incrementer/resource buttons only. Debounce input events 350ms inside the official reader and send a tiny `dirty` hint over the established, strict-origin `postMessage` bridge. The editor checks known iframe or registered popout source, popup session and selected character identity, then schedules a current-tab read after ~400ms, with at least two seconds between expensive DOM scans during rapid edits. Never navigate user-owned tabs, and cancel pending event scans when Auto-sync is disabled. Maintain ~16-second current-tab polling for silent programmatic/remote updates and ~one-second HP watch as safety fallbacks.

**QA:** Added tests for event listener registration, debounce and rejected generic clicks, authenticated popup event scans, non-HP value refresh, forged source/session/name/origin rejection, burst throttling and cancellation after disable. **CI verified:** PR #41 GitHub Actions run 38314500857 at `78ab6c945c54affa4a55966f515b340e87a29fdb`, **240 tests passed, zero failed**, `npm run check` green and generated-userscript diff clean. Awaiting PR merge and user-confirmed live latency. This is **not a claim of all fields being updated in <1 second**; own Render/Vue processing, virtualized tabs, some button interactions, background-window throttling, and browser-specific behavior can delay/omit browser events. Test Nier's popout with a resource/quantity change and observe updates without clicking Import.

**Next:** Verify live event delivery in Floorp and characterize cases lacking DOM input/change; only then consider targeted mutation observation if needed. Fully closed-sheet Journal opening and unmapped AC/speed/saves/slots remain outstanding.

**v3.1.4 merged checkpoint (2026-10-12):** PR #41 squash-merged to `main` as `c7f3a9074b53a7ac8f1a1f781fe402633c27a2ee`. Final PR-head GitHub Actions run 38314565901 passed `npm run check` (**240 tests, zero failures**) and regenerated userscript diff. Production bundle v3.1.4. The user has previously verified popout HP and manual full import on v3.1.2; live v3.1.4 event-driven speed needs confirmation. Next Floorp test: update script, pop out Nier, enable Auto-sync and modify a named Inventory or Features field. Expected fast update after reader ~350ms debounce + editor ~400ms debounce, subject to a 2s minimum between current-tab scans and browser throttling. If event not emitted, ~16s fallback applies. Do not claim automatic import without sheet tested.


## v3.1.5 — Live inventory count/toggle visibility (October 12, 2026)

**User bug:** In the actual popped-out sheet, using an inventory item's toggle or reducing its quantity to zero produces no visible change in the R20eb Inventory debug menu, despite v3.1.4 event-driven sync.

**Source-level causes verified:** `r3ReaderScan('current')` passed the generic `Current view` label; the conservative generic 2024 inventory row adapter `r3InventoryRows` only runs for a tab explicitly called Inventory, so auto scans can miss these rows. The inventory card record `r3CardInfo` only included visible text and action buttons; count inputs (especially numeric zero) and toggle state were never recorded. The UI `r3CardsView` likewise couldn't display those values. In addition, the click hint filter ignored some inventory-specific switches or aria-pressed toggles.

**Fix:** Determine the active **visible primary** 2024 sheet tab (rather than nested filters) for current-view scans, maintaining conservative tab-scoped generic item discovery. For each named inventory row, inspect a bounded set of mounted inputs/spinbuttons, checkboxes, switches, and aria-pressed buttons. Store raw typed control observations; record `quantity=0` as a valid value only for explicit quantity/incrementer controls, and do not guess the semantics of an inventory toggle. Show quantity and observed On/Off control states in the Inventory debug view, preserving existing scroll/expanded state and off-tab data. Expand event detection to relevant inventory-toggle controls while ignoring unrelated clicks; keep authenticated popup messages and rate limits unchanged.

**QA:** Added fixtures for current Inventory tab detection with nested selected filters, numeric zero and observed toggles with unchanged row text, toggle event hints and actual Inventory debug re-render during a partial scan. **CI verified:** PR #42 code head `aa967db3282fa7847661b24d6f86cdbc7c4a0332`, GitHub Actions run 38315914209: **244 tests passed, zero failures**, `npm run check` and generated userscript diff both green. **Live browser state remains unverified**; user should test both quantity 2→0 and toggling a saved inventory row in Floorp, watch the specific item details and whether the value changes. If the official control lacks an accessible label/state or disappears on zero, collect a narrow page DOM fixture before adding further selectors. A missing/virtualized row is not automatically counted as deleted.

**v3.1.5 merge checkpoint (2026-10-12):** PR #42 squash-merged into `main` as `ee0a95dbee96fba9b8783863434d1cac621517fc`. Final PR-head GitHub Actions run 38316019860 passed all checks (**244 tests, zero failures**, generated-userscript consistency). Production userscript header is v3.1.5. The user previously confirmed popout HP and manually triggered Import all tabs; **actual Nier inventory zero/use-toggle changes remain unverified live** after this fix. Next test: with popped-out Inventory tab visible and Auto-sync on, change a named item's quantity to 0 and toggle use; expand that item in R20eb Inventory debug and check Observed quantity and On/Off. If neither changes even after a manual current-tab import, gather narrow DOM markup for that specific item (do not guess anonymous controls); if manual works but Auto-sync doesn't, inspect event bridge and timer state. Do not automatically delete absent/virtualized rows.


## v3.1.6 — Zero quantity removes item from R20eb Inventory (October 12, 2026)

**User report following v3.1.5:** Official 2024 sheet inventory on/off toggle is **user-verified working**. Reducing an item quantity to **0** has not removed it from the imported Inventory debug list. The user requests zero quantity to **remove the item from that list**, not just show 0.

**Verified root cause:** The v3.1.5 reader captures an explicit numeric `quantity:0`, but `r3AutoCombine()` unconditionally inserts or updates that entry in the saved Inventory Map, and `r3StartImport()` stores a full/manual snapshot unchanged. `r3CardsView` dutifully renders the entry regardless of zero quantity. Generic off-tab absence must remain non-authoritative, but an actual observed numeric zero can act as a precise deletion observation.

**v3.1.6 implementation:** Add `r3InventoryZero()` to identify **only numeric** `quantity===0` (not `undefined`, not missing card, not arbitrary unlabeled numeric control, and not string `"0"`). Preserve the zero row **inside the cross-origin reader snapshot** for current-tab and all-tab merging, then remove that exact item key when `r3AutoCombine()` applies live updates; retain unrelated and off-tab entries. Normalize manual `Read current tab`, `Import all tabs`, script-owned auto-full scans, and old cached snapshots through `r3InventoryPrune()`. Add a defensive Inventory debug renderer filter. On a later explicit positive observation, the item can re-enter the list. Fix full-tab `r3Merge()` to honor a later zero observation rather than discarding it as a duplicate. Update UI count and JSON export by recomputing coverage after pruning. Never modify Roll20's underlying character sheet.

**QA:** Added fixture regressions for numeric 0, positive reappearance, preserving unrelated/off-tab inventory, full/manual imports, persistence, old local snapshots and same-key full-tab precedence. **CI verified:** PR #43 head `635343534e703f92b0c2af5803ebb6a6a9e9c888`, GitHub Actions run 38316660508: **251 tests passed, zero failed**, `npm run check` and generated userscript diff green. **Live Floorp verification pending for zero-removal**; toggle is already user-verified. Do not infer deletion when a row disappears due to filtering, collapsed groups or virtualization.

**Next:** Confirm Nier's zero-count entry vanishes from Inventory while other entries remain, and appears again if count becomes positive. Then return to closed-sheet Journal automation, non-HP event behavior on other tabs and evidence-backed AC/speed/save/slot fields.

**v3.1.6 merged checkpoint (2026-10-12):** PR #43 squash-merged to `main` as `c2d16758ce255db5d834c22c808f2ee9f29d121b`. Final PR-head GitHub Actions run 38316709781 passed `npm run check` (**251 tests, zero failures**) and generated-userscript consistency. Production userscript v3.1.6. Live user confirmation still required that Nier's quantity-zero item disappears from the Inventory debug list and reappears if the quantity becomes positive. The user's toggle on/off test was already confirmed working in v3.1.5. This userscript does not delete any items from the official character sheet.


## v3.1.7 — Screenshot-confirmed unlabeled Inventory stepper gap (October 12, 2026)

**Live user evidence:** Screenshot `image(20261012-223208).png` shows **Crowbar with a visible - 0 + quantity stepper in the official D&D 2024 Inventory**, while the right-hand R20eb Inventory debug list still includes Crowbar and only reports `headlessui-switch-100 On`. The toggle works as the user confirmed, so popup bridging and toggle updates are functional. There is no captured `quantity` field displayed. v3.1.6 zero-removal code cannot act without `quantity:0`, and previous fixtures assumed a strongly labeled `utility-incrementer__input`.

**Implementation:** Prefer the complete structural item row rather than a nested `.item-row__...` name element when collecting generic 2024 inventory entries. Add a bounded local DOM signature for an unlabeled numeric input accompanied by **both** visible minus and plus buttons in its own single-input control cluster; reject ambiguous clusters with multiple inputs and resource/charge tracker contexts. This is directly grounded in the screenshot's UI, without mapping random UUIDs or treating any anonymous numeric input as quantity. Mark the quantity as observed, so existing `r3InventoryZero` removes a zero-count item from the imported snapshot while preserving other/off-tab records. Recognize unlabeled ± button clicks as dirty hints in Inventory so rapid changes trigger auto-sync. Make the debug menu display a "Quantity not detected" diagnostic when an item has a captured toggle but an unidentified quantity.

**QA:** New screenshot-like synthetic DOM regression recreates Crowbar's unlabeled `minus / 0 / plus` counter and `headlessui-switch-100` state, verifies capture, current-tab incremental deletion, later positive reappearance, control-group ambiguity, missing plus button, and dirty click notification. UI test checks unresolved quantity displays a diagnostic. **CI verified:** PR #44 head `7819aaba952023d26c00e2941b14d4b0efc91664`, GitHub Actions run 38317619492, **257 tests passed, zero failures**, clean `npm run check` and generated userscript diff. Final doc-only CI and merge pending. **Live browser confirmation is still required**: update Tampermonkey, reload editor and popped-out sheet, then take Crowbar to 0 and check it disappears. If not, the next step is to inspect just the quantity input's real HTML and its nearest ± controls. Do not assert source row removal or underlying Roll20 item deletion.

**v3.1.7 post-merge checkpoint (2026-10-12):** PR #44 squash-merged to `main` as `614fa130b404df9eb3c85a1fe9f81f10d8995e32`. Final PR-head GitHub Actions run 38317669511 passed all checks: **257 tests, zero failures, clean generated userscript**. Script metadata is v3.1.7. User live screenshot shows Crowbar at 0 on the official sheet while R20eb still displayed it in v3.1.6; v3.1.7 fixes control capture using a bounded anonymous minus/input/plus signature and correct full item row selection, but **live v3.1.7 behavior is not yet verified**. Re-test Crowbar 0 then 1; if it remains at 0, inspect actual quantity input DOM and parent wrapper instead of guessing selectors. Item Use switch is already user-verified on v3.1.5. Rolling handover and roadmap are current.


## v3.2.0 — Default player combat HUD foundation (October 12, 2026)

**Live verification received:** User explicitly confirmed **"it works"** for v3.1.7 Crowbar zero count. Treat popped-out official-sheet HP auto-sync, manual Import all tabs, Inventory toggle and observed zero-quantity removal as user-verified. User chose **"ditch the importer UI and move on to implementing the actual HUD"**, then replied `1` to authorize implementing HUD v1 plus a debug-only importer.

**Architecture:** Preserve `v3/00_capture.js` DOM-derived observations, `v3/10_reader.js` authenticated sheet bridge, `v3/25_auto.js` current/HP scan and profile persistence. Add dedicated `v3/22_hud.js`, ordered between `v3/20_ui.js` and `v3/25_auto.js`, and update `scripts/build.mjs` to six modules. The UI shell remains one shadow DOM host but contains two independent surfaces: bottom-centered always-visible HUD and the old detailed importer panel, now **hidden by default** and exposed via HUD **Debug**. Do not remove diagnostics, per-character JSON export, manual Import all tabs, or the old UI's scroll-state preservation.

**HUD v1 behavior:** Responsive dark-gold RPG shell with identity initial, current/max HP proportional bar, AC, speed, initiative, passive perception, named observed spell slots/resources and categorized action cards: Actions (imported attack entries), Bonus, Reactions (only explicitly labeled casting-time/action-type entries), Spells, Inventory (zero-count items excluded), Features and Resources. Missing stats render as `—`; no fabricated movement, spell-slot totals, spells or character values. Cards expand to show observed descriptions, range, casting time, count and raw resource/check states. **Cards are explicitly read-only**: no native Roll20 roll/cast is triggered by expansion, no local use decrements, no invented resources. The HUD Sync button invokes existing `r3ToggleAuto()`; Debug exposes legacy importer; Minimize and selected category persist per game. Keep original input keyboard suppression inside panel.

**QA:** Added HUD-specific tests for initial hidden-debug shell, reliable event delegation from category icon, accurate stats/slots/resources and unknown-value placeholders, read-only categorized cards, zero-count exclusion, preserved snapshots during HUD minimize/debug, saved HUD state, and live HP changes repainted via existing health sync. Existing v3 importer tests are preserved. Await CI results and PR merge. **Next:** ask user to verify HUD rendering/action tabs and positioning on Floorp, then progressively implement verified native action bridge without changing imported character data, and continue AC/speed/save/slot diagnostics.
