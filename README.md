# Roll20embetterment

A Firefox extension that adds a slim action bar beside Roll20's left toolbar.
It reads the official **D&D 2024** character sheet (PCs and NPCs) and the
**D&D 5E Classic** sheet, and lets you attack, cast, use items and features,
roll checks and saves, and track resources from cascading popup menus,
without digging through the sheet.

Every action presses the sheet's own button, so Roll20 posts its normal chat
card. Attacks keep the chat **Damage** button, and Roll20's roll visibility and
advantage settings apply as usual.

Also in this repository:

- **Foundry VTT module**: the same bar for the dnd5e system. See
  [foundry/README.md](foundry/README.md).
- **Roll20embetterment Campaign Exporter**: a separate Firefox add-on that
  saves a whole Roll20 campaign. See [exporter/README.md](exporter/README.md).
- **Roll20 Campaign Import**: brings that export into Foundry VTT. See
  [importer/README.md](importer/README.md).

> Unofficial fan tool, not affiliated with Roll20. MIT licensed (see `LICENSE`).

## What's on the bar

| Button | Opens |
| --- | --- |
| Portrait | The selected token's character. Click for the picker: open sheets and the Journal, with search. Eye button hides or shows a sheet window. |
| ♥ Hit points | Take damage, heal, temp HP, short/long rest, hit dice (PC), concentration, death saves at 0 HP. NPCs show average HP and AC. |
| 👢 This turn | Action / Bonus / Reaction used this turn, and movement against speed. See below. |
| ⚔ Attacks | Weapons, each opening its attacks (e.g. Dagger → Standard / Finesse / Off-Hand / Thrown) with attack, damage and chat buttons. |
| ⚡ Actions | Actions, Bonus Actions, Reactions and Free Actions. **Use** rolls and spends a use. |
| ✦ Spells | Spells by level: cast (posts the spell card), attack/save and damage buttons. |
| 👜 Inventory | Consumables first, then the sheet's sections. Each item: use (linked action or attack), quantity −/+, equip, show in chat. |
| ★ Features | Class features, species traits and feats, with use counters. |
| ⧗ Resources | Every tracked counter and consumable quantity in one list, with −/+. |
| 🎲 Checks | Initiative, abilities and saves, skills, tools, hit dice. |
| ⚙ Settings | Roll visibility (Public/Whisper), roll mode (Advantage/Disadvantage/Automatic/Query), Roll20embetterment options, **Copy diagnostics**. |

Drag the bar anywhere: press on any part of it and move. A press without
movement is an ordinary click. The position is remembered; ⚙ → **Dock bar
beside the toolbar** puts it back. Menus open toward the side of the screen
with more room.

Lost the bar? **Alt+Shift+C** brings it back beside the toolbar.

Keyboard: arrow keys move through menus (→ opens, ← goes back), Enter
activates, Esc closes.

## Follows the selected token

Click a token on the map and the bar switches to the character it represents.
GMs get the NPC (or PC) under the token instantly: its sheet loads hidden in the
background, so actions work right away, and Roll20embetterment keeps at most three
such background sheets, closing the oldest. Players only follow tokens of
characters they control. Sheets you opened yourself are never hidden or
closed. Turn it off with ⚙ → **Follow the selected token**.

## Classic (D&D 5E Classic) sheets

Games can enable both the 2024 sheet and the older "D&D 5E (Classic) by
Roll20" sheet; compendium NPCs often use Classic. Roll20 draws a Classic
sheet straight into the page, so `src/editor/classic.js` reads it from the
editor and presses its own roll buttons (actions, bonus actions, reactions,
legendary actions, traits, saves, skills, initiative; for player characters also attacks, spells, inventory, features & traits and resources). Rolls post Roll20's
normal chat cards.

Roll20 has no public "selected token" API, so `src/editor/selection.js` runs in
Roll20's page and reads the selection from the Jumpgate engine, read-only. It
reaches the engine through Roll20's `window.MeshManager` global, and falls back
to finding the engine module in the webpack registry. Selecting a token that
isn't linked to a character ("Represents Character" in the token settings)
shows a short message instead of doing nothing. If Roll20 changes its engine,
following stops and ⚙ → **Copy diagnostics** shows why; everything else keeps
working.

## This turn: actions and movement

The **This turn** button (boot icon) tracks what the active character has
used this turn.

- **Action, Bonus, Reaction**: green while still available. Using an attack,
  spell, action or feature from the bar marks the one it takes (from its
  section, such as "Bonus Actions", or the spell's casting time). Click a
  pill to flip it by hand.
- **Movement**: how far the token has moved, against its speed from the
  sheet. Distance follows the page's grid: the 5e rule counts every square,
  diagonals included, as one; other diagonal settings are honored. A move
  made with waypoints counts the whole path walked, using Roll20's own record
  of the move.
- **Dash** doubles the speed (and uses the action). **Difficult terrain**
  makes every foot moved count as two while it's on. Characters with fly,
  swim, climb or burrow speeds can pick which speed to measure against. The
  bar turns red once the token has moved further than its speed.
- Everything clears when that token's turn starts in the turn order. Outside
  the turn order, use **Start a new turn**.
- **Your turn**: when one of your characters comes up in the turn order, the
  bar glows and switches to that character. Turn it off in ⚙ → **Highlight
  the bar on my turn**.

## Concentration, death saves and rests

- Casting a concentration spell from the bar marks the character as
  **Concentrating** (or tick it by hand in ♥ Hit points). Taking damage
  through the bar then shows the Constitution save DC (10 or half the damage,
  at most 30) with a button that rolls the sheet's own save.
- At 0 HP a **Death saving throw** button appears (the sheet's own, or a d20
  posted to chat when the sheet has none). Classic sheets also show the
  successes and failures ticked.
- The 2024 sheet's Short Rest and Long Rest buttons are in ♥ Hit points. The
  Classic sheet has none, so the bar adds a **Long Rest** that restores HP,
  spell slots and half the hit dice, and clears temp HP and death saves.
  Class resources are left alone, since they recharge on different rests.

## No setup for players

When a player joins a game, Roll20embetterment finds the character they control
and loads that sheet hidden in the background, so the bar works right away
and actions never wait for a sheet to open. It never gets in the way:

- If the player opens that sheet themselves (Journal, token, anywhere), it is
  shown and becomes theirs; Roll20embetterment stops hiding it.
- When they close it, it is quietly reloaded in the background.
- Sheets the player opens for other characters are never hidden or closed.
- GMs don't get a background sheet; they pick characters from the portrait
  menu, and a sheet opens (hidden) when an action needs it.

Turn this off with ⚙ → **Keep my character sheet loaded**.

## How it works

- Roll20 loads each character sheet in a frame named after the character's ID.
  The extension runs inside those frames, reads the sheet, and sends the data
  to the bar.
- The 2024 sheet keeps every tab in the page (inactive tabs are only hidden),
  so the whole sheet is read in one pass and hidden buttons can be pressed
  without switching tabs.
- The sheet must be loaded for an action to work. Players' own sheets stay
  loaded in the background (above). For any other character, Roll20embetterment
  opens the sheet from the Journal when needed and keeps the window hidden.
  The portrait's dot is green while the sheet is connected.
- Hidden sheets are hidden with a style rule written before they open, so
  they never flash on screen.
- Data from the last time a sheet was open is saved locally, so the menus are
  available before you open the sheet again.

## Install (Firefox / Floorp)

Open the `.xpi` from the
[latest release](https://github.com/newnetmp3/roll20embetterment/releases?q=roll20embetterment)
in Firefox and click **Add**. It is signed by Mozilla and updates itself.

## Limits

- **Spell slots** aren't tracked by the bar. Cast posts the spell card; spend
  slots on the sheet.
- Counters change through the sheet's own controls. If Roll20 refuses a
  change, the bar says so rather than pretending it worked.
- Only the official D&D 2024 and D&D 5E Classic sheets are read.

## Development

```
npm test          # unit tests (simulated page, synthetic sheets)
npm run build     # dist/firefox/extension + unsigned zip
npm run check     # both
node scripts/inspect-dump.mjs <saved-sheet.html>   # run the reader on a saved sheet
```

To release a new version: bump `version` in `package.json`, set the same
version in `release-request.json`, and push. The **Roll20embetterment signed
release** workflow signs it, publishes the release and updates `updates.json`.
`npm run build` also writes `dist/firefox/roll20embetterment-<version>-amo.zip`,
the upload for addons.mozilla.org (no self-hosted update URL); the listing text
is in `store/amo-listing.md`.

To try a build, load `dist/firefox/extension/manifest.json` from
`about:debugging` → **Load Temporary Add-on…**.

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
| `src/editor/classic.js` | Roll20 page (editor) | Reads and drives Classic sheets |
| `src/editor/selection.js` | Roll20 page | Reports the characters behind the selected tokens |
| `src/shared/wire.js` | both | Message format between page and frames |

Saved sheet HTML from a real campaign contains private character data. Name
such files `*.private.html` (git-ignored) and never commit them; tests use the
synthetic sheets in `test/fixtures/`.
