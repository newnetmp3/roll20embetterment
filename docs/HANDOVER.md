# R20 Embetterment — development handover

**Updated:** 2026-10-24  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Branch:** main  
**Workflow:** feature PR → `npm run check:firefox` → green GitHub CI → merge → Mozilla signing → signed XPI and update-feed verification.

## 2026-10-24 — Roll20 ruler-based movement (Firefox v3.10.5 candidate)

- User prefers the **feet displayed by Roll20 while dragging a token** instead of continuously summing over-precise pixel-coordinate changes. Jumpgate offers `Always measure token movement` and Roll20's ruler can use grid-specific diagonals.
- The Firefox tracker now collects a **single exact feet readout** when Roll20 exposes an identifiable visible measurement label, carries it through the drag, and applies it at token-drop/confirmed model change once. It does not sum intermediate ruler previews; it still follows only the currently verified controlled token and respects the active turn.
- **Important renderer limitation:** Jumpgate may draw the distance text inside Babylon/WebGL canvas, not DOM. A canvas-only label cannot safely be read this way; when absent, the tracker uses **whole page-grid squares and Roll20's configured diagonal rule** (5E/foure, Manhattan, 3.5E alternate, Euclidean) rather than an unrounded pixel distance. A gridless/unresolved page does not invent a distance. This fallback is explicitly labeled `Roll20 grid-rule estimate` in Debug, not a native measurement.
- Waypoints and backtracking count as separate path legs; 5-ft grid jitter is not overcounted; a drag is committed once and current allowance can still go negative. Manual +/-5-ft corrections remain.
- Automated regression tests cover display priority, ambiguity/hidden measurements, diagonal modes, movement preview/drop, replay, gridless rejection, token changes, no double-counting and existing safety. **CI, Mozilla signing and live Roll20 Jumpgate acceptance are pending** until released. The exact DOM form of Jumpgate's ruler still requires a real drag capture. Do not claim the native ruler value is always obtainable or movement issue #73 resolved.

## 2026-10-24 — verified signed Firefox v3.10.4 release

- **PR #116 merged** as `e159dfe` after successful push and PR Firefox CI; **500/500 tests passed** and generated-userscript parity was clean.
- [Firefox v3.10.4 XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.10.4/r20eb-firefox-v3.10.4.xpi) published as Mozilla-signed; [release run 40069003914](https://github.com/newnetmp3/roll20embetterment/actions/runs/40069003914) succeeded.
- Release asset and [update feed](../extension/firefox/updates.json) both advertise SHA-256 `b18b09d2c5141b58cf11cf82c593f7b3f8fe07a69affd3ee298f0a4e008a57c4`; version and URL agree. Firefox v3.10.4 is the current signed baseline. Chrome and optional userscript remain v3.4.0.
- Actual Roll20 2024 Cast/Use button exposure, gameplay prompts, side effects and two-character behavior still need **live Floorp verification**. The October 22 import does not contain Cast/Use control evidence and cannot prove gameplay parity.
- Next: refresh an all-tab export on v3.10.4, compare native sheet and HUD attack/skill clicks; identify true Cast/Use controls and versioned save/tool/action contracts before wiring any state mutations. Jumpgate movement #73 stays unresolved.

## 2026-10-24 — source-observed Cast/Use card adapter (Firefox v3.10.4 signed; live QA pending)

- Add a strictly conditional official-sheet click path for **Spells / Cast**, **Features / Use or Activate**, and **Inventory / Use or Activate** when an imported named card itself exposes one explicit matching button. Generic `Show More`, damage, equip and quantity controls are **not** action mappings.
- Source evidence must have one explicit eligible card control and an unambiguous imported card name. The authenticated live reader rechecks character name, tab, named row, optional stable repeating-row ID, bounded source card text, exact visible enabled button, and a single-use session-bound token. Changed/duplicate/disappearing rows fail closed; no retry after click.
- Only R20eb-owned private readers may switch tabs to find the recorded action. Player-opened dialogs/popouts remain on their current tab, and other-character source actions never execute. Existing safe macro mapping continues to take precedence.
- Source/reader regression tests cover one click across three card families and rejection of details, disabled/duplicate controls, changed rows and manual-tab navigation. **CI and live Floorp QA remain separate.** The prior user export showed spell details/Show More only, so it does **not** verify any castable spell; this adapter makes no claim of observed cast/use coverage for that export.
- Firefox 3.10.3 signed feed already published (commit `e81e0fb`, update hash `8814e2781c3c779f9ef3203aa13b515aace80cbd2f9f701481ddd6ef2f09e1dc`). Firefox 3.10.4 is a candidate until CI, merge, Mozilla signing and update-feed verification finish. Chrome/userscript versions remain separately 3.4.0.

## 2026-10-22 — automatic private all-tab import (Firefox v3.10.3 candidate)

- User requirement: import the official D&D 2024 tabs automatically in the
  background, without requiring manual sheet opening or disturbing normal
  Roll20 sheet controls.
- A selected, verified **Controlled By** character now reuses the existing
  Roll20 model `showDialog` / exact Journal fallback from the native-action
  background opener. It creates a separately owned private reader rather than
  relying on the sidebar's Journal DOM. After identity checks, the initial
  private scan uses `all` and subsequent full scans retain a five-minute gate.
- Auto-sync prefers its own private reader over a player popout; it **never**
  changes the active tab of a player-opened dialog or popped-out sheet. Manual
  sheets continue current-tab/HP reads. Existing ownership, identity,
  generation and read-only guards remain.
- A trusted user Journal opening sends `cancel-scan` to any owned in-flight
  all-tab reader before releasing its dialog/overlay. It introduces a short
  grace period for manual opening, not a permanent opt-out; explicitly chosen
  Debug restore/private-reader restrictions still remain sticky.
- Source tests added for the no-Journal initial full scan, cancellation during
  tab traversal and manual-priority lifecycle. **CI and live Floorp QA pending**
  at branch creation; version 3.10.3 requested for signed publication only
  after green PR CI and merge. Verify the signed XPI/feed separately.
- Known Roll20 constraint: if Roll20 reuses the same singleton dialog instead
  of creating an independent one, R20eb refuses to claim player-owned DOM and
  cannot force a separate private session. Virtualized/unmounted rows remain
  outside guaranteed coverage. Export after live testing, and never equate a
  raw 750-control limit with all native calls discovered.

## Verified baseline and current candidate

- Historical baseline for this handover slice: **v3.10.2**, Mozilla-signed; release/feed SHA-256 `e5af5d63fda9b00d1c2a576a15a0643bf3113e5351c3514aa966a0e61c1dec74`. Signing run [39871351495](https://github.com/newnetmp3/roll20embetterment/actions/runs/39871351495) succeeded. PR #114 merged as `5f2ce53`; feed commit `8f15eab`.
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
