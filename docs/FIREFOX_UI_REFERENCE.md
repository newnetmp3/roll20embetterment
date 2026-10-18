# Firefox Battlefield HUD — approved visual reference

**Source of truth:** The user-approved **compact** Roll20 battlefield HUD screenshot from the October 18, 2026 ChatGPT design iteration (final image: short equal-height docks in the two bottom corners; right-side portrait/status stack; subtle turn strip). This document encodes the screenshot's **layout constraints** so follow-on development does not regress to a full-width or screen-filling HUD. The screenshot is a design reference, **not a screenshot of actual functioning software**.

## Non-negotiable visual layout

1. **Battlefield dominates.** The fixed shadow-root host must not swallow Roll20 map clicks. The HUD root covers the viewport only geometrically and uses pointer-events:none; each actual control panel enables pointer-events:auto. No full-width bottom toolbar, persistent modal overlay, central blur or dimmer.
2. **Bottom-left compact action dock**, at ~14px from left, ~12px from bottom. Target **530 × 102px at a 1650px-wide viewport**. Four circular, color-coded action controls: green **Action**, amber **Bonus**, violet **Reaction**, cyan **Movement**; adjacent slim stacked buttons **Dash**, **Disengage**, **Hide**. Available/spent state must be readable without relying solely on color, and must remain manually correctable.
3. **Bottom-right compact five-button dock**, ~14px from right and ~12px from bottom. Target **470 × 88px at 1650px**. Five equal sections with small outlined icons and labels: **Attacks, Features, Spells, Inventory, Skills**. Do not persist any corresponding menu over the map; opening a menu expands a narrow, dismissible panel **upward above its dock**, max 54% viewport height.
4. **Top-right slim character stack**, approx **258px wide** on desktop: small portrait/name, **observed** HP/AC/Speed/Initiative/Passive stats; independently toggleable **Concentration**; imported **Resources**; small **Turn Notes** textbox. Stack panels, not full-height opaque sidebars. Minimize overview if requested; no fixed fake fighter/rogue class, enemy data or portrait assets.
5. **Top-center small turn pill**, not a fabricated initiative display. Show local phase (Turn Tracking / Your Turn / Turn Ended) and visible start/reset/end-local controls. Do **not** display "Round 2", initiative portraits, or turn order unless observed from Roll20.
6. **No prompts or question popups.** Short tooltips, local manual state corrections and an inline More options panel only. Roll20 actions are never silently taken: Dash/Hide/Disengage buttons update local bookkeeping, not Roll20 mechanics. Browse a card without spending an action. Native attacks still require the established authenticated sheet reader and explicit confirmation.

## Responsive rules and interaction invariants

- **≥1150px:** both docks retain reference-like dimensions and stay close to their edges. The map center has no pointer-catching element.
- **761–1150px:** slim down both docks and right stack, keep button labels legible.
- **≤760px:** both docks shrink with viewport proportions, simplify icon sublabels and hide secondary quick actions if necessary. Keep each dock independently usable. Never place a map-blocking full-width panel.
- **Low-height windows:** right stack scrolls inside its own maximum height rather than extending offscreen; bottom dock stays usable.
- **Expanded category:** preserve the existing imported sheet entries, character access checks, card details, spell levels, and authenticated native attack probe/confirmation. The flyout should close via its existing X button.
- **Character switch:** portrait/stats, local action economy, concentration and private notes must switch based on the active controlled character ID; never leak a previous character's notes to another token.
- **Auto-sync:** notes cursor, focus and selection survive incidental HUD redraws; do not reset a player's scroll position merely because HP changed.
- **Accessibility:** status labels and button titles supplement color; tooltips describe local vs Roll20 effects; keyboard navigation remains possible.
- **Privacy/security:** no remote UI assets beyond Roll20's already observed portrait; unverified stat/class/round values show unknown or are omitted. Chrome remains a different extension with its old layout.

## Source files and testing

The **Firefox-specific visual implementation** lives at \`extension/firefox/battlefield-layout.js\`; the existing Firefox turn-state engine is \`extension/firefox/turn-economy.js\`. Shared \`v3/20_ui.js\` and \`v3/22_hud.js\` use feature-detected hooks to activate this presentation only when bundled in Firefox. Chrome and the optional legacy userscript must not adopt it inadvertently.

Run \`npm run check:firefox\` and inspect \`tests/firefox-battlefield.test.mjs\`. Tests enforce corner anchoring, click-through central map, selected-token state isolation, source-backed data, notes persistence, flyouts on demand and compact mode. **A real Floorp/Roll20 screenshot comparison is still required** before claiming pixel-perfect matching to the approved concept, because Chrome-less CI does not render the actual browser or Roll20 page.


## Firefox v3.7.0 — User-positionable HUD panels

The screenshot remains the **starting appearance reference**; the user must be able to move every actual visible HUD panel independently when a battlefield or Roll20 chat layout requires another arrangement.

- Independent drag grips on Action Economy, the five-category Dock, Turn status pill, Profile, Concentration, Resources, Turn Notes, More Options, menu flyouts, native status, mini-tools, profile show button, and the original importer panel. Grips are visually small `⠿` tabs and do not replace ordinary action/roll controls.
- Use pointer/mouse/touch dragging on a panel's grip. For keyboard access, focus the grip and press arrow keys (12px nudge, Shift+arrow for 1px).
- **Default right-side panels and category dock reserve the actual chat width when its page element is visible**; otherwise reserve approximately 330px on larger desktops. Layout prevents overlap of the bottom docks in narrower browsers. Users can override all defaults by dragging panels wherever desired; reset from **Reset layout** in the mini-tools.
- Positions persist in per-game, browser-local storage independently of character-specific resource data and notes. The same positions apply when switching a controllable character; re-importing HP or rerendering must not reset them.
- On resize or restored small screens, saved positions clamp inside the visible browser viewport. Default layout must leave the Roll20 battlefield click-through and the right chat usable. Panel grips have `pointer-events:auto` but the full-screen HUD root retains `pointer-events:none`.
- Content is unchanged: no prompts or extra confirmation popups, native Roll20 attack confirmation still handled by existing bridge, no auto-spending from an unverified chat roll, and Chrome remains separate.
- Run `npm run check:firefox`, especially `tests/firefox-panel-drag.test.mjs`. Compare real Floorp UI against the reference and verify manual docking beside the current chat sidebar at different window sizes.


## Firefox v3.8.0 — Live movement and status safety

Automatic movement appears within the existing blue Movement ring and turn-correction panel; do not grow either dock or cover the battlefield to display more values. Use Roll20's verified page scale and accumulated controlled-token path, **not** the net distance from the starting cell. The remaining movement amount is allowed to be **negative** (e.g. -10 / 30 ft), so overspeed is visible without blocking play. Manual 5-ft corrections remain accessible, and movement observation is active only within the currently started turn.

Routine debug, native reader and sheet-recovery notices must never produce a floating overlay obstructing the five ability controls. Small movable Status control with an accessible tooltip contains passive messages; show larger movable details only when explicitly requested, or when the player genuinely needs native-roll Confirm/Cancel controls. All prior dock and chat-safe draggable placement invariants remain binding.
