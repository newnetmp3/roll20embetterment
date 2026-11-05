// Builds Roll20embetterment Campaign Exporter, a separate Firefox add-on, into
// dist/exporter/ (unpacked) plus a zip. It bundles its own copy of the 2024
// sheet reader (same files as the action bar) with its own message tag.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const exporterVersion = JSON.parse(readFileSync(join(root, 'exporter/release-request.json'), 'utf8')).version;
const TAG = 'exporter/src/tag.js';
export const EXPORTER_ID = 'roll20-campaign-exporter@newnetmp3.github.io';

export const exporterManifest = {
  manifest_version: 3,
  name: 'Roll20embetterment Campaign Exporter',
  version: exporterVersion,
  description: 'Unofficial. Saves a whole Roll20 campaign (pages, tokens, walls, characters incl. 2024 sheets, handouts, tables, jukebox, every image) as zip files for the Foundry VTT importer.',
  icons: { 48: 'icons/icon.svg', 96: 'icons/icon.svg' },
  action: { default_title: 'Export this Roll20 campaign for Foundry', default_icon: 'icons/icon.svg' },
  background: { scripts: ['exporter/src/background.js'] },
  // Save the zip parts straight into the Downloads folder (no save dialogs).
  permissions: ['downloads'],
  // Download images and audio from Roll20 and its file storage (uploaded
  // audio is handed out from Amazon storage or its CDN).
  host_permissions: ['https://app.roll20.net/*', 'https://*.roll20.net/*', 'https://s3.amazonaws.com/*', 'https://*.amazonaws.com/*', 'https://*.cloudfront.net/*', 'https://files.d20.io/*'],
  content_scripts: [
    { matches: ['https://app.roll20.net/editor*'], js: ['exporter/src/page.js'], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://app.roll20.net/editor*'], js: [TAG, 'src/shared/wire.js', 'src/editor/classic.js', 'src/editor/sheets.js', 'exporter/src/exporter.js'], run_at: 'document_idle' },
    {
      matches: ['https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/*'],
      js: [TAG, 'src/shared/wire.js', 'src/sheet/parse.js', 'src/sheet/act.js', 'src/sheet/main.js'], all_frames: true, run_at: 'document_idle',
    },
  ],
  browser_specific_settings: {
    gecko: {
      id: EXPORTER_ID,
      strict_min_version: '128.0',
      update_url: 'https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/exporter/updates.json',
      data_collection_permissions: { required: ['none'] },
    },
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, 'dist', 'exporter');
  rmSync(out, { recursive: true, force: true });
  const files = [['manifest.json', Buffer.from(JSON.stringify(exporterManifest, null, 2) + '\n')]];
  const all = new Set(['icons/icon.svg', 'exporter/src/background.js', ...exporterManifest.content_scripts.flatMap((c) => c.js)]);
  for (const f of all) files.push([f, readFileSync(join(root, f))]);
  files.push(['LICENSE', readFileSync(join(root, 'LICENSE'))]);
  for (const [name, data] of files) {
    mkdirSync(dirname(join(out, 'extension', name)), { recursive: true });
    writeFileSync(join(out, 'extension', name), data);
  }
  const name = 'roll20-campaign-exporter-' + exporterVersion + '.zip';
  writeFileSync(join(out, name), zip(files));
  console.log('Built dist/exporter/extension and dist/exporter/' + name);
}
