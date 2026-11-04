// The Campaign Exporter is its own add-on: its own id, its own message tag
// loaded before the shared sheet scripts, and nothing of it in the action bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exporterManifest, EXPORTER_ID } from '../scripts/build-exporter.mjs';
import { manifest } from '../scripts/build.mjs';

test('exporter: separate add-on with its own message tag', () => {
  assert.equal(exporterManifest.browser_specific_settings.gecko.id, EXPORTER_ID);
  assert.notEqual(EXPORTER_ID, manifest.browser_specific_settings.gecko.id);
  for (const cs of exporterManifest.content_scripts.filter((c) => c.js.includes('src/shared/wire.js'))) {
    assert.equal(cs.js[0], 'exporter/src/tag.js', 'tag before wire.js');
  }
  assert.match(exporterManifest.browser_specific_settings.gecko.update_url, /exporter\/updates\.json$/);
  const bar = JSON.stringify(manifest);
  assert.ok(!/exporter|host_permissions|background/.test(bar), 'action bar has no exporter parts');
});
