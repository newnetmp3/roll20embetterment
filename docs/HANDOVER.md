# R20 Embetterment — current development handover

**Updated:** 2026-10-22  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Default branch:** `main`  
**Development workflow:** feature PR → `npm run check:firefox` → passing GitHub Actions → merge → separate Firefox signing/update-feed verification.

## Release and verification baseline

- **Firefox:** v3.10.0 is published as Mozilla-signed and referenced by `extension/firefox/updates.json`. Release asset SHA-256 matches the feed: `43b167a4bada4540150e4e71645f078607b0e29b6704ac73a871f5041a667666`. Signature contents and live gameplay were not independently inspected in this step.
- **Chrome and optional Tampermonkey distribution:** v3.4.0. The generated userscript is synchronized with v3 source and is *not* the Firefox version number.
- **Latest merged functional milestone:** [PR #106](https://github.com/newnetmp3/roll20embetterment/pull/106) unified existing character-ability native mapping across attacks, spells, features, inventory, resources, skills, saving throws, and ability checks. **467/467 automated tests passed** in its branch and PR checks. This is not evidence of end-to-end Roll20 game validation.
- **Latest merged hardening:** [PR #108](https://github.com/newnetmp3/roll20embetterment/pull/108) merged as `486f79a` after [Firefox CI run 39693899199](https://github.com/newnetmp3/roll20embetterment/actions/runs/39693899199) passed **470/470 automated tests**, including generated userscript parity. It tightened macro ownership, added conditional explicit repeating-row ID linking, and removed obsolete documentation. It was packaged into signed Firefox v3.9.19; live Floorp action verification is still separate.
- **Outstanding live blocker:** [Jumpgate token movement issue #73](https://github.com/newnetmp3/roll20embetterment/issues/73) remains open. Automatic token selection/movement has not passed the required in-game forward/backtracking acceptance test.

## Milestone Completion candidate — native coverage & professional HUD (PR #110)

**Merged milestone:** [PR #110](https://github.com/newnetmp3/roll20embetterment/pull/110) merged as `ce0b533` after green Firefox CI [run 39697156820](https://github.com/newnetmp3/roll20embetterment/actions/runs/39697156820), **476/476 tests**, 0 failures including generated userscript parity. Firefox v3.10.0 Milestone Completion packaging requested separately; signing, update-feed publication and live gameplay acceptance remain independent. This is **not full native parity**. This milestone is NOT described as implementing every private Roll20 call: many undocumented source controls are not safe to invoke blindly.

**Native capabilities added:**

- Capture entire, single, explicitly supplied character-bound macro references on authenticated official sheet card attributes `data-roll20-macro` or `data-native-macro` (and their visible action buttons), only when valid and unambiguous. These attributes are **supported conditional inputs, not yet verified to exist in the live D&D 2024 sheet**; absence disables this path without changing gameplay. Source action identity and current Controlled By permission are rechecked on invocation. Reject compound scripts, cross-character/selection-dependent references, ambiguous references, and invented row IDs.
- Use an exact observed macro directly when the official sheet exposes one, even without an existing token-bar ability. Previously mapped existing character abilities continue to work. The separate observed Dice action remains explicitly non-native.
- Discover unclassified, exact, existing player-controlled Roll20 repeating-action abilities from current `window.Campaign.characters` (never other characters or arbitrary chat macros). Expose them in **MISC**. If the official sheet exposes a source action with no known section, also import into MISC; do not present unrecognized generic buttons as clickable.
- Track `misc` through bounded capture/merge/coverage, importer diagnostics, snapshot/identity and HUD. No automatic action execution on scan or render.

**UI consolidation:**

- **Remove** the six-button bottom utility toolbar (More options, Debug, Show Sheet, Allow private reader, Reset layout, −). The turn strip has just one accessible **Debug** entry; the existing Debug window contains sync, show/reveal original sheet, allow private reader, reset HUD positions, hide HUD, importer, turn corrections, movement diagnostics and local copyable logs.
- Keep categories ergonomic and add **MISC** to the action dock; maintain one deliberate action click for a verified native binding. Unknown/missing mappings show Native unmapped, not misleading active controls.
- Recalculate HUD scale from CSS-pixel viewport size and live chat inset on browser resize. Keep panel drag/nudge saved positions clamped to the new viewport. Respect chat and manual sheet priority, reduce visual clutter and avoid obstructing the map. No new in-game popup tutorials.

**Validation verified on PR:** `npm run check:firefox` and generated userscript consistency green, 476/476 tests. Responsive Debug/MISC static tests, direct source-action rejection, and original-sheet safety regressions passed. Package separate **Firefox v3.10.0 milestone candidate** with Mozilla-unlisted signing, inspect signed XPI and auto-update feed. **Live Floorp gameplay remains required** for: official 2024 action references actually exposed, chat/action card parity, resource effects, Jumpgate startup, 5 ft outbound + back and no original sheet/chat interference.

**Unimplemented or intentionally disabled native interactions (do not overclaim):** Native write mappings for inventory quantity, equip/attune, HP and temporary HP, spell slots, resource trackers and conditions; custom API/multi-command macros; arbitrary buttons without a verified macro or existing owned ability; dynamic target-picking, GM turn order modification; unexposed D&D 2024 Advanced Tools internal identifiers; exact upstream game-native prompts, damage/crit/upcast parity not confirmed live; Jumpgate movement issue #73 remains OPEN. These require actual source and live evidence before safely enabling.

## Current runtime

1. `v3/00_capture.js`: bounded, read-only official 2024 sheet DOM observations (stats, attacks, spells, inventory, features, resources, skill/save/check fields). Source labels and card buttons are *observations*, not action references. PR #108 recognizes only an explicit official repeating-row data attribute on a card and records `nativeRowId` when unambiguous.
2. `v3/10_reader.js`: authenticated official sheet iframe/popout import bridge.
3. `v3/20_ui.js`: diagnostics, importer and snapshot presentation.
4. `v3/21_native.js`: native-action mapping and one-click Roll20 chat dispatch; separate legacy native sheet probe for opt-in diagnostics; verified controlled-character permission gates and source identity.
5. `v3/22_hud.js`: movable combat HUD and category navigation, no speculative native actions.
6. `v3/23_token.js`: Jumpgate token/character/page introspection and selected-character watchers, with safe renderer-startup guards.
7. `v3/25_auto.js`: character-scoped automatic snapshot synchronization with explicit Off and manual-sheet priority.
8. `v3/30_boot.js`: runtime startup.

The `src/` tree is historical legacy implementation. **Do not modify `src/` for current Firefox work.** `roll20-embetterment.user.js` is generated by `npm run build`; do not hand-edit it.

## Native-action integration: verified scope and boundaries

Existing Roll20 character abilities may be invoked by a player click using the official chat macro `%{CHARACTER_ID|ABILITY_NAME}`, **only** when the currently controlled character, imported source entry, native category, and exact existing ability are unambiguous. Calls are revalidated immediately before dispatch. No character sheet is opened to invoke a mapped ability, and no HUD render automatically sends a roll.

| Imported source | Mapping capability | Important limitation |
| --- | --- | --- |
| Attacks | Existing repeating attack/NPC-action abilities | Not every 2024 weapon/variant is exposed; native roll-card parity needs live testing |
| Spells | Existing repeating spell abilities | Cast prompts, slot expenditure, concentration and upcasting need live testing |
| Features | Existing repeating feature/trait/action abilities | Feature charges and special effects require native action coverage |
| Inventory | Existing repeating item/inventory/equipment abilities | Quantity, equip and attune edits remain read-only |
| Resources | Existing repeating resource/action abilities | Resource counter mutations remain read-only |
| Skills | Existing specific named skill abilities | No guessed or reconstructed roll for missing references |
| Saving throws | Existing specific named save abilities | No ability-name-only fallback |
| Ability checks | Existing specific named check abilities | No fabricated modifiers or chat template substitutions |

Current `main` requires a **single complete macro pointing to the current character**, with a category-consistent sheet-action reference. It rejects multi-command scripts, `selected`/other-character references, stale identities and ambiguous mappings. For duplicate-named card entries, it can match by an *explicit* row ID captured from the official card **and** a matching existing character ability reference. If the sheet does not expose that ID, duplicate names remain deliberately unmapped. Never derive a repeating ID from a DOM index, caption, button label or cached guess.

The earlier opt-in diagnostic sheet probe and explicitly labeled non-native **Dice** fallback remain separate from native mappings. **Dice is not a faithful native 2024 sheet roll.** Successful chat-button dispatch alone does not establish that a game chat card appeared.

### Native calls and interactions still NOT implemented or verified

- Automatic enumeration of all D&D 2024 Advanced Tools action IDs/token-bar macros and stable repeating IDs when the rendered sheet does not expose them.
- General-purpose direct execution of an official sheet button that is not already represented by a verified character ability, including duplicate-named entries without an exposed row ID.
- Native-verified hit/damage/critical/advantage and special attack card semantics for every weapon/variant.
- Fully validated native spell-cast prompts (target choice, upcasting, slot consumption, concentration, effects) for every imported spell.
- Fully validated use/charge semantics for class features, traits, consumables and equipped gear.
- Write operations for **inventory quantity**, **equipped**, **attuned**, **HP/current/max/temp**, **spell slot used/remaining**, **resource counters/checkboxes** and **conditions**. These need type-safe identity, optimistic-state protection, Roll20 authoritative re-read and clear error/rollback behavior.
- Actions whose existing macro uses a selection-dependent or other-character target, custom API script, a compound/multi-command body, an unknown category or an undocumented backend identifier.
- Safe automatic GM turn-order mutation/end-turn, target selection/targeted attacks, range/condition manipulation, and reliable automatic movement: intentionally not part of this native-action milestone.

These are **explicitly unimplemented**, not hidden behind disabled buttons and not counted as working native integration.

## Safety and current acceptance criteria

- Original Roll20 sheet and chat remain usable; do not hide or close player-opened sheets. Safe Jumpgate first-page-render barrier prevents eager `VTTEngine.instance` construction.
- Never issue a native roll, spend resources, edit a sheet, advance the turn or mutate inventory without deliberate user action and a verified capability.
- Never infer current character from artwork, duplicated names, an arbitrary graphic, stale import or a player-uncontrolled token.
- Live Floorp QA must verify: install and Jumpgate startup, selected controlled-token changes, correct first import, mapped attacks **and** spell/feature/skill actions producing their original Roll20 card/prompts, duplicate weapon rows, blocked malformed/foreign macros, live chat draft preservation, manual sheet priority, and 5 ft out + 5 ft back = 10 ft movement.
- Unit and browser-mock tests do not substitute for those live tests. Distinguish branch green, merged code, Mozilla-signed release, feed publication and in-game verification in status updates.

## Resume development without regressions

1. Check `main` SHA, open PRs, GitHub Actions and the signed Firefox update feed. Do **not** trust stale top-level version strings.
2. Work in `v3/`, `tests/`, and relevant Firefox extension modules. Use only source-grounded official 2024 identifiers; if missing, fail closed and report exact missing capability.
3. Run `npm run build` to regenerate the optional userscript; run `npm run check:firefox` before requesting merge. Wait for a green PR check; never claim CI passed solely from edits.
4. Update **this handover** and `docs/ROADMAP.md` in the same feature PR. After merge, update the verified baseline and initiate independent Mozilla signing; ensure the XPI and update feed match the new Firefox version.
5. Prioritize completing supported native-action identity discovery, then full official 2024 gameplay parity and type-safe writable interactions. **Do not add HUD features** while core native-action coverage is incomplete. Keep issue #73 open until user-tested and resolved.

## Milestone references

- [PR #96](https://github.com/newnetmp3/roll20embetterment/pull/96): character sync activation on controlled-token discovery; live full-import acceptance still required.
- [PR #100](https://github.com/newnetmp3/roll20embetterment/pull/100): modern `window.Campaign` bridge (no obsolete `window.d20.Campaign` dependency).
- [PR #102](https://github.com/newnetmp3/roll20embetterment/pull/102): explicit, separate non-native observed-dice Roll20 chat path.
- [PR #104](https://github.com/newnetmp3/roll20embetterment/pull/104): weapon-first grouping and conditional native ability linking.
- [PR #106](https://github.com/newnetmp3/roll20embetterment/pull/106): shared native mapping across all imported player action categories.

Resume baseline: `cc87fcd` on main; PR #110 merged and Firefox v3.10.0 published. Historical v3.9.19 packaging notes above are superseded. Only the above current architecture and status should be treated as the active handover. Superseded v2/v3 patch-by-patch details belong to Git history, not the live engineering baseline.

## 2026-10-21: Expanded full native mapping scope

User explicitly requests mapping EVERY interactable element exposed by the Roll20 D&D 2024 character sheet, not just attack rolls, across Spells, Features, Inventory, Skills, Saves, Checks, Resources, HP, equipment, slots, conditions and MISC.

Existing main has the shared R3_NATIVE_CATEGORIES ability registry spanning attacks, spells, features, inventory, resources, skills, saves, modifiers and misc (latest 470-test baseline). This only covers a subset of existing verifiable native character actions; source-button enumeration, unexposed Advanced Tools identifiers, duplicated native action IDs, and state-mutating controls are NOT solved by the registry.

Architecture mandate: comprehensive source-grounded control inventory; classify each observed action as roll, action, toggle, counter, field, selection or unsupported; map exact source identity, current character, permissions and required arguments; use native Roll20 behavior, not fake equivalent cards. For state writes implement verified model ownership, stale-revision guards, authoritative re-read and failure reconciliation before enabling. Preserve normal sheet-closed execution where official actions allow it; do not hide manually opened sheets. Report unmapped controls and reasons, not an inert or misleading button. Put uncategorized controls in MISC.

Execution order: (1) discover all source controls and their stable identities; (2) complete existing exact native action mapping for rolls, spells, skills, features, items; (3) typed writable inventory/HP/slot/resource/condition interfaces; (4) full per-control Floorp/Jum​pgate acceptance comparing official native sheet action/chat output/state with R20eb. Update this handover and ROADMAP for each verified milestone. This commit records an EXPANDED SCOPE, not a claim of full implementation. Signed Firefox v3.9.19 baseline remains unchanged; do not trigger a release for docs-only scope changes.


## 2026-10-22: Interactive control evidence inventory

Resumed from main `cc87fcd`; no open PRs at the start of this step. Added diagnostic-only enumeration of visible enabled rendered buttons, fields, counters, toggles, selections, links and ARIA controls. Records include bounded labels, tab/category, observed DOM attributes and explicit macro evidence when unambiguous. DOM IDs/test IDs are observations, never native action IDs. Every record stays observation-only with a missing adapter/validation reason. No clicks, free-text values, credential values, URLs or mutations are collected/executed by this pass.

Bounded to 750 candidates per view and 1500 merged records; revisiting a tab replaces its old inventory. Exported snapshots and importer Diagnostics expose the inventory. Automatic sync signatures now include MISC and controls, and partial refreshes merge MISC rather than discarding it. Older snapshots remain supported.

Validation: `npm run check:firefox` passes 479/479 tests locally, including three new evidence/privacy/merge-bound tests. CI, merge and release status for this step must be checked separately. No release requested. This is discovery infrastructure, not completion of native parity. Next: inspect real official 2024 control evidence, establish stable character-bound source identities, then implement validated native adapters and transactional writes. No new HUD features. Movement #73 and all previously listed write/parity gaps remain open.

## Firefox v3.10.1 signing request

PR #113 merged as `7e0b558` after both Firefox CI runs passed, 479 tests. User explicitly requests merge and publication, and prefers a Mozilla-signed Firefox plugin on every update. Version 3.10.1 requests the established unlisted signing workflow; publication and feed verification remain separate until the workflow completes. No additional live gameplay claims.
