# R20 Embetterment — Rolling Development Handover

**Updated:** 2026-10-11  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Current verified main baseline:** `1148313473bee5c6da3dbe434de8f22a3ecc3367` (v2.3.10, merged PR #24).  
**Latest completed milestone:** v2.3.10 stabilization/refactor (PR #24 merged, 169 tests passed).  
**Known unresolved issues:** Real Jumpgate 2024 sheet-opening behavior and authoritative HP/AC/ability syncing still require direct browser verification.  
**Pending:** Live Roll20 Jumpgate/Firefox verification of sheet opening and actual HP/AC/speed correctness.  

## Resume process

1. Fetch `docs/HANDOVER.md` and `docs/ROADMAP.md` from GitHub main. Verify latest SHA, open PRs, build version and GitHub Actions.
2. Implement meaningful, tested slices from the roadmap rather than tiny one-off commits.
3. **Update both documents in every development PR** with implemented behavior, verifiable tests/CI, remaining problems and next action.
4. Only edit `src/??_*.js`; `roll20-embetterment.user.js` is generated with `npm run build`.
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

## v2.3.11 — Nier stat mismatch correction (PR pending CI)

**User evidence:** Two screenshots from 2026-10-11 show official 2024 Nier sheet at 82/84 HP, AC 17, speed 55 ft, initiative +2.14, and six ability scores (18/14/15/12/15/10), while R20eb had 69/84 HP, AC 10, speed 30 ft, initiative +0 and blank scores.

**Root causes identified in code:**

1. `mergeBeaconSnapshot` previously preserved stale *named* values over newer visible 2024 text even in a confirmed live read.
2. `autoRefreshVisibleSheetStats` then unconditionally applied linked token-bar health over the visible character HP, even if the bar was stale or represented something else.
3. `autoCandidateForCharacter` ignored embedded 2024 iframes with no character ID (but a visible exact player-character name), preventing nonintrusive live refresh.
4. Initiative +2.14 had no visible text parser and the HUD truncated decimal values.

**Changes:** Trusted live 2024 scans opt in to a visible-value-first merge; visible HP takes precedence over token bars, which are now fallbacks; ID-less embedded candidates may match via unique exact character name and unique controlled-character identity; parse and render decimal initiative. Add screenshot-based regression fixtures and ambiguity checks. Named-first remains default for legacy data. This remains a read-only import.

**Verification pending:** GitHub Actions, generated userscript, and especially live Roll20 iframe reader values. If any number still differs, inspect the candidate match, frame message, and visible extraction in that order, rather than adding more field-name aliases.
