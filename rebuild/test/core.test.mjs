import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
function src(name){return readFileSync(new URL('src/'+name,root),'utf8');}
const sandbox={};vm.createContext(sandbox);
vm.runInContext(src('common.js')+'\nglobalThis.R4_test=R4;',sandbox);
const R=sandbox.R4_test;
test('character IDs never derive from names or arbitrary HTML',()=>{
 assert.equal(R.id('-P3f-mzIJNe0rkMc2r4D'),'-P3f-mzIJNe0rkMc2r4D');
 assert.equal(R.id(''), '');assert.equal(R.id('<script>'), '');
 assert.equal(R.id('Nier Stoneshadow'), '');
});
test('Controlled By is checked against exact player or all only',()=>{
 const model={attributes:{controlledby:'p123,p456'},get(k){return this.attributes[k];}};
 assert.equal(R.authorized(model,'p123'),true);
 assert.equal(R.authorized(model,'p12'),false);
 assert.equal(R.authorized(model,''),false);
 model.attributes.controlledby='all';
 assert.equal(R.authorized(model,'p999'),true);
});
test('read-only merged snapshots do not lose categories from earlier tabs',()=>{
 const a={stats:{hp:31},categories:{attacks:[{name:'Dagger'}]}};
 const b={stats:{ac:17},categories:{spells:[{name:'Light'}],attacks:[]}};
 const merged=R.merge(a,b);
 assert.equal(merged.stats.hp,31);assert.equal(merged.stats.ac,17);
 assert.equal(merged.categories.attacks[0].name,'Dagger');
 assert.equal(merged.categories.spells[0].name,'Light');
});
test('percent never reaches 100 with errors or incomplete units',()=>{
 assert.equal(R.progress(1,2,1,1,0),95);
 assert.equal(R.progress(2,2,0,1,0),100);
 assert.equal(R.progress(2,2,0,1,1),99);
 assert.equal(R.progress(0,2,0,1,0),0);
});
test('both worlds parse and share no access to Roll20 Mod API',()=>{
 new vm.Script('(function(){'+src('common.js')+src('ui.js')+src('selection.js')+src('editor.js')+'})();');
 new vm.Script('(function(){'+src('common.js')+src('reader.js')+'})();');
 assert.match(src('reader.js'),/event\.origin!==R4\.editor/);
 assert.match(src('editor.js'),/event\.origin!==R4\.sheet/);
 assert.match(src('editor.js'),/state\.mode!=='player'/);
 assert.doesNotMatch(src('reader.js'),/window\.d20|createObj|sendChat/);
});
test('only source-observed native buttons execute a click',()=>{
 const reader=src('reader.js');
 assert.match(reader,/control\.click\(\)/);
 assert.match(reader,/current\.source\.isConnected/);
 assert.match(reader,/R4\.same\(data\.expectedName,sheetName\(\)\)/);
});

test('Jumpgate adapter is isolated and bounded before reading internal engines',()=>{
 const j=src('selection.js');
 new vm.Script(j);
 assert.match(j,/checked>=3/);
 assert.match(j,/ids.length>16000/);
 assert.match(j,/bytes>64000000/);
 assert.match(j,/getterVerified\(tabletop\.getSelection\)/);
});

test('unknown single buttons are never considered native attacks',()=>{
 const reader=src('reader.js');
 assert.doesNotMatch(reader,/buttons.length===1\?buttons\[0\]/);
 assert.doesNotMatch(reader,/found.length===1\)control=found\[0\]/);
 assert.match(reader,/eligible.length===1\?eligible\[0\]:null/);
});

test('HP fast-peek avoids tab navigation and preserves native actions',()=>{
 const reader=src('reader.js'),editor=src('editor.js');
 assert.match(reader,/function peekStats\(\)/);
 assert.match(reader,/message\('peek'/);
 assert.match(editor,/function maybePeek\(\)/);
 assert.match(editor,/Date\.now\(\)-state\.lastPeek<1200/);
});

test('private all-tab reading discovers lazily mounted nested tabs with a hard limit',()=>{
 const reader=src('reader.js');
 assert.match(reader,/newcomers=tabs\(\)\.map\(describe\)/);
 assert.match(reader,/queue\.splice\(i\+1,0,\.\.\.newcomers\)/);
 assert.match(reader,/names.length<32/);
});
