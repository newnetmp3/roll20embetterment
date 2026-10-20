# R20 Embetterment — v3 clean restart roadmap

Updated: October 14, 2026 (v3.3.4 currentPlayer selected-token identity correction merged). v2.3.13 continued to fail real Floorp/Roll20 imports despite green DOM mocks. The production script is being **replaced**, not patched.

| Priority | Milestone | Status | Required verification |
| --- | --- | --- | --- |
| 1 | Replace production bundle with independent v3 engine | Implemented | Run 38182938287 green; 189 total tests, 10 for v3; v2 runtime excluded |
| 2 | Labeled HP/stats/abilities/saves/skills/slots | CI verified; live QA pending | Official 2024 iframe in Floorp |
| 3 | Spells, attacks, inventory, features and resources | Implemented; live QA pending | Live populated character sheet tabs |
| 4 | Bounded tab traversal, origin verification, diagnostics and JSON export | **Manual all-tabs popout import user-verified**; field accuracy/diagnostics still require QA | Examine export for missing fields |
| 5 | Improve unmapped fields from exported observations | Planned | No guessed selectors |
| 6 | Verify virtualized tabs and official sheet popouts | **Popout HP sync and manual all-tabs import user-verified**; virtualization/reconnect still open | Check specific missing rendered/virtualized records and window reopen |
| 7 | Rebuild player combat HUD atop confirmed importer data | **HUD v1 merged, CI green; live browser QA pending** | Default combat shell, observed stat strip, category cards, debug-only importer |
| 8 | Add independent 2014 sheet adapter | Planned | Real 2014 fixtures |
| 9 | Release/installation automation | Planned | Repeatable CI and browser install |

**v3.0.1 fix:** The sheet was detected, but all buttons failed because the UI refreshed a nonexistent `r3-title` element. Now references `r3-toggle`, reports unexpected control exceptions and covers actual scan button interaction with a mocked frame. 194 tests pass. Browser verification still required.

**v3.0.2 fix:** Removed accidental skill-object processing as a card array, which caused a live TypeError during import. Added regression coverage for populated skill rows alongside HP and spell data. The uploaded HTML confirms the original editor iframe, not its cross-origin sheet DOM; live browser verification remains pending.

**v3.0.3 work:** Inventory and resource zeros reported in Floorp. Added Inventory-tab-scoped named item-row reading and nested feature/item resource tracker support. Main tabs now have priority and fresh Vue references during all-tabs traversal. Added three regression fixtures and visible diagnostics for skipped vs empty Inventory tabs. Still need a live inside-iframe DOM sample to verify selectors and detect virtualization.

**Next:** Install v3.0.3 with the previous version disabled. Open the original 2024 sheet, import all tabs, verify HP 82/84, STR 18, AC 17, speed 55, initiative +2.14 and spell inventory; export JSON for any missed fields. Do not call the importer correct based solely on CI.

Rolling rule: update this roadmap and docs/HANDOVER.md with each development milestone.

**Planned UI phase (after trustworthy importer):** Use the user-supplied Foundry VTT module as the visual and interaction framework for the Roll20 companion. Port layout/components conceptually to a Roll20-native userscript; do not depend on Foundry runtime APIs, and review asset/code licensing before reuse. Await module file or URL and user sign-off on importer accuracy.
 
**v3.0.4 UI stability:** Focus and Refresh list no longer rebuild unchanged results; preserve individual category scroll and expanded cards across category changes and reimports. Regression tests added; pending live Floorp confirmation.

**v3.0.5 actual Nier export:** Import verified from user JSON for 37 inventory, 34 features, 22 attacks, 18 skills, 5 spells, 82/84 HP and six scores. The previous zero-resources report is explained by named range controls being absent from resource-wrapper selectors; v3.0.5 reads named sliders as observations (not presumed remaining uses), temp HP, and coin counts. Spell fields no longer parse prose as metadata. **Next:** request narrowly scoped accessible parent markup for two unlabeled numeric controls (17 and 55) to establish AC/speed, plus actual official saving throw/modifier controls. Do not infer UUID identity from values; continue validating slots and whether spells are virtualized. Then proceed with user-selected Foundry module UI.

**v3.0.6 review:** The second live export confirms v3.0.5 resources/tempHP/currency. Fix known `11 Action` spell parsing and preserve compact official V/S/M, ritual R and concentration C header markers. Add bounded context of anonymous numeric controls and support explicit `aria-labelledby` without guessing UUID meanings. Re-import in Floorp to verify diagnostic hints for AC and speed. Saving throws, modifiers and slots remain unknown, so no invented values. UI redesign deferred until trustworthy importer.

**v3.1.0 automatic importer:** User-requested opt-in per-game Auto-sync with background journal open when a matching character entry exists, official iframe origin/identity checks, full scan in script-opened offscreen dialog and current-view refresh without disrupting player-visible tabs. Report unsupported journal UI instead of silently scanning another actor. Next manual Floorp QA of journal discovery and whether Roll20 supports synthetic double-click for managed character dialogs. Remain careful not to confuse this with proven fully unattended background support. Saving throws/modifiers/slots remain unverified. User's removed spells Power Word Pain and Blade of Disaster should not be flagged as missing.

**Automated QA:** v3.1.0 branch CI: 214 tests passed, 0 failed (run 38305794819). End-to-end live journal auto-open remains unverified; avoid calling automatic background access guaranteed until tested on the actual Roll20/Floorp session.


**v3.1.1 — Fast health and auto-open correctness:** Implemented targeted cross-origin, read-only `hp` request once per second with input validation, 2.5s timeout, bounded capture and value-change-only storage. This does not accelerate the 30-second current-tab or 5-minute full-tab traversals. Honor pinned character IDs, reject conflicting/ambiguous same-name candidates, retain player-owned dialog positions, and ignore stale health responses on disable. Regression tests and CI passed: PR #38 GitHub Actions run 38307657964, **221/221 tests passed**, generated bundle clean. **Live Floorp QA** remains required. Browser throttling or unmounted HP controls prevent a guaranteed one-second update; do not silently fall back to token guesses.

**Next:** Validate synthetic Roll20 Journal double-click and loaded iframe in Floorp, compare live HP changing under damage/healing, verify AC 17/speed 55 only from labeled controls, then resume the Foundry-inspired combat HUD once imports are reliable.

**v3.1.1 merge checkpoint:** PR #38 was merged into main as `00bb39c9eb2aa3c2ea2fc71564f23ea454682647`. Final PR-head CI run 38307749208 passed all checks (221 tests at the code verification head). Feature implemented; live Floorp/Jumpgate background opening and roughly one-second real HP response remain unverified. Continue with browser evidence instead of assuming synthetic Journal events work.

**Live feedback received (2026-10-12):** User reports the updates appear to work correctly. Mark HP refresh as **user-reported working, latency unmeasured**. Keep fully unattended automatic import with a closed sheet and Journal unopened as **unverified** until explicitly tested. Next check restart/reload without manually opening Nier's sheet; preserve the fast health path.


**v3.1.2 — Popped-out official Roll20 sheet:** User-reported v3.1.1 regression: HP refreshing stops when the official 2024 sheet is opened in a separate window. Code inspection proves the auto reader filters out all `type=popout` candidates even though the existing authenticated bridge registers them. Implement popout preference for unique exact name (without weakening character-ID conflict checks), registration refresh after late Vue mount, closed-window cleanup, and unchanged one-second HP/30-second current-tab scan cadences. Preserve scroll and full-catalog data, and do not change player-owned popup tabs. Regression CI verified: PR #39 GitHub Actions run 38310552374, **228 tests passed**, zero failures and clean generated bundle. **Live Floorp/Jumpgate validation is still required**. The link requires a functioning popup-to-editor `window.opener` and userscript access on the official advanced-sheets host.

**v3.1.2 merged:** PR #39 squash-merged to `main` as `4f812a74a74d7b510628d08e78ecbffe89abbfc4`. Final GitHub Actions run 38310601659 green (228 automated tests, generated bundle consistent). Await live Floorp popout confirmation. Do not consider fully unattended background Journal opening verified; no runtime proof yet.

**v3.1.2 user-verified popout HP (2026-10-12):** User confirms HP now updates when the official character sheet is popped out. Update popout HP item to **user verified**; interval unmeasured. Do not propagate this status to other fields or full popout imports. Current-tab auto scanning remains read-only and about every 30 seconds; HP-only watch is about every second. A player-owned popout is never automatically navigated through all tabs. Remaining browser QA: explicit Import all tabs from popout, changed non-HP field propagation, popup reconnect and closed-sheet Journal unattended open. AC/speed/saves/slots still need evidence-backed mappings. Documentation-only update, no new CI claim.

**v3.1.2 successful manual popout import (2026-10-12):** User confirms `Import all tabs` is successful from Nier's official popped-out 2024 character sheet. Together with prior user confirmation that popout HP watches work, this completes the **live functional check of the popout bridge and user-triggered multi-tab import**. Individual field completeness remains unverified; don't equate import success with verified AC/speed/saves/slots. Automated refresh of a user-owned popout still scans only its current view (~30-second gate), and does not automatically navigate tabs; HP gets separate ~1-second best-effort reads. Next: test non-HP live changes, unattended Journal opening/reload, and missing labeled fields before the combat HUD rebuild. Documentation-only checkpoint; no new code or CI claim.


**v3.1.3 — non-HP automatic current-view refresh:** Fix the confirmed source-level blocker in `r3AutoStoreSnapshot` that incorrectly requires a stat/HP on every automatic current-tab scan. Accept correctly identified recognized non-HP data from Inventory, Features, Resources, Skills, Spells and slot controls while rejecting unrecognized/blank snapshots and wrong character names. Preserve other tabs' data and original player-owned popup tabs. Reduce current-view scan gate from 30s to 12s on an 8s scheduler (~16s practical cadence), without changing the separate HP-only 1s polling or script-owned all-tabs scan. Regression tests added; **CI verified** in PR #40 run 38313102450 (**233 tests, zero failures**, generated bundle clean); corrected shallow spell-slot merge so current/maximum properties are both preserved. Live Floorp/Jumpgate non-HP refresh verification still required. **Outstanding:** non-HP live confirmation, deleted/off-tab and virtualized rows, closed-sheet Journal auto-open, source-backed AC/speed/save/slot mapping, future HUD redesign.

**v3.1.3 post-merge checkpoint:** PR #40 squash-merged to `main` as `018584ffd46d7ba281c7ecddf9c78827cfbc7524`; final GitHub Actions run 38313162355 successful (**233 tests**, bundle diff clean). Next development: safe fully closed-sheet Journal recovery with browser QA; follow with source-backed AC/speed/saves/slots. Live non-HP auto-refresh has not been independently verified in Floorp; do not equate CI with live confirmation.


**v3.1.4 — Event-driven faster synchronization:** User correctly identified that the ~16-second non-HP current-tab delay is an artificial, conservative scan throttle rather than a local data latency requirement. Use capture-phase `input`/`change` and recognized incrementer events in the official 2024 iframe or popout to send a 350ms-debounced authenticated `dirty` signal to the Roll20 editor. After source/name/session validation, automatically re-read the current visible tab after ~400ms, rate-limited to >=2s between heavier reads. Keep the ~16s periodic scan for silent updates and separate ~1s HP watcher. Preserve full profile catalog, ignore forged/ambiguous messages, cancel queued scans on disable and never change player-owned sheet tabs. **Automated CI verified:** PR #41 run 38314500857, **240 tests passed, zero failures**, generated bundle diff clean. Real Floorp popup verification still required before calling latency improved in practice. **Pending:** unattended closed-sheet Journal recovery and precise AC/speed/saves/slot mappings.

**v3.1.4 merge checkpoint:** PR #41 merged as `c7f3a9074b53a7ac8f1a1f781fe402633c27a2ee`; final GitHub Actions run 38314565901 passed (240 tests, generated userscript clean). Next: live Floorp event-driven latency verification and identify controls whose changes do not emit browser input/change; preserve the polling fallback until these are characterized. Unattended closed-sheet Journal open and source-grounded character field mappings remain outstanding.


**v3.1.5 — Inventory toggles and zero quantity:** User confirms v3.1.4 live popup Inventory debug does not reflect toggling an inventory item or decrementing to zero. Verified current-view label did not resolve Inventory (skipping generic item rows) and inventory cards did not capture numerical quantity or raw toggle state. Fix active primary tab detection, item-scoped raw quantity/checkbox/switch/aria-pressed observations, relevant toggle event signals, and explicit debug UI rendering. Tests include quantity=0, toggle on→off, unchanged card text and partial snapshot refresh. Never assume checkbox/toggle semantics or delete virtualized/hidden item from absence. **CI verified:** PR #42 run 38315914209, **244 tests passed, zero failures** and generated userscript diff green. Live Floorp verification is still pending. Preserve v3.1.4 HP and popup behavior. Closed-sheet automatic Journal opening and incomplete official field mappings remain future milestones.

**v3.1.5 merge checkpoint:** PR #42 merged to `main` as `ee0a95dbee96fba9b8783863434d1cac621517fc`; final run 38316019860 passed **244 tests** and clean generated-bundle consistency. Live Floorp Inventory item quantity/toggle verification is next. Mark precise zero/Use toggle support as **implemented/CI-verified**, not user-verified. Preserve source-observation safety and remaining closed-sheet and field-mapping roadmap.


**v3.1.6 — Inventory quantity zero removes imported entry:** Live user report validates 2024 popout inventory toggle On/Off works in v3.1.5, but zero-count item still appears. Implement numeric, directly observed `quantity===0` as an exact-key removal from the R20eb Inventory list during event-driven current-tab merges, full automated imports, manual current/all-tab imports, and cache loads. Keep zero as a source-side observation until the editor processes it. Never delete Roll20 source records; never remove an item merely because it is absent in an off-tab, filtered or virtualized scan. Preserve all other items and spell/HP information. Regression tests for deletion, re-addition, unaffected items, persistence, coverage, full-tab precedence and debug rendering. **CI verified:** PR #43 run 38316660508 (**251 tests, zero failures**, bundle consistency clean). User live QA remains required before considering zero-removal verified. Unattended Journal and remaining field mapping remain planned.

**v3.1.6 merged:** PR #43 into `main`, commit `c2d16758ce255db5d834c22c808f2ee9f29d121b`; final PR-head GitHub Actions run 38316709781 green, **251 tests passed**, generated bundle consistent. Pending live Floorp check of zero count deletion from imported UI; a Roll20 control that unmounts its row before capture may require additional evidence-driven event handling. No Roll20 source items are deleted or modified.


**v3.1.7 — Unlabeled Inventory quantity stepper from user screenshot:** User confirms Inventory On/Off works, but screenshot proves Crowbar shows numeric **0** in official sheet while R20eb still shows Crowbar with only `headlessui-switch-100 On`; v3.1.6's deletion logic needs a real `quantity:0` that was absent from the captured item. Fix selecting the full item row, recognize a unique anonymous numeric input bounded by visible +/- controls, emit dirty notifications for unlabeled +/- buttons, and report unrecognized quantity in Inventory debug when switch is captured but count is not. Do not guess random UUID fields, resource counters or row absence as item quantity/deletion. **CI verified:** PR #44 run 38317619492 (**257 tests passed, zero failures**, generated bundle consistent). Live actual Floorp evidence still pending. Next, once verified, resume closed-sheet Journal import and missing character field mappings.

**v3.1.7 merge checkpoint:** PR #44 merged to `main` as `614fa130b404df9eb3c85a1fe9f81f10d8995e32`; final head CI run 38317669511 passed **257 tests** with a clean generated userscript. Re-test Crowbar at 0 on the official popped-out sheet: it should be excluded from the imported Inventory list; an observed positive count should add it back. Live Floorp proof still required. If non-working, request DOM markup scoped to that item's count control and enclosing stepper.


**v3.2.0 — HUD v1 foundation (user authorized by replying "1"):** User verified that v3.1.7 Crowbar quantity-zero removal now **works** and requested dropping the importer-centric UI in favor of the actual combat HUD. Keep v3 reader, authentication, popout, persistence and auto-sync engine untouched. Add dedicated `v3/22_hud.js` renderer between importer UI and auto-sync; make a bottom-center, responsive CRPG-styled combat HUD the primary UI, showing confirmed HP/max HP, AC, speed, initiative, passive perception, observed spell slots/resources, action categories and expandable cards from captured character data. Show unknown stats as em-dashes. Classify Bonus/Reaction spell cards **only** with source-observed casting times; don't infer class features or fabricate actions. Provide HUD Sync and Debug controls, collapsed mode and per-game preferences. Hide, do not delete, the existing importer/JSON Diagnostics UI behind Debug. Cards are read-only placeholders for later verified Roll20 action dispatch; no unauthorized casting, expenditure or synthetic rolls. Add HUD UI tests and include the module in the six-module v3 build. **CI verified:** PR #45 run 38319116848, **265 tests passed with zero failures**, generated userscript matches source. Merge and real Floorp UI validation still pending. **Next milestones:** live Floorp HUD UX QA, action attribution/typed action metadata, verified Roll20 native roll/cast bridge, HUD economy/resource display, then Foundry-inspired refinement. Current importer limits (fully closed-sheet Journal auto-open; uncertain AC/speed/save/slots on some sheets) remain tracked.

**v3.2.0 merged:** PR #45 squash merge `6c78f826b5eaaf1afafd9ea2f34a79fac9a63bfa`; final Actions run 38319190135 **265 tests passed**, generated bundle consistent. Start real Floorp HUD QA, then implement safe native Roll20 action dispatch/rolls, action economy and richer categorization from observed sheet data. Debug importer preserved for diagnostics; data pipeline remains intact.


**v3.2.1 — Correct HUD design/data after live screenshot:** User showed v3.2.0 generic grid instead of requested Foundry/Argon interface and missing AC/speed/passive. Reviewed provided `enhancedcombathud-t2k4e-3.0.0.zip`: a Twilight 2000 Argon CORE **adapter**, organized around portrait panel, segmented action groups, item buttons/drawers (not a standalone design asset bundle). Redesign into portrait dock + small action icon groups for action/bonus/reaction, quick side stat readouts, popup category drawers. Keep debug importer and reader intact. Recover source-observed AC=17 and speed=55 for Nier from precise per-input nearby labels `ARMOR CLASS` and `SPEED (ft)` in previously exported JSON, not from UUID guesses. Passive authoritative value is absent; UI may display **PASSIVE BASE** `10 + observed Perception (5) = 15` with explicit non-authoritative qualification. Tests for field mapping with conflicts, old data load, drawer and responsive DOM. Next: real Floorp UI validation, then verified native Roll20 action dispatch; no unverified roll/cast semantics. **CI verified:** PR #46 run 38320187465, **271 tests passed, zero failures**, generated bundle clean. Live Floorp confirmation pending.

**v3.2.1 merged:** PR #46, commit `6d7cc77310602ecc4e389ea8ade85aface761ed6`, final CI 38320244100 green (**271 tests** plus generated bundle check). HUD redraw uses compact portrait dock, small observed stat blocks and Action/Bonus/Reaction icon groups, with detailed category cards in an optional drawer. AC 17 and Speed 55 are source-grounded through explicit nearby captions already in Nier observations. The displayed Passive Base of 15 is *calculated*, not a confirmed Roll20 passive score. Live Floorp HUD screenshot/QA is next; avoid calling the underlying Argon Core styling fully replicated from the system adapter alone.


## Argon Core faithful-port roadmap (official wiki reference; added in v3.2.2)

Reference: `https://wiki.theripper93.com/free/enhancedcombathud`. Main source `theripper93/enhancedcombathud` (GPL-3.0) and first-party D&D 5e implementation `theripper93/enhancedcombathud-dnd5e` (MIT). User expects faithful *layout AND behavior*, not generic styling. Implement independently in R20eb with license-safe original assets and retained authenticated official-sheet backend.

| Original Argon capability | R20eb state | Next work |
| --- | --- | --- |
| Full horizontal bottom HUD, portrait, grouped main/bonus/free/reaction/pass | v3.2.2 implemented; needs live Floorp visual QA | Measure live sizing/spacing against wiki screenshots |
| Three pairs of portrait-top weapon set slots | v3.2.2 HUD-native click-to-assign, per-game persistence | Real Roll20 token/sheet drag/drop and equipment semantics |
| Spells panel expanding upward, grouped by cantrip/level and slots | v3.2.2 local read-only tier flyout from observed fields | Prepared spell visibility and native casting |
| Skills, saves, tools flyout | v3.2.2 skills/saves/ability checks from actual import | Tool data mapping and native rolls |
| Action tracking | v3.2.2 local manual used marks and manual reset | Tie to confirmed Roll20 action/turn events |
| Shift+A HUD toggle | v3.2.2 keyboard control guarded for text fields | User-configurable keybind/keyboard QA |
| Special actions, macro slot, item tooltips and actor config | Partial read-only labels, imported card details | Native dispatch, controls, macros/config UI |
| Target picker with required/selected target count | Not implemented | Detect Roll20 native target selection without fake automation |
| Movement tracker / dash color states | Not implemented | Source actual speed and measured token movement |
| End Turn / pass action | Deliberately disabled pending verified Roll20 combat API | Integrate only after confirmed live behavior |
| True portrait/token selection and screen size responsiveness | Name monogram placeholder and responsive CSS only | Token/portrait integration, mobile sizing and sidebar state |

**v3.2.2 CI and merge:** PR #47 squash-merged as `e5c3dcf58ee745d4095391bad2721c84be6368cb`. Final run 38321249957 green (**277 tests, zero failures**, generated bundle consistent). Live Floorp verification and native combat action automation remain pending. Do not mark a function truly verified until both automated CI and live Floorp QA demonstrate it. Keep v3.2.1 source-grounded AC 17/speed 55 and 2024 popout importer behavior.

**v3.2.2 implementation checkpoint:** `main` includes original-wiki reference visual structure: left character panel with 3×2 quick weapon slots, horizontal Main Action/Bonus/Free/Reaction/Pass bar, upward spell-level and item/skill flyouts, HUD-native per-game weapon assignments, Shift+A toggle and local-only spent indicators. Still no native D&D 2024 rolls/casts, GM turn control, target picker or movement tracking. This is a **structural-faithfulness milestone**, not total Argon functional parity.


**v3.2.3 — Screenshot-confirmed HUD layout and visible Journal image (2026-10-12):** User supplied first Floorp screen of v3.2.2. **Confirmed live:** bottom horizontal segmented action bar, weapon-set selectors, Nier HP 82/84, AC 17, Speed 55ft and resources rendering. **Visible defects:** portrait dock compressed with HP/stat wrap; utility/action labels small; resource bar cramped. Implement larger stable portrait width, row height and bottom gutter, readable single-line HP, full 2×2 stat grid, readable actions and horizontally scrollable resource chips. Add exact-name **already displayed** Roll20 Journal portrait reuse with no API/remote searches, URL validation and safe fallback. Source data/authoritative action semantics unchanged. **CI verified:** PR #48 run 38322073424 (**280 tests, zero failures**, bundle consistent). Re-test in Floorp before treating improved sizing/portrait as verified. Remaining: real Roll20 token/avatar connection, native rolls/casts, prepared spell state, targeting, movement tracking and end-turn.

**v3.2.3 merged:** PR #48 at `b37b33c57c74adb390616a705ed4dbf59211d4b9`. Final CI run 38322126103 passed (**280 tests, 0 failures**, generated bundle consistent). Portfolio: portrait/HP/stat sizing improved based on user Floorp screenshot, original horizontal Argon layout preserved, exact-named already-rendered Journal thumbnails now conditionally reused with HTTPS safety. Real Floorp layout/portrait is pending user validation. Next continue native Roll20 action dispatch feasibility and source-grounded combat HUD parity.


**v3.2.4 — Live screenshot #2:** Real Floorp view on Chat tab shows HP82/84, AC17, Speed55, Initiative2.14 and Passive Base15 correctly; the portrait's lower stats remain partially clipped, despite v3.2.3 improved formatting, due to inherited hard max-height 229px on its containing bar. Remove maximum cap and allow content-driven min 242px with 2×2 grid stat rows minimum 21px. The real character image remains unavailable when Journal is hidden. Once an exact-name HTTPS thumbnail is observed on the visible Journal row, persist its name/URL in per-game HUD preferences so switching to Chat retains it without navigation, private API calls or substring guesses. Keep initial monogram when character art is unobserved. **CI verified:** PR #49 run 38323806848 (**284 tests passed, zero failures**, production userscript consistent). Live Floorp validation still required. Remaining high priorities: genuine attack/spell native controls, target selector, turn state and safe token linkage.

**v3.2.4 merged:** PR #49 squash `b47ec4c13470d751e81dd057fe6f9a7658d59ac9`; final CI 38323846235 passed (**284 tests, zero failures**, generated userscript consistent). The second Floorp screenshot confirmed structured HP/AC/Speed/Initiative/Passive but showed bottom portrait stats clipped by the fixed max-height; removed the cap with content-sized layout. Journal portrait observed once can persist while switching to Chat and across reloads, but no unseen image can be inferred and the monogram is the fallback. Live QA next; keep native roll/cast and token behavior as the next major functional milestone.


## Character-agnostic support guarantee (v3.3.0 onward)

**Explicit user requirement:** All installers must be able to use R20eb with **their own** official 2024 character; Nier is only one development/debug fixture and cannot become a special-cased source name, character ID, HP/AC/speed value, specific attack, default inventory or requirement. Use identities and controls observed dynamically from each current imported official sheet. Tests must cover at least three unrelated character names, different attacks, unchanged character IDs and safe switching between sheets. Lock write-like requests to the authentic connected window and exact character, never auto-route one player's actions to another's sheet. Avoid carrying old Auto-sync character ID into a newly imported character.

**v3.2.4 live verified (2026-10-13):** User confirmed both stat rows display without clipping and an observed Nier Journal portrait remains visible when switching to Chat. These UX fixes may be marked user-verified; they do not imply any character-specific requirement.

**v3.3.0 optional experimental native attack pilot:** Two-stage `native-probe` then explicit `native-invoke` through authenticated official sheet bridge. Compare **characterName** with sheet owner and **attackName** with unique visible Combat attack row separately; require an explicitly labeled Roll Attack control, then user confirmation and a single-use 15s token before one click. No arbitrary macros, no guessed dice, no implicit resource spend and no false success claims. Abort for no sheet, wrong identity, several matching rows/buttons, missing labeling, other tab, token replay or changed character. **CI verified:** PR #50 run 38467635644 passed **295 tests with zero failures** and a clean generated bundle, including generic players/attack names and cross-character action blocking. Native attack control selector is necessarily narrow until real Floorp live DOM proves a broader label safe. Spellcasting, targeting and action/turn tracking remain planned, not implemented.

**v3.3.0 merged:** PR #50 (`521f442cceaf86e265f250b0ec4dbf04829b0f71`) to `main`, final Actions run 38467803354 green, **295 tests passed** and generated bundle consistent. Strict generic-player support and character/attack identity guards landed. This is an optional live test of a **one-click native attack only after explicit second confirmation**; actual official 2024 Roll Attack controls and chat outcome still need Floorp validation. Unsupported labels fail closed rather than assume a specific PC or sheet markup. Add future work: isolate HUD quick-slot assignments per-character within one game as well as per game; dynamic imported snapshots and source-matched action routing are already general.

## v3.3.1 — Token-selected multi-character HUD and native attack probe recovery

- Token focus: Follow the last newly selected map token whose represented character grants this player control. Ignore unlinked/inaccessible tokens; keep last valid HUD on deselection.
- Per-character state: Portrait image, HP/stats, attacks/spells/items and six loadout slots follow represented character ID; save per-character snapshots and HUD options within one game. Unknown characters show a named empty state, not the previous PC's HP. Legacy name-only import migrates only when unambiguous.
- Auto-sync: Invalidate old pending scans when changing selected characters, and use the selected sheet ID/name; never send pending native roll confirmation to another PC.
- Attack probe: User reports that v3.3.0 finds no corresponding attack. Read the same generic 2024 attack-title rows as the importer, and only accept explicitly marked attack-roll controls; give clear diagnostic labels and row counts when blocked. Current live Roll20 attack markup is not yet verified. Keep two-stage confirm and fail-closed behavior.
- QA: Multiple distinct PCs, same-name ambiguity, unauthorized token selection, snapshot/loadout isolation, source-matched attack controls, readable failure diagnostics. **CI verified:** PR #51 run 38479316434 passed **304 tests with zero failures** and consistent generated userscript. Live Floorp validation required.

**v3.3.1 merged:** PR #51 (`ad8cd6e7ff260a349c0dcb0f6584857bcca3849f`) with final CI run 38479476464 green (304 tests, zero failures; generated bundle clean). User-facing milestone: most recent player-controllable token follows its character's saved HUD/portrait/loadouts, separate identity-keyed caches, and expanded native attack matching with diagnostic reasons. Live Roll20/Firefox verification is essential, especially whether in-page token selection models are exposed and whether current 2024 attack buttons have explicit actionable semantics. Native roll/cast success remains unverified; do not broaden to arbitrary clickable text without source evidence.


**v3.3.2 — Native attack source identity correction from two live user screenshots:** Current 2024 official sheet contains `+7 Attack` (to-hit) and `1d6+4` (damage) in the uniquely named Handaxe row. Former matcher incorrectly required the words `Roll Attack`. Current HUD import also contains two attack entries named Dagger, so name-only probe rejected both as ambiguous before contacting the native sheet. Implement per-card exact `_key` selection and carry character/attack/source details through the authenticated probe and single-use confirmation, matching same-name native rows only when explicit numeric hit/damage metrics distinguish them. Recognize signed numeric to-hit buttons and NEVER the damage dice or a generic `Attack` button. Ambiguous identical rows, changed source numbers or multiple hit controls remain blocked. Tests include multiple unrelated player characters and duplicate attack names. **CI verified:** PR #52 run 38486142000 passed **312 tests, zero failures** with generated script consistent. A real Roll20 chat-confirmed hit roll remains pending.

**v3.3.2 merged:** PR #52 `9436c76e021fdda660099b21dda9a7dc1fb500b6`, final Actions run 38486218400 passed (**312 tests, zero failures; generated userscript consistent**). Correct duplicate-name Dagger source identity in action cards and accept source-verified numeric Roll20 `+7 Attack` hit-roll controls but not neighboring damage dice. Authenticated token and exact character checks unchanged; confirmation rechecks source/row fingerprint. Live Floorp validation with real chat rolls and selected-token behavior is the next gate. Truly ambiguous identical attack rows still fail closed, never click arbitrary first occurrence.


**v3.3.3 — Open own official Roll20 reader automatically (on-demand):** User wants native attack without manually opening the character sheet, and no interference with manually opened sheets. Implement guarded use of Roll20's browser-local character model `view.showDialog()` when available, with exact character ID and current-player controlledby verification. Only a uniquely **newly created** character-ID-matched dialog from this request can be claimed and moved offscreen; preserve visible Vue rendering and script-owned overlay only. Reuse owned background sheets per player character, bounded at six, and allow Combat tab activation only for script-owned official sheet. Leave existing manual sheet/popout untouched and never clone a bare frame URL or infer character access. Source-keyed attack matching, time-limited user confirm and no damage-button misclick remain. Roll20 internal opener and hidden Vue behavior require **live Floorp proof** even after passing DOM mock tests. Explicitly track safe fallback when same-character manual dialog already exists on another tab, and future lifecycle cleanup once verified.

**v3.3.3 CI:** PR #53 final source head `f108f3a1136d5d3bbfb7e8ba3baffa4bd4bbfacd` run 38487842277 green (**322 tests, 0 failures**, build reproducible). Safety covers previous manual dialogs unchanged, multiple owned PCs, same-name character ID mismatch blocked, full probe/confirm path and background-only Combat navigation. Live Floorp check pending before marking it reliable in Roll20.

**v3.3.3 merged:** PR #53 commit `18c32f8cf1ee5eddff23a9848f28fd9e5ade1de1`. Final GitHub Actions run 38487936698 passed **322 tests, 0 failures** and generated-userscript diff check. Supports on-demand player-authorized Roll20 browser model sheet opening into addon-owned offscreen dialogs; never relocates or navigates manually opened sheets, and only navigates Combat in an authenticated owned frame. Same-name characters bound to selected token IDs. Real Floorp/official Vue mounting and actual chat roll still require user confirmation. Next: live QA of automatic background session with official sheet initially closed; then fix any specific opener/iframe diagnostics without weakening authentication.


**v3.3.4 — Live background opener failure while player token selected:** User confirms v3.3.3 emitted generic cannot-verify-character despite selected owned token. Browser identity bug: `d20.player` is not reliable, while `window.currentPlayer.id` / Backbone `.get('_id')` is used in Roll20 editor. Fix shared current-player detection and re-read current selected token's represented ID at attack time even before token polling. Reuse explicit character controlledby authorization, prevent viewing permission becoming control permission and bind duplicate-name characters by exact selected represented ID. Add distinct, safely actionable errors for missing player identity vs model/ownership vs opener, plus multi-character security regression tests. **CI verified:** PR #54 run 38488729549 passed **329 tests, zero failures**, userscript regenerated consistently. Live Floorp validation pending; remain cautious with Roll20's undocumented browser sheet opening API.

**v3.3.4 merged:** PR #54 `dcffa62d97cc81f63af3a9d9549c5a303517641b`; final run 38488801556 green (**329 tests passed, 0 failures**, bundle check clean). Fixed Roll20 frontend currentPlayer vs d20.player identity mismatch; selected linked token read at native attack time, duplicate names resolved by exact source ID; no control bypass. Live Floorp verification pending for the real showDialog background reader and actual Roll20 chat hit roll. Continue source diagnostics rather than guess an accessible character or hidden iframe URL.


## v3.3.5 — Background sheet privacy and native action readiness (2026-10-13)

- [x] Observe a Roll20 dialog before opening; shield only the newly created, identity-verified, player-owned sheet and its newly created modal overlay.
- [x] Apply equivalent exact-identity, wrapper-aware shielding to Auto-sync's Journal opener; preserve manual dialogs and restore inline styles on disable.
- [x] Retry source-verified missing Combat tab / +N Attack hit controls after bounded mount delays; remain fail-closed for wrong characters, ambiguous attacks and damage buttons.
- [x] Add late-mount/overlay/restoration regression tests and generate v3.3.5 userscript.
- [x] GitHub Actions run 38491180410 green: 334 tests passed, zero failures, generated userscript diff clean.
- [ ] Validate live Floorp sheet concealment and exactly one resulting Roll20 chat hit roll after player confirmation.

**v3.3.5 merged verification (2026-10-13):** PR #55 merged at `46708c310a2c298f670c1889156eadbea367eb84`, final CI [38491256815](https://github.com/newnetmp3/roll20embetterment/actions/runs/38491256815) passed 334 tests and generated script checks. Remaining verification is live Floorp HUD-owned and Auto-sync sheet concealment plus real Roll20 chat roll proof.


## v3.3.6 — One-click readiness and recoverable native sheet hiding (2026-10-13)

- [x] Replace iframe-exists = reader-ready assumption with authenticated, exact-character hello handshake before first native probe.
- [x] Retry transient owned Combat control mounting within a single Find action; never retry native-invoke / real attack clicks automatically.
- [x] Use owned-only important CSS to suppress late Roll20 dialog recentering; avoid disabling the actual sheet's close interaction; conceal late owned overlays.
- [x] Add Show original sheet recovery action restoring original styles and close behavior; match Auto-sync wrapper/overlay lifecycle.
- [x] Add first-click, delayed reader, transient mount, wrong identity, CSS and recovery regression tests.
- [x] PR #56 merged; final CI 38492651190 green with 340 passing tests and reproducible userscript.
- [ ] Confirm in live Floorp no foreground sheet and no second Find, plus exactly one actual Roll20 chat hit roll on explicit confirmation.

**v3.3.6 merged:** [PR #56](https://github.com/newnetmp3/roll20embetterment/pull/56), commit `06cdd3ab0beb1f3b106a3dae64ca1fc27eba60f3`, [CI 38492651190](https://github.com/newnetmp3/roll20embetterment/actions/runs/38492651190): 340/340 tests passed. Next user Floorp check is the release gate for real automatic sheet concealment, first-click hit-control readiness, manual reveal and chat roll confirmation.


## v3.4.0 — Firefox and Chrome extension packaging (2026-10-17)

- [x] Generate separate Firefox 128+ and Chrome 120+ Manifest V3 packages from the same eight v3 modules as the optional userscript.
- [x] Static MAIN-world injection on Roll20 editor and official sheet route, matching frames and popouts; no userscript manager, privileged extension permissions or background process.
- [x] Add browser action popup, deterministic ZIP packaging and install instructions (temporary Firefox vs unpacked Chrome).
- [x] Version synchronized to 3.4.0; add browser manifest and archive tests, GitHub Actions artifact upload and rolling docs.
- [ ] Require passing CI before merging and record final verified run/commit in handover.
- [ ] Live Firefox/Floorp and Chrome testing with Tampermonkey disabled: HUD, importer, cross-origin bridge, first native Find, own hidden sheet and actual one-time chat roll.
- [ ] Future: Mozilla Add-ons signing for permanent Firefox XPI and Chrome Web Store publishing (separate accounts/review).

**v3.4.0 merged (2026-10-17):** [PR #57](https://github.com/newnetmp3/roll20embetterment/pull/57) merged at `1e752f23c6ee1f58bf9cc7075acf81aa64bbd95a`. [CI 39080887581](https://github.com/newnetmp3/roll20embetterment/actions/runs/39080887581) green, 343/343 tests and extension archives attached. Live browser QA and signing/store release remain open.

## Firefox-first independent extension tracks (2026-10-17)

- [x] Split Firefox/Chrome configuration, popup, versions, output folders, entrypoints, and CI packages while retaining the common v3 runtime.
- [x] Make Firefox development default; Chrome build/tests run independently and never gate Firefox.
- [x] Add Firefox 3.4.1 HTTPS update URL with stable Gecko ID and intentionally empty initial update manifest.
- [x] Implement manual GitHub Actions unlisted Mozilla signing and only-after-signature GitHub Release/update JSON publication (SHA-256).
- [x] Add separate Firefox vs Chrome package regression tests plus signed-update metadata tests.
- [x] Both PR-head pipelines green (Firefox 39082472615, Chrome 39082472659); PR #58 merged at `436a73402ed003a95a643f4e8f5f9056e3bf0814`.
- [ ] Configure GitHub environment `firefox-signing` with AMO JWT credentials (user action) before attempting genuine Mozilla signature.
- [ ] Live Firefox/Floorp QA of HUD, selected token, official sheet bridge, first-click Find and hidden reader; confirm one genuine Roll20 chat hit roll.
- [ ] Publish first signed Firefox XPI to GitHub only after Mozilla signs it; verify permanent install and Firefox self-update. Chrome browser-specific development resumes later.

**Independent build merged:** PR #58 `436a73402ed003a95a643f4e8f5f9056e3bf0814`, Firefox test gate 347 passing, Chrome independently passing; signed Firefox release and live QA are still open.

## Firefox v3.4.1 first unlisted signing (2026-10-17)

- [x] AMO signing credentials configured by user (their confirmation; inaccessible/opaque to assistant).
- [x] Add main-only, version-locked release-request trigger to start the authorized first Firefox signing without manual workflow dispatch.
- [x] PR #59 merged and Firefox signing run 39085562302 successfully completed.
- [x] Mozilla-signed Firefox v3.4.1 XPI published via GitHub Release and HTTPS update feed activated with SHA-256 hash.
- [ ] Install signed Firefox XPI and verify hidden sheets, first Find and real native chat roll in live Floorp.

**Firefox v3.4.1 signed release (2026-10-17):** [Download signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.4.1/r20eb-firefox-v3.4.1.xpi). [Actions 39085562302](https://github.com/newnetmp3/roll20embetterment/actions/runs/39085562302) passed the Mozilla unlisted signing, release publication and Firefox update feed steps. Next: real Firefox/Floorp install and Roll20 functionality QA. Chrome unchanged.

## Firefox v3.5.0 — Action-economy and turn-flow dashboard (2026-10-17)

- [x] Firefox-only Turn Flow module bundled before boot; Chrome and optional legacy userscript keep their existing HUD behavior.
- [x] Four visible action-economy indicators with accessible spent/ready state, manual corrections and muted spent sections.
- [x] Per-controlled-character turn state, per-game persistence and explicit new/end turn markers without touching Roll20 turn order.
- [x] Reaction persists through end of turn until next start; live initiative tracking resets only on a verified token-order transition.
- [x] Manual movement-used progress and remaining amount from observed official speed; Action/conditional Bonus Dash increases allowance, with undo.
- [x] Multiple attack counts and extra actions adjustable separately; exact-name Extra Attack is a hint, not a guessed count.
- [x] Explicit sheet-observed spell/feature action costs; free-interaction reminder and manual concentration state persisting across turns.
- [x] Existing official spell-slot/resource values remain read-only; native button clicked ACK never wrongly auto-consumes action.
- [x] No question/tutorial dialogs; inline feedback, hover explanations and regression tests for cross-character isolation and rules safety.
- [x] PR #60 merged, 359 Firefox tests passed, Chrome checks green; Mozilla-signed Firefox v3.5.0 XPI released with verified signed-only update manifest.
- [ ] Live Floorp HUD sizing, per-character action economy, native first Find, hidden sheet and actual chat-roll QA.
- [ ] Future optional: auto-measure token movement only after browser-verified Roll20 grid scale, coordinate and path APIs; attach verified chat events to action spending; account for more class-specific economy overrides.

**v3.5.0 shipped:** [signed Firefox download](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.5.0/r20eb-firefox-v3.5.0.xpi), [signing CI 39090704856](https://github.com/newnetmp3/roll20embetterment/actions/runs/39090704856) green; 359/359 test suite passed. Only Firefox version advanced. Next: real Floorp HUD/layout, manual reaction/movement, initiative turn transition, native attack confirmation and chat result verification.

## Firefox v3.6.0 — Reference-matched battlefield-first HUD (2026-10-18)

- [x] Codify approved final screenshot as a non-regressing visual/layout baseline in `docs/FIREFOX_UI_REFERENCE.md`.
- [x] Implement actual Firefox-only low-occlusion, map-click-through corner-dock overlay (not another illustration).
- [x] Bottom-left four colored economy indicators and three compact common-action controls; bottom-right five labeled category flyouts opening upward only as needed.
- [x] Small top-right observed character portrait/stats, concentration, resources and private per-character turn notes; slim turn pill near top center.
- [x] Preserve all imported cards, spell-level navigation, native attack probe/confirmation, token switching, and correction controls.
- [x] Separate Firefox 3.6.0 release and signing request; Chrome 3.4.0 and optional userscript remain unchanged in layout.
- [x] Responsive narrow layouts, internal sidebar scrolling, notes persistence and focus protection.
- [x] Add static/source-backed layout regression tests for click-through map, corner alignment and character isolation.
- [x] PR #61 merged; 368/368 Firefox tests passed; Mozilla unlisted signed v3.6.0 XPI and hash-verified update feed published.
- [ ] Compare real Floorp screenshot side-by-side against the approved concept image, especially 530px left dock vs 470px right dock, anchored bottom corners and battlefield visibility.
- [ ] Live Roll20 verification of native attack finding, hidden HUD-owned sheet, and one real chat roll; no code-only tests substitute for this.

**Firefox v3.6.0 shipped (2026-10-18):** [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.6.0/r20eb-firefox-v3.6.0.xpi), [PR #61](https://github.com/newnetmp3/roll20embetterment/pull/61), [CI 39096112335](https://github.com/newnetmp3/roll20embetterment/actions/runs/39096112335) (368 tests), [Mozilla signing 39096150187](https://github.com/newnetmp3/roll20embetterment/actions/runs/39096150187). Keep approved screenshot/spec the baseline; next gate is an actual Floorp screenshot and Roll20 native action check. Chrome is unchanged.

## Firefox v3.7.0 — Movable HUD, protect chat (2026-10-18)

- [x] Make the action dock, five-category dock, turn pill, profile, concentration, resources, notes, options, mini-tools, flyouts, native status, profile-restore and importer independently movable.
- [x] Preserve each panel's placement per game in local storage, independently of the active character and sheet data; restore after page reload and HP refresh.
- [x] Reposition right-side defaults to avoid visible Roll20 chat/sidebar (with conservative fallback), and prevent dock overlap at reduced widths.
- [x] Make grips pointer and keyboard accessible (Arrow=12px, Shift+Arrow=1px); never turn ordinary ability buttons into drag surfaces.
- [x] Clamp panels within the browser viewport, accommodate resize, and add a non-dialog Reset layout control.
- [x] Keep the approved compact reference, central map click-through, native roll confirmation, per-character notes and Firefox-only isolation.
- [x] Add drag, chat-inset, persistence, keyboard, boundary, reset and storage validation regression tests.
- [ ] Firefox/Chrome CI green, PR merged, Mozilla-signed Firefox v3.7.0 XPI published and update feed verified.
- [ ] Live Floorp Roll20 chat open: confirm default panels do not cover the chat, grips work and can be reset, no auto-sync input focus regression, native roll still works.

## Firefox v3.7.1 — Restore player-owned character sheets (2026-10-18)

- [x] Implement full cleanup of all HUD native hidden-reader sessions and Auto-sync-owned dialogs and exclusive overlays, not only the currently selected character.
- [x] Make real Journal player-open events release private readers before Roll20 reopens a reused dialog.
- [x] Add always-available **Show Sheet** recovery button in the movable Firefox HUD; no question popups.
- [x] Persist per-game player-managed-sheet priority and block new hidden readers in that mode; allow explicit re-enable.
- [x] Continue authenticated import/native Find through player-opened official sheets/popouts without changing manual sheet tabs or positions.
- [x] Regression tests for multi-session restoration, original sheet visibility, trusted-vs-synthetic Journal requests, persisted preference and re-hide prevention.
- [x] Firefox/Chrome PR CI green; PR #63 merged; 380 Firefox tests passed; Mozilla unlisted signing run 39151570823 published v3.7.1 XPI and SHA-256 update feed.
- [ ] Live Floorp with Auto-sync and native attack: verify original Roll20 sheet opens visibly, Close button works, R20eb does not move it, and first native roll still behaves safely.

**v3.7.1 signed release:** [download Firefox XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.7.1/r20eb-firefox-v3.7.1.xpi), [PR #63](https://github.com/newnetmp3/roll20embetterment/pull/63), [Mozilla signing 39151570823](https://github.com/newnetmp3/roll20embetterment/actions/runs/39151570823) successful. Next: user verify Roll20's original sheet is visible and closable with Auto-sync, including manually reopening a sheet that had been HUD-owned. Chrome remains unchanged.

## Firefox v3.8.0 — Automatic turn movement and nonblocking debug notices (2026-10-18)

- [x] Follow exact authorized controlled token and observe position on Roll20's engine canvas; preserve read-only player permissions.
- [x] Accumulate segments and anchored official lastmove waypoints, including doubling back; subscribe to Backbone changes and poll as fallback.
- [x] Translate movement using known active page units and scale; never invent a missing page scale or track another character/camera.
- [x] Start/rebase observation immediately at turn start, stop counting when ended, reset per new turn and keep manual +/- 5-foot correction.
- [x] Let remaining movement be negative after exceeding speed; spent distance and meter remain readable and do not restrict legal DM overrides.
- [x] Replace routine debug/status overlays with compact Status indicator; show draggable details only on request, except for actionable native roll confirmation.
- [x] Add movement and HUD-notification regression cases; preserve separate Chrome and userscript layout.
- [x] PR #64 merged at `29cb42000055119d47eea2b38a8ead386c05fd5e`, 392 Firefox tests passed and separate Chrome CI passed; Mozilla-signed v3.8.0 published with verified SHA-256 feed.
- [ ] Test real Roll20 movement with current game page settings and chat open in Floorp, especially paths with waypoints, deselect/reselect, turn transition and visible status controls.

**v3.8.0 signed release (2026-10-18):** [signed Firefox XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.8.0/r20eb-firefox-v3.8.0.xpi), [PR #64](https://github.com/newnetmp3/roll20embetterment/pull/64), [Mozilla CI 39153585095](https://github.com/newnetmp3/roll20embetterment/actions/runs/39153585095) green; 392 Firefox tests passing. **Next:** live Floorp check of Roll20 scale, automatic segment/path movement, negative remaining, and ability controls no longer obscured by status notices.

## Firefox v3.8.1 — Panel drag without handles (2026-10-18)

- [x] Remove every visible ⠿ grab handle/tab, including the importer and native confirmation panel.
- [x] Allow mouse/pointer dragging directly on each existing independently positioned panel, even from dense button layouts.
- [x] Require a drag movement threshold; preserve ordinary button clicks, text fields, keyboard-triggered actions and browser accessibility.
- [x] Prevent a drag-generated post-release click from unintentionally launching an attack, spell, or another HUD action.
- [x] Keep saved per-game panel layouts, viewport bounds, default chat clearance, and Reset layout.
- [x] Replace former grip keyboard arrows with focusable panels and Alt+Arrow / Alt+Shift+Arrow.
- [x] Add regression tests for direct panel movement, threshold, click suppression, text-edit exclusion and saved positions.
- [x] Final Firefox CI green (394 tests), PR #65 merged, Mozilla-signed Firefox v3.8.1 XPI and SHA-256 automatic-update feed published. Chrome v3.4.0 unchanged; no Chrome-specific build was required.
- [ ] Verify actual Floorp Roll20 click-versus-drag behavior with Attacks/Spells, notes typing and chat visible.

**Firefox v3.8.1 release verified (2026-10-18):** [PR #65](https://github.com/newnetmp3/roll20embetterment/pull/65) merged, [394-test PR CI](https://github.com/newnetmp3/roll20embetterment/actions/runs/39157525423) green and [Mozilla signing 39157589515](https://github.com/newnetmp3/roll20embetterment/actions/runs/39157589515) successful. [Signed XPI download](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.8.1/r20eb-firefox-v3.8.1.xpi). Live Floorp direct-drag and button click safety still open.

## Firefox v3.9.0 — Dedicated Debug window and live movement troubleshooting (2026-10-18)

- [x] Replace passive HUD status button with an opt-in, draggable Debug window; leave the battlefield, chat and ability dock unobstructed during ordinary play.
- [x] Collect and filter movement, native-roll, importer/Auto-sync, local turn and control tooltip messages with timestamps; bound, escape and keep logs local to this browser tab.
- [x] Add Copy log, Clear, Importer shortcut and close controls; automatically show only actionable Confirm/Cancel native roll controls in the gameplay HUD.
- [x] Expose concrete movement diagnostics: whether controlled token is found, map/page resolution, scale units/grid, coordinate source, turn state, total used.
- [x] Expand token and page detection across commonly exposed Roll20 Fabric/Backbone/browser collections, preserving exact player-controlled token ID matching.
- [x] Prefer live Fabric coordinates, subscribe to movement events, keep polling fallback, negative remaining movement and existing per-character persistence.
- [x] Add Debug and fallback lookup/scale regression tests.
- [x] Firefox PR + main CI green (406 tests), separate Chrome CI green; PR #66 merged; Mozilla signed v3.9.0 XPI released with SHA-256 update feed.
- [ ] Live Floorp Roll20 QA: move controlled token during Your Turn, confirm feet increase and Debug status/source/page scale match actual map; test tooltip history and log copy.

**Firefox v3.9.0 signed release checkpoint:** [PR #66](https://github.com/newnetmp3/roll20embetterment/pull/66), [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.0/r20eb-firefox-v3.9.0.xpi), [Mozilla signing 39164290728](https://github.com/newnetmp3/roll20embetterment/actions/runs/39164290728) successful. Next: confirm real Roll20 token movement and collect Debug movement log if source is still unavailable; Debug panel is closed by default and movable. Chrome 3.4.0 unchanged.


**2026-10-18 selection-debug follow-up:** In response to a live report that selected graphics show as not selected in Movement Debug, extend the shared token watcher to inspect both Roll20 editor selection and Fabric active selections. Do not bypass character ownership or use arbitrary on-map graphics. Verify under Floorp with the selected token, then test movement counting, source diagnostics, and release/signing separately.

**Firefox v3.9.1 release request (2026-10-18):** PR #67 merged the alternate Roll20/Fabric selected-token API fallback with regression tests; Firefox test and generated userscript consistency CI passed. Bump only Firefox extension metadata from 3.9.0 to 3.9.1 and request unlisted Mozilla signing via main workflow. Chrome/user-script version numbers stay 3.4.0. After signing, verify XPI + update manifest, then live Floorp selection recognition, token movement/distance including reversals, and native character control checks. Release request is not evidence of live browser behavior.

**Firefox v3.9.1 signed (2026-10-18):** Mozilla unlisted signing, verified-XPI publication and signed update feed completed successfully: [signing run 39167264438](https://github.com/newnetmp3/roll20embetterment/actions/runs/39167264438), [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.1/r20eb-firefox-v3.9.1.xpi). The selection source compatibility fix from PR #67 is now packaged; browser verification of the user's highlighted token and movement distance remains **open**. Chrome remains on its separate v3.4.0 release.


**2026-10-18 Babylon selection recovery (pending verification):** User-reported v3.9.1 selection failure persists. Prior editor HTML identifies a Babylon.js v8.56.2 canvas, not Fabric. The v3 token watcher now probes explicit engine selection sets/objects and guarded Babylon mesh metadata references; it retries selection when character info loads after first poll. Movement Debug presents the renderer, source count, and rejection reason without exposing raw IDs or treating random graphics as selected. Tests and PR CI must pass, followed by a separate signed release and actual Floorp selection/movement QA. **Do not mark auto-movement fixed on CI alone.**

**Firefox v3.9.2 signing request (2026-10-18):** Release PR to package the merged PR #69 Babylon renderer diagnostics and best-effort token selection adapters. Require successful Firefox CI and actual Mozilla-signed XPI/update feed, then ask user to share Debug → Copy log for their selected PC if detection still fails. Movement live QA remains open.

**Firefox v3.9.2 released and signed (2026-10-18):** [Mozilla unlisted signing CI 39169500580](https://github.com/newnetmp3/roll20embetterment/actions/runs/39169500580) succeeded; [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.2/r20eb-firefox-v3.9.2.xpi) and official 3.9.2 update feed verified. Next: live Babylon selection/Controlled By verification; if still failing, collect Debug Copy Log showing renderer, selection source/type/shape and the rejection reason, then correct actual Roll20 runtime integration and distance events.

**2026-10-18 selected Babylon token follow-up:** v3.9.2 reports no selection while engine lists `tabletopSelected`. Source now probes its read-only value, supports bounded explicit selection wrappers and exact selected graphic ID lookups, and resolves movement from an authoritative model without a Fabric canvas. Permission verification remains mandatory. Add tests, validate Firefox/Chrome, sign a new Firefox release and obtain live Floorp confirmation. If property is a function/boolean, the new Debug API-type field documents the limitation rather than guessing a token.

**Firefox 3.9.3 release request:** Package selected Jumpgate `tabletopSelected` property probe and exact graphic/model movement handling; CI verified in PR #71. Require Mozilla signed-XPI/update-feed verification followed by user Floorp selection and movement test. If Selection API types shows `engine.tabletopSelected:function` or `boolean`, collect diagnostics and investigate further; no fabricated live success.

**Firefox v3.9.3 Mozilla signed 2026-10-18:** [signing CI success](https://github.com/newnetmp3/roll20embetterment/actions/runs/39173839215), [signed XPI published](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.3/r20eb-firefox-v3.9.3.xpi), signed automatic update feed points to version 3.9.3. Need live selected character and movement verification in Floorp. Inspect `Selection API types` to learn whether observed `engine.tabletopSelected` is an object, boolean or function; do not bypass Controlled By or infer movement from a random token.

**2026-10-18 Jumpgate selected-token blocker:** Latest signed Firefox v3.9.3 does NOT detect the selected token. User's Debug evidence proves `engine.tabletopSelected` is a **function** rather than collection. New [issue #73](https://github.com/newnetmp3/roll20embetterment/issues/73) tracks source-grounded inspection of function implementation and reliable read-only selection events. Do not call unknown callback or publish another guessed selector. Next: obtain read-only function signature/source from Floorp, implement and test actual selection path, then verify movement in live game.

**2026-10-18 verified Jumpgate selection getter:** User-provided function definition proves `engine.tabletopSelected()` wraps `VTTEngine.instance.tabletop.getSelection()`; development branch now invokes that *verified zero-arg read-only getter* and displays its return shape. Retain exact token-to-character Controlled By gate, tests for other engines/unsafe functions, and automatic movement rules. Sign a new Firefox build only after CI; live Floorp acceptance still required. See issue #73.

**Firefox v3.9.4 release request:** PR #74 merged verified Jumpgate `tabletopSelected()` getter. Firefox CI green. Publish unlisted signed XPI/update feed, then verify the user's real Jumpgate selection result, movement path accumulation and negative remaining allowance; issue #73 remains open until validated.

**Firefox v3.9.4 signed 2026-10-18:** [Mozilla signing workflow passed](https://github.com/newnetmp3/roll20embetterment/actions/runs/39177743384); [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.4/r20eb-firefox-v3.9.4.xpi) and signed update feed verified. Source-verified `tabletopSelected()` getter now invoked. Issue #73 stays open for live Floorp verification of selection return data, controlled character association and distance. No claim of complete movement repair without user's in-game observation.

**2026-10-18 blocking Jumpgate native editor bridge:** After disabling conflicting extension, Roll20 game loads but R20eb selection getter and campaign/page objects are all unavailable. Add diagnostic-only editor bridge presence/status; need verified native Jumpgate API or viable permitted read-only game bridge without dependency on other extensions. Do not sign a fix-only release until real selection, character ownership and token coordinates are source-grounded. Issue #73 remains open.

**2026-10-19 Jumpgate-native namespace discovery:** User's top-window console proves direct `Campaign`, `currentPlayer`, and `vttEngine` globals with no `d20`. Development adapter now uses direct `Campaign` for characters/pages and direct `d20_player_id` fallback for ownership; tentatively supports a native `vttEngine.tabletop.getSelection` getter when its zero-arg signature exists, with read-only return-shape diagnostics. **Still blocked on observing actual vttEngine and Campaign structures** and live movement QA. No signing until confirmed source/shape. Issue #73 stays open.

**2026-10-19 correction:** `window.vttEngine` was misidentified as native tabletop runtime in PR #77. In actual Jumpgate session it behaves as engine-mode **string**, with no `.tabletop`, `.instance`, or getter. Remove hypothetical API and its unrealistic test fixtures; keep direct `window.Campaign` and `d20_player_id` fallbacks. Source-grounded selection retrieval remains blocked; explore native exposed bridge and/or authenticated official Beacon `dispatch.getTokens` (not accessible until proven), then live test token association and movement before signing. See #73.

**2026-10-19 Jumpgate API scan:** `d20ext`, `vttjs`, `Campaign.pages`, and global `getSelection`/DOM selection names do not establish a token selection API (confirmed by read-only browser names). Direct Campaign access is in main, but automatic movement is still blocked on obtaining the real Jumpgate selection store. Prior editor wrapper targeted internal `VTTEngine.instance.tabletop.getSelection()`, not global `vttEngine` (mode string). Next request exact production `vtt.bundle` JS for offline static analysis and source-grounded adapter design; continue validation, player control checks and Mozilla signing only when actual token selection integration exists. Issue #73 OPEN.

**2026-10-19 actual Jumpgate bundle received and inspected:** User supplied the exact 23 MB uncompressed production JS. Identified Webpack runtime hash `19490f9953b3c5b0e6c6`, VTTEngine export module 73210, `VTTEngine.instance.tabletop.getSelection()`, and selected node `dataWrapper.model` structure. A narrow version-pinned bridge uses Webpack's runtime callback only for this verified export (registers an empty chunk), reads selected objects without changing game selection, and keeps exact character control checks. Regression tests and generated userscript sync passed. **Still open:** signed Firefox update, live selected-token and per-turn distance test (including backtracking), and clean fallback on Roll20 bundle updates; do not claim successful gameplay from CI alone. No proprietary Roll20 source committed. Issue #73.

**Firefox v3.9.5 release request:** PR #79 source-verified pinned Jumpgate selection bridge is merged and tested; packaging as Mozilla unlisted signed Firefox release, no Chrome/user-script version bump. Check live selected graphic model and movement in Floorp; fail closed on different bundle. Issue #73 OPEN until verified.

**Firefox v3.9.5 signed test build published 2026-10-20 UTC:** [Mozilla signing CI passed](https://github.com/newnetmp3/roll20embetterment/actions/runs/39348882106); [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.9.5/r20eb-firefox-v3.9.5.xpi) and automatic update feed 3.9.5 verified. Pinned runtime reader validated by automated tests, not yet in user's Floorp Jumpgate session. Selection + movement (including reversal and negative remaining allowance) and no original sheet obstruction remain acceptance tests for issue #73.
