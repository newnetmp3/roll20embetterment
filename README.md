# Roll20 Sheet Companion

A Firefox extension that adds a slim action bar beside Roll20's left toolbar.
It reads the official **D&D 2024** character sheet (PCs and NPCs) and lets you
attack, cast, use items and features, roll checks and saves, and track
resources from cascading popup menus, without digging through the sheet.

Every action presses the sheet's own button, so Roll20 posts its normal chat
card. Attacks keep the chat **Damage** button, and Roll20's roll visibility and
advantage settings apply as usual.

> This is v5, a from-scratch rewrite. The previous extension (v3, "Roll20
> Embetterment") is preserved on the `main` branch history and its releases.

## What's on the bar

| Button | Opens |
| --- | --- |
| Portrait | Character picker: open sheets and the Journal, with search. Eye button hides or shows a sheet window. |
| ♥ Hit points | Take damage, heal, temp HP, short/long rest, hit dice (PC). NPCs show average HP and AC. |
| ⚔ Attacks | Weapons, each opening its attacks (e.g. Dagger → Standard / Finesse / Off-Hand / Thrown) with attack, damage and chat buttons. |
| ⚡ Actions | Actions, Bonus Actions, Reactions and Free Actions. **Use** rolls and spends a use. |
| ✦ Spells | Spells by level: cast (posts the spell card), attack/save and damage buttons. |
| 👜 Inventory | Consumables first, then the sheet's sections. Each item: use (linked action or attack), quantity −/+, equip, show in chat. |
| ★ Features | Class features, species traits and feats, with use counters. |
| ⧗ Resources | Every tracked counter and consumable quantity in one list, with −/+. |
| 🎲 Checks | Initiative, abilities and saves, skills, tools, hit dice. |
| ⚙ Settings | Roll visibility (Public/Whisper), roll mode (Advantage/Disadvantage/Automatic/Query), companion options, **Copy diagnostics**. |

Keyboard: arrow keys move through menus (→ opens, ← goes back), Enter
activates, Esc closes.

## How it works

- Roll20 loads each character sheet in a frame named after the character's ID.
  The extension runs inside those frames, reads the sheet, and sends the data
  to the bar.
- The 2024 sheet keeps every tab in the page (inactive tabs are only hidden),
  so the whole sheet is read in one pass and hidden buttons can be pressed
  without switching tabs.
- The sheet must be loaded for an action to work. If you use an action for a
  character whose sheet is closed, the companion opens it from the Journal and
  (by default) keeps the window hidden. The portrait's dot is green while the
  sheet is connected.
- Data from the last time a sheet was open is saved locally, so the menus are
  available before you open the sheet again.

## Install for testing (Firefox / Floorp)

1. `npm install && npm run build`
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** →
   choose `dist/firefox/extension/manifest.json`.
3. Disable the old Roll20 Embetterment add-on while testing, so the two don't
   overlap.
4. Reload your Roll20 game and open a character sheet.

Temporary add-ons are removed when Firefox restarts. A signed build will come
once live testing is done.

## Not yet known / limits

- **Spell slots** aren't tracked yet: no slot-casting character has been
  sampled. Cast posts the spell card; spend slots on the sheet.
- Counters change through the sheet's own controls. If Roll20 refuses a
  change, the bar says so rather than pretending it worked.
- Only the official D&D 2024 sheet is supported.

## Development

```
npm test          # unit tests (simulated page, synthetic sheets)
npm run build     # dist/firefox/extension + unsigned zip
npm run check     # both
node scripts/inspect-dump.mjs <saved-sheet.html>   # run the reader on a saved sheet
```

Code layout:

| Path | Runs in | Does |
| --- | --- | --- |
| `src/sheet/parse.js` | sheet frame | Reads the sheet into plain data |
| `src/sheet/act.js` | sheet frame | Presses the sheet's buttons for an action |
| `src/sheet/main.js` | sheet frame | Identifies the character, sends updates, runs actions |
| `src/editor/model.js` | editor | Builds the menus from sheet data (pure, unit-tested) |
| `src/editor/sheets.js` | editor | Finds sheet frames, opens/hides sheets, sends actions |
| `src/editor/ui.js` | editor | The bar and cascading menus |
| `src/editor/main.js` | editor | Wires it together, saves data and settings |
| `src/shared/wire.js` | both | Message format between page and frames |

Saved sheet HTML from a real campaign contains private character data. Name
such files `*.private.html` (git-ignored) and never commit them; tests use the
synthetic sheets in `test/fixtures/`.
