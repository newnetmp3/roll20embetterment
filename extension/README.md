# Browser extension installation

R20eb is now a real Manifest V3 browser extension. The page-context runtime is built from the same eight source modules as the optional existing userscript. **There is no dependency on Tampermonkey.**

## Build

Requires Node.js 20 or newer. Run:

    npm run build:extension

The build produces unpacked directories at dist/extension/firefox/ and dist/extension/chrome/, and ZIP packages named roll20-embetterment-firefox-VERSION-unsigned.zip and roll20-embetterment-chrome-VERSION.zip in dist/. The ZIPs are also available as artifacts on passing GitHub Actions runs.

## Firefox / Floorp

Open about:debugging#/runtime/this-firefox, select Load Temporary Add-on, and choose dist/extension/firefox/manifest.json (or the Firefox ZIP). Firefox 128+ is required for MAIN-world extension content scripts. The unsigned development build is installed only temporarily and does not survive a browser restart. Standard Firefox requires signing through Mozilla Add-ons before it can be permanently installed; this ZIP is **not** a signed XPI.

## Chrome / Chromium / Brave / Edge

Extract the Chrome ZIP to a persistent folder. Open chrome://extensions, enable Developer mode, click Load unpacked and choose the extracted folder containing manifest.json. Requires Chrome 120+. Update by replacing that folder's contents and clicking Reload on the extension.

## Operation and privacy

Both extensions run the shared v3 source directly in the Roll20 editor and on the official D&D 2024 sheet domain, including matching cross-origin frames and popouts. MAIN-world execution is needed to read Roll20's own browser-local player/token objects and authenticated sheet bridge. No privileged extension APIs, background service worker, remote code, wide wildcard websites, or userscript manager are required.

Saved data still uses Roll20-origin localStorage in the **same browser profile**, so converting the packaging does not create a new profile store. Permission to read the game's selected player-controlled character is checked by the same existing code. Roll20 remains the service that operates the game's sheets.

**Disable the old R20eb userscript in Tampermonkey before enabling this extension. Reload Roll20 after switching.** Two concurrent injectors can cause duplicate HUDs and conflicting native actions.

Browser QA is still required for first-click attack readiness, automatic private sheet hiding, real Roll20 chat rolls, and the official iframe/popout bridge. This extension release does not automatically resolve upstream Roll20 UI compatibility.

For permanent distribution, Firefox needs Mozilla signing and Chrome Web Store distribution requires a developer account and review. Neither store submission has been performed.
