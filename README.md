# roll20 Embetterment 2.3.8 — Concentric Combat HUD

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
- Native D&D 2024 Attack/Damage controls use Roll20's actual official sheet buttons; missing controls are never synthesized. Sending a legacy cast macro, marking a local cast, and spending a local slot are separate decisions.
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

## Debug & local maintenance tab (2.2.4)

R20eb now includes a dedicated **Debug** tab. It shows local profile/sheet-link status, cached attribute count, and current token-tracking status. The tab can export a compact debug report, clear R20eb's sheet scan/cache state, and force player-token re-detection.

Two reset levels are available:

- **Clear imported sheet data** resets imported stats, abilities, currency, spell slots, sheet linkage, and entries marked `origin: "sheet"`, while preserving local journal entries and locally-created spells, inventory, resources, and quests.
- **Clear current character data** resets the entire current R20eb character profile to defaults while preserving that profile's name and ID.

Both actions change browser-local R20eb data only. They do not edit, delete, save, or otherwise modify the authoritative Roll20 character sheet.

## Official D&D 2024 sheet popout (2.2.5)
R20eb now recognizes the official top-level D&D 2024 character-sheet popout hosted on `advanced-sheets.production.roll20preflight.net`, including Roll20's CDN-backed popout URL form. The reader announces itself to the originating Roll20 editor with an origin-checked `postMessage` handshake, appears as a normal Sheet import candidate, and supports the same read-only snapshot and full-tab tour as the embedded iframe. The captured official popout markup provides stable desktop tab links for Combat, Skills & Tools, Spells, Inventory, Features & Traits, Notes, and About; R20eb visits those rendered tabs and restores the originally selected one. Character identity comes from the popout document/title at runtime, never a hardcoded character name. If a browser opens the popout without an opener relationship, the direct editor bridge cannot connect and R20eb will report no popout candidate; this case can be diagnosed from the Debug tab.

## Automatic controlled-token character import (2.3.0)

On editor startup R20eb inspects the active Roll20 page's own token models. A token qualifies only when the **current Roll20 player** can control that token directly or can control the represented Journal character, and the token has a non-empty `represents` character ID. GM-wide control is deliberately not treated as a player assignment.

Each represented character ID gets its own persistent R20eb profile. Multiple tokens representing the same character share that profile; different represented characters get separate profiles. R20eb persists a token ID → character ID → R20eb profile mapping and uses the selected token ID to switch the combat wheel to the correct assigned profile. Names are display/fallback information only, not the primary identity key.

For each newly discovered controlled character, R20eb first reads any Roll20 character attributes already available through the controlled character model. It then attempts a **full import**. If the character sheet is not already open, R20eb invokes Roll20's own character-view dialog, moves the helper dialog offscreen, preserves keyboard focus, runs the normal full Character Sheet / Bio & Info / Advanced Tools + official D&D 2024 tab tour, and closes the helper dialog afterward. If the full sheet cannot be opened yet, model attributes are imported as a partial seed and R20eb retries the full import later. This is read-only: no character attributes, token settings, attacks, spells, inventory, or Roll20 sheet values are changed.

Discovery repeats periodically so page changes, newly spawned controlled tokens, and additional represented characters are picked up. A character is fully imported at most once per page load unless the user explicitly requests another controlled-character scan from **Debug → Rescan controlled characters**.

## Native official-sheet rolls from the combat wheel (2.3.1)

R20eb no longer treats official D&D 2024 attacks as informational-only when the sheet exposes an actual roll control. During the full sheet tour it harvests **semantic references** to the official sheet's rendered roll buttons rather than copying transient DOM nodes or inventing Roll20 macros.

Supported official-sheet roll surfaces include:

- weapon/attack cards: **Attack / Hit-DC** and **Damage**,
- spell cards: **Attack / Hit-DC** and **Damage**,
- skill checks,
- ability checks,
- saving throws,
- initiative,
- tool proficiency checks,
- Hit Dice and other native controls whose accessible label explicitly identifies them as a **Roll** action,
- rollable action/feature cards, including **Healing**, attack and damage controls.

The radial Attack menu uses the weapon's official attack button and exposes its official damage button separately. Spell entries similarly expose their native roll controls. The ROLLS section also contains **Sheet Rolls**, which provides every harvested native roll action that is not otherwise conveniently surfaced.

When invoked, the editor sends only a validated semantic roll reference (kind, name, action and tab) to the authenticated official-sheet iframe/popout reader. The reader resolves that reference against the live sheet DOM and clicks Roll20's own button. This preserves Roll20's current roll mode/privacy, attack math, critical handling, spell behavior, resource prompts and native chat templates. If the helper sheet is closed, R20eb can reopen its associated controlled character sheet offscreen, perform the requested roll, and close the helper again. No roll formula or 2024 repeating macro is synthesized.

Legacy 2014 commands continue to use their existing Roll20 macro command path.

## Hidden helper-sheet bridge registration (2.3.2)

When a native 2024 roll is requested while its character sheet is closed, R20eb may open Roll20's character dialog offscreen as a temporary helper. The discovered iframe is now registered in the editor's authenticated sheet-candidate list before any snapshot or roll invocation is sent. This ensures the editor accepts the helper reader's origin-checked reply instead of discarding it as an unknown frame. The same registration path is used when an already-open sheet is first discovered automatically.

## Sheet panel and command palette native-roll parity (2.3.3)

The Sheet panel now offers official 2024 weapon Attack and Damage buttons even without old-style macro commands, as well as a separate list of all native sheet rolls. The command palette (Alt+Shift+K) supports native weapon and spell attacks/damage, skills, saves, tools, Hit Dice and rollable features with explicit labels. Both interfaces use the existing verified official-sheet bridge, including the hidden helper when a sheet is closed. No 2024 roll formulas are synthesized; no authoritative character resources are changed.


## Native roll progress and duplicate prevention (2.3.4)

An official D&D 2024 roll now shows visible, screen-reader-accessible **rolling / received / not completed** feedback. While an action is waiting for Roll20's authenticated embedded/popout or offscreen helper sheet, R20eb ignores duplicate invocations of that same character + roll reference and disables its matching Sheet-panel button. Different native roll actions may still run separately. Successful and failed requests release the in-flight guard, allowing normal retry. The result indicator clears after a few seconds. No character-sheet values or official roll formulas are modified.


## Explicit spellcasting and local combat reminders (2.3.5)

The SPELLS wheel and Spells panel distinguish **Cast in Roll20** (only when a working chat command exists), **Mark cast (local)** (available even for official 2024 spells without a cast command), **Roll attack / Roll damage** (only when genuine official sheet buttons were imported), and **Use level N slot (local)**. The command palette follows the same distinction. Native sheet attack/damage rolls never imply a cast or spend a slot. Mark cast records the turn action type if the imported casting time explicitly says Action, Bonus Action, or Reaction, and starts a local concentration reminder only for concentration spells. Unknown casting times are not guessed. No slot is consumed automatically, including from Roll20 macros; spell slots remain explicit manual local controls. This companion does not cast a spell inside the 2024 sheet unless that sheet actually exposes a supported executable cast control.

## Combat wheel and palette keyboard accessibility (2.3.6)

Each visible combat ring has one Tab stop. Use **Left/Up** and **Right/Down** to move between wedges (including Previous/Next pagination), **Home/End** for the first/last wedge, and **Enter/Space** to select. Keyboard expansion moves focus into the new outer ring, and **Escape** backs out one ring. The command palette now exposes combobox/listbox semantics with an active option for screen readers, supports Home/End and PageUp/PageDown navigation, handles zero results without a negative selection, and closes before Escape affects the underlying wheel. Keyboard events inside R20eb inputs stay local rather than reaching Roll20 shortcuts.

## Hidden import, original character-sheet access and movable wheel dock (2.3.7)

Background imports no longer take over a sheet you already opened. If the player has the original Roll20 character sheet open, R20eb seeds available character-model fields without changing the player's selected tabs; **Import all sheet tabs** remains an intentional manual operation. When an automatic full import opens a temporary helper, R20eb hides newly created dialogs before the browser paints them, tours the helper offscreen and restores its original style before closing. A failed/unsupported helper is closed instead of left on the tabletop. **Open original Roll20 sheet** in the Sheet panel, **Roll20** on the wheel toolbar, and **Sheet** on the minimized dock use Roll20's own character view. Opening it during a helper import reclaims the window so R20eb does not close it. When no controlled character ID or accessible Roll20 view is present, use the Journal manually.

The minimized **Open wheel / Pin / Sheet** dock now has a visible ⠿ grip. Drag that grip to reposition the dock; its position is saved per campaign in browser-local state. Dragging buttons does not move the dock, and the position is clamped to the viewport while dragging. The full wheel's control footer still follows the ring.

## Automatic live character statistics (v2.3.8)

The full combat wheel no longer shows the redundant “Choose an action” line. Its compact status footer displays **current/max HP**, temporary HP, **AC**, **walking speed** and **initiative** (alongside the original controls). The Home panel includes six ability scores and modifiers, proficiency, initiative, level and available passive perception. Character values imported from Roll20 stay local to R20eb and never write back to the official sheet.

Background scanning refreshes **loaded Roll20 controlled-character model attributes approximately every 5 seconds**, even after the full import is complete. A change to HP, maximum HP, temporary HP, AC, speed, initiative, ability scores, modifiers, saves, skills, coins or recognized details updates the local HUD without opening/scrolling the sheet. Blank, unsupported and nonnumeric values are ignored. Imported spells, attacks, native action controls, local notes and manually tracked spell usage are preserved. Extra aliases cover 2014/2024 field spelling and speed values with feet units. If an official sheet keeps values in inaccessible React state, R20eb cannot automatically detect them; use an intentional **Import all sheet tabs** and verify the available data. Edits made only to R20eb's local HP fields may be replaced by the next real model update.
