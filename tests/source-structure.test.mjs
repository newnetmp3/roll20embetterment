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
