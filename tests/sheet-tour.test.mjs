import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const modules=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js',
  '16_beacon_visible.js','17_frame_bridge.js','18_sheet_tour.js','19_radial_hud.js',
  '20_ui.js','25_bg3_theme.js','30_events.js'];
const script=modules.map(x=>readFileSync(join(root,'src',x),'utf8')).join('\n');
function harness(doc){
  const stored=new Map(),intervals=[];
  const page=doc||{querySelectorAll(){return []}};
  const win={parent:{},addEventListener(){}};
  const scope={document:page,window:win,location:{hostname:'test.example',pathname:'/test',search:'',href:'https://test.example/test'},
    URL,URLSearchParams,crypto,console,Date,Math,
    setTimeout(fn){fn();return 1},clearTimeout(){},
    setInterval(fn){intervals.push(fn);return intervals.length},
    clearInterval(){},
    localStorage:{getItem(k){return stored.get(k)||null},setItem(k,v){stored.set(k,v)}}
  };
  vm.createContext(scope);
  vm.runInContext(script+'\nload();globalThis.api={RB,profile,sheetTourTabs,sheetTourActive,sheetTourMergeVisible,sheetTourAccumulator,sheetTourAdd,sheetTourFrameScan,sheetTourStart,sheetTourCancel,sheetTourPromptOpen,sheetUI};',scope);
  return {api:scope.api,intervals,doc:page};
}
function tab(label,selected,change) {
  return {innerText:label,textContent:label,role:'tab',className:'sheet-tab',
    getAttribute(attr){return attr==='role'?'tab':attr==='aria-selected'?(selected.value===label?'true':'false'):null},
    closest(){return {nodeName:'NAV'}},
    click(){change?.(label);selected.value=label},
    isConnected:true};
}
function field(name,value){
  return {type:'text',value:String(value),getAttribute(k){return k==='name'?'attr_'+name:null},
    hasAttribute(){return false},closest(){return null}};
}
test('safe navigation ignores similarly named action buttons',()=>{
  const {api}=harness();
  const selected={value:'Combat'};
  const combat=tab('Combat',selected);
  const spells=tab('Spells',selected);
  const misleading={innerText:'Spells',className:'',getAttribute(){return null},closest(){return null}};
  const scope={querySelectorAll(){return [combat,misleading,spells]}};
  const nav=api.sheetTourTabs(scope,['Combat','Spells'],'button,[role="tab"]');
  assert.equal(nav.length,2);assert.equal(nav[0],combat);assert.equal(nav[1],spells);
});
test('frame tour scans available named attributes across Combat, Spells and Inventory',async()=>{
  const selected={value:'Combat'};
  const tabs=['Combat','Spells','Inventory'].map(n=>tab(n,selected));
  const data={Combat:[field('hp',84),field('hp_max',84)],
    Spells:[field('repeating_spell-1_$0_spellname','Bless'),field('spell_attack_bonus',7)],
    Inventory:[field('repeating_inventory_$0_itemname','Potion of Healing')]};
  const body={
    get innerText(){return 'Character Sheet\n'+selected.value+'\nHIT POINTS\n84 / 84\nABILITIES\nWIS 15 +2 +2\nSKILLS\nCombat';},
    querySelectorAll(selector){
      if(selector.startsWith('input,textarea'))return data[selected.value];
      return [];
    }
  };
  const doc={body,querySelectorAll(selector){
    if(selector.startsWith('button,[role="tab"]'))return tabs;
    if(selector.includes('[role="tab"]'))return tabs;
    return [];
  }};
  const {api}=harness(doc);
  const result=await api.sheetTourFrameScan();
  assert.equal(result.fields.hp.current,'84');
  assert.equal(result.fields['repeating_spell-1_$0_spellname'].current,'Bless');
  assert.equal(result.fields['repeating_inventory_$0_itemname'].current,'Potion of Healing');
  assert.ok(result.tabs.includes('Spells'));
  assert.ok(result.tabs.includes('Inventory'));
  assert.equal(selected.value,'Combat','must return to original tab even after traversal');
});
test('merges visible results across tabs without duplicate attacks or resources',()=>{
  const {api}=harness(),acc=api.sheetTourAccumulator();
  const first={stats:{hp:12},coverage:{names:['HP'],sections:['Combat'],visibleFields:1},
    attacks:[{id:'blade',name:'Blade'}],resources:[]};
  const second={stats:{ac:16},coverage:{names:['AC','HP'],sections:['Combat'],visibleFields:2},
    attacks:[{id:'blade',name:'Blade'}],resources:[{id:'ki',name:'Ki',current:2,max:3}]};
  api.sheetTourMergeVisible(acc.visible,first);api.sheetTourMergeVisible(acc.visible,second);
  assert.equal(acc.visible.stats.hp,12);
  assert.equal(acc.visible.stats.ac,16);
  assert.equal(acc.visible.attacks.length,1);
  assert.equal(acc.visible.resources.length,1);
  assert.equal(acc.visible.coverage.visibleFields,2);
});
test('missing character window prompts the user and can cancel waiting',async()=>{
  const {api,intervals}=harness();
  await api.sheetTourStart();
  assert.equal(api.RB.sheetTourWaiting,true);
  assert.ok(intervals.length>0);
  const ui=api.sheetUI();
  assert.match(ui,/Open your character sheet in Roll20 now/);
  assert.match(ui,/Cancel waiting/);
  api.sheetTourCancel();
  assert.equal(api.RB.sheetTourWaiting,false);
});
test('tab controls and manual import remain accessible while the guided flow is available',()=>{
  const {api}=harness();
  const markup=api.sheetUI();
  assert.match(markup,/data-action="sheetTourAll"/);
  assert.match(markup,/data-action="scanSheets"/);
  assert.match(markup,/data-action="syncSheet"/);
  assert.match(markup,/id="rbe-sheet-tour-status"/);
});
