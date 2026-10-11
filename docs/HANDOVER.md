# R20 Embetterment — Rolling Development Handover

**Updated:** 2026-10-11  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Current main baseline:** `128b6a16fa00f14e2d82099276842c2df9d96ddf` (v2.3.4, PR #17)  
**Previous milestone:** v2.3.3 (PR #16, 128 tests green).  
**Latest completed milestone:** v2.3.5 (PR #18, CI 136 tests green) — separate casting, official rolls, and local reminders.  
**Verified previous main baseline:** `128b6a16fa00f14e2d82099276842c2df9d96ddf` (v2.3.4); verify main HEAD again after merge.

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
