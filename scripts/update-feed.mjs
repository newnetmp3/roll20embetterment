// Writes updates.json for a Mozilla-signed XPI published as a GitHub release.
// Usage: node scripts/update-feed.mjs <signed.xpi> <version>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { manifest } from './build.mjs';

const [file, version] = process.argv.slice(2);
if (!file || !/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('usage: update-feed.mjs <signed.xpi> <x.y.z>');
const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
const id = manifest.browser_specific_settings.gecko.id;
const feed = {
  addons: {
    [id]: {
      updates: [{
        version,
        update_link: `https://github.com/newnetmp3/roll20embetterment/releases/download/roll20embetterment-v${version}/roll20embetterment-${version}.xpi`,
        update_hash: 'sha256:' + hash,
      }],
    },
  },
};
writeFileSync('updates.json', JSON.stringify(feed, null, 2) + '\n');
console.log(`updates.json -> ${version} sha256:${hash}`);
