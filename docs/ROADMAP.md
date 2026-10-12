# R20 Embetterment — v3 clean restart roadmap

Updated: October 12, 2026 (v3.1.2 merged). v2.3.13 continued to fail real Floorp/Roll20 imports despite green DOM mocks. The production script is being **replaced**, not patched.

| Priority | Milestone | Status | Required verification |
| --- | --- | --- | --- |
| 1 | Replace production bundle with independent v3 engine | Implemented | Run 38182938287 green; 189 total tests, 10 for v3; v2 runtime excluded |
| 2 | Labeled HP/stats/abilities/saves/skills/slots | CI verified; live QA pending | Official 2024 iframe in Floorp |
| 3 | Spells, attacks, inventory, features and resources | Implemented; live QA pending | Live populated character sheet tabs |
| 4 | Bounded tab traversal, origin verification, diagnostics and JSON export | UI click-handler fix and tests in v3.0.1; live QA pending | Floorp end-to-end scan |
| 5 | Improve unmapped fields from exported observations | Planned | No guessed selectors |
| 6 | Verify virtualized tabs and official sheet popouts | Planned | Browser QA matrix |
| 7 | Rebuild player combat wheel atop confirmed importer data | Planned | Separate architecture |
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
