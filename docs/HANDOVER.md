# R20 Embetterment — Rolling Development Handover

**Updated:** 2026-10-11  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Starting baseline:** `d4d6a8e8d07be38c1a87371fb4e56448440ec339` (v2.3.2)  
**Latest completed milestone:** v2.3.3 — unified official 2024 native rolls across Sheet panel, wheel and command palette in PR #16.

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

## Next milestone

Add native-roll pending state and accidental duplicate-click protection, with clear confirmation/error for slow hidden helper sheets, without changing official Roll20 roll math or resource consumption.

**Rolling policy:** Update this file and `docs/ROADMAP.md` in the same PR for each completed feature slice.
