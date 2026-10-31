# R20eb clean rebuild handover (v4 alpha)

**Branch:** \`rebuild/clean-v4\` • **Location:** \`rebuild/\` • **Release status:** unsigned developer preview.

## Why a new codebase
The historical v3 extension grew around private Roll20 internals (Webpack module relocation and multiple readers). v3.10.33 handover still records live DM slow-load and owned-dialog cleanup failures. A clean boundary reduces ambiguity rather than inheriting every compatibility shim.

## Modules
- \`common.js\`: pure ID, ownership, category merge and progress guards.
- \`reader.js\`: authenticated official 2024-sheet iframe, delayed Vue readiness, actual DOM capture and one-shot button dispatch.
- \`editor.js\`: source-bound controlled token, Journal discovery, DM/manual sheet reads, one-owned-sheet-at-a-time preload, generation-scoped cache and diagnostics.
- \`ui.js\`: compact Shadow DOM taskbar, category lists, grouped attack variants, read-only Journal chooser, loading progress/errors, debug, themes, drag and local turn boxes.
- \`build.mjs\`: independent Firefox/Chrome MV3 manifests and packages.

## Validation gate (before calling release-ready)
1. Install unsigned Firefox preview separately from v3; verify MAIN-world editor and advanced-sheet host injection.
2. In non-premium DM campaign, check delayed ~10-second loading and first initial empty tab; two Journal sheets should complete without ever adopting manually opened sheets. Verify script-owned dialog closes or visibly restores if no close control.
3. Check native Roll20 2024 Attack, Cast, Use, Skills, Inventory, Saves including duplicate Dagger variants. Compare official chat cards and native side effects. Never substitute a generic roll.
4. Check controlled-token Jumpgate selection and grid/diagonal movement on actual current engine. Existing direct selection getter may not be exposed. Do not import unverified Webpack module hacks.
5. Check PC with several controlled sheets, token switching, GM opened sheet, Journal removal/access revocation, cancellation across campaigns and fresh browser session.
6. Check progress bar never hides before 100% clean completion or obscures native Chat/Journal/toolbar; test 1080p/1440p and right sidebar changes.
7. Only then version bump, merge, run signed unlisted Mozilla workflow with separate preview ID/update location, and verify SHA-256.

## Known first-alpha bugs to address
- Exact native Vue action matching across tab unmounts; retain source fingerprint and re-resolve a unique row rather than stale \`Element\` references.
- Recognize newly selected token in current Jumpgate releases without dependency on internals. If unsupported, show diagnostic and keep manual read-only mode.
- Active reader session must be cleaned up when switching player tokens; preserve user-opened sheets.
- Ensure no progress percentage can be declared complete after a partial authorized source read.
