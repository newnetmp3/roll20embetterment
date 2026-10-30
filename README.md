# Roll20 Embetterment (R20eb)

Player-focused D&D 2024 combat HUD and read-only Roll20 sheet companion. R20eb uses existing player-controlled character data to present attacks, spells, features, inventory, resources, skills, saves and ability checks in a compact taskbar and cascading menus. **It is not a replacement for the Roll20 character sheet, and not every observed control is natively callable.**

## Installation and current versions

| Distribution | Status |
| --- | --- |
| **Firefox / Floorp** | **v3.10.27** Mozilla-signed and published; v3.10.28 tabletop-safe progress under validation |
| **Chrome / Chromium** | **v3.4.0**; independently versioned and not feature-parity guaranteed |
| **Optional userscript** | **v3.4.0** metadata; built from `v3/` independently of Firefox releases |

- [Firefox v3.10.27 signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.10.27/r20eb-firefox-v3.10.27.xpi)
- [Firefox updates.json](extension/firefox/updates.json)
- [Firefox installation and signing guide](extension/firefox/README.md)
- [GitHub Actions](https://github.com/newnetmp3/roll20embetterment/actions)

Disable any previous R20eb userscript or duplicate extension when using the signed Firefox add-on. Keep the native Roll20 chat panel accessible when running actions; R20eb does not overwrite an unsent chat draft.

Firefox v3.10.27 is published as Mozilla-signed and referenced by the update feed. The release asset digest matches the feed hash. Live Roll20 gameplay acceptance remains separate.

## Playing as a DM vs Player Character — source-aware modes (v3.10.25 signed)

R20eb separates **data-source modes** rather than guessing that a Roll20 account is a GM. A selected, explicitly controlled token activates **Player Character** mode with source-verified movement and character-specific private sheet import. Opening a uniquely identified official 2024 sheet without an active controlled token activates **DM Sheet · Read-only** mode, with automatic import of its **current visible tab** and no inferred map-token control, privileged DM operation or tab switching. Unbound mode displays no unverified historical character. The status bar and Debug show the active mode.

The shared reader and HUD remain common; code responsibilities are divided into `v3/23_token.js` (verified Jumpgate and cache), `24_player.js` (player-owned token/session), `24_dm.js` (opened DM sheet and safe reader), `25_auto.js` (read-only scan engine), and `26_session.js` (sole coordinator). Both bundlers compile these modules in explicit order. See [current architecture](docs/ARCHITECTURE.md) and [review findings](docs/CODEBASE_REVIEW.md).

DM mode does **not** yet privately import every tab without touching a manually opened sheet. Player-controlled token background imports and native action safety remain independent. Automated source tests are not a substitute for real Roll20 gameplay testing.

## Firefox v3.10.26 — Journal preloading, fast local updates and progress (signed)

R20eb silently indexes the current Roll20 Journal without switching your Journal tab. For DM use it preloads available Journal character/NPC sheets through exact-ID verified Roll20 openers; for player use it preloads only characters verified under the logged-in player's **Controlled By** permission. If Roll20 has not hydrated its character model collection, an authenticated DM Journal row may still be opened by its exact character ID. This does **not** extend a regular player's access.

Only one verified private sheet is scanned at a time, with a hard cap, retries and explicit failure details. Cached entries can be selected directly from **Character → Journal characters** in the HUD Profile cascade or from the importer panel. This is a read-only preview: clicking an attack requires switching to a verified controlled token; unsupported GM native calls are not fabricated.

A compact loading strip near the top of the usable tabletop (never across the left Roll20 toolbar or right Chat/Journal sidebar) shows percentage based on **discovered sheets and planned/visited sheet tabs**, plus a Details dropdown with pending or failed entries. It disappears automatically after **100% successful completion with no errors** and returns when new/changed sheets require work. HP refresh uses local 500ms source checks, while heavier full-tab requests remain gated so Roll20 stays responsive. Manual sheets and active imports take precedence. Only mounted official fields can be imported, and some Journal entries may be inaccessible under Roll20's API: failures remain visible rather than being counted as success.

## Native-action and UI milestone (PR #110 — released in Firefox v3.10.0)

The **Milestone Completion** build extends native action discovery beyond existing token-bar abilities: it can use whole, character-bound references explicitly published by authenticated official 2024 sheet controls, and discover safe **uncategorized** existing Roll20 character actions. Unclassified valid actions appear in a dedicated **MISC** menu. This is **conditional capability**, not a claim that every private 2024 button exposes a supported macro; unverified controls stay unmapped.

The Firefox battlefield HUD replaces the former six-button utility toolbar with one **Debug** entry in the turn strip. Debug contains the manual turn corrections, original-sheet controls, automatic private reader status, layout reset, HUD visibility, importer and movement logs. Panels remain movable and keyboard-nudgeable. The layout scales to browser/monitor viewport size and accounts for Roll20 chat/sidebar space.

**Firefox v3.10.25 is published as Mozilla-signed.** Roll20 still owns all game rolls and character-sheet state; R20eb does not fabricate edit calls for HP, inventory, slots, conditions or resource counters.

## Firefox v3.10.3 background import (signed; live QA pending)

After selecting a linked character whose **Controlled By** permission can be verified,
R20eb now uses the existing Roll20 character-model opener to start a private
official-sheet reader **without requiring the Journal sidebar or a manual sheet
open**. This reader automatically traverses rendered sheet tabs for the initial
full import and periodically refreshes them. Only an R20eb-owned private reader
can be navigated this way. The reader does not synthesize character values or
edit the official sheet.

Opening the character's original sheet from the Journal takes priority: it
cancels in-flight private full-tab traversal and restores the original visible
sheet. That ordinary manual action is no longer a permanent Auto-sync opt-out.
Any visible player-owned sheet or popout is read on its **current tab only**,
without automatic navigation. Private readers are **always enabled**; opening the
original Roll20 sheet restores it and briefly pauses background access,
which resumes on its own without an enable/disable toggle.

This is a source/automated-test milestone, not a guarantee of live Floorp
behavior. Roll20 must expose a valid character model, official frame and
rendered tab controls; virtualized/unmounted entries still cannot be inferred.

## Firefox v3.10.4 Cast/Use card adapter (signed; live QA pending)

The existing native sheet-click adapter now recognizes a **single explicitly
observed Cast, Use, or Activate button** on a uniquely named official spell,
feature or inventory card, and re-verifies the live row, tab, identity and
button before clicking once. Existing official Roll20 macro mappings take
precedence. A player-opened sheet is **never switched to another tab**; only
an R20eb-owned private reader may navigate to the correct one.

This does **not** make Show More, damage, equipment toggles or quantity
controls callable. In the latest source export, spells exposed expansion
buttons rather than verified Cast buttons, so **native spell casting is not
yet demonstrated**. Slots, HP, charges and inventory mutations remain
read-only. This milestone requires green CI, a signed release, and separate
in-game parity checks.

## Firefox v3.10.24 — DM open-sheet identity (signed)

Actual DM editor HTML confirms a visible official 2024 sheet can be wrapped by `.characterdialog[data-characterid]` with an exact title and name but **without a hydrated `Campaign.characters` model**. R20eb previously ignored that sheet. The new read-only fallback follows the already opened, uniquely ID-bearing official dialog, ignores settings/preload frames, and imports the **current visible tab** automatically. It does not infer token ownership or invoke privileged DM APIs. Later explicit map-token selection still works; closing the sheet clears its active HUD identity. Importing *every* tab invisibly without touching the DM's manually opened sheet requires a separate verified private reader and is **not implemented** by this fix.

## Firefox v3.10.23 — DM campaign character isolation (signed)

In a new campaign, a previously imported PC is no longer shown merely because that character is saved in the browser. R20eb stages old snapshots until a real character is verified in the **current campaign**, and game sessions without an exposed ID no longer share the old generic editor cache. A DM can open a new official 2024 Player Character sheet without first creating a controlled map token: when the visible sheet's identity resolves to exactly one character model, R20eb displays that character and reads the current tab. This is **read-only sheet presentation**; it does not claim token control, change the manually opened sheet's tabs or silently roll an action. Select a verified token for normal movement and private character-sync features. Real DM browser QA is still required.

## Firefox v3.10.22 — Movement tracks without manually starting a turn (signed)

The user's current Jumpgate Debug confirms native selection, controlled character and token coordinates work, but the local `Turn Ended` marker was blocking every movement update. R20eb now automatically tracks distance from an explicitly selected, controllable token even if the local turn marker is `unknown` or `ended`. Neither that movement nor a manual End Turn changes Roll20's actual initiative. The distance counter resets only when R20eb's Start Turn button is clicked or when a new turn is genuinely observed in Roll20 initiative. This counter therefore represents **travel since the last reset**, even outside combat. Source-verified model and token checks, grid/diagonal rules, native ruler fallback and completed-move deduplication remain in place.

## Firefox v3.10.21 — Relocated Jumpgate selection module (signed)

The latest Jumpgate build `775403f71ba36dde7775` no longer registers the previously verified selector at Webpack module ID `73210`. R20eb now searches the loaded *factory source text* (not arbitrary module execution), accepts only one exact capability-matched selection engine module, and preserves strict player-control validation. This restores the ability to find a compatible selector even when Roll20 renumbers modules, without hardcoding an unsupported new ID. Debug reports a specific failure if the current interface differs more substantially. **Real Roll20 movement still requires a signed-browser acceptance test.**

## Firefox v3.10.20 — Movement tracking and click-only menus (signed)

A user Debug report from Jumpgate build `775403f71ba36dde7775` showed a changed private selection interface, leaving the character unselected and preventing movement tracking. This update makes selection capability matching less sensitive to code-minifier variations while retaining the exact token, Controlled By and read-only getter checks; Debug now names the rejected capability if the interface has genuinely changed. For Roll20 clients that publish coordinates but not graphic-model events, the tracker counts completed moves after two additional stable polls, while avoiding repeat counting or counting Fabric preview frames. Menu sections **change on click**, never hover. A live check with the current Jumpgate build is still required.

## Firefox v3.10.19 — Keyboard-safe cascading menu focus (signed)

The menu rail preserves keyboard focus across repeated HUD status repaints and category changes. Left-arrow returns from the active submenu to its selected parent instead of closing the whole cascading menu, while left/right caret movement inside Notes and other editors remains untouched. Focus is not inherited across a different character selection. The native Roll20 character sheet, verified Attack/Cast/Use dispatch, and background reader are unchanged.

## Firefox v3.10.18 — Cascading HUD menus (signed)

All R20eb display windows have been reorganized into a single **cascading menu stack** attached to the taskbar: Attacks → type/weapon/variant, Spells → level/spell, Inventory/Features → expandable details, Skills, MISC, Resources, Character, Concentration, Notes, Status, Debug, Theme Manager and Settings. Open a category by clicking a taskbar icon; change first-level menu sections with a click or keyboard activation only (hover just highlights). Keyboard users can Tab, use arrow keys and Enter/Space; Escape closes the menu. The Importer is positioned as a branch while preserving its live controls and active scans.

Menus open toward the available screen area without covering Roll20's chat. **Only verified source-bound native actions are executable**; opening, hovering or expanding a menu never rolls or modifies a character. The player's official Roll20 character sheet and other Roll20-owned dialogs are unchanged. Native Attack/Spell/Item parity and final visual QA still require a real browser session.

## Firefox v3.10.17 — Preserve list expansion and keyboard focus (candidate)

Inventory, Spell and Feature rows retain their expanded descriptions when a native action status message, HP update or background import redraws the HUD. Focused row summaries and verified native Use/Cast/Roll buttons also retain keyboard focus on the matching control, without jumping the list scrollbar or triggering the action again. Switching character, category or spell level intentionally clears old row focus/expansion. Native Roll20 chat parity remains a separate live-game validation requirement.

## Firefox v3.10.16 — Compact Inventory, Spell and Feature lists (candidate)

**Inventory, Spells and Features** now display as a **single-column list** instead of a multi-column tile grid. Each row shows its name and essential level/quantity/usage details; click the row to expand observed Roll20 sheet information. Real native **Cast, Use or Roll** buttons appear in the same row only when an exact official control or a safe pre-existing Roll20 character macro was verified.

Previously almost every item showed a distracting **Native unmapped** warning. Passive equipment and resource details no longer display that warning in the collapsed list. Expanding an entry explains why a native Use/Cast/Roll action could not be verified. **This does not invent missing Roll20 actions**—some inventory items have quantity and equipped switches but no native Use control, and some spells expose only Show More. Manual sheets, automatic private importing and native action safety are unchanged.

## Firefox v3.10.15 — Roll20-style vertical toolbar and checkboxes (candidate)

Selecting **Left** or **Right** from the taskbar context menu now creates a true **single-column, 66 px toolbar** with one action, shortcut, or ability category per row—similar to Roll20's native tool strip. Its status line becomes a compact HP tile; click the tile to see the full HP/AC/movement/turn/native-action status beside the toolbar. Bottom and Top keep the horizontal taskbar.

**Action, Bonus, Reaction** display simple checkboxes instead of "Ready" or "Spent". Unchecked means available (the default), checked means used. Clicking toggles the existing local turn tracker; it does not execute or consume a native Roll20 action. Existing manual sheet isolation and native attack mappings remain unchanged.

## Firefox v3.10.14 — Taskbar and status-bar HUD (candidate)

The combat HUD is now a compact **unified taskbar** with action indicators, Attack/Feature/Spell/Inventory/Skill/MISC shortcuts, and a **status bar** for the current character, HP, AC, movement, turn and official-sheet native action status.

**Right-click the taskbar** or use the visible **⋯** menu to change orientation (**Bottom, Top, Left, Right**) and to show or hide Character, Concentration, Resources, Turn Notes, Turn Controls, Action Indicators, Quick Actions, Category Buttons and the Status Bar. Settings save per game, and the menu remains usable even with all optional elements hidden. Independent character flyouts and Debug remain movable. Context menus, status and buttons inherit the chosen Baldur's Gate 3, Tokyo Night, Oh My Posh-inspired or Windows 9x styling.

Docking never changes any native Roll20 sheet, attack mapping, account state or character data. Actual Jumpgate performance and native chat parity still require in-game verification.

## Firefox v3.10.13 — Faster native action/resource mapping (candidate)

Selecting a controllable token starts private sheet synchronization immediately. Instead of withholding mapped attacks and resources until every nested sheet filter has been read, R20eb prioritizes **Combat, Features & Traits, Inventory and Spells** and publishes verified data as those sections arrive. The remaining sheet views finish importing afterward. The private sheet continues to stay offscreen; player-opened sheets are untouched.

The browser now checks sheet readiness more promptly, while preserving exact token/character ownership and source-observed native action verification. This makes useful information appear earlier, but cannot guarantee instantaneous loading when Roll20's sheet iframe or Vue controls have not finished mounting.

## Firefox v3.10.12 — Attack button visibility and hidden-reader repair

A private Roll20 character sheet can use a generic iframe title even when its owning dialog has the correct character ID. The Auto-sync importer now locates that owned reader by ID and authenticated name rather than treating the generic title as a different character. Pending Attack clicks use the freshly imported official control evidence after an in-progress all-tab scan; unrelated HP polling is deferred while the action resolves. The Attack window shows native progress or errors in its compact titlebar without scrolling your weapon list.

Only authenticated, player-controlled sheets and exact source-observed Roll20 controls may be invoked. A native status saying the button was clicked is not yet proof of a matching chat result; the live Roll20 interface must be tested separately.

## Firefox v3.10.11 — Selected-token private sheet (candidate)

Selecting your controlled token automatically opens and retains a script-owned official character sheet offscreen, imports its available tabs, and uses that authenticated sheet for native Attack/feature actions. There is no manual importer setup. If an Attack is clicked during a full import, R20eb waits for the reader and checks for the native roll button before clicking once. It never silently retries an uncertain native roll.

A sheet you open manually remains visible and is never moved or navigated by R20eb. If Roll20 prevents a second same-character sheet, R20eb uses only the visible current view without switching tabs. Real-game action parity still needs verification.

## Firefox v3.10.10 — Attack list scroll stability (candidate)

Clicking an **Attack** button no longer resets the weapon-list scroll position while R20eb locates or invokes the official sheet control. Native status updates retain the same horizontal and vertical viewport; switching attack categories still opens a new view intentionally. All themes, HUD panel placements, original-sheet visibility and native mapping are otherwise unchanged.

## Theme Manager — BG3, Tokyo Night and Oh My Posh-inspired palettes (Firefox v3.10.9 candidate)

Open **R20eb Debug → Theme Manager** to change the entire HUD appearance instantly without moving panels or reloading Roll20. The theme is saved across characters and games. **Baldur's Gate 3** (dark fantasy, leather and gold) is the default. Windows 95/98 remains available as a selectable retro skin.

The presets include **Tokyo Night Storm** (palette derived from [Oh My Posh's `tokyonight_storm.omp.json`](https://github.com/JanDeDobbeleer/oh-my-posh/blob/main/themes/tokyonight_storm.omp.json)), Catppuccin Mocha, Dracula, Gruvbox Dark and Nord Frost. These are R20eb UI adaptations of published shell-theme color families, *not* executable Oh My Posh configuration imports. They require no shell, font installation, network access, or user CSS. Appearance is isolated to R20eb's Shadow DOM, not the native Roll20 app.

## Firefox v3.10.8 — Win9x contrast polish (candidate)

The Windows 9x visual system uses readable light surfaces for expanded cards, character HP and stats, class resource panels and the full-screen action dock. The original Roll20 UI remains unaffected. Native sheet-action behavior is unchanged from v3.10.7; in-game parity verification remains necessary.

## Firefox v3.10.7 — Windows 95/98 desktop styling and native actions (candidate)

The entire Firefox HUD, original-sheet controls, flyouts, weapon variant menus, Debug and importer now use a unified Windows 9x-inspired design: navy caption bars, classic gray beveled buttons and windows, inset white lists, compact Tahoma-style text and keyboard focus outlines. Panels remain individually draggable and respect the chat area.

Native attacks still use the original Roll20 action rather than silently rolling reconstructed dice. This release also recognizes a **unique explicitly observed feature dice button** (for example, Second Wind `1d10+5`) and clicks that same native button with a single-use source/session check. The HUD labels these **Roll**; it does not assert that Roll20 spent a class-feature use or that a resource was changed. Saving throws and ability checks similarly become native actions **only if** their actual exact control was captured from the official 2024 sheet.

**Remaining limitations:** some features are explanatory text without an executable button; the supplied spells exposed `Show More` but no verified Cast control. Those remain `Native unmapped`, not fake actions. Code tests do not replace an in-game chat-roll comparison.

## Firefox v3.10.6 native Attack recovery (candidate)

If Roll20 does not expose an active Combat tab marker, R20eb can verify an imported attack against an exact live official hit-roll button in the unclassified view. It never substitutes a damage button or a fabricated dice roll. **Private official-sheet reading is automatic and always enabled—there is no private-reader toggle.** Prior saved private-reader opt-outs are discarded. Opening the player's original Roll20 sheet restores it and safely interrupts private navigation; any separate private session resumes automatically after that manual opening settles. A player-opened sheet is never hidden, reparented or switched to another tab.

These changes do not prove full in-game Roll20 action parity. Verify each native attack, particularly duplicate-weapon variants, against the actual Roll20 chat result.

## How it works

**Automatic character sync.** A selected, linked, player-controllable token can trigger character-scoped read-only synchronization; manual importing remains available when Roll20's protected sheet/Journal interfaces do not allow unattended reading. A different character should never inherit the previous character's values. An explicit sync Off is preserved. Real-game reliability varies with upstream Roll20 interfaces and remains under testing.

**Native sheet controls (v3.10.2).** When no verified character ability exists, imported attack-hit buttons and standard skill-check buttons can use the official sheet reader. The HUD shows **Native sheet**; clicking Attack or Roll rechecks ownership, source identity and a unique live control, then clicks that official button once. An eligible private reader can load on demand. Existing player-opened sheets retain their tab and visibility. Native prompts and resulting chat cards still require live acceptance.

**Native action mapping.** For an imported action with a unique matching *existing* Roll20 character ability, R20eb invokes the character's own `%{CHARACTER_ID|ABILITY_NAME}` macro when clicked. This lets Roll20, rather than R20eb's dice formatter, handle the native sheet macro and its result. Supported mapping categories are attacks, spells, features, inventory/item use, resources, skills, saving throws and ability checks. **Native linked** indicates an identified existing ability; **Native unmapped** indicates that no safe linkage has been verified.

Mappings are conservative. A shared name or displayed control label is **not** proof of the correct action. Same-named weapons, ambiguous characters, unsupported macros and unknown official 2024 action IDs remain unmapped until identifiable. The optional **Dice** attack path uses *observed* hit/damage expressions through Roll20 chat; it is explicitly not equivalent to an official 2024 attack card.

**HUD behavior.** Weapons appear under Melee, Ranged (including Thrown) and Other, with actual Finesse/Off-Hand/etc. variants in contextual submenus. Panels can be dragged independently. Imported inventory quantities and resource counters are observations, not permission to edit the character sheet. The debug window collects diagnostics without interrupting the normal chat layout.

## Known limitations — do not assume native parity

- Existing ability discovery is incomplete for official **D&D 2024 Advanced Tools**, token actions and repeating rows not exposed by the official sheet. Similar or duplicate names may not be callable.
- Matching a Roll20 macro in code is **not proof of live native result**; critical attack damage-card, spell prompt, slot, resource and feature behavior still needs direct Floorp QA.
- **Inventory count changes, equipped/attuned toggles, HP edits, spell-slot usage, resource counters and checkbox state edits are not native-write integrated.** R20eb does not guess these changes or silently write the sheet.
- **Automatic Jumpgate selection and movement tracking** remain unresolved in live gameplay: [issue #73](https://github.com/newnetmp3/roll20embetterment/issues/73). A successful simulated test is not evidence that in-game walking/backtracking has been detected.
- Firefox-first improvements do not automatically update the older Chrome and userscript versions.

For a detailed checklist of implemented and **unimplemented native calls**, current engineering priorities and acceptance criteria, read [HANDOVER.md](docs/HANDOVER.md) and [ROADMAP.md](docs/ROADMAP.md).

## Development

Requirements: Node.js with npm, a supported browser for live testing, and Roll20 access to a player-controlled D&D 2024 character.

```sh
npm install
npm run build:firefox
npm run check:firefox
```

Source of truth is `v3/` (eight numbered runtime modules), with `tests/` for regression coverage. `src/` is legacy historical code. `roll20-embetterment.user.js` is a **generated artifact**, not the active source to edit:

```sh
npm run build
```

Firefox packages and releases are independent of Chrome. Automated test success, GitHub merge, Mozilla signing, update-feed publication and actual Roll20 gameplay acceptance are separately verified steps; none implies the others.

**Current focus:** complete safe, source-verified native-action identification and official 2024 gameplay parity before adding any more HUD features. Changes must preserve read-only imports, authorized character identity, manual player-sheet priority and Jumpgate startup safety.

## Privacy and limitations

R20eb runs in the browser and uses local imported character data and Roll20's existing authenticated interfaces. Its normal usage does not require external API keys or a character-specific configuration, and it does not automatically spend real inventory/resources or advance the GM's turn order. Use the built-in Debug panel to capture bounded technical diagnostics when a Roll20 upstream update breaks a bridge. Do not treat screen-detected values as authoritative until checked against the original Roll20 sheet.

[Releases](https://github.com/newnetmp3/roll20embetterment/releases) · [Issues](https://github.com/newnetmp3/roll20embetterment/issues) · [Handover](docs/HANDOVER.md)


The importer Diagnostics view includes a bounded, read-only interactive control inventory with observed source attributes, control kinds, categories and missing-capability reasons. These records do not authorize execution; supported attack/skill candidates are revalidated against the live sheet before a click. Only rendered, visible, enabled controls are scanned; virtualized or unopened content is not guaranteed complete.

**Discovery fix:** the control inventory now budgets visible controls separately from hidden DOM nodes, retains named inventory owners, and recognizes skill controls and range counters. All-tab capture uses the actual initial tab to avoid duplicating it as “Current view.”

## Firefox v3.10.27 — preload lifecycle hardening (candidate)

This reliability update revalidates Journal character access before accepting an asynchronous preload; revoked or removed previews and their cache entries are cleared. It preserves previously verified Journal entries when the sidebar temporarily unmounts, reconnects the observer on late Journal mounting, and protects campaign switches against late background reader responses. The progress Details view now reports an unavailable private reader. These changes are subject to Firefox and Chrome CI and live DM/Player testing; candidate status does not imply a Mozilla-signed release.

## Firefox v3.10.28 — tabletop-safe progress placement (candidate)

The preload indicator is no longer a full-window header. It uses actual Roll20 toolbar/sidebar geometry when available, conservatively reserves the controls when they are not yet mounted, caps the bar at 420px, and repositions on window/sidebar resize. The Details dropdown stays inside this bounded strip. If the viewport is too crowded to display it without overlapping native controls, only the overlay is suppressed; background importing continues and diagnostics remain available through the importer/Debug window. Clean 100% completion still automatically hides it. Real Roll20 layout acceptance is pending.

## Firefox v3.10.29 — DM private reader cleanup (candidate)

Fixes incorrect owned-dialog close handling during the DM Journal preload queue. Only script-owned, exact-ID verified Roll20 dialogs may be closed; manual character sheets remain untouched. The original import error is preserved in the progress Details instead of being replaced by a generic close failure. Real DM live verification is pending.

## Firefox v3.10.30 — DM sheet reader handshake (candidate)

A newly opened Journal iframe may appear before its official sheet reader script is ready. The editor now completes an authenticated readiness handshake before submitting a full-tab scan rather than losing an early message and reporting a generic 40-second timeout. The original source/character identity checks remain in place. A missing extension reader and a stalled scan are reported separately in Details. Real GM session verification is still required.
