# R20eb — Firefox/Floorp installation and releases

**Published Firefox update feed:** v3.9.18 as of October 21, 2026.  
**Latest merged source:** PR #108 adds native-action ownership/identity hardening; it is **not part of v3.9.18** until a subsequent signed release is published.  
**Chrome and optional userscript:** independently versioned v3.4.0.

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
