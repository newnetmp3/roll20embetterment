// Builds the Foundry VTT module: dist/foundry/foundryembetterment/ and a zip
// whose root holds module.json, ready for a GitHub release. The menu model and
// the bar are the same files the Firefox add-on uses.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = JSON.parse(readFileSync(join(root, 'foundry', 'module.json'), 'utf8'));
// The download link always names this version's release.
mod.download = 'https://github.com/newnetmp3/roll20embetterment/releases/download/foundryembetterment-v' + mod.version + '/foundryembetterment.zip';
const files = [
  ['module.json', Buffer.from(JSON.stringify(mod, null, 2) + '\n')],
  ['scripts/model.js', readFileSync(join(root, 'src/editor/model.js'))],
  ['scripts/ui.js', readFileSync(join(root, 'src/editor/ui.js'))],
  ['scripts/adapter.js', readFileSync(join(root, 'foundry/scripts/adapter.js'))],
  ['scripts/main.js', readFileSync(join(root, 'foundry/scripts/main.js'))],
  ['LICENSE', readFileSync(join(root, 'LICENSE'))],
  ['README.md', readFileSync(join(root, 'foundry/README.md'))],
];
const out = join(root, 'dist', 'foundry');
rmSync(out, { recursive: true, force: true });
for (const [name, data] of files) {
  mkdirSync(dirname(join(out, mod.id, name)), { recursive: true });
  writeFileSync(join(out, mod.id, name), data);
}
writeFileSync(join(out, mod.id + '.zip'), zip(files));
writeFileSync(join(out, 'module.json'), files[0][1]);
console.log('Built dist/foundry/' + mod.id + '.zip (v' + mod.version + ')');
