# Roll20 Embetterment (R20eb)

Player-focused D&D 2024 combat HUD and read-only Roll20 sheet companion. R20eb uses existing player-controlled character data to present attacks, spells, features, inventory, resources, skills, saves and ability checks in movable panels. **It is not a replacement for the Roll20 character sheet, and not every observed control is natively callable.**

## Installation and current versions

| Distribution | Status |
| --- | --- |
| **Firefox / Floorp** | **v3.10.4** in the signed-release update feed; primary development target |
| **Chrome / Chromium** | **v3.4.0**; independently versioned and not feature-parity guaranteed |
| **Optional userscript** | **v3.4.0** metadata; built from `v3/` independently of Firefox releases |

- [Firefox v3.10.4 signed XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.10.4/r20eb-firefox-v3.10.4.xpi)
- [Firefox updates.json](extension/firefox/updates.json)
- [Firefox installation and signing guide](extension/firefox/README.md)
- [GitHub Actions](https://github.com/newnetmp3/roll20embetterment/actions)

Disable any previous R20eb userscript or duplicate extension when using the signed Firefox add-on. Keep the native Roll20 chat panel accessible when running actions; R20eb does not overwrite an unsent chat draft.

Firefox v3.10.4 is published as Mozilla-signed and referenced by the update feed. The release asset digest matches the feed hash. Live Roll20 gameplay acceptance remains separate.

## Native-action and UI milestone (PR #110 — released in Firefox v3.10.0)

The **Milestone Completion** build extends native action discovery beyond existing token-bar abilities: it can use whole, character-bound references explicitly published by authenticated official 2024 sheet controls, and discover safe **uncategorized** existing Roll20 character actions. Unclassified valid actions appear in a dedicated **MISC** menu. This is **conditional capability**, not a claim that every private 2024 button exposes a supported macro; unverified controls stay unmapped.

The Firefox battlefield HUD replaces the former six-button utility toolbar with one **Debug** entry in the turn strip. Debug contains the manual turn corrections, original-sheet controls, automatic private reader status, layout reset, HUD visibility, importer and movement logs. Panels remain movable and keyboard-nudgeable. The layout scales to browser/monitor viewport size and accounts for Roll20 chat/sidebar space.

**Firefox v3.10.4 is published as Mozilla-signed.** Roll20 still owns all game rolls and character-sheet state; R20eb does not fabricate edit calls for HP, inventory, slots, conditions or resource counters.

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
