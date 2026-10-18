import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createFirefoxUpdates,FIREFOX_ADDON_ID,FIREFOX_UPDATE_URL} from '../scripts/lib/firefox-updates.mjs';
const root=resolve(import.meta.dirname,'..');
test('Firefox uses a stable signed identity and separate update endpoint',()=>{
  const m=JSON.parse(readFileSync(join(root,'dist/firefox/extension/manifest.json'),'utf8'));
  const config=JSON.parse(readFileSync(join(root,'extension/firefox/package.json'),'utf8'));
  assert.equal(m.version,config.version);
  assert.equal(m.browser_specific_settings.gecko.id,FIREFOX_ADDON_ID);
  assert.equal(m.browser_specific_settings.gecko.update_url,FIREFOX_UPDATE_URL);
});
test('signed update metadata accepts only a version/hash and signed-release location',()=>{
  const update=createFirefoxUpdates({version:'3.4.1',sha256:'a'.repeat(64)})
    .addons[FIREFOX_ADDON_ID].updates[0];
  assert.equal(update.update_hash,'sha256:'+'a'.repeat(64));
  assert.equal(update.update_link,
    'https://github.com/newnetmp3/roll20embetterment/releases/download/firefox-v3.4.1/r20eb-firefox-v3.4.1.xpi');
  assert.doesNotMatch(update.update_link,/unsigned|chrome|\.zip/);
  assert.throws(()=>createFirefoxUpdates({version:'3.4.1',sha256:''}),/SHA-256/);
  assert.throws(()=>createFirefoxUpdates({version:'bad',sha256:'a'.repeat(64)}),/version/);
});
test('Firefox update feed stays empty until signed releases are available',()=>{
  const feed=JSON.parse(readFileSync(join(root,'extension/firefox/updates.json'),'utf8'));
  assert.deepEqual(Object.keys(feed.addons),[FIREFOX_ADDON_ID]);
  assert.ok(Array.isArray(feed.addons[FIREFOX_ADDON_ID].updates));
  for(const entry of feed.addons[FIREFOX_ADDON_ID].updates){
    assert.match(entry.update_link,/^https:\/\/github\.com\/newnetmp3\/roll20embetterment\/releases\/download\//);
    assert.match(entry.update_link,/\.xpi$/);
    assert.match(entry.update_hash,/^sha256:[a-f0-9]{64}$/);
  }
});
