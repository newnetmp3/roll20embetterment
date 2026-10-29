# R20eb production codebase review — 2026-10-29

Scope: repository inventory, shipped `v3/` runtime, Firefox-only modules, shared bundlers, Chrome build, CI tests, current release machinery, and the retained legacy `src/` tree. Review findings are grounded in source; automated simulated-DOM coverage is not the same as real Roll20 acceptance.

## Architecture audit and changes

| Area | Finding | Improvement made |
| --- | --- | --- |
| Jumpgate selection, token cache and DM sync | The 38 KB token module combined low-level engine discovery, player control, DM sheet recognition, campaign lifecycle and polling; easy to regress one mode while changing another | Split into `23_token` (shared), `24_player`, `24_dm`, `26_session`; mode is derived from verified state, not guessed from GM flags |
| Player Character | Controlled-token verification was intermixed with DM-visible-sheet handling; an unchanged open DM sheet could retake focus after a freshly selected token | Player activation, reader eligibility and newest-token dispatch live in the Player module; last-seen dialog latch preserves explicit token choice |
| DM sheet | An opened ID-bearing 2024 dialog could be ignored if Campaign.models had not loaded, and old private sessions were eligible candidates | DM module owns exact visible-dialog identification and unique current-sheet reader selection. No private owned reader, hidden navigation or implied map-token authority |
| Cross-mode auto-import | Shared importer switched on `origin` with repeated inline role checks; Sync off/on could convert a DM sheet into manual/private fallback | Shared importer now calls separate `r3DmAutoAllowed / r3DmAutoCandidate / r3PlayerAutoAllowed` guards; DM sync toggle stays scoped to the currently opened sheet |
| Per-character snapshot cache | Old DM snapshot was saved in the name-only legacy migration slot; same-name characters risked an unintended handoff | Store DM data only by exact game + character ID + name, and leave legacy migration only for verified player token snapshots |
| Campaign navigation | Clearing the HUD/token was insufficient; authenticated reader map, popout registry, pending hidden sessions and local turn state could survive single-page game navigation | On game change clear all those in-memory registrations, invalidate pending importer generation and restore new-game turn/layout state |
| UI / diagnostics | No clear indication of the data-source mode; movement Debug text incorrectly said tracking required Your Turn | Add Player Character / DM Sheet read-only / unbound source label to taskbar/Debug; correct tracker guidance |
| Build pipeline | Both builders asserted exactly eight source modules, obstructing role separation; bundling constraints were implicit | Explicitly reviewed, matching runtime lists in userscript and extension builders, with boot last; new v3 module addition requires intentional build change |
| Repository documentation | `docs/ARCHITECTURE.md` described pre-v3 runtime only; Firefox install guide contained stale release numbers | Rewrite runtime architecture for current implementation; update install and mode instructions |
| Legacy code | `src/` contains older UI/profile/sheet code but is not shipped in v3 bundles | Keep isolated and tested. Do not mix with v3 or remove until tests and replacement interfaces have been audited |

## Modes and trust boundary

**Player Character:** R20eb can read a source-verified controlled token and attempt native actions only when existing character permissions and source controls permit it. Background tab traversal belongs to an R20eb-owned official sheet opened for exactly that character.

**DM Sheet:** R20eb can present a uniquely opened visible official 2024 PC sheet and read its *currently displayed tab*. This source identification does not prove token ownership, grant Roll20 GM privileges, or authorize modifying sheet data. It never hides the user-opened sheet or changes its tabs. No hidden all-tab DM importer is claimed.

**Unbound:** nothing current is proven. Past snapshots may remain cached by campaign but do not appear as an adopted active PC.

## What remains risky / not yet implemented

1. **Live DM and Jumpgate validation:** source HTML confirms outer dialog and visible character ID, not contents/behavior of the cross-origin iframe. Need a user test for freshly opened level-7 PC, no-token DM import, page switch and close/reopen.
2. **Whole-sheet DM read without tab manipulation:** design a separate character-ID-bound DM-owned private reader and prove it never interferes with manually opened official sheets. This is a substantial separate milestone.
3. **Native Roll20 action coverage:** `v3/21_native.js` has many explicit fallback/verification paths; only confirmed official source controls may be invoked. Remaining unmapped native actions require real Roll20 diagnosis, not guessed macros.
4. **Large shared presentation files:** `v3/22_hud.js` and Firefox `battlefield-layout.js` are substantial. Splitting CSS/render/menu logic may help, but should be done separately with visual regression tests; not necessary for mode isolation.
5. **Outdated historical change descriptions:** README and handover retain prior milestones for traceability. New architecture docs are the authoritative current module map; older sections may carry historical release statuses.

## Quality gates

- Node test suite: `npm run check:firefox`; includes legacy source regression and modern role/HUD/Jumpgate tests.
- Signed Firefox packaging: separate release-request version, Mozilla AMO signing and digest-backed update feed, not satisfied by CI alone.
- Chrome and optional userscript are built from the same v3 runtime but separately versioned and not feature-parity guaranteed for Firefox-only UI.
- Explicit restrictions: no additional browser permissions, no fabricated native Roll20 actions, no leaking user-specific campaign character IDs into committed tests.
