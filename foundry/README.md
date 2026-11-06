# Foundryembetterment

The Roll20embetterment action bar, as a Foundry VTT module for the D&D 5e
system. It's a compact bar beside the scene controls with cascading menus for
the selected token's character, using the dnd5e system's own rolls, chat
cards and dialogs.

Needs **Foundry VTT v14** and **dnd5e 6.0** or newer (made against Foundry
14.370 and dnd5e 6.0.6).

## Install

In Foundry's setup screen: **Add-on Modules → Install Module**, paste this
into **Manifest URL**, then **Install**:

```
https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/foundry/module.json
```

Then enable **Foundryembetterment** in your world (**Game Settings → Manage
Modules**). Each player sees their own bar; nothing to set up per player.

## What's on the bar

| Button | Opens |
| --- | --- |
| Portrait | The character: follows the token you select. Click to pick another of your characters (GMs: anything on the scene). |
| 📌 Favorites | The character sheet's favorites (items, spells, attacks, skills, spell slots), plus anything you pin from the bar: right-click an entry to pin or unpin it. |
| ♥ Hit points | Health bar, take damage / heal / temp HP (dnd5e's own damage, temp HP first), concentration and its save, death saving throw at 0 HP, Short and Long Rest, hit dice. |
| 👢 This turn | Action / Bonus / Reaction used, and movement against speed. |
| ⚔ Attacks | Weapons and other attacks: attack and damage rolls, or show in chat. |
| ⚡ Actions | Features you activate, by Actions, Bonus Actions, Reactions, Legendary Actions. |
| ✦ Spells | Spell slots left by level (and pact slots), with −/+; then spells by level: cast (dnd5e's usage dialog spends the slot), attack or save, damage. |
| 👜 Inventory | Consumables first, then weapons, equipment, tools and loot: use, quantity −/+, equip. |
| ★ Features | Class features, species traits and feats, with use counters. |
| ⧗ Resources | Every limited-use counter and consumable quantity in one list, with −/+. |
| ✧ Effects & conditions | Effects on the character (from spells, items, features) and the conditions, switched on and off. |
| 🎲 Checks | Initiative, abilities and saves, skills, tools. |
| ⚙ Settings | Roll visibility (Public, Private GM, Blind GM, Self: Foundry's roll mode), roll mode for the bar's d20 rolls (Ask each time, Normal, Advantage, Disadvantage), follow the selected token, highlight on your turn, dock, copy diagnostics. |

## Descriptions

Hover over an attack, spell, item, feature or effect (or move to it with the
arrow keys) to read its description in a tooltip, without posting anything to
chat. Spells also show their level, school, components and duration. Players
see an unidentified magic item's unidentified description only. A long
description scrolls: move the mouse onto the tooltip and use the wheel (it
stays open while the mouse is on it), or press Page Up / Page Down.

## Damage button on chat cards

dnd5e 6 shows a card's Attack and Damage buttons as small icons. With this
module the **Damage** button is a full-width labelled button, and turns red
(**Damage — hit!**) once the card's attack has hit a target (or crit). Turn it
off in **Configure Settings → Foundryembetterment → Big Damage button on
attack cards**.

## This turn

- **Action, Bonus, Reaction** are marked when something with that activation
  is used: from the bar, the character sheet or the hotbar. Click a pill to
  flip it by hand.
- **Movement** comes from Foundry's own record of the token's moves this turn,
  so difficult terrain set up as scene regions and the token's movement mode
  (walk, fly, swim...) are already counted. Pick the speed to measure against
  in the menu; that also sets the token's movement mode. **Dash** doubles it.
- Everything clears when that combatant's turn starts. **Start a new turn**
  clears it by hand (and the token's movement history).
- When one of your characters comes up in the combat tracker, the bar glows
  and switches to that character, and **End turn** passes to the next
  combatant.

## Concentration

dnd5e tracks concentration itself (it starts when you cast a concentration
spell). The bar shows what you're concentrating on, ends it on click, and
after you take damage shows the save DC with a button for dnd5e's
concentration save.

## Notes

- The bar is the same code as the Roll20 add-on (`src/editor/model.js` and
  `src/editor/ui.js`); `foundry/scripts/adapter.js` reads dnd5e actors and
  runs actions through the dnd5e API.
- Build: `node scripts/build-foundry.mjs` writes `dist/foundry/`.
- Release: raise `version` in `foundry/module.json` (and the version in its
  `download` link) and push to `main`; GitHub Actions publishes the release.
- Unofficial; not made or endorsed by Foundry Gaming LLC or Wizards of the Coast.
