# Roll20 → Foundry VTT campaign import

Imports a Roll20 campaign exported with
[r20Exporter](https://github.com/ooshhub/r20Exporter) (the "R20Exporter"
zip: `campaign.json`, `characters/`, `journal/`, `pages/`, `jukebox/`) into a
Foundry VTT v14 world running dnd5e 6.

Two steps: a script on the Foundry server unpacks the export, then a Foundry
module creates everything inside your world.

## 0. Export from Roll20 (recommended: the Campaign Exporter add-on)

Install **Roll20embetterment Campaign Exporter** (a separate Firefox add-on,
see [exporter/](../exporter/README.md)), open the campaign in Roll20 as GM,
click its toolbar button → Export. Keep the tab open until it says Done.

Compared with r20Exporter it:
- downloads every image and audio file through the add-on, so Roll20 can't
  refuse them (r20Exporter misses many, which leaves holes in maps);
- stores each image once (r20Exporter saves a copy per token), so the export
  is much smaller;
- reads characters on the **2024 sheet** by opening each one hidden, so their
  stats, skills, attacks, actions, features, items and spells come across;
- saves zip files of up to 1 GB each ("… part 1.zip", "… part 2.zip", …).
  Give `r20prep.py` part 1; it finds the other parts in the same folder.

r20Exporter zips still work: `r20prep.py` downloads the images they're
missing on the server.

## 1. On the Foundry server (Arch Linux)

```bash
git clone https://github.com/newnetmp3/roll20embetterment.git
cd roll20embetterment/importer
sudo python3 r20prep.py "/home/scott/Downloads/The Shattered Lands - Foundry export part 1.zip"
```

It unpacks into `Data/r20import/<campaign>/`, fixes image file types,
writes an index, installs the **Roll20 Campaign Import** module into
`Data/modules/r20import`, and makes `komovtt` the owner. Defaults:
`--data /home/komovtt/.local/share/FoundryVTT/Data --user komovtt`.
It checks free disk space first (the unpacked copy is about the zip's size).

## 2. In Foundry

1. Return to Setup (or restart Foundry) so it sees the new module.
2. Create a world with **Dungeons & Dragons Fifth Edition** and launch it.
3. **Game Settings → Manage Modules**: enable *Roll20 Campaign Import*.
4. **Game Settings → Configure Settings → Roll20 Campaign Import → Open importer**.
5. Pick the campaign, match Roll20 players to Foundry users, press **Import**.

Big campaigns take a few minutes. It is safe to run again: things already
imported are skipped.

## What comes across

| Roll20 | Foundry |
| --- | --- |
| Pages | Scenes: map images as tiles, tokens (linked to their actors), GM-layer items hidden, dynamic-lighting walls, drawings, text, grid and scale, vision and fog settings |
| Characters (Classic 5e OGL sheet) | dnd5e actors: abilities, HP, AC, speeds, senses, CR, type, saves and skills, NPC actions as working attacks (to-hit, damage, saves, recharge, uses), traits, inventory, spells, class, currency, spell slots, bio and GM notes (as a secret section), art and token settings, lights and vision |
| Spells, items, classes, species, backgrounds | Taken from the dnd5e compendiums (2024 first) when the name matches, else built from the sheet |
| Custom species (homebrew races), subclasses, backgrounds | Built from the sheet's traits (2024 sheet: by their source label; Classic: "Racial" traits), put on the character and saved once to the Items sidebar (*Campaign › Species / Subclasses / Backgrounds*, each species with its traits) for reuse |
| Handouts | Journal entries: image, notes, GM notes (GM-only page) |
| Journal folders | Actor and Journal folders |
| `controlledby` / `inplayerjournals` | Ownership for the mapped users |
| Roll tables, macros, jukebox | Roll tables; macros (Roll20 text, kept for reference); playlists |
| Roll20 journal links | Foundry links between entries and actors |

Not imported: chat archive, card decks, turn order, character ability macros
(kept on the actor as a flag), doors and windows (not in the export).
Characters on the **2024 sheet** need Roll20embetterment's exporter (see step
0); from an r20Exporter zip they keep only name, art, bio and basics. Either
way, add their class from the dnd5e compendium afterwards (the 2024 sheet's
reading shows the level, not the class).
