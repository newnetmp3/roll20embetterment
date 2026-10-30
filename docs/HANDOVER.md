## 2026-10-30 — DM reader returns data but verification fails (v3.10.31 candidate)

- Screenshot shows both GM-authorized Journal sheets at 0/2 despite 50% tab-count progress. Underlying error: `Preload result did not verify source ID, name and actual sheet data`.
- Debug confirms GM source `dm-journal`, 2 entries queued, Jumpgate rendering valid and official sheet Current view read, but no recognizable character values at first scan. Movement without selected controlled token is expected in a DM session and is unrelated to the importer.
- Add bounded 6-second Vue hydration wait inside the official iframe before all-tab scans; preserve cancellation and manual-sheet priority. No empty results are accepted as successful.
- Split final verification into precise failures: changed campaign, lost private reader ownership, changed Journal access, nonmatching/missing official sheet name, and lack of actual source-observed values. Failed scan diagnostics now list visited tab names.
- Add regressions for missing data and wrong-name refusal. Verify real DM session after signing; the screenshot alone cannot prove which validation failed.

## 2026-10-30 — DM official reader startup race (Firefox v3.10.30 candidate)

- User's DM screenshot after v3.10.29 cleanup fix shows two authorized Journal characters still at 0%, now with the real underlying error: `Official sheet reader did not answer`. The prior close failure was a secondary symptom.
- Root cause candidate verified in source: the editor fired a one-shot `scan` message immediately after an iframe appeared, before the official sheet reader listener was known to be registered. A late reader would miss that message, producing the 40-second timeout.
- Firefox/Chrome content scripts now match the existing advanced-sheets host regardless of path shape; the runtime still boots the reader only for verified D&D 2024 page paths. This handles Roll20 URL variants without access to additional hosts. Manual opened-sheet scans retain their previous immediate behavior; only owned Journal preloads require the new handshake.
- Editor now waits for a source-matched authenticated `ready` session before sending the first scan, sending bounded idempotent `hello` probes while the iframe initializes. An early ready event is recorded even if the Vue character name is initially empty. A conflicting established sheet name fails closed; owned reader preemption is respected.
- Diagnostics distinguish a sheet reader that never initialized (check Firefox site access for advanced-sheets.production.roll20preflight.net) from a reader that initialized but did not complete its tab scan. This is a code-level race fix; actual DM Jumpgate acceptance and extension injection still require live validation.
- Added handshake tests, regenerate userscript, run Firefox/Chrome CI and request signed v3.10.30 after merge.

## 2026-10-30 — DM-session Journal preload cleanup correction (v3.10.29 candidate)

- User screenshot confirms a DM session with two Journal character sheets at 0%, showing the same private-reader cleanup error. This is the GM-authorized exact-ID Journal path; Player Character Controlled By checks must not be substituted.
- The native opener records a verified, script-owned jQuery UI wrapper in `R3_NATIVE_BG.moved`, but preload cleanup previously searched only `dialog.closest('.ui-dialog')` and could miss its close button.
- Reuse the exact ownership-marked wrapper, with an optional verified jQuery UI close fallback; treat detached owned sessions as already closed, and never close unmarked/manual sheets. Do not report cleanup failure if no dialog was claimed.
- Preserve the original scan or opener error, rather than overwriting it with a secondary cleanup failure. This will reveal what else prevents DM NPC/PC preloading if present.
- Add regression tests, run Firefox and Chrome checks, and request a signed v3.10.29 release. Live GM-mode verification is still required.

## 2026-10-30 — protect native Roll20 controls from the preload progress strip (Firefox v3.10.28 candidate)

- **User reported a regression in signed v3.10.27:** the progress UI covered the full top of the editor, hiding the Chat/Journal tab row on the right and native Roll20 action toolbar on the left.
- Root cause: `v3/24_progress.js` used fixed `top:0;left:0;right:0` for its shadow-root overlay. It had no map/sidebar awareness. Remove that full-width rule and use a compact 420px maximum-width indicator positioned near the top of the *usable tabletop* instead.
- The geometry routine conservatively reserves the left toolbar (known DOM selectors and fallback inset) and right Chat/Journal sidebar (existing Firefox safe inset and native sidebar bounding rectangles). It recalculates on preload progress, window resize and observed native sidebar/toolbar size changes; never changes Roll20 page elements. It uses a bounded scrollable Details dropdown.
- If a narrow viewport contains no safe tabletop gap, suppress the overlay rather than block native controls; preloading and importer/Debug diagnostics continue. Preserve hide-at-clean-100%, errors/Details, DM/Player authority boundaries and all existing native-action logic.
- Add CSS/geometry regression tests for 1920px, resized sidebar, left action toolbar, narrowed viewport, non-toolbar wide headers and sidebar ResizeObserver, and validate Firefox and Chrome builds before requesting Mozilla-signed v3.10.28.
- Real Jumpgate visual acceptance remains required, especially resizable right-hand Journal/Chat tabs and vertically docked left toolbar.

## 2026-10-29 — Roster preload lifecycle hardening (Firefox v3.10.27 candidate)

- Resume from Mozilla-signed v3.10.26. Audit the Journal preload queue, top progress bar and same-document campaign reset rather than adding another parallel importer.
- When a Journal row is removed/renamed or a player loses Controlled By permission, evict the old cached snapshot and invalidate an explicitly selected read-only Journal preview. Recheck exact Journal ID/name and current authorization **after** the asynchronous official read, before caching any result. Preserve verified rows when Roll20 temporarily unmounts its Journal sidebar; those retained rows still undergo live model-permission checks.
- Preload attempts carry a generation-scoped run ID. Old responses and cleanup after a game switch cannot write errors or HP into the new campaign, release a newer queue lock, or close a newer private sheet with the same character ID. Report unavailable official private opener as a Details error instead of silently consuming an attempt.
- Reconnect the local MutationObserver when Roll20 mounts or replaces `#journalfolderroot` after startup; disconnect old observers on reset. The campaign coordinator now restores script-owned private sheet state and invalidates pending openers before clearing cached session handles; never acts on a user-opened sheet.
- Add synthetic regressions for authorization loss, temporary Journal unmount, permission revocation during a read, old-campaign request cancellation, unavailable opener and late Journal mounting. Preserve 500ms HP polling and previously intentional full-tab throttles. Run Firefox/Chrome CI, compare regenerated userscript, and request Mozilla v3.10.27 signing only after green validation.
- **Acceptance remains:** real Roll20 GM and player sessions, Vue tab mounting, owned reader cleanup and native action parity need live verification; synthetic tests cannot prove browser behavior.

## 2026-10-29 — Journal roster silent preloading and top progress indicator (Firefox v3.10.26 candidate)

- User requested fast, silent local data refresh after first import; DM preload of all authorized Journal NPC/character sheets; Player Character preload of available controlled PC sheets; and a percentage progress bar **at the very top**, auto-hiding only upon 100% successful completion, with a Details dropdown for errors.
- Source `v3/24_roster.js` discovers exact `#journalfolderroot li.journalitem.character[data-itemid]` rows and names from the actual Roll20 DM HTML. GM authority requires Roll20's boolean/numeric `window.is_gm` and an exact current Journal row; if Campaign.characters has not hydrated, DM can open *only that exact Journal row* through the native Roll20 handler. Non-GMs require exact Roll20 character model ID/name and Controlled By permission; Journal visibility alone never permits scanning or native actions.
- A bounded, serialized queue preloads authorized Journal characters using only newly created, script-owned and exact-ID-verified private official sheets. It requests all *rendered* tabs from the authenticated reader, stores game+character-ID snapshots, and attempts to close only its own marked dialog. Fails closed and reports an error instead of touching user-opened sheets. Active character imports/manual Roll20 sheets take precedence over background work; inaccessible sheets remain pending, not fabricated.
- Source `v3/24_progress.js` mounts a slim top-of-window Shadow DOM progress strip with real completed/total Journal sheet+tab units. Reader `v3/10_reader.js` reports observed planned and visited tab counts through authenticated progress messages. The progress bar **automatically disappears at 100% only when every discovered eligible sheet completed with zero errors**, reappears for new/changed entries, and retains error details otherwise.
- Journal chooser added to importer panel and Firefox click-only Profile cascade. Selecting a cached NPC/PC is an explicitly read-only source mode; native Roll20 calls are blocked in this preview, even if an unrelated same-name controlled token remains selected. A fresh token or manually opened official sheet can still take control of its respective view.
- Change signals: local journal DOM MutationObserver, periodic cheap registry refresh (1.4s), and Roll20 Backbone character collection change/add/remove listeners requeue changed character sheets without remote polling. HP-only read refresh interval improved to 500ms; existing 2s/12s heavier tab scans and source-bound dirty event throttles deliberately retained to avoid UI stalls/races. Previously imported selected PC full scans count toward progress to avoid duplicate all-tab reads.
- Tests: GM with and without hydrated character model, player permission exclusions, exact-ID preload and cache, loaded tab count %, auto-hide on clean 100%, errors in Details, model-change requeue, roster selection read-only action boundary, and existing Firefox/Chrome/legacy importer coverage. Firefox and userscript builders explicitly include both modules. Update README/architecture/roadmap; request Mozilla-signed 3.10.26 only after green branch+PR CI.
- **Known limitations:** Roll20's official Vue sheet exposes only currently mounted/rendered fields; dynamic tabs may increase planned counts. No GM-privileged API calls or invented action macros, and no guaranteed silent preload when Roll20 refuses to open an exact sheet or an original manual dialog is active. Live Roll20 DM+player acceptance remains required.

## 2026-10-29 — Production codebase audit and DM/Player Character runtime separation (Firefox v3.10.25 candidate)

- User requested comprehensive review and explicit separation of DM and Player Character paths without layering ad-hoc role checks throughout the source. Reviewed shipped v3 source, Firefox modules, build scripts, automated test tree, retained legacy src/, release process and historical documentation; audit recorded in `docs/CODEBASE_REVIEW.md`.
- Shipped runtime split `v3/23_token.js` into: shared low-level Jumpgate selection/identity/cache in `23_token.js`; verified Player Character activation and auto-reader rules in `24_player.js`; read-only visible DM sheet identification, exact-ID reader and cleanup in `24_dm.js`; `26_session.js` coordinates selected-token vs explicitly opened-sheet precedence and cross-campaign lifecycle. Mode is derived from **evidence source**, not a speculative Roll20 `isGM` flag, and marked in status/Debug.
- `25_auto.js` is the unchanged shared scan/merge engine but uses Player/DM-specific guards and reader targeting. Switching off/on a DM sheet's Sync no longer sends that session through name-only manual/private fallback.
- Fixed explicit new controlled token losing focus to unchanged open DM sheet (preserve dialog last-seen identity until close/reopen). Fixed DM snapshots being promoted to name-only player migration; new DM imports persist only under exact game + sheet character ID + matching name.
- On a same-document campaign change, clear stale `R3_NATIVE.readers`, `R3_POPOUTS`, native background reader sessions, cached character identity and local turn/layout state; invalidate generations before scanning new campaign.
- Firefox status/Debug now expose active data-source mode and correct the stale movement instructions. UI themes, original sheet tabs, click-only cascade menus, native calls, selected token safety and themes retain prior behavior.
- `scripts/build.mjs` and `scripts/lib/extension-builder.mjs` now validate the 11 explicitly reviewed v3 modules. Userscript generated from same modules; Chrome still builds from v3 but lacks Firefox-only modules. `docs/ARCHITECTURE.md` rewritten for the current implementation; release docs and test coverage updated.
- Added regression tests for DM/Player mutual exclusion and selected token precedence, DM reader exact-ID isolation, DM sync toggle scope, and DM snapshot cache provenance. Verify green full Firefox CI, PR merge, signed v3.10.25 XPI/update feed independently. Browser QA for real GM and PC campaigns remains pending; **no all-tab invisible DM reader** implemented.

## 2026-10-29 — DM visible Roll20 2024 sheet binds by dialog ID without Campaign model (Firefox v3.10.24 candidate)

- **New actual HTML inspected:** Roll20 2024 embeds the active official sheet iframe `#advanced-charsheet-dialog__charsheet` under `.characterdialog[data-characterid]`; the title is `Character sheet for <name>` and `.asv__header__name` shows the identical name. An unrelated `#charsheetSettingsIframe` and a separate standalone preload iframe also share the official sheet URL, so detection must require the **visible, exact named dialog** and reject unlabeled preload/settings frames. **Do not store or publish the user's actual character ID or name in repository fixtures.**
- Root blocker in v3.10.23: `r3TokenFollowVisibleSheet()` required `window.Campaign.characters` before considering the sheet, even though a DM may have the active official sheet visible and no hydrated character collection/Controlled By assignment. The full outer HTML does not include the cross-origin iframe interior or prove a native reader response; actual scan QA remains necessary.
- Accept a clearly visible official iframe nested under `.characterdialog[data-characterid]` when exact dialog ID is valid, the exposed frame ID matches it and the frame's observed title/header/reader name is non-generic and non-conflicting. Use the exact DOM ID **only to select and read that already open sheet**; never confer selected map-token control, GM-only API authority or an unverified native call.
- Keep the prior unique named-character-model fallback for environments without a DOM ID; reject conflicting model names and multiple candidate dialogs. A new explicitly opened sheet can supersede an old unchanged selected-token display, but a later newly selected verified token can supersede the sheet. On dialog close, expire old visible sheet state and cancel late auto-import after four stable polls (avoid Vue transition flicker).
- Read the current manual tab via the pre-existing authenticated cross-origin iframe reader; never switch a user-opened tab, move that dialog off-screen, or open unrelated sheets. Source-observed whole-sheet import without touching manual tabs remains unimplemented for a GM-only sheet; do not claim otherwise.
- Added synthetic exact-structure fixtures: DM dialog ID with absent Campaign model and saved old profile, actual auto-read and HP update, stale selected token, no ID, conflicting title/header, and close cleanup. Verify Firefox suite and userscript, merge only if green, then request Mozilla-signed v3.10.24. **Live Roll20 DM sync still requires browser confirmation.**

## 2026-10-28 — isolate campaigns and follow newly opened DM PC sheets (Firefox v3.10.23 candidate)

- **User report:** a brand-new Roll20 campaign as DM with a new level-7 Player Character still displayed Nier in the HUD. A DM may not have created/selected a token or assigned `Controlled By` to their new character; that does not mean the manually opened official sheet should show an unrelated PC. User mentioned DM HTML, but no HTML upload was visible for inspection; no unsupported DM DOM selectors were assumed.
- Root causes: `r3Load()` displayed browser-cached snapshots immediately without proving they were from the current active character; missing game IDs fell back to a shared literal `editor` storage key; `r3TokenPoll()` could retain the previous selected token indefinitely and never follow a newly opened official sheet.
- Preserve existing `roll20-embetterment-v3:<gameID>` storage keys for valid editor URLs. Prefer URL game ID, then direct Campaign ID; when neither is available, use an ephemeral per-session key instead of shared `editor`. Stage any saved snapshot as **unverified** until a real current-campaign token or sheet identity is matched; never paint previous campaign character stats, portraits or attacks on initial load.
- Add DM/manual-sheet support: if no verified controlled token is currently selected, recognize one **visible player-opened** official 2024 sheet with an unambiguous current-campaign character ID or exactly one matching character model. Generic iframe titles can use the name reported by the authenticated reader for that same window; contradictory title/reader names and duplicate character names fail closed. Display the new PC immediately with a blank/loading snapshot and import its **current visible tab** without modifying the manual sheet's navigation.
- A visible sheet is an explicit **display/read** identity, not an invented player-controlled map token. Do not execute token-bound movement, open a Journal entry, or move the user's visible sheet offscreen to read other tabs. Selecting a verifiably controlled token still activates the original source-bound private auto-import path.
- Detect a game-ID change during a same-document navigation, discard previous active token, selection IDs, cached per-character snapshots, reader targeting, UI/turn state and stale native preview; load new campaign preferences separately. Add tests for new DM campaign with Nier cache, newly opened PC sheet without token, generic title reader identity, duplicate/contradictory names, cache staging, and SPA navigation.
- Tests only cover simulated Roll20 DOM/reader models. DM HTML was not actually received, so live acceptance of the new campaign and level-7 PC requires a new browser check. No broad DM authority grants were added to original native action dispatch.

## 2026-10-28 — automatic movement independent of local turn phase (Firefox v3.10.22 candidate)

- **Actual user Debug from v3.10.21:** the previously broken Jumpgate selection is now verified on real build `775403f71ba36dde7775` (`selectedToken:true`, `nativeSelection: verified Jumpgate selection read`, source `selected.graphicId`, position `2975,2205`, page 5 ft/70px), but Movement says `Waiting for your turn` with `turn: ended`. This is the code's intentional phase gate, **not** another selection/scale failure.
- The user wants automatic selected-token movement and previously tried End Turn while testing UI. A local manual `End Turn` merely changes the R20eb action-economy marker; it does not advance Roll20's initiative. Movement tracking must no longer be silently disabled by `phase!=='active'`.
- Count source-verified controlled-token movement with native ruler / grid-rule estimate, token/page/scale checks, explicit drop or stable-coordinate polling, and deduplication **even when local turn phase is unknown or ended**. Leave `R3_TURN.phase`, Action/Bonus/Reaction and concentration unchanged; movement never fabricates a game turn.
- `Start Turn` or an observed real turn-order transition to the selected token still resets the movement total and movement baseline. Thus the movement counter means **distance since the most recent local/observed turn reset**, including out-of-turn repositioning; label that behavior clearly in R20eb's movement help and End Turn tooltip.
- Existing pending/drop accounting, lastmove waypoint/diagonal handling, negative remaining distance, character isolation, actual Roll20 sheet controls and click-only cascading menus remain unchanged.
- Added regressions: auto tracking before a manual Start Turn, continuing after local End Turn while phase stays ended, stable Jumpgate polling after End Turn, no duplicate accounting, and new-turn reset. CI, signed Firefox release and actual in-game token movement must each be verified independently.

## 2026-10-28 — restore Jumpgate selection after Webpack module relocation (Firefox v3.10.21 candidate)

- **User live Debug on signed v3.10.20:** Jumpgate build `775403f71ba36dde7775`, first-render complete, `jumpgateModuleSignature: selection interfaces differ: expected module factory absent`, `jumpgateRuntimeAttempts: 3`, `selectedToken:false`, page scale 5 ft/70px. **Confirmed root blocker:** the previously source-verified VTTEngine Webpack module ID `73210` is absent from the current registered factory map. Broadening minifier matching at the same ID in v3.10.20 could not help.
- Prefer the known verified `73210` factory when still registered. If absent/incompatible, inspect only bounded existing Webpack **function source strings** (not execution), rejecting registries over 16k module IDs, source inspections above 64MB, nonnumeric IDs, wrong export pattern, missing read-only selection getter/delegate, missing `dataWrapper.model`, or multiple matching candidates. Import **only one uniquely capability-matched** VTTEngine factory; update the selected module ID to avoid repeated registry inspection.
- Maintain first-render gate before any Webpack callback/engine singleton, perform a separate zero-argument selection getter source validation before read-only getSelection(), and still require the exact selected token graphic ID, represented Roll20 character, current player ID and Controlled By permission. There is no name/artwork-based guessing, no fabricated token coordinates, no Roll20 input mutation, and no new native roll execution.
- When the verified factory is not yet registered, permit up to three normal polling retries and record an actionable diagnostic; ambiguous/unsafe registries fail closed without invoking any module. Existing v3.10.20 event-free movement settling and click-only cascading sections remain unchanged.
- Regression tests confirm unique relocated selector in a simulated `775403f71ba36dde7775` registry, unchanged known-ID builds, missing/ambiguous candidates never executing, and first-render/read-only safety. *A simulated build hash is not proof that the current Roll20 binary still exposes the same selection methods.* The user may need to supply the current exact source bundle if Debug reports no verified selector registered.
- Required gates: green Firefox test suite and generated optional userscript check, review/merge, Mozilla-signed v3.10.21 XPI with update-feed digest. Live selected-token, 5-ft movement and manual-sheet native chat parity cannot be verified by unit tests.

## 2026-10-28 — Jumpgate movement bridge recovery and click-only cascades (Firefox v3.10.20 candidate)

- **Live user Debug:** Jumpgate build `775403f71ba36dde7775`, first page render observed, Campaign and 5ft/70px page scale available, but `Jumpgate selection interface changed; bridge disabled`, `selectedToken:false` and no token coordinate. Thus the primary regression is selector compatibility, **not** map scale or the cascading menu display.
- Replace minifier-fragile exact `getSelection()` factory string matching with bounded fixed-module (`73210`) capability checks for VTTEngine export, read-only selection delegation, selection-holder children and `dataWrapper.model`. The verified zero-argument getter is checked separately, and current player Controlled By / exact character and graphic checks remain unchanged. Report the **specific failing capability** in Debug if this Roll20 build changes beyond the supported shapes; do not execute a source-unknown module or guess a controlled character.
- Firefox movement tracker previously required a Backbone change or Fabric modified event before accounting for token movement, despite a 400ms read-only poll. Jumpgate may update an exact controlled token's coordinates without those events. A stationary confirmed token is now counted only after two additional unchanged polls, while active Fabric dragging still requires drop; movement counters never repeatedly accumulate the same coordinates.
- Same verified token ID/character/page can acquire a new scene-node or graphic model object during Roll20 rerenders. Rebind its event listeners while retaining the last confirmed coordinate baseline; reset on true identity, page or scale changes.
- **User preference:** R20eb menu sections are click-only. Removed pointerover synthetic clicks; keyboard arrow/Enter and deliberate pointer clicks still operate. Native sheet Attack/Cast/Use safety, manual sheet windows and local action economy are unchanged.
- Regression tests added for event-free stable movement, wrapper replacement, minifier format changes, unknown source rejection and absence of pointer hover dispatch. Firefox CI, real Jumpgate build matching, selected-token movement, browser UI and Mozilla signature are independent validations; **live v3.10.20 movement compatibility cannot be established from Debug fields alone**.

## 2026-10-28 — keyboard focus retention in cascading HUD menus (Firefox v3.10.19 candidate)

- Firefox v3.10.18 signed and published, update feed SHA-256 verified. Follow-up review found a keyboard regression: `r3HudRender` restored focus only to Inventory/Spells/Features summaries or verified native action buttons, but not to a **first-level cascading-menu entry**. HP/reader/native-status repaints and submenu selection rebuilt the Shadow DOM, dropping the focused category button.
- Preserve exact focused first-level entry using checked `data-hud-flyout` / `data-bf-action` / `data-bf-item` identities; restore it using `focus({preventScroll:true})` only while the same selected character remains active. Normalize absent dataset values; no dynamic selector injection, no action execution on focus restore, no focus transfer on character switch.
- ArrowLeft inside a submenu returns keyboard focus to its expanded first-level menu entry **without closing the entire menu**. Do not hijack Left-arrow when the player edits notes, search boxes, selects or contenteditable fields. Escape continues closing the R20eb menu without touching the original Roll20 sheet.
- Added behavioral unit tests for menu DOM replacement and keyboard behavior. Regenerated optional userscript; no modifications to source-bound native Roll20 Attack/Cast/Use execution paths. CI, Mozilla signature/feed and live Jumpgate keyboard QA are independent acceptance gates.

## 2026-10-28 — cascading menu HUD instead of independent windows (Firefox v3.10.18 candidate)

- **User request:** "change all windows to cascading menus." Rework R20eb-only UI; **do not** replace/move/hide the manually opened official Roll20 character sheet or other Roll20-owned windows.
- Replace the free-floating Character, Concentration, Resources, Turn notes, Combat flyouts, settings and Debug displays with one context-aware **taskbar-anchored menu stack**. First-level rail lists Attacks, Features, Spells, Inventory, Skills, MISC, Resources, Character, Concentration, Notes, Status, Importer, Debug, Settings. Only the active branch appears. The native-action confirmation is also a branch; opening a menu never executes a native sheet action.
- **Hierarchy:** Attack types and weapon variants, spell levels and spell lists, expandable Inventory/Feature rows, Debug sections and settings are nested in the selected branch. Click or hover an unopened first-level branch; keyboard Tab/Enter/Space, Right to open, Up/Down to navigate and Escape/Left to close are supported. Navigation events are constrained to R20eb's Shadow DOM.
- **Placement:** compute one floating menu-stack anchor from the current Left/Right/Top/Bottom dock and visible browser size, clamping to the Roll20 chat/sidebar inset. Ignore obsolete saved drag positions for children of the menu stack. Preserve taskbar drag/orientation, action economy, native source/session/ownership validation, character-switch state, expanded card focus and scroll.
- The existing Importer DOM and reader remains alive: visually place it as a branch without destroying or remounting the importer while typing or scanning. Debug's logs/actions and Theme Manager are preserved inside the menu, not removed.
- Win9x and all named modern themes remain scoped to R20eb; no CSS applied to Roll20 itself. Added cascade layout/navigation regression tests and updated old floating-window expectations. **GitHub CI, Mozilla signed v3.10.18 XPI/feed/hash and live Floorp/Jumpgate visual & native action parity remain separate acceptance gates.**

## 2026-10-28 — expanded list/focus preservation on HUD native status repaints (Firefox v3.10.17 candidate)

- Static review identified a real regression in the v3.10.16 compact list feature: \`r3HudRender\` captured expanded \`details.hud-card\` only when the obsolete \`.hud-body\` was present. The active battlefield \`.hud-flyout\` lacks that container, so native status updates or HP/auto-import repaints could collapse open Inventory, Spell and Feature details even while the list's scrollbar remained stable.
- Snapshot expanded row keys directly from the live HUD regardless of legacy \`.hud-body\`, but restore them **only for the same controlled character and same flyout/weapon/spell-level view**. Character switches, category navigation and level changes clear old expansion state, so one character's controls cannot accidentally appear focused in another's list.
- Preserve keyboard focus for a focused list \`summary\` or verified \`data-hud-native-kind/key\` action across non-navigational repaints using exact data-key matching and \`focus({preventScroll:true})\`. Focus restoration does not execute the action, alter resource counts, or touch Roll20's own sheet, chat or map.
- Add behavioral regression tests with a simulated replacing Shadow DOM for expanded cards, vertical/horizontal flyout scroll, native-action button focus, character-switch and flyout-change isolation. These tests cover HUD behavior, **not** actual Roll20 native gameplay parity. CI, Firefox signing and update-feed digest verification remain independent release gates.

## 2026-10-28 — compact Inventory, Spell and Feature lists / native control clarity (Firefox v3.10.16 candidate)

- User screenshot showed a four-column **Inventory tile grid**, with long expanded descriptions crammed into ~150px widths, and the repeated "Native unmapped" label on every ordinary item. Follow-up explicitly requests the same list treatment for **Spells and Features**.
- Replaced these three flyouts with **one full-width, scrollable, expandable row per imported item**. Collapsed rows display a short name, item category and useful quantity/level/uses metadata. Expand a row for complete observed text and item controls; existing `details.hud-card` expanded-state restoration and flyout scroll restoration still operate. Attack groups, skills, resources and the taskbar are unchanged.
- A **Cast / Use / Roll** button is displayed directly on the list row only when `r3NativeMapPreview` finds a real character-bound Roll20 sheet macro or one uniquely source-observed executable official sheet button. This reuses the existing `data-hud-native-kind/key` click dispatcher and character identity, native reader/session/token checks. Do not promote "Show More", quantity steppers, headlessui equipped switches, feature descriptions or observed resource counters into actions.
- **No repeated "Native unmapped" label for ordinary passive records.** If a row has no verified executable native control, its expanded detail explains what category of action could not be verified and retains the precise internal reason in a tooltip. This is a reporting/affordance repair, not a claim that Roll20 magically exposes item-use controls. Native spell casts and consumable use remain unavailable when the official sheet does not expose any suitable button or macro in the authenticated import.
- Regression tests cover full-width single-column lists for all three sections, inline native action controls with existing real Roll20 macros, no fake Cast for Show More, inventory quantity/equip preservation, no native trigger for view-only items and theme-safe CSS. **Automated tests/CI, signed Firefox XPI/feed and live Jumpgate action parity are separate acceptance gates.**

## 2026-10-27 — single-column vertical toolbar + action-used checkboxes (Firefox v3.10.15 candidate)

- User supplied screenshot showing Left dock as a **174 px wide, two-column mess**, with Action/Bonus/Reaction/Movement squeezed into a grid, Dash/Disengage/Hide beside it, two-column ability menus and a full multi-line status block. Corrected **both Left and Right orientations** to a fixed **66 px single-column toolbar**, one independently clickable icon and short caption per row, similar to Roll20's own vertical toolbar. The six character category buttons and three optional quick actions also stack one per row, with no paired columns. Vertical layout scrolls only if necessary.
- Replaced visible `Ready` / `Spent` for **Action, Bonus and Reaction** with **accessible checkbox-style status buttons** (`role=checkbox`, `aria-checked`). **Unchecked = available by default; checked = used**. Existing `data-turn-action` events toggle the same local action-economy model; the next observed turn resets them. A used box does **not** mutate Roll20 action resources or claim that a sheet action was executed.
- Narrowed vertical Movement to a short remaining-feet value. Replaced the oversized stacked HP/AC/move/status text with one small **HP tile**. Click it for a detail panel beside the toolbar showing the full character, HP, AC, movement, turn and any native action status. Bottom/Top retain the wider horizontal status strip. The settings **⋯** button sits at the end and remains reachable, including when optional sections are hidden.
- All visual changes use selectors scoped to R20eb's Shadow DOM and maintain BG3, Tokyo Night, Oh My Posh-inspired and Windows 9x styles. Manual character-sheet visibility, native action mapping, user preference persistence, independent panels and Roll20 toolbar remain untouched.
- Added layout/checkbox/detail tests for both vertical orientations. PR CI, Mozilla signing, feed checksum and live Floorp screenshot QA remain distinct release gates.

# R20 Embetterment — development handover

**Updated:** 2026-10-27  
**Repository:** https://github.com/newnetmp3/roll20embetterment  
**Branch:** main  
**Workflow:** feature PR → `npm run check:firefox` → green GitHub CI → merge → Mozilla signing → signed XPI and update-feed verification.

## 2026-10-27 — taskbar/status bar + right-click customization (Firefox v3.10.14 candidate)

- User requested a **taskbar/status-bar-style HUD** with right-click orientation and per-element show/hide controls. Existing two large action/category blocks and scattered stats occupy too much Roll20 canvas.
- New unified **R20eb taskbar** wraps Action/Bonus/Reaction/Move indicators, the six action-category menus, and a narrow status line with verified character name/HP/AC, movement allowance/remaining, turn phase and native action progress. The separate panels (profile, concentration, resources, notes, turn strip, flyouts, Debug) remain independently movable. Action controls still use existing native action routes.
- **Right-click any part of the taskbar**, or select its always-visible **⋯ Taskbar settings** button, to open an accessible context menu. Orientation choices: Bottom, Top, Left and Right. Per-section checkboxes show/hide Character, Concentration, Resources, Turn notes, Turn controls, Action indicators, Quick actions, Category buttons and Status bar. Reset panel positions remains available. The settings persist in per-game battlefield schema 2; schema 1 notes/sidebar settings migrate. Invalid stored section/orientation values are ignored.
- Dock orientation changes clear only a previously dragged taskbar position (not manually placed character panels). The unified taskbar itself can still be dragged or nudged via Alt+Arrow, and clamps to the viewport. Right docking reserves the Roll20 chat/sidebar inset. Old independent action/category positions are ignored by the new grouped layout. Menu is dismissed with Escape or outside click, without hijacking the Roll20 map's normal context menu.
- Status and context menu colors follow the selected BG3, Tokyo Night or other palette; Windows 9x retains classic gray beveled context styling. Context controls are isolated to R20eb's Shadow DOM and never hide, navigate or move a manually opened official Roll20 sheet.
- New tests cover dock markup, all four edges, visibility persistence and legacy migration, context menu scoping, drag grouping, theme hooks and guaranteed access to settings even when every optional section is hidden. **CI/Mozilla signing and live screenshot QA are separate checks.**

## 2026-10-26 — fast progressive sheet imports (Firefox v3.10.13 candidate)

- User goal: after selecting a controlled token, attacks, features, spells, inventory and resources should appear and map to *verified* native sheet controls as quickly as Roll20 exposes them, instead of waiting for a long all-tab traversal. **Near-instant is a perception target, not a guaranteed latency**: Roll20 iframe/Vue startup and network latency remain external.
- Reader now visits **Combat → Features & Traits → Inventory → Spells → Skills & Tools** ahead of numerous nested filters. It captures the initially active view first, reports each primary tab, defers secondary views until after primary content is available, and restores the original private-sheet tab. No manually opened sheet receives automatic tab clicks.
- Adds a source-authenticated, request-ID/window-bound `progress.snapshot` for at most the useful primary tabs; avoids repeatedly serializing accumulated inventories/controls for every secondary filter. The editor accepts it only for a matching pending **all** scan and exact existing frame. The auto importer validates selected controlled character ID, authenticated private ownership, generation, and snapshot character name, then uses non-destructive `r3AutoStoreSnapshot(...,'current')` to publish Combat and resource actions early without erasing fields from other tabs. End-of-scan full replacement and inventory zero/prune semantics are preserved.
- First private reader ready announcements change from 1500ms to 500ms; the auto scheduler changes from 8000ms to 3000ms (one-second HP watch unchanged), with startup retry from 1600ms to 180ms. Token selection already schedules an immediate guarded `r3AutoTick`.
- Progressive updates do not execute or invent actions, alter Roll20 resources, change saved character identity, or claim full-import success before the final scan. Native actions still require real observed controls and session-scoped one-shot verification. Queued early clicks continue waiting for the reader's active tab traversal to finish to avoid clicking a moving DOM.
- New regression tests for primary tab priority, early resource visibility, restored original view, spoofed cross-origin/window progress rejection, stale post-result rejection, partial-then-final import and selected-character identity protection. **Live Firefox/Jumpgate timings and attack chat parity still require verification.**

## 2026-10-26 — native Attack nonresponse follow-up (Firefox v3.10.12)

- User screenshot: imported Nier attack cards correctly render real **Attack** buttons and label **Native sheet**, yet clicks produce no visible Roll20 attack. Previous build had automatic hidden-reader ownership but did not guarantee that the all-tab importer could recognize its candidate; `r3AutoCandidate` demanded a matching iframe title, which may remain generic even after the script creates an exact-ID private dialog.
- Fix: prioritize an existing script-owned `r3NativeBgCandidate` by exact controlled character ID and expected owner name, cross-check an authenticated reader name when available, and **never accept contradictory authenticated identity**. This supports full private import without relying on Roll20's iframe `title`; manual same-name sheets stay unclaimed.
- A player Attack issued during the full private import is now bound first to a verified selected character ID, then rebinds to the freshly captured attack metadata when the scan completes. Revalidate source key/name/ID again before the one-shot native click; source disappearances or token switches abort. Pause subsequent HP scans while a native action is pending.
- Give the Attack flyout a **fixed-height, ellipsis-truncated, tooltip-accessible native status line in its titlebar**. Native-control lookup errors and successful acknowledgements appear immediately without moving the Attack-list scroll. The Debug Native log retains full text.
- Regression tests: generic-iframe-title exact-ID owned sheet, mismatch of authenticated reader name, refreshed imported attack during queued click, visible top-bar status and prior safeguards. No claim that a mocked reader proves actual Jumpgate chat parity; install signed v3.10.12 and compare Dagger Standard/Off-Hand against the original sheet. Retain manual-sheet noninterference.

## 2026-10-25 — selected-token private sheet and native Attack reliability (v3.10.11)

- Selected controlled token now automatically enables ID-pinned private full-tab import even if an older setting stored Auto-sync Off. No setup toggle is required for normal Attack use.
- Keep extension-created character dialog offscreen and reuse its authenticated reader; periodically rescan and refresh stats, attacks, features, spells and inventory.
- A native Attack clicked during full-sheet import waits for that import, rechecks character/source identity, and retries only read-only inspection while the official Vue button mounts. The actual native Roll20 button is clicked once, never retried on an uncertain acknowledgement.
- Preserve strict manual-sheet boundaries: never hide, reposition, switch tabs on, or take ownership of a player-opened character sheet. A same-character manual dialog may prevent Roll20 from creating a second one; use its current view without changing tabs and surface missing native controls clearly.
- Automated tests cover stale Off migration, token changes while waiting, queued attacks, and the existing private reader safety conditions. Real Roll20 chat parity remains a live acceptance check.

## 2026-10-25 — attack button must preserve weapon-list scroll (Firefox v3.10.10 candidate)

- User report: clicking an **Attack** button while scrolled down the attack menu moves the list to another position. Cause: `r3NativeStatus` increments HUD revision and calls `r3HudRender`, replacing the Firefox `.hud-flyout` DOM, but the old HUD scroll preservation only handled `.hud-body` (legacy renderer). The native status was also prepended before attack rows and shifted their visible position.
- Fix: record `.hud-flyout.scrollTop` and `.scrollLeft` before replacing markup when flyout/chooser/weapon mode/group have not changed; restore after drag positioning and expanded-card state. Put native attack progress/status **after** the attack list rather than ahead of the weapon cards. Every native operation status update now keeps the same viewport; deliberate category/weapon changes open a fresh viewport.
- Regression test uses the actual `data-hud-attack-key` click path, repeated `r3NativeStatus` updates, left/top viewport preservation, stable attack-list ordering, and intentional mode-switch reset. This is a UI-only fix: sheet action mapping, reader permissions, automatic private reader, chosen Theme Manager theme and original Roll20 remain unchanged.
- Candidate needs green Firefox CI, Mozilla signing and XPI/feed checksum verification. Live Roll20 player test required: scroll to a lower weapon, click Attack, confirm list does not jump while native control resolves or after chat roll.

## 2026-10-25 — BG3 restored + Oh My Posh-inspired Theme Manager (Firefox v3.10.9 candidate)

- **Request:** restore Baldur's Gate 3 fantasy look while keeping the recent Windows 9x styling selectable, and build a Theme Manager from Oh My Posh palettes with special attention to Tokyo Night.
- Added `extension/firefox/theme-manager.js`, loaded before Debug and battlefield via the Firefox builder. Theme Manager is under **Debug → Theme Manager** and offers instant visual previews and accessible theme-choice buttons. Default is **Baldur's Gate 3** for unconfigured browsers. Selection is stored globally in `r20eb:ui-theme:v1` (across campaigns/characters), validated against built-in IDs, and restored at startup. Invalid stored themes fall back to BG3.
- Seven themes: **BG3** (dark leather/gold fantasy); **Tokyo Night Storm** (official Oh My Posh `tokyonight_storm` palette `#24283b`, `#7aa2f7`, `#bb9af7`, `#9ece6a`); **Catppuccin Mocha**, **Dracula**, **Gruvbox Dark**, **Nord Frost** (curated Oh My Posh–inspired variants); **Windows 95/98** (preserved full beveled CSS).
- Switching themes updates only `#r3-theme-style` inside R20eb's Shadow DOM. It does **not** rebuild attack panels, touch Roll20's native sheet/chat, move HUD panels, perform a game action, or fetch untrusted remote CSS/fonts. Debug gallery, profile, token rings, spells/attacks/features/inventory, importer and notes all share a palette. Win9x styles are no longer unconditional.
- Tests for default BG3, exact Tokyo Night palette, whitelist/persistence, all seven presets, gallery accessibility, no network CSS/HTML, unchanged native actions/layout on switch, module bundle order and theme CSS isolation. Existing native Roll20 mapping is unchanged. **CI, Mozilla signing and real-game visual QA remain separate acceptance gates**.

## 2026-10-24 — Windows 9x contrast polish (Firefox v3.10.8 candidate)

- Expanded native action cards, resource chips and status tiles inherited dark styles behind new black text. Add explicit light backgrounds and black text to expanded card bodies, title/subtitle, skill rows, feature/spell tags, portraits, HP values, class/resource panels and bar icons. Preserve navy caption contrast and chat-safe placement.
- Regression check now requires the affected panel overrides. No Roll20 action logic changes beyond v3.10.7. Firefox v3.10.8 must still pass CI, get Mozilla signature and update feed/hash verification; real-game visual QA remains open.

## 2026-10-24 — Windows 9x usability and native sheet-action expansion (Firefox v3.10.7 candidate)

- **Request:** deliver a usable, compact Windows 95/98-style UI and map interactive actions to the exact official Roll20 sheet controls, ideally before October 25. Implemented a uniform **silver #c0c0c0 bevel / navy #000080 titlebar / Tahoma system font / white inset list** theme over HUD rings, combat categories, flyouts, weapon submenu, cards, Debug, importer and original-sheet controls, retaining drag/layout/monitor/chat inset and reduced-motion settings.
- Extend source-observed native sheet bridge: **features with one explicit numeric dice button** (e.g., official Second Wind `1d10+5` in a Combat/`Current view` card) now use that exact official button via the same permission-checked reader and single-use action token. UI says **Roll**, not Use, to avoid falsely claiming a feature charge/resource was spent.
- When a controlled character's official sheet exposes an exact `Roll a NAME saving throw` or `Roll a NAME ability check` button, include saves/ability checks in source-verified native dispatch, using precise matched button captions. Keyed numeric values alone do not create actions. Attack, skill, item and explicit Cast/Use controls continue previous source/macro-first routes.
- User export `r20eb-v3-Nier(5).json` confirms **20 imported attacks**, three observable feature dice buttons (Elixir of Health, Drink Potion of Greater Healing, Second Wind), and 18 standard skill check labels. It does **not** expose executable Cast controls for Druidcraft, Detect Magic or Lesser Restoration—only `Show More`—nor verify Action Surge usage, resource mutation or a saving throw control for that character. Preserve clear **Native unmapped** states, no speculative API, source edits or dice fallback mislabeled as native.
- Native trigger probes confirm exact character ownership/session/source/row/label, reject duplicate/disabled/moved controls, and invoke the real Roll20 element **once**; no retries after invocation uncertainty. Visible manually opened sheets are never hidden/switched; private readers stay automatic.
- Added regression tests for feature dice roll vs expansion, ambiguous/disabled controls, observed saves/ability checks, no replay and Windows 9x themed panels. **Signing and real in-game Roll20 parity must be verified separately.** Candidate version 3.10.7 is not considered released until GitHub CI, Mozilla signature, and update feed/XPI digest checks pass.
- Acceptance: install the signed Firefox version, reload Roll20, click Dagger Standard/Finesse/Off-Hand and Second Wind (compare native 2024 chat cards), ensure resource effects aren't implied, inspect spell availability, check manual Journal sheet remains fully usable and verify UI on target monitor resolution. No user setup toggles.

## 2026-10-24 — native Attack execution repair (Firefox v3.10.6 candidate)

- Screenshot shows all **Native sheet** attack buttons displayed but not executing. The exact visible failure string is `Your original Roll20 character sheet takes priority`, originating from the private-reader guard in `r3NativeBgOpen`; this means a reader cannot be opened under existing manual-sheet priority, not that a sheet click succeeded.
- The previous user export contains 20 attacks including Dagger variants, all with `tab: Current view`, source-verified numeric hit buttons, and no explicit native macro references. Old `r3NativeAttackControl` rejected every such action if the live Jumpgate sheet also lacked an active `Combat` tab marker.
- With an unclassified **Current view**, now permit an attack only when the unique mounted source row has the exact imported name, bonus, damage and a matching numeric `+N Attack` hit button. Explicit non-Combat tabs, stale metrics, duplicate rows, generic Roll Attack captions, and damage buttons remain blocked.
- Background readers no longer attempt to change tabs if this exact attack control is already verifiably mounted. Player-opened sheets are never navigated.
- Follow-up requirement: **private readers are always enabled without user toggles**. The prior sticky `manual-sheet-priority:v1` setting is discarded at startup. The Attack flyout, Debug window and battlefield remove the "enable private reader" action. Visible player-owned sheets remain untouched; trusted Journal opening cancels private traversals and briefly defers fresh private opens (three seconds) before automatic resumption.
- New regression tests cover exact mounted native attack on an unclassified tab, mismatched/importless evidence rejection, no damage-button substitution, automatic reader access and restoring original sheets without persistent opt-out. **CI, signed release and actual game parity are separate verification gates.** Request Firefox 3.10.6 signed only after PR CI succeeds. Verify the release/feed hash afterward.

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
  Debug Show Sheet now only restores visibility and briefly defers new private sessions; it never creates a sticky private-reader opt-out.
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
6. A private reader may load when the sheet is closed, using the existing controlled-character opener. A player-opened sheet is never hidden or navigated. If it is on another tab, an attack may require the player to return to Combat. Original-sheet access temporarily defers new private loading, then it resumes automatically without a toggle. Automatic full scans pause during native requests.

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
