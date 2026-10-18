# Firefox-first extension development

R20eb is now split into **independently versioned, built, and released Firefox and Chrome add-ons**. Both reuse audited core modules from `v3/`, but browser-specific code and release schedules are separate.

## Firefox development

Firefox metadata and popup are under `extension/firefox/`. Its independent version starts at 3.4.1.

- `npm run build:firefox` creates `dist/firefox/extension/` and an unsigned Firefox ZIP.
- `npm run check:firefox` validates Firefox alone. GitHub Firefox CI uploads only Firefox artifacts.
- Firefox temporary installation: open `about:debugging#/runtime/this-firefox` and Load Temporary Add-on.
- Firefox version bumps do not change Chrome or the optional userscript versions.

## Mozilla-signed permanent installation and GitHub updates

1. Register an AMO developer account and create Mozilla JWT credentials at https://addons.mozilla.org/en-US/developers/addon/api/key/.
2. In the GitHub repo, add an Actions environment named **firefox-signing** (optionally require reviewer approval). Create environment secrets named **AMO_JWT_ISSUER** and **AMO_JWT_SECRET**. Never commit either credential.
3. Make sure Actions has permission to write repository contents; the Firefox release workflow explicitly requests `contents: write`.
4. Merge your desired Firefox changes and independently bump only `extension/firefox/package.json`. From main, manually run **Firefox unlisted signed release** in GitHub Actions.
5. The workflow tests the Firefox add-on, requests Mozilla signing with `web-ext sign --channel=unlisted`, verifies the returned signature entries, and publishes the signed XPI to a release named `firefox-v<version>`.
6. Only after the signed release exists, GitHub updates `extension/firefox/updates.json` with the signed XPI URL and SHA-256 hash. Future versions can update automatically.

The immutable Gecko add-on ID is `roll20-embetterment@newnetmp3.github.io`. The Firefox manifest points to the HTTPS update feed:

https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/extension/firefox/updates.json

The feed begins empty: unsigned ZIPs will never be published to it. Normal Firefox can permanently install the Mozilla-signed XPI from GitHub Releases. Signing needs your AMO API credentials and Mozilla server acceptance; it has not happened yet.

## Chrome later

Chrome metadata/version/popup live in `extension/chrome/` (v3.4.0). Its independent build and tests are `npm run build:chrome` and `npm run check:chrome`, with an optional separate Chrome CI job. No Firefox release affects Chrome's version, zip, or release cadence.

**Before using any R20eb extension, disable the previous Tampermonkey userscript and reload Roll20.** Live verification of private sheet concealment, first Find, and actual Roll20 chat rolls is still required before distributing widely.


## First signed release trigger (2026-10-17)

The user's Mozilla AMO JWT secrets are now configured. To launch signing without needing manual access to the GitHub Actions Run workflow button, the release workflow also listens for a change to `extension/firefox/release-request.json` on **main only**. The requested version must exactly match `extension/firefox/package.json`, and a release for that version must not exist. This protects against accidental signatures when Firefox or Chrome code changes. PR merge #59 requests the first Firefox 3.4.1 unlisted signature. A protected `firefox-signing` environment can still require explicit approval. Future updates increment the Firefox version, update this request, then merge with passing CI.

Publishing remains conditional on Mozilla producing an authentic signed XPI. If GitHub Actions reports an AMO authentication or validation failure, fix the workflow or account settings rather than publishing the unsigned ZIP.

## Firefox 3.5.0 turn-flow feature

The Firefox-only `turn-economy.js` module adds a persistent action economy dashboard above the existing Argon action buttons. Use **Start / reset turn** at the beginning of your turn; use the action, bonus, reaction and movement indicators to record spending, with 5-ft movement buttons and Dash/Undo Dash. The end-turn tile marks your local phase; it **does not** change Roll20's initiative tracker. A supported exact Roll20 top-token initiative transition can reset your trackers automatically, but inaccessible turn-order data is never guessed.

Tracking is scoped to the selected player-controlled character. Concentration survives turn boundaries. Attack allowances and extra actions are manual overrides; Extra Attack is a sourced hint, not a guessed attack count. The official sheet remains authoritative for speed, spell-slot/resource values and labeled casting-time action costs. Confirming a native Roll20 click without observing an actual chat roll does not silently consume an action. No tutorial popups. The UI is designed for manual corrections and DM-approved rules exceptions.

## Firefox 3.6.0 — Compact battlefield HUD

This Firefox-only version implements the approved low-obstruction reference layout instead of the old large bottom bar. Action/Bonus/Reaction/Movement are displayed in a short bottom-left dock; Attacks/Features/Spells/Inventory/Skills open from a bottom-right dock. Character/HP/stats, concentration, observed resources and private per-character turn notes stay in a small collapsible top-right stack. The center of Roll20's map stays click-through. Skill and attack flyouts expand on demand and close normally. **Reference:** [Firefox UI specification](../../docs/FIREFOX_UI_REFERENCE.md).

Dash, Hide and Disengage quick shortcuts update only local economy indicators; they do not execute a Roll20 action. Native attacks retain separate explicit Roll20 confirmation. New version 3.6.0 is distributed through Mozilla's unlisted signing/update workflow after CI; Chrome is separate and unchanged. Live Floorp rendering must still be checked.

## Firefox 3.7.0 — Move each HUD panel

Each HUD panel now has a small **⠿ move grip**. Drag that grip with the mouse, touch, or pen to reposition the action dock, category dock, Turn indicator, character details, Concentration, Resources, Turn Notes, advanced adjustments, importer, menu flyout, and native roll status **independently**. Clicks on normal action buttons and typing in Turn Notes are unaffected. You can also focus a grip and press an arrow key to nudge 12px, or Shift+Arrow to nudge 1px.

Panel locations are saved automatically for the current Roll20 game. If a chat sidebar is visible on the right, the starting layout reserves that space rather than covering it. At narrower window widths the bottom-right category dock starts above the action dock to avoid overlap. Select **Reset layout** from the small HUD tools near the dock to restore default positions. The main battlefield remains click-through. The approved visual baseline is `docs/FIREFOX_UI_REFERENCE.md`.

## Firefox 3.7.1 — Original Roll20 character sheet always accessible

**Show Sheet** is permanently available in the Firefox HUD's small tools. Clicking it restores every HUD-owned offscreen native sheet across all selected characters **and** Auto-sync's hidden sheet, including their dialog wrappers and any exclusive backdrop. It then makes player-opened sheets the priority, so background automation cannot hide a visible original character sheet again. You can now open and close the original Roll20 character sheet normally. This preference is saved **for this Roll20 game** and survives extension restarts. Auto-sync still reads a visible character sheet or popout, but does not silently open a new hidden sheet while player-owned priority is active. Native attack Find likewise uses a visible official sheet or popout; if you have closed every sheet, open one normally from the Journal before retrying Find.

Opening an original sheet directly in the Roll20 Journal also automatically releases any HUD-created hidden readers **before** Roll20's own click/double-click handlers run. This listener responds only to actual trusted player input in the Journal, never to R20eb's synthetic auto-open event. If you intentionally want background readers again, choose **Allow private reader** from the HUD after clicking Show Sheet. This is an explicit opt-in and won't move any existing visible original sheet.

No input dialogs are added, no manually opened Roll20 sheet is moved by this recovery, and Firefox is still the only extension receiving this change. Visual HUD layout and individual panel dragging are preserved.
