# roll20 Embetterment

A player-focused, no-dependency Tampermonkey userscript for **D&D 5E in Roll20**, designed for both the 2014 and 2024 character-sheet editions. It does **not** require GM permissions, a Roll20 Pro subscription, or any external service.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or compatible userscript manager) in your browser.
2. Open the [raw userscript](https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js) and install it.
3. Open a Roll20 game **inside the VTT** at `https://app.roll20.net/editor/?id=...`.
4. Click the **⚔ R20E** launcher in the lower left, or press **Alt+Shift+E**. Press **Alt+Shift+K** for command search.

## Features

- **Player HUD**: local HP, temp HP, armor class, movement speed, initiative bonus, concentration, conditions, death saves, inspiration, class resources, short/long rest resets.
- **Eight-slot action bar**: assign macros or your saved spells. Optional 1–8 hotkeys are *off* until enabled, to avoid interfering with Roll20.
- **Quick rolls**: advantage/disadvantage, all six ability checks and saves, 18 skills, initiative with selected token, custom rolls and whispered GM rolls. Rolls use Roll20 chat, never simulated local dice.
- **Macros**: editable categorized actions; favorites, search, and Roll20 built-in `#macros` and `%{selected|button}` support.
- **Spells**: searchable local spellbook, independent 1–9 spell-slot counters, cast-command mapping, concentration reminders. Casting does not automatically decrement slots.
- **Inventory**: categories, quantities, weights, and 5E coins.
- **Journal**: searchable personal notes, quest checklist, timestamped activity log, Markdown export.
- **Chat**: personal message search and rough category filtering, whispers/emotes/OOC shortcuts.
- **Command palette**: find tabs, spells, macros, skills, saves with keyboard search.
- **Customization**: four themes including Baldurian dark fantasy (default), scaling, draggable panel, show/hide toggles, multiple local character profiles, JSON backup/import, persistent campaign settings.

## Important limitations

- **Character sheet and token bars are not automatically synchronized**. Roll20 does not expose a stable, supported client API for changing a player's character sheet from a userscript. Local counters are intentionally separate. Set the bonuses and macros you want to use.
- **2014 vs. 2024 sheet buttons differ**. Add the macro command that works for your sheet to a slot; the `2014 Perception` example is *not guaranteed* to work with a 2024 sheet.
- **Chat injection is best-effort.** Roll20 changes its UI periodically. If the supported chat field cannot be detected, Embetterment displays the command and offers **Copy command** to paste into Roll20. It never overrides a draft you're typing.
- Initiative rolls that update Roll20's tracker require a **selected token**, and game permission still applies.
- Chat filters only hide messages locally, do not remove shared history, and may need updating for newer layouts.
- Data lives in the browser `localStorage` and is **not** synced to other devices. Export a JSON backup before wiping browser storage.
- No GM/hidden information is accessed; no scraping of hidden tokens, no API keys, no third-party connections.

## Hotkeys

| Shortcut | Action |
| --- | --- |
| Alt+Shift+E | Toggle Embetterment panel |
| Alt+Shift+K | Open command palette |
| 1–8 | Optional action bar slots (Settings, off by default; ignored while typing) |
| Escape | Close command palette or command-copy modal |

**Keyboard isolation:** When typing in an Embetterment input, keydown, keypress, and keyup events stay within the Embetterment window. This prevents B, V, and Z from triggering Roll20 tabletop tools while editing journal notes, spells, macros, or other fields. Roll20 shortcuts remain available on the tabletop.

## Development

The installed `.user.js` is generated from independent modules:

- `src/00_core.js`: local profiles and storage
- `src/10_roll20_bridge.js`: chat adapter, rolls, export/import
- `src/20_ui.js`: HTML/CSS and tabs
- `src/30_events.js`: actions, user input, keyboard, bootstrap

Requires Node 20+; no `npm install` needed:

```bash
npm run check
```

On a new feature branch, update source and run `npm run build`; commit the generated `.user.js` with your changes. CI confirms the build output matches what is committed.

## Status

**First release / beta:** syntax and offline tests run in CI. Real Roll20 Jumpgate, both 5E sheets, and Chrome/Firefox/Tampermonkey compatibility still need in-game acceptance testing. Please report any broken selectors with the page type and browser in a GitHub issue.

Not affiliated with or endorsed by Roll20.


## Baldurian dark-fantasy makeover (v1.2.0)

**Default appearance:** BG3-inspired `Baldurian • Dark Fantasy`, with an original obsidian / brass / parchment design. All artwork-like flourishes are made in CSS and basic Unicode glyphs; **no official Baldur's Gate 3 artwork, logos, game files, copyrighted textures, remote fonts or API requests** are used.

- Ornate, framed companion panel, engraved brass navigation across **two compact rows** instead of a long horizontal scrolling list; the **Sheet** import tab remains visible.
- Character banner with level, class, race/species when imported, and link status; compact combat HUD with prominent HP bar, AC and concentration.
- Game-inspired eight-slot quick action bar with separate dice, spell and attack glyphs, numbered shortcuts, and accessible button labels.
- Custom layouts and visuals for Rolls, Spells, Inventory, Journal, Sheet imports, Chat, Macros, Reference, and Settings, including tooltips, tables, search, buttons, and modal overlays.
- Responsive layout with compact mobile styles; visible keyboard focus, user-controlled UI scaling, and reduced-motion support.
- Previous **Midnight**, **Arcane Violet**, and **Parchment** themes remain available under Settings. Existing installations using the old *default* Midnight theme are switched to Baldurian **once**; deliberate Violet/Parchment choices stay as they are. You can switch back to Midnight.

**All functionality remains player-first and read-only toward Roll20 game data.** Sheet imports, custom macros, saved profile data, storage keys, and the keyboard event isolation fix are preserved. Install or update using the same raw userscript URL above, then refresh the tabletop.

## Character-sheet integration (v1.1.1)

The new **Sheet** tab imports as much data as Roll20 exposes to a player in the **open character sheet**. It does **not** require GM access, a Pro subscription, or any external service.

1. Open your D&D 5E character sheet **inside the VTT window**. Disable Roll20's *pop out character sheets* preference first; a separate browser window cannot be inspected from the tabletop tab.
2. Open Embetterment (Alt+Shift+E), then click **Import character sheet** on Home or select the **Sheet** tab in the top navigation.
3. Click **Scan open sheets**, choose the correct sheet in the dropdown, and click **Sync selected**.
4. Optional: enable **Refresh while linked sheet is open** (every 12 seconds). Rescans are read-only and pause when the sheet is not available.
5. Use **Export visible fields** to inspect which raw attribute names Roll20 actually exposes.

Supported named fields include HP/max/temp HP, AC, speed, initiative, level, proficiency bonus, ability scores/modifiers, saving throws, skills, currency, spell slots, class/species/background, passive skills, spell DC/attack, languages, and select character details. On compatible **2014/legacy** sheets, repeating sections additionally import **spells, attacks/actions, inventory, class traits/feats, tools/proficiencies, and class/other resources**. Imported spells appear in Spells, equipment in Inventory, and attacks in Sheet, the command palette, and configurable action-bar slots.

**2024/Beacon limitation:** Roll20 intentionally exposes fewer attributes than the legacy sheet. The importer only captures named, browser-accessible controls; it does not invent the unseen spellbook, equipment, or attack values. You can paste an exported attribute-name JSON mapping into the fallback importer when available. Values absent from the current scan are **not zeroed**, and locally written notes, macros, homebrew spells, quests, and items remain intact.

This integration **never modifies actual Roll20 character data**. Data is saved as a local copy in your browser. Attacks and spells with recognized Roll20 sheet commands may be launched from Embetterment, but those macros require the **correct linked token selected** on the tabletop. For unsupported 2024 actions, roll directly on your Roll20 sheet. Browser, 2024/legacy, and sheet-layout compatibility still require live testing on your account.
