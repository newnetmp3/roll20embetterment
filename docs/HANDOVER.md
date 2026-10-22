# R20 Embetterment — development handover

**Updated:** 2026-10-22  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Branch:** main  
**Workflow:** feature PR → `npm run check:firefox` → green GitHub CI → merge → Mozilla signing → signed XPI and update-feed verification.

## Verified baseline and current candidate

- Published Firefox baseline: **v3.10.2**, Mozilla-signed; release/feed SHA-256 `e5af5d63fda9b00d1c2a576a15a0643bf3113e5351c3514aa966a0e61c1dec74`. Signing run [39871351495](https://github.com/newnetmp3/roll20embetterment/actions/runs/39871351495) succeeded. PR #114 merged as `5f2ce53`; feed commit `8f15eab`.
- Current functionality: **Firefox v3.10.2**, native sheet-click attacks/skills and control-discovery fixes. Local Firefox check and both PR CI runs passed **492/492 tests**. Release validation, Mozilla signing, XPI publication and update-feed publication all succeeded; live gameplay acceptance remains pending.
- Chrome and optional userscript metadata remain **v3.4.0**. Firefox version is independent.
- User wants **signed Firefox builds on every update**, with merge/publication authorized in this workstream. Keep verifying each signed release and feed before handing it over.
- [Movement issue #73](https://github.com/newnetmp3/roll20embetterment/issues/73) remains OPEN; no live forward/backtracking acceptance.

## Evidence from the latest user export

The 2026-10-22 export contains 20 attack entries, 35 inventory items, 34 features, 3 spells, 18 skills and 4 resources. Its 1,056 control observations include repeated persistent controls across views; this is not a count of unique native calls. No explicit native macro reference was captured. Every scanned view reported the previous 750-DOM-candidate cap; Inventory had imported items but no inventory-category controls in the global inventory.

The global scanner capped raw candidates before filtering hidden nodes. That starved later visible controls. The fix examines up to 12,000 candidates but budgets 750 visible controls per view, with a separate 1,500-record merged cap and explicit truncation notes. Revisited views replace their control records; all-tab initial capture uses the actual active tab. Generic named inventory rows now provide owner context, standard skills have a category, range inputs are counters, and tab labels are retained. No user export or character-specific IDs are committed.

## Current native execution

1. Prefer an existing verified controlled-character ability or a complete explicit character-bound native macro. Category/source/ownership checks remain in place. These macros can run with the sheet closed through Roll20 chat; unsent chat drafts are preserved.
2. If no macro mapping exists, **supported source-observed attack-hit and standard skill buttons** may use the official sheet DOM. Imported evidence enables a candidate button labelled **Native sheet**. Only an explicit player click begins discovery, followed by a session-bound probe and one-time invocation token.
3. Attack matching requires the exact source name and observed hit/damage metrics, one live matching row and one attack-hit control. Duplicate indistinguishable rows are blocked. Damage buttons never satisfy attack-hit matching. Missing or changed metrics invalidate the request.
4. Skill matching requires one of the 18 standard skills and the exact observed `Roll a <skill> check` button. The live reader must find exactly one visible enabled button. No generic caption is converted into a macro or private action ID.
5. Character selection, Controlled By permission, source data, reader session and ownership are rechecked after asynchronous preparation. No invocation retry occurs after a missing response or transport failure. A changed session's response cannot resolve the pending request.
6. A private reader may load when the sheet is closed, using the existing controlled-character opener. A player-opened sheet is never hidden or navigated. If it is on another tab, an attack may require the player to return to Combat. Manual sheet priority still blocks private loading until explicitly re-enabled in Debug. Automatic full scans pause during native requests.

For the supplied export, **19/20 attack entries and 18/18 skills qualify as candidates**. This is source-evidence coverage, not successful gameplay verification. The remaining attack entry exposes a saving-throw effect rather than a hit-roll button. Spell observations show details/expansion controls, which do not establish a cast action.

## Remaining gaps

- General native cast/feature/item-use DOM controls, tools, saves and ability-check adapters beyond existing exact macro mappings.
- Saving-throw effect actions, separate damage/critical controls, target selection, advantage, upcasting, concentration and charge/slot side effects need verified source contracts and live parity tests.
- Inventory quantity/equip/attune, HP/current/max/temp, slots, resource counters and conditions remain **read-only**; transactional native writes require ownership, revision protection, authoritative re-read and failure reconciliation.
- Unexposed Advanced Tools identifiers and arbitrary/compound/API/selection-dependent macros remain unsupported.
- The exporter does not enumerate unmounted or virtualized controls. Reaching a cap is reported, not treated as complete discovery.
- Jumpgate movement #73 remains unresolved in live gameplay.

## Runtime and constraints

- `v3/00_capture.js`: bounded read-only DOM capture, cards and control evidence.
- `v3/10_reader.js`: authenticated official iframe/popout bridge and tab traversal.
- `v3/20_ui.js`: importer, diagnostics and snapshot export.
- `v3/21_native.js`: macro mapping, validated sheet-click adapters and reader ownership.
- `v3/22_hud.js`: movable combat HUD and native capability labels.
- `v3/23_token.js`: selected character/page introspection with Jumpgate startup guards.
- `v3/25_auto.js`: character-scoped synchronization and manual-sheet priority.
- `v3/30_boot.js`: startup.

`src/` is historical: do not modify it for current Firefox work. `roll20-embetterment.user.js` is generated by `npm run build`, never hand-edited. Use current `window.Campaign` character data; do not restore `window.d20.Campaign` dependencies or eagerly construct Jumpgate engines. Keep UI compact, draggable, chat-safe, with one Debug entry and no notification overlays. Finish native integration before further HUD features.

## Next acceptance step

Install the signed candidate, reload Roll20 and refresh the import. Compare an Attack and a skill Roll from the HUD against the corresponding official sheet clicks, including resulting chat cards. Test a second character and duplicate names; ensure each explicit click produces at most one roll. Verify closed-sheet/private-reader startup, manual sheet visibility and no unwanted tab changes. Export a new all-tab snapshot to confirm inventory control coverage after the hidden-node fix. Then extend source-grounded adapters to the remaining control families. Never describe unit/bridge mocks as live Floorp validation.

## Release verification — v3.10.2

[PR #114](https://github.com/newnetmp3/roll20embetterment/pull/114) merged after green CI runs 39871304886 and 39871279452. Release run 39871351495 completed successfully, including signed-XPI validation and feed publication. The [signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.10.2/r20eb-firefox-v3.10.2.xpi) URL, version and SHA-256 match `updates.json`. Next user check: compare a HUD attack and standard skill roll against the actual sheet results, then export all tabs to confirm Inventory discovery.
