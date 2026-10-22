import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});
vm.runInContext(readFileSync(new URL('../v3/00_capture.js',import.meta.url),'utf8')+';globalThis.api={r3Empty,r3ControlInventory,r3MergeControlInventory}',context);
const {r3Empty,r3ControlInventory,r3MergeControlInventory}=context.api;
function control(tag,attrs={},extra={}){
  return {tagName:tag,getAttribute:k=>attrs[k]||null,closest:()=>null,
    getClientRects:()=>[{}],click(){throw Error('Must never click')},...extra};
}
function scan(nodes,tab='Combat'){
  const s=r3Empty();s.diagnostics.tabs.push(tab);
  r3ControlInventory({querySelectorAll:()=>nodes},s,tab);return s;
}
test('inventory classifies controls without values, credentials, execution or invented native IDs',()=>{
  const s=scan([
    control('BUTTON',{'data-testid':'attack-123','aria-label':'Attack'}),
    control('INPUT',{type:'number',name:'hp'},{value:'private value'}),
    control('INPUT',{type:'checkbox','aria-label':'Equipped'}),
    control('SELECT',{'aria-label':'Slot level'}),
    control('INPUT',{type:'password'},{value:'secret'}),
    control('BUTTON',{}, {hidden:true}),
    control('A',{href:'https://private.example/token'})
  ]);
  assert.deepEqual(Array.from(s.controls,c=>c.kind),['action','counter','toggle','selection','unsupported']);
  assert.equal(s.controls[0].identity['data-testid'],'attack-123');
  assert.equal(s.controls[0].nativeActionRef,undefined);
  assert.ok(s.controls.every(c=>c.status==='observation-only'));
  assert.doesNotMatch(JSON.stringify(s.controls),/private value|secret|private.example/);
});
test('explicit references stay observations; conflicting and compound references are rejected',()=>{
  const s=scan([
    control('BUTTON',{'data-native-macro':'%{char123|attack}'}),
    control('BUTTON',{'data-native-macro':'%{char123|attack}','data-roll20-macro':'%{char456|attack}'}),
    control('BUTTON',{'data-native-macro':'%{char123|attack}; more'})
  ]);
  assert.equal(s.controls[0].nativeActionRef,'%{char123|attack}');
  assert.equal(s.controls[1].nativeActionRef,undefined);
  assert.equal(s.controls[2].nativeActionRef,undefined);
});
test('revisited views replace stale evidence while preserving other tabs and enforcing bounds',()=>{
  const s=scan([control('BUTTON',{'aria-label':'Old'})]);
  r3MergeControlInventory(s,scan([control('BUTTON',{'aria-label':'Spell'})],'Spells'));
  r3MergeControlInventory(s,scan([]));
  assert.equal(s.controls.length,1);assert.equal(s.controls[0].label,'Spell');
  const large=scan(Array.from({length:751},()=>control('BUTTON')),'Inventory');
  assert.equal(large.controls.length,750);
  assert.ok(large.diagnostics.limits.includes('750 visible interactive controls per view'));
  r3MergeControlInventory(s,large);
  r3MergeControlInventory(s,scan(Array.from({length:750},()=>control('BUTTON')),'Features'));
  assert.equal(s.controls.length,1500);
  assert.ok(s.diagnostics.limits.includes('1500 interactive controls total'));
});

test('hidden early DOM controls do not starve the visible inventory later in the document',()=>{
  const hidden=Array.from({length:900},()=>control('BUTTON',{}, {hidden:true}));
  const owner={querySelector:()=>({innerText:'Travel Rations',getClientRects:()=>[{}]}),getAttribute:()=>null};
  const quantity=control('INPUT',{type:'number'},{closest:sel=>sel.startsWith('.item-row,')?owner:null});
  const s=scan([...hidden,quantity],'INVENTORY');
  assert.equal(s.controls.length,1);
  assert.equal(s.controls[0].category,'inventory');
  assert.equal(s.controls[0].owner.name,'Travel Rations');
  assert.equal(s.diagnostics.limits.length,0);
});
test('range trackers and exact skill labels retain observed meaning; excessive DOM scan is reported',()=>{
  const s=scan([control('INPUT',{type:'range','aria-label':'Second Wind'}),
    control('BUTTON',{'aria-label':'Roll a Athletics check'})]);
  assert.equal(s.controls[0].kind,'counter');
  assert.equal(s.controls[1].category,'skills');
  const huge=scan(Array.from({length:12001},()=>control('BUTTON',{}, {hidden:true})));
  assert.ok(huge.diagnostics.limits.includes('12000 DOM candidates per view'));
});
test('merging control evidence does not mutate a prior snapshot diagnostics object',()=>{
  const prev=scan([control('BUTTON')]);
  const target={...prev};
  r3MergeControlInventory(target,scan([]));
  target.diagnostics.limits.push('new limit');
  assert.equal(prev.diagnostics.limits.length,0);
});
