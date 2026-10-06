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

## Expanding radial controls (2.1.1)
The bottom **Back / Root / Pin / Sheet / Close** toolbar and action breadcrumb follow the outermost concentric circle, moving outward as selections expand and inward on Back/Root. The character label follows the upper edge of the active ring. Wheel scaling and vertical clamping include the controls so they remain visible at the bottom edge of the screen.

## Guided full sheet import (2.2.0)
Click **Sheet → Import all sheet tabs**. When your character sheet is closed, a prompt asks you to open it from Roll20's Journal; the importer watches for up to two minutes and starts automatically once the window opens. On D&D 2024 Jumpgate it visits Roll20's Character Sheet, Bio & Info and Advanced Tools → Attributes views, and safely navigates the iframe's available combat/spells/inventory/features sections. It collects the named values and visible sections, merges them, updates the local profile once, and restores the original selected tabs. Automatic clicks are limited to recognized tab navigation: no rolls, item use, cast, save or delete buttons. The actual 2024 iframe can expose fewer values than the sheet's internal data; the importer only reads rendered player-visible DOM. Some tab changes may be visible during scanning.

## Readable combat wheel labels (2.2.1)
Weapon, item, and spell names now wrap onto multiple lines inside the SVG wedges, with context such as attack bonus, range, damage, spell level, concentration, or quantity on a secondary line when space allows. Labels follow their wedges tangentially and flip to remain upright. When a ring contains more than 12 choices, the wheel shows at most 10 per page with Previous/Next wedges rather than shrinking every name to 6 characters. The complete name and additional details remain in the native hover title and screen-reader label. Existing attack execution behavior, sheet integration, and bottom control positioning are unchanged.

### Adaptive wheel sizing (2.2.1)
The original 520 px wheel size is retained whenever its labels fit. If long names, crowded selections, or important attack/spell metadata would otherwise be clipped, it may grow gradually up to 1.6×. The exact ceiling depends on the available Roll20 tabletop viewport (preferably the editor canvas) and the bottom toolbar/title clearance. On smaller windows the wheel automatically scales down to stay visible rather than expanding off-screen. This does not change the ring hierarchy or action commands.

## Jumpgate player-token tracking (2.2.2)
The combat HUD now prefers Roll20 Jumpgate's rendered tabletop token overlay instead of relying on legacy Fabric internals. It looks in `#tabletop-ui-layer .overlay` for a visible nameplate matching the current/local linked character (exact or prefix match, so a local profile named `Nier` can follow a token named `Nier Stoneshadow`). The token-sized child rectangle supplies the browser-space center, which automatically includes Roll20 pan and zoom transforms. Style/DOM mutations in the tabletop UI layer schedule immediate position updates, while the prior selected-token DOM, Fabric, and manual pin methods remain as fallbacks. No private Babylon scene data is read.

## Bottom HP gauge and native Roll20 token cleanup (2.2.3)

R20eb leaves the token center clear and renders its hit-point gauge immediately below the active outer ring, above the Back / Root / Pin / Sheet controls. The gauge includes temporary HP when present and changes appearance at wounded and critical thresholds. Its height is included in viewport clamping.

When R20eb is enabled, the matched Jumpgate player token is tagged locally with `data-r20e-player-token="true"`. R20eb hides that token's native Jumpgate `.bars-above` and `.nameplate-container`. It also hides Roll20's selected-token status-marker button and bar controls in `#radial-menu` (buttons 2–5 and an editable fourth bar), while deliberately leaving the native settings/gear button (button 1) available. These are presentation-only CSS changes; Roll20 token values are not modified.
