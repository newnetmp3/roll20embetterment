// Writes the update feed for a Mozilla-signed XPI published as a GitHub release.
// Usage: node scripts/update-feed.mjs <signed.xpi> <version> [--exporter]
//   default:     updates.json for Roll20embetterment
//   --exporter:  exporter/updates.json for the Campaign Exporter
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { manifest } from './build.mjs';
import { EXPORTER_ID } from './build-exporter.mjs';

const [file, version, flag] = process.argv.slice(2);
if (!file || !/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('usage: update-feed.mjs <signed.xpi> <x.y.z> [--exporter]');
const exporter = flag === '--exporter';
const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
const id = exporter ? EXPORTER_ID : manifest.browser_specific_settings.gecko.id;
const name = exporter ? 'roll20-campaign-exporter' : 'roll20embetterment';
const outFile = exporter ? 'exporter/updates.json' : 'updates.json';
const feed = {
  addons: {
    [id]: {
      updates: [{
        version,
        update_link: `https://github.com/newnetmp3/roll20embetterment/releases/download/${name}-v${version}/${name}-${version}.xpi`,
        update_hash: 'sha256:' + hash,
      }],
    },
  },
};
writeFileSync(outFile, JSON.stringify(feed, null, 2) + '\n');
console.log(`${outFile} -> ${version} sha256:${hash}`);
