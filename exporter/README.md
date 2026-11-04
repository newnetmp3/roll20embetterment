# Roll20embetterment Campaign Exporter

A separate Firefox add-on that saves a whole Roll20 campaign as zip files for
the Foundry VTT importer in [importer/](../importer/README.md). It doesn't
need the Roll20embetterment action bar, and the two can be installed together.

## Use

1. Install the signed `.xpi` from the
   [releases](https://github.com/newnetmp3/roll20embetterment/releases)
   ("Roll20embetterment Campaign Exporter"). It updates itself afterwards.
2. Open your campaign in Roll20 **as the GM** (the game itself, not the
   campaign's details page).
3. Click the exporter's toolbar button → **Export**. Keep the tab open until
   it says Done. Firefox may ask where to save each zip.
4. Copy the zips to the Foundry server and run
   `sudo python3 r20prep.py "<Campaign> - Foundry export part 1.zip"` (it
   finds the other parts in the same folder), then import in Foundry.

## What it saves

- Pages with every graphic, text and path (walls included), plus anything else
  Roll20 keeps on a page (such as doors and windows); archived pages too.
- Characters with all sheet attributes, abilities (macros), bios, GM notes and
  default tokens. Characters on the **2024 sheet** are opened hidden one at a
  time and read with the same sheet reader as the action bar, because their
  data isn't in Roll20's attributes.
- Handouts with notes and GM notes, roll tables, card decks, players' macros,
  the jukebox, Journal and jukebox folders, the turn order.
- Every image (maps, tokens, token sides, portraits, handout art, images
  inside bios and notes) and jukebox track ("My Audio", Tabletop Audio,
  Incompetech), each downloaded once and stored under `assets/`.
  `campaign.json` records which Roll20 link each file came from.

Zips are at most about 1 GB each; `campaign.json` is in the last one.

## Permissions

It downloads images and audio from Roll20 (`*.roll20.net`) and its file
storage (`s3.amazonaws.com`, `files.d20.io`). Requests from the add-on itself
aren't refused the way a web page's are, which is why nothing goes missing.
Files go only to your own downloads folder; nothing is sent anywhere else.

## Build and release

- Build: `node scripts/build-exporter.mjs` → `dist/exporter/`.
- Release: raise `version` in `exporter/release-request.json` and push to
  `main`; the "Campaign Exporter signed release" workflow signs it with
  Mozilla (unlisted), publishes the release and updates
  `exporter/updates.json`.
