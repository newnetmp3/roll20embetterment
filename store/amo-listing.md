# addons.mozilla.org listing — Roll20embetterment

Copy these into the Developer Hub when submitting the listed version.

**Name:** Roll20embetterment

**Summary** (max 250 characters):
Unofficial action bar for Roll20's D&D 5E character sheets (2024 and Classic). Attacks, spells, items, features, resources and checks one click away, rolled with the sheet's own buttons. Not affiliated with Roll20.

**Categories:** Games & Entertainment

**License:** MIT

**Homepage:** https://github.com/newnetmp3/roll20embetterment
**Support site:** https://github.com/newnetmp3/roll20embetterment/issues

**Description:**

Roll20embetterment adds a compact action bar beside Roll20's left toolbar for D&D 5E games.

- Attacks, spells, inventory, features & traits, resources, checks and saves in cascading menus.
- Every roll presses the character sheet's own button, so chat cards are Roll20's normal ones (including the Damage button after an attack).
- Follows the token you select: GMs get the NPC's actions, players their own character.
- Hit points as a health bar, with take damage / heal / temp HP, concentration save DCs and death saves.
- Tracks each turn: Action, Bonus Action and Reaction used, and how far your token has moved against its speed (Dash, difficult terrain, fly/swim speeds). Resets when your turn comes up, and the bar lights up when it's your turn.
- Keeps the sheet it needs loaded in the background, so actions work without opening a sheet window.
- Works with the "D&D Fifth Edition (5E & 5.5E) by Roll20" sheet and the older "D&D 5E (Classic) by Roll20" sheet, for player characters and NPCs.
- Hover over anything for its full description in a tooltip (spells with level, school, components and duration), without posting to chat.
- Spell slots left by level; on Classic sheets, spend and restore them from the bar.
- Token markers on and off, End turn when your token is up in the turn order, and right-click anything to pin it to Favorites.
- Drag the bar anywhere; Alt+Shift+C puts it back.

This is an unofficial fan tool. It is not made, endorsed or supported by Roll20. "Roll20" is a trademark of The Orr Group, LLC.

Privacy: the add-on collects and sends no data. It runs only on app.roll20.net and Roll20's character sheet frames, and stores its settings (bar position, preferences, last loaded sheet summary) locally in your browser.

**Notes to reviewer:**

- Source is plain, unminified JavaScript; the uploaded files are the repository's `src/` files as-is (built by `scripts/build.mjs`, which only copies files and writes the manifest). Repository: https://github.com/newnetmp3/roll20embetterment
- `src/editor/selection.js` runs in the page (MAIN world) and reads Roll20's own `window.MeshManager.engine.tabletop.getSelection()` to learn which character the selected token represents. It sends the result to the content script as a JSON string in a DOM CustomEvent.
- The same script reads, read-only, the active character's saved sheet attributes from `window.Campaign` to show descriptions and spell slots in tooltips and menus, and replies to the content script with plain text (HTML tags removed; nothing is inserted into the page as HTML).
- It changes Roll20 data in exactly three cases, each only when the user clicks the matching bar entry: toggling a status marker on the character's token (`token.save({ statusmarkers })`), ending the user's turn when their token is first in the turn order (`Campaign.save({ turnorder })`), and spending or restoring a Classic sheet's spell slot (`attribute.save({ current })`).
- The same script also reads, read-only, Roll20's `window.Campaign` page data (token positions, the page's grid scale and the turn order) to measure how far each token moved this turn. It sends only distances and token ids to the content script, the same way.
- Two actions write to Roll20's own UI, both only when the user clicks them: a death or Constitution save on a sheet without its own button types a d20 roll into Roll20's chat box and presses Send; the Classic sheet's Long Rest sets the sheet's own HP, spell slot and hit dice fields.
- `wrappedJSObject` is used read-only to look up the current player id, whether the user is the GM, and the characters they control.
- Sheet actions are performed by clicking the official sheet's own buttons inside the sheet frame (messages between frames are origin-checked).
- No remote code, no network requests, no analytics.
