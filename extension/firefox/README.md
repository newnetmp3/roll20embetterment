# R20eb — Firefox/Floorp installation and releases

**Last verified Mozilla-signed Firefox version:** v3.10.25.  
**Current candidate:** v3.10.26 Journal preloading, local refresh and top progress.  
**Chrome and optional userscript:** independently versioned v3.4.0; Firefox-only UI not guaranteed in Chrome.

## DM and Player Character modes

**Player Character** mode requires a selected source-verified controlled token. Native actions and private full-tab background import remain subject to their original Roll20 permission and reader-ownership checks.

**DM Sheet · Read-only** mode follows a uniquely opened official 2024 character sheet, even if the selected token is absent and Roll20's character collection is not hydrated. It reads the currently visible sheet tab and never navigates/hides that manual sheet or grants token authority. The status bar and Debug show the active source mode; there is no automatic inference that the user's Roll20 account is a DM.

See [architecture](../../docs/ARCHITECTURE.md) and [audit](../../docs/CODEBASE_REVIEW.md). Full private all-tab DM sync remains unimplemented.

## Background Journal preloading and status

R20eb reads exact-ID character entries from the existing Journal DOM without switching the Journal tab. DM rows may be preloaded through Roll20's verified opener with explicit GM role; player rows require Controlled By verification. It uses only script-owned private dialogs and does not hide or navigate manually opened original sheets. If Roll20 has not hydrated the character collection, the DM can still use an exact current-Journal entry; player authorization does not gain this fallback.

A narrow progress strip appears at the top while scanning, counting actually discovered sheets and visited official tabs. It **hides automatically at error-free 100%**; any failures stay visible under Details. The Profile cascade and importer can show cached Journal snapshots as read-only previews, not as token control or authorization for native rolls.

## Install

Download the [latest signed Firefox XPI](https://github.com/newnetmp3/roll20embetterment/releases) and open it in Firefox or Floorp. The extension declares the stable Gecko ID `roll20-embetterment@newnetmp3.github.io`. Install the signed file, not the unsigned CI ZIP, for permanent Firefox use. Disable the older Tampermonkey script or duplicated extension first, then reload Roll20.

Signed versions receive updates from [updates.json](updates.json), also hosted at:
https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/extension/firefox/updates.json

A passed CI build does **not** mean Mozilla-signed publication or live Roll20 functionality. Always verify the released XPI asset and manifest hash.

## Build and test from source

```sh
npm install
npm run build:firefox
npm run check:firefox
```

The build packages `v3/` plus Firefox-specific modules from `extension/firefox/` into `dist/firefox/`. Tests validate native-action safety and package consistency, but cannot exercise a real official Roll20 2024 sheet or its private Jumpgate runtime. A generated optional userscript is maintained with `npm run build`; it stays independently versioned.

To test an **unsigned** development package only, open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** and select the built Firefox manifest. This temporary installation is not a permanent signed release.

## Mozilla unlisted signing and publishing

Repository maintainers use the `firefox-signing` GitHub Actions environment with `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` stored only as Actions secrets. The release workflow requests an authentic AMO unlisted signature, verifies the signed XPI, publishes `firefox-v<version>` to GitHub Releases, then updates `updates.json` with its actual SHA-256.

For an intentionally requested release, increment **only** `extension/firefox/package.json` and change `extension/firefox/release-request.json` to the same version. Merge a passing release PR into `main` and leave main unchanged while signing and feed publication run. The separate release-request trigger must find matching versions and a release tag that does not yet exist. Inspect the signing workflow, published signed asset and update feed; do not treat a queued/failed signing run as a successful release. Chrome and userscript versions remain unchanged.

For native-action mapping coverage, known unsafe/unsupported operations, and live acceptance tests, see [HANDOVER.md](../../docs/HANDOVER.md). The [movement tracking issue #73](https://github.com/newnetmp3/roll20embetterment/issues/73) remains open.

## Current live QA priorities

Ensure Roll20 Jumpgate starts normally, native sheets remain visible when opened by a player, the imported HUD matches the currently controlled PC, and **each mapped original Roll20 action** produces the expected attack/damage card, spell prompt or skill/feature result. Ambiguous identifiers and unverified state writes must remain blocked. No automatic HP, inventory, slot or resource mutations and no implicit GM turn advancement. Full native 2024 parity and movement accounting are not yet verified in Floorp.
