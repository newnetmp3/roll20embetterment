# R20 Embetterment — Rolling Development Handover

**Updated:** 2026-10-11  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Previous milestone:** v2.3.3 (PR #16, 128 tests green).  
**Current verified main baseline:** `f2711bb8cc2d8ce2590c01e8bdc8c91d392c2f0b` (v2.3.8, PR #21).  
**Latest verified milestone:** v2.3.7 (PR #20, 150 tests green) — hidden helper isolation, manual Roll20 character access and draggable minimized dock.  
**Latest tested milestone:** v2.3.8 (PR #21, CI green: 155 tests) — compact wheel and live controlled-character stats. Pending merge and actual browser validation.  

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

## v2.3.9 — Fix inert native Roll20 sheet button (in progress)

- Live screenshot showed the Roll20 button emitted “Select a controlled character token or open its sheet from the Roll20 Journal” even while Nier's linked profile and combat wheel were active.
- Root cause: opening previously *required* `character.view.showDialog`; current Roll20 character models do not always expose that method. Linked IDs and token assignments were ignored in this case.
- Resolve character ID from the current profile, selected assignment, unique mapped profile assignment, or unique exact controlled-character name. Reject malformed IDs and ambiguous matches.
- Preserve native in-editor sheet opening and hidden-helper ownership where supported. Otherwise open Roll20's documented journal character URL as a player-clicked new tab; provide a real hyperlink if the browser blocks popups.
- Preserve the automatic importer isolation. Tests required for both native and fallback paths, popup blocker, ambiguous/missing IDs, and safe journal link rendering.
- Pending: GitHub Actions and live Roll20 browser verification.

**Next:** Verify click from expanded wheel and minimized dock opens Nier's actual sheet (native or journal tab); compare Roll20 2024 and legacy 2014. Maintain rolling docs after merging.
