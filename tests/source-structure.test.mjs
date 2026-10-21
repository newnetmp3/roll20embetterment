import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fullRuntimeSource,runtimeModuleNames} from './_runtime.mjs';
const root=resolve(import.meta.dirname,'..');
test('full runtime harness tracks new source modules in production build order',()=>{
  const names=runtimeModuleNames();
  const expected=['18_sheet_access.js','18_sheet_tour.js','18_stats_sync.js'];
  for(const name of expected)assert.ok(names.includes(name),name);
  assert.deepEqual([...names].sort(),names);
  const source=fullRuntimeSource();
  for(const name of expected){
    const contents=readFileSync(join(root,'src',name),'utf8').trim();
    assert.ok(source.includes(contents),name+' missing from runtime');
  }
  for(const signature of ['function autoRefreshCharacterStats(', 'function openRoll20CharacterSheet(',
    'async function sheetTourImportCandidate(']){
    assert.equal(source.split(signature).length-1,1,signature+' must have exactly one implementation');
  }
});

test('Jumpgate runtime does not depend on window.d20.Campaign in any shipped entry point',()=>{
  const files=['v3/21_native.js','v3/23_token.js','extension/firefox/movement-tracker.js',
    'extension/firefox/turn-economy.js','roll20-embetterment.user.js'];
  for(const name of files){
    const code=readFileSync(join(root,name),'utf8');
    assert.doesNotMatch(code,/(?:window\.d20(?:\?\.|\.)Campaign|\bd20\?\.Campaign)/,
      name+' should not use obsolete d20.Campaign in Jumpgate');
  }
  const token=readFileSync(join(root,'v3/23_token.js'),'utf8');
  assert.match(token,/function r3TokenCampaign\(\)\{[\s\S]*?return window\.Campaign\|\|null;/);
});
