# roll20 Embetterment 3.0.0 — Independent D&D 2024 sheet importer

This is a clean restart of the importer, **not another v2 patch**. The previous HUD, model cache, token HP reconciliation, and background imports are not included in the production userscript. Old source is retained under src/ for comparison only.

## Install and use
Install or update the script from https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js. Disable duplicate/old scripts and reload Roll20. Open an official D&D 2024 character sheet. The new importer appears at the bottom right of the editor. Refresh the sheet list, choose the visible sheet, then use **Read current tab** or **Import all tabs**. The latter navigates rendered tabs and sub-tabs and restores the original tab selection.

## What the new engine captures
- Labeled form values: current, max and temporary HP, AC, speed, initiative (including decimals), six abilities, modifiers, saving throws, skill bonuses, spell slots, level, proficiency, spell bonuses and other identifiable numeric fields.
- Named spells, attacks, inventory, features, resources and skills when those cards are rendered; spell/card text, casting metadata hints and accessible action labels.
- Raw labeled but unrecognized control values in **Fields**, explicit source information, coverage counts, rejected/hidden counters, scanned tabs and limits in **Diagnostics**.
- A local per-campaign snapshot and downloadable JSON export; missing values are **not** replaced with default stats.

This is a player-triggered, read-only scan. It never writes to Roll20 character values, accesses private application state or fetches data from external servers. The iframe and editor communicate via strict origin-checked postMessage. Hidden/headless frames are not treated as a player's open sheet. Bounded traversal avoids hanging the browser.

## Limits
This v3 baseline intentionally supports the official D&D **2024** sheet first; the old combat wheel and the 2014 sheet adapter will return in separate milestones. Roll20 may virtualize or lazily load cards: only rendered DOM values can be collected. All browser integration still needs a live Floorp test; DOM fixture tests cannot establish that the userscript actually loaded inside Roll20's iframe.

## Code and tests
Production only bundles v3/00_capture.js, v3/10_reader.js, v3/20_ui.js and v3/30_boot.js. Run npm run check (build, tests, syntax). The v2 implementation remains unexecuted in src/ and its legacy test suite remains for archival regression reference.
