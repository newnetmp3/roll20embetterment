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
- **Customization**: three themes, scaling, draggable panel, show/hide toggles, multiple local character profiles, JSON backup/import, persistent campaign settings.

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