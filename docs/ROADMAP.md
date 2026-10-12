# R20 Embetterment — v3 clean restart roadmap

Updated: October 12, 2026. v2.3.13 continued to fail real Floorp/Roll20 imports despite green DOM mocks. The production script is being **replaced**, not patched.

| Priority | Milestone | Status | Required verification |
| --- | --- | --- | --- |
| 1 | Replace production bundle with independent v3 engine | Implemented | Run 38182938287 green; 189 total tests, 10 for v3; v2 runtime excluded |
| 2 | Labeled HP/stats/abilities/saves/skills/slots | CI verified; live QA pending | Official 2024 iframe in Floorp |
| 3 | Spells, attacks, inventory, features and resources | Implemented; live QA pending | Live populated character sheet tabs |
| 4 | Bounded tab traversal, origin verification, diagnostics and JSON export | UI click-handler fix and tests in v3.0.1; live QA pending | Floorp end-to-end scan |
| 5 | Improve unmapped fields from exported observations | Planned | No guessed selectors |
| 6 | Verify virtualized tabs and official sheet popouts | Planned | Browser QA matrix |
| 7 | Rebuild player combat wheel atop confirmed importer data | Planned | Separate architecture |
| 8 | Add independent 2014 sheet adapter | Planned | Real 2014 fixtures |
| 9 | Release/installation automation | Planned | Repeatable CI and browser install |

**v3.0.1 fix:** The sheet was detected, but all buttons failed because the UI refreshed a nonexistent `r3-title` element. Now references `r3-toggle`, reports unexpected control exceptions and covers actual scan button interaction with a mocked frame. 194 tests pass. Browser verification still required.

**Next:** Install v3.0.1 with the previous version disabled. Open the original 2024 sheet, import all tabs, verify HP 82/84, STR 18, AC 17, speed 55, initiative +2.14 and spell inventory; export JSON for any missed fields. Do not call the importer correct based solely on CI.

Rolling rule: update this roadmap and docs/HANDOVER.md with each development milestone.
