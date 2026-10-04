# roll20 Embetterment 2.0.2 — Concentric Combat HUD

The main interface is a **token-anchored, Baldur's Gate 3–inspired combat wheel** for D&D 5e. Selecting a category contracts its ring, dims unused choices, and adds a new outer ring. Actions, spells, inventory, resources, sheet import, macros and other existing data are preserved locally.

## Quick start
1. Install or update `roll20-embetterment.user.js` in Tampermonkey and reload the Roll20 tabletop.
2. Select your player's token. Where Roll20 exposes a selected token's screen position, the wheel follows it.
3. If the current Roll20 engine does not expose token coordinates, select **Pin to token**, then click the center of your token. This is a **screen-space pin**: re-pin it after moving the token or panning/zooming the map.
4. Select segments to grow concentric rings. Chosen segments glow gold; nonchosen segments dim and inner rings contract. **Back**, **Root** and **Esc** navigate.
5. Use **Sheet** to open the original read-only scanner. Open your Roll20 character sheet inside the VTT, scan, and sync for attacks, spells and stats.

**Shortcuts:** Alt+Shift+R toggles the combat wheel; Alt+Shift+E opens the advanced companion panel; Alt+Shift+K opens the command palette. Inputs in the panel consume Roll20's B/V/Z keybindings.

## Action safety
- Rolls are sent through the visible Roll20 chat form, not a hidden API. Unsent drafts are preserved.
- Sheet-linked attacks and spells require an imported working Roll20 action command. 2024 sheet buttons that do not expose one are **not synthesized**. The HUD prompts you to use the original sheet.
- Item use and spell slots are tracked only through explicit selections. The HUD never assumes the DM has approved an action or modifies Roll20 character attributes.
- The wheel's action, bonus-action, reaction, concentration, and movement trackers are **local reminders**. They do not enforce official turn rules.
- Automatic anchor tracking is best-effort and depends on what the Roll20 engine exposes. **Screen-space pinning is the fallback**, not real token tracking.

## Development
`npm run check` builds the distribution, runs unit tests, and checks its syntax. Source is modular under `src/`; edit these files rather than hand-editing the generated userscript.

## Legacy companion
The earlier character sheets, rolls, macros, spells, inventory, reference, journal, chat and settings panels remain available from the ring or Alt+Shift+E, but the old floating HP HUD, hotbar and launcher are off by default after upgrading.

## Roll20 2024 Attributes importer (2.0.2)
The **Sheet → Scan open sheets → Import visible attributes** flow supports the current Advanced Tools attribute list, including rows without `attr_*` controls. It reads the Name and Value columns, preserves empty values, and, when available, scrolls through a virtualized list before restoring the position. It also rejects unrelated dialogs that contain no usable sheet fields. Only browser-visible, player-accessible DOM is read; private Roll20 state is not accessed. If the 2024 app changes its DOM again, use **Export scan report** and share only details you are comfortable sharing.

## Silent attribute preload (2.0.2)
On **Scan open sheets**, the importer quietly traverses virtualized Advanced Tools attribute rows, allowing the UI to keep displaying the same content while the hidden list is visited. When finished it restores the previous scroll position and caches the fields. **Import visible attributes** applies that snapshot to your local profile and can rescan if stale. It stays within the accessible sheet DOM; no private Roll20 APIs are read. If a particular Roll20 version does not expose a scrollable element, it imports currently rendered rows only.

## Cross-origin D&D 2024 character sheets (2.1.0)
Roll20 Jumpgate displays the 2024 character in a separate iframe at `advanced-sheets.production.roll20preflight.net/dnd2024byroll20/`. Tampermonkey runs the same userscript in both the Roll20 editor and that iframe, using an origin-checked `postMessage` bridge to read the *currently rendered, player-accessible sheet DOM*. The parent finds the character via `.characterdialog .asv__header__name`, not the unrelated `pencil` icon. The reader supports both Combat and Attributes tabs; the Advanced Tools list is scrolled behind a frozen snapshot only when appropriate. No Roll20 private APIs, network calls, or GM-only information are accessed.

If **Scan open sheets** identifies Nier but **Import visible attributes** times out, verify the updated v2.1.0 userscript is enabled for `advanced-sheets.production.roll20preflight.net` in Tampermonkey and reload the game. A full live Roll20 verification is still necessary; the supplied full HTML dump contains the iframe *element*, not its inner sheet document.
