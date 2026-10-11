# R20 Embetterment — Rolling Roadmap

**Updated:** October 11, 2026 · **Goal:** Player-first, D&D 5e combat companion on Roll20 (2014 + official 2024).

| Priority | Feature | Status | Next requirement |
| --- | --- | --- | --- |
| 1 | Modular userscript, BG3-inspired concentric combat wheel | ✅ merged | Maintain |
| 2 | Jumpgate tracking and full 2024 attribute/sheet tab tours | ✅ merged | Live QA |
| 3 | Player-controlled multi-character auto-import and profile switching | ✅ v2.3.0 | Live QA |
| 4 | Secure official native weapon/spell/skill/tool rolls, closed-sheet helper | ✅ v2.3.2 | Live QA |
| 5 | Unified Sheet/palette/wheel official native roll controls | ✅ v2.3.3 PR #16 | 128 tests passing; continue live QA |
| 6 | Native-roll pending feedback and duplicate-click protection | 🟡 v2.3.4 in progress | CI, review and merge |
| 7 | Spell roll versus casting semantics, safe local turn/resource reminders | ⬜ planned | Design + tests |
| 8 | Keyboard accessibility, wheel density, palette navigation | ⬜ planned | QA + implementation |
| 9 | Real Roll20 integration matrix (iframe, popout, helper, legacy 2014) | 🔍 live QA | Browser fixtures |
| 10 | Release/version automation and reproducible install | ⬜ planned | CI tags |

**Active milestone v2.3.4:** Suppress duplicate native-roll invocations while in flight, show visible busy/success/failure states and allow safe retries after resolution.

**Rolling update contract:** Every development PR refreshes both this roadmap and `docs/HANDOVER.md`; a milestone becomes ✅ only after verified checks and merge.
