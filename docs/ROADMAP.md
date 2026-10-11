# R20 Embetterment — Rolling Roadmap

**Updated:** October 11, 2026 · **Goal:** Player-first, D&D 5e combat companion on Roll20 (2014 + official 2024).

| Priority | Feature | Status | Next requirement |
| --- | --- | --- | --- |
| 1 | Modular userscript, BG3-inspired concentric combat wheel | ✅ merged | Maintain |
| 2 | Jumpgate tracking and full 2024 attribute/sheet tab tours | ✅ merged | Live QA |
| 3 | Player-controlled multi-character auto-import and profile switching | ✅ v2.3.0 | Live QA |
| 4 | Secure official native weapon/spell/skill/tool rolls, closed-sheet helper | ✅ v2.3.2 | Live QA |
| 5 | Unified Sheet/palette/wheel official native roll controls | ✅ v2.3.3 PR #16 | 128 tests passing; continue live QA |
| 6 | Native-roll pending feedback and duplicate-click protection | ✅ v2.3.4 PR #17 | 130 passing tests; live Roll20 QA remains |
| 7 | Spell roll versus casting semantics, safe local turn/resource reminders | ✅ v2.3.5 PR #18 | 136 tests passing; live Roll20 QA remains |
| 8 | Keyboard accessibility, wheel density, palette navigation | ✅ v2.3.6 PR #19 | 140 tests passing; live density/keyboard QA remains |
| 9 | Real Roll20 integration matrix (iframe, popout, helper, legacy 2014) | 🧪 v2.3.9 merged (PR #22) | 167 tests passing; sheet fallback and source-aware stats shipped; live browser QA still required |
| 10 | Release/version automation and reproducible install | ⬜ planned | CI tags |

**Next actionable milestone:** Live test Nier's Roll20 button and match actual health, AC, speed and initiative against the official sheet. If token bars are unlinked, choose the configured HP bar in R20eb Sheet; use source diagnostics to target the remaining 2024 adapter gaps.

**Rolling update contract:** Every development PR refreshes both this roadmap and `docs/HANDOVER.md`; a milestone becomes ✅ only after verified checks and merge.
