# Roll20 Embetterment (R20eb)

Player-focused D&D 2024 combat HUD and read-only Roll20 sheet companion. R20eb uses existing player-controlled character data to present attacks, spells, features, inventory, resources, skills, saves and ability checks in movable panels. **It is not a replacement for the Roll20 character sheet, and not every observed control is natively callable.**

## Installation and current versions

| Distribution | Status |
| --- | --- |
| **Firefox / Floorp** | **v3.10.1** in the signed-release update feed; primary development target |
| **Chrome / Chromium** | **v3.4.0**; independently versioned and not feature-parity guaranteed |
| **Optional userscript** | **v3.4.0** metadata; built from `v3/` independently of Firefox releases |

- [Firefox v3.10.1 XPI](https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.10.1/r20eb-firefox-v3.10.1.xpi)
- [Firefox updates.json](extension/firefox/updates.json)
- [Firefox installation and signing guide](extension/firefox/README.md)
- [GitHub Actions](https://github.com/newnetmp3/roll20embetterment/actions)

Disable any previous R20eb userscript or duplicate extension when using the signed Firefox add-on. Keep the native Roll20 chat panel accessible when running actions; R20eb does not overwrite an unsent chat draft.

Firefox v3.10.1 is published as Mozilla-signed and referenced by the update feed. The release asset digest matches the feed hash. Live Roll20 gameplay acceptance remains separate.

## Native-action and UI milestone (PR #110 — released in Firefox v3.10.1)

The **Milestone Completion** build extends native action discovery beyond existing token-bar abilities: it can use whole, character-bound references explicitly published by authenticated official 2024 sheet controls, and discover safe **uncategorized** existing Roll20 character actions. Unclassified valid actions appear in a dedicated **MISC** menu. This is **conditional capability**, not a claim that every private 2024 button exposes a supported macro; unverified controls stay unmapped.

The Firefox battlefield HUD replaces the former six-button utility toolbar with one **Debug** entry in the turn strip. Debug contains the manual turn corrections, original-sheet controls, private reader permissions, layout reset, HUD visibility, importer and movement logs. Panels remain movable and keyboard-nudgeable. The layout scales to browser/monitor viewport size and accounts for Roll20 chat/sidebar space.

**Firefox v3.10.1 is published as Mozilla-signed.** Roll20 still owns all game rolls and character-sheet state; R20eb does not fabricate edit calls for HP, inventory, slots, conditions or resource counters.

## How it works

**Automatic character sync.** A selected, linked, player-controllable token can trigger character-scoped read-only synchronization; manual importing remains available when Roll20's protected sheet/Journal interfaces do not allow unattended reading. A different character should never inherit the previous character's values. An explicit sync Off is preserved. Real-game reliability varies with upstream Roll20 interfaces and remains under testing.

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


The importer Diagnostics view includes a bounded, read-only interactive control inventory with observed source attributes, control kinds, categories and missing-capability reasons. These records never enable execution. Only rendered, visible, enabled controls are scanned; virtualized or unopened content is not guaranteed complete.
