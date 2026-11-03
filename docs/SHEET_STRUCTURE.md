# Roll20 D&D 2024 sheet structure (observed Nov 2026)

Notes from real PC and NPC sheet HTML. Update when Roll20 changes the sheet.

## Editor page (app.roll20.net/editor)

- Left toolbar: `#master-toolbar`. The companion docks to its right edge.
- Sheet window: `.characterdialog[data-characterid]` containing
  `iframe#advanced-charsheet-dialog__charsheet` named `iframe_<characterId>`.
- Other frames load the same sheet URL but are not character sheets:
  `#charsheetSettingsIframe` and the hidden `headless_sheet_frame_dnd2024byroll20`.
- Journal: `#journalfolderroot li.journalitem.character[data-itemid]`, name in `.namecontainer`.
  Clicking the entry opens the sheet.
- Chat attack cards contain `button.dnd-2024__roll-action[data-sheet-action="damage"]`
  (the Damage button), added by Roll20 when the attack comes from the sheet.

## Sheet frame (advanced-sheets.production.roll20preflight.net/dnd2024byroll20/)

- Root `.dnd-sheet.pc-sheet` or `.dnd-sheet.npc-sheet`.
- PC renders twice: `.wrapper--mobile` and `.wrapper--desktop`. All 7 tabs are
  mounted; inactive `.layout-tabbed-panel__display` panels are `display:none`.
- NPC renders twice: `.npc__large` (two columns) and `.npc__small`.
- Roll settings: `.manage__roll-privacy--radio` / `.manage__roll-mode--radio`, options `[role=radio]`.

| Thing | Row | Name | Buttons |
| --- | --- | --- | --- |
| Attack | `.attack-item` | `.span--item-row-title` | `.poly-button--hit-dc button`, `.poly-button--damage button`, `.poly-button--item-row-chat button` |
| Action | `.action-item` | `.span--item-row-title` | `.poly-button--healing button` (rolls), chat |
| Feature | `.feature-item` | `.feature-item__title-chat .span--item-row-title` | chat; source `.feature-item__source`; timing `.feature-item__action` |
| NPC feature | `.npc-feature` | `.poly-value__label` ("Name:") | `.npc-feature__chat button` |
| Item | `.item-item` | `.item-item__title` | equip `[role=switch]`, qty `.poly-incrementer__button--increment/--decrement`, value `aria-valuenow` |
| Spell | `.spell-item` | `.spell-item__name` | `.spell-item__chat button`, hit/damage in `.spell-item__hit-dc` / `.spell-item__damage` |
| Ability | `.inline-ability` | `.utility-incrementer__label` | `.poly-button--ability button`, `.poly-button--compact-saving-throw button` |
| Skill/tool (PC) | `button[aria-label="Roll a X check"]` | aria-label | itself; bonus in `.skill .skill__bonus` |
| Skill (NPC) | `.npc-abilities__skill-button` | `.npc-skill__name` | inner button |
| Counters | `.view-resource .draggable-list__item` | `.view-resource__name` | count: `.view-resource__decrement/__increment button` + `.poly-incrementer__input[aria-valuenow]`; checkbox: `input.range-counter__input[type=range]` |
| HP (PC) | inputs titled `Current Hitpoints`, `Max Hitpoints`, `Temp`, `Heal or Damage` | | `.utility-button--harm`, `.utility-button--heal` |
| Rests / hit dice | `button[aria-label="Short Rest"]`, `button[aria-label^="Roll a d"][aria-label*="hit die"]` | | |
| Initiative | PC `.initiative-btn`; NPC `.npc-info__initiative .poly-button.initiative` | | inner button |
