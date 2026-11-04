// Builds the Firefox extension into dist/firefox/ (unpacked) and an
// unsigned zip next to it. No dependencies.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

export const EDITOR_SCRIPTS = ['src/shared/wire.js', 'src/editor/model.js', 'src/editor/classic.js', 'src/editor/sheets.js', 'src/editor/ui.js', 'src/editor/main.js'];
export const PAGE_SCRIPT = 'src/editor/selection.js';
export const SHEET_SCRIPTS = ['src/shared/wire.js', 'src/sheet/parse.js', 'src/sheet/act.js', 'src/sheet/main.js'];

export const manifest = {
  manifest_version: 3,
  name: 'Roll20embetterment',
  version: pkg.version,
  description: 'Unofficial action bar for Roll20 D&D 5E character sheets (2024 and Classic). Uses the sheet\'s own buttons, so chat rolls keep their Damage button.',
  icons: { 48: 'icons/icon.svg', 96: 'icons/icon.svg' },
  permissions: ['storage'],
  content_scripts: [
    // Runs in Roll20's page to read the token selection (see selection.js).
    { matches: ['https://app.roll20.net/editor*'], js: [PAGE_SCRIPT], run_at: 'document_start', world: 'MAIN' },
    { matches: ['https://app.roll20.net/editor*'], js: EDITOR_SCRIPTS, run_at: 'document_idle' },
    {
      matches: ['https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/*'],
      js: SHEET_SCRIPTS, all_frames: true, run_at: 'document_idle',
    },
  ],
  browser_specific_settings: {
    gecko: {
      id: 'roll20-sheet-companion@newnetmp3.github.io',
      strict_min_version: '128.0',
      // Firefox checks this feed for new signed versions (written by the sign workflow).
      update_url: 'https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/updates.json',
      data_collection_permissions: { required: ['none'] },
    },
  },
};

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
// Uncompressed ZIP with a fixed timestamp, so builds are reproducible.
function zip(files) {
  const local = [];
  const central = [];
  let pos = 0;
  for (const [filename, data] of files) {
    const name = Buffer.from(filename);
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    const c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(33, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(33, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(pos, 42);
    local.push(h, name, data);
    central.push(c, name);
    pos += h.length + name.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(pos, 16);
  return Buffer.concat([...local, ...central, end]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, 'dist', 'firefox');
  rmSync(out, { recursive: true, force: true });
  const files = [['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')]];
  for (const f of new Set([PAGE_SCRIPT, ...EDITOR_SCRIPTS, ...SHEET_SCRIPTS, 'icons/icon.svg'])) files.push([f, readFileSync(join(root, f))]);
  for (const [name, data] of files) {
    mkdirSync(dirname(join(out, 'extension', name)), { recursive: true });
    writeFileSync(join(out, 'extension', name), data);
  }
  const zipName = 'roll20embetterment-' + pkg.version + '.zip';
  writeFileSync(join(out, zipName), zip(files));
  // addons.mozilla.org upload: Mozilla hosts updates for listed add-ons, so
  // no self-hosted update_url.
  const amo = JSON.parse(JSON.stringify(manifest));
  delete amo.browser_specific_settings.gecko.update_url;
  const amoFiles = [['manifest.json', Buffer.from(JSON.stringify(amo, null, 2) + '\n')], ...files.slice(1), ['LICENSE', readFileSync(join(root, 'LICENSE'))]];
  const amoName = 'roll20embetterment-' + pkg.version + '-amo.zip';
  writeFileSync(join(out, amoName), zip(amoFiles));
  console.log('Built dist/firefox/extension, dist/firefox/' + zipName + ' and dist/firefox/' + amoName);
}

