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
