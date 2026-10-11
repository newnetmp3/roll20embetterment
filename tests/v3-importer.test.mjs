import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(f=>/^\d{2}_.*\.js$/.test(f)).sort();
function input({id='',title='',name='',ariaMax='',value='',visible=true,type='text',checked=false,testId='utility-incrementer__input'}={}){
  const attrs={id,title,name,'aria-valuemax':ariaMax,'data-testid':testId};
  return {id,title,name,value,type,checked,disabled:false,tagName:'INPUT',
    getAttribute(k){return attrs[k]||null},getClientRects(){return visible?[{}]:[]},closest(){return null}};
}
function card(kind,name,text,buttons=[]){
  const selector={
    spells:'.spell-item__name',attacks:'.span--item-row-title',
    inventory:'.inventory-item__name',features:'.action-item__name',
    resources:'.resource-item__name',skills:'button.skill__name'
  }[kind];
  return {disabled:false,tagName:'DIV',innerText:text,getClientRects(){return [{}]},getAttribute(){return null},
    closest(){return null},
    querySelector(sel){return sel===selector?{innerText:name,getClientRects(){return [{}]}}:null},
    querySelectorAll(sel){return sel==='button'?buttons:[]}};
}
function docFixture({
  inputs=[],cards={},text='',name='NIER',tabs=[]
}={}){
  const doc={title:name,querySelectorAll(sel){if(sel.startsWith('[role="tab"]'))return tabs;return [];},
    querySelector(sel){if(sel==='[data-testid="character-name"]')return {innerText:name};return null;}};
  const body={ownerDocument:doc,innerText:text,
    querySelector(sel){if(sel==='[data-testid="character-name"]')return {innerText:name};return null;},
    querySelectorAll(sel){
      if(sel==='input,textarea,select,[data-attribute]')return inputs;
      if(sel==='input')return inputs;
      if(sel==='.inline-ability'||sel==='.skill')return [];
      for(const [kind,selector] of Object.entries({
        spells:'.spell-item,',attacks:'.attack-item,',inventory:'.inventory-item,',
        features:'.feature-item,',resources:'.resource-item,',skills:'.skill,'
      }))if(sel.startsWith(selector))return cards[kind]||[];
      return [];
    }};
  doc.body=body;return {body,document:doc};
}
function harness(fixture=docFixture()){
  const context={console,Date,Math,Number,String,Array,URL,URLSearchParams,crypto,
    Blob,location:{origin:'https://app.roll20.net',pathname:'/editor/123',search:'?id=123'},
    document:fixture.document,window:{},setTimeout(){return 1},clearTimeout(){},
    setInterval(){return 1},clearInterval(){},localStorage:{getItem(){return null},setItem(){}}
  };
  vm.createContext(context);
  const code=files.filter(f=>f!=='30_boot.js').map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n');
  vm.runInContext(code+'\nglobalThis.testApi={r3Capture,r3Merge,r3Empty,r3Coverage,r3Field,r3String,r3Candidates,r3StartEditorBridge,r3SendScan,r3Listen,r3CollectAllTabs,r3Escape,R3_UI};',context);
  return {h:context.testApi,context,fixture};
}
test('new production userscript bundles only v3 (not legacy profile reconciliation)',()=>{
  const compiled=readFileSync(join(root,'roll20-embetterment.user.js'),'utf8');
  assert.match(compiled,/\/\/ @version\s+3\.0\.0/);
  assert.match(compiled,/function r3Capture\(/);
  assert.doesNotMatch(compiled,/function autoRefreshCharacterStats\(/);
  assert.doesNotMatch(compiled,/function sheetTourFrameScan\(/);
  assert.deepEqual(files,['00_capture.js','10_reader.js','20_ui.js','30_boot.js']);
});
test('real official Vue inputs yield 82 of 84 HP and STR 18 even when innerText is empty',()=>{
  const inputHp=input({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:'84'});
  const inputStr=input({id:'60J__jQcN-ohd8YX_aHEj',title:'STR',value:'18'});
  const {h,fixture}=harness(docFixture({inputs:[inputHp,inputStr]}));
  const snap=h.r3Capture(fixture.body);
  assert.equal(snap.stats.hp,82);assert.equal(snap.stats.maxHp,84);assert.equal(snap.abilities.str,18);
  assert.equal(snap.coverage.observations,2);
  assert.equal(snap.provenance['stats.hp'].kind,'input');
});
test('bounded live official fields include decimal initiative AC speed and named ability scores',()=>{
  const {h,fixture}=harness(docFixture({
    text:'ARMOR CLASS 17\nSPEED (ft) 55\nINITIATIVE +2.14',
    inputs:[input({title:'STR',value:'18'}),input({title:'DEX',value:'14'}),
      input({title:'CON',value:'15'}),input({title:'INT',value:'12'}),
      input({title:'WIS',value:'15'}),input({title:'CHA',value:'10'})]
  }));
  const s=h.r3Capture(fixture.body);
  assert.equal(s.stats.ac,17);assert.equal(s.stats.speed,55);
  assert.equal(s.stats.initiative,2.14);
  assert.deepEqual({...s.abilities},{str:18,dex:14,con:15,int:12,wis:15,cha:10});
});
test('explicit max HP beats accessible aria max and recognizes temp HP',()=>{
  const {h,fixture}=harness(docFixture({inputs:[
    input({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:'84'}),
    input({title:'Max Hitpoints',value:'90'}),input({title:'Temporary Hitpoints',value:'7'})
  ]}));
  const s=h.r3Capture(fixture.body);
  assert.equal(s.stats.hp,82);assert.equal(s.stats.maxHp,90);assert.equal(s.stats.tempHp,7);
  assert.match(s.provenance['stats.maxHp'].label,/Max Hitpoints/);
});
test('hidden malformed and unlabeled controls never invent stats',()=>{
  const {h,fixture}=harness(docFixture({inputs:[
    input({id:'hp-current',title:'Current Hitpoints',value:'92',ariaMax:'99',visible:false}),
    input({title:'STR',value:'bad'}),
    input({title:'DEX',value:'32'}),
    input({title:'unrelated counter',value:'21'}),
    input({title:'',value:'100'})
  ]}));
  const s=h.r3Capture(fixture.body);
  assert.equal(s.stats.hp,undefined);assert.equal(s.abilities.str,undefined);
  assert.equal(s.abilities.dex,undefined);assert.equal(s.coverage.observations,3);
  assert.ok(s.diagnostics.rejected>=3);
});
test('extracts identifiable spells attacks inventory features resources and associated visible text',()=>{
  const cards={
    spells:[card('spells','Fire Bolt','Fire Bolt Cantrip Evocation 120 ft 2d10'),
      card('spells','Shield','Shield Level 1 Casting Time: Reaction Duration: 1 round')],
    attacks:[card('attacks','Handaxe','Handaxe Melee 5 ft +7 attack 1d6+4')],
    inventory:[card('inventory','Rope','Rope 50 feet')],
    features:[card('features','Second Wind','Second Wind 1/1 Bonus Action')],
    resources:[card('resources','Hit Dice','Hit Dice 4/7')]
  };
  const {h,fixture}=harness(docFixture({cards}));
  const s=h.r3Capture(fixture.body,'Combat');
  for(const kind of ['spells','attacks','inventory','features','resources'])assert.ok(s[kind].length>0,kind);
  assert.equal(s.spells[0].name,'Fire Bolt');
  assert.equal(s.spells[1].castingTime,'Casting Time: Reaction Duration: 1 round'.slice(0,70));
  assert.equal(s.inventory[0].visible,'Rope 50 feet');
  assert.equal(s.attacks[0].tab,'Combat');
});
test('multiple scans merge distinct categories and deduplicate repeated card names',()=>{
  const {h,fixture}=harness(docFixture({cards:{spells:[card('spells','Fire Bolt','Fire Bolt Cantrip')]}}));
  const a=h.r3Capture(fixture.body,'Spells');
  const b=h.r3Capture(fixture.body,'Spells');
  const total=h.r3Merge(a,b);
  assert.equal(total.spells.length,1);assert.equal(total.diagnostics.tabs.length,2);
});
test('does not infer stats or spells when the sheet DOM has no relevant values',()=>{
  const {h,fixture}=harness(docFixture({text:'Welcome to Roll20',inputs:[]}));
  const s=h.r3Capture(fixture.body);
  assert.deepEqual({...s.stats},{});
  assert.equal(s.spells.length,0);assert.equal(s.attacks.length,0);
});
test('escapes user-provided sheet names and field descriptions in the UI',()=>{
  const {h}=harness();
  assert.equal(h.r3Escape('<img onerror="evil()">'),'&lt;img onerror=&quot;evil()&quot;&gt;');
});
test('origin-checked message handler ignores forged frame responses',async()=>{
  const {h,context}=harness();
  const calls=[];
  context.window.addEventListener=(type,listener)=>calls.push(listener);
  const frame={
    src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/test',
    getClientRects(){return [{}]},getAttribute(){return null},closest(){return null},
    contentWindow:{postMessage(message,origin){calls.push({message,origin})}}
  };
  context.document.querySelectorAll=sel=>sel==='iframe'?[frame]:[];
  h.r3StartEditorBridge();
  const p=h.r3SendScan(h.r3Candidates()[0],'current');
  const record=calls.find(x=>x.message?.type==='scan');assert.ok(record);
  assert.equal(record.origin,'https://advanced-sheets.production.roll20preflight.net');
  const listener=calls.find(x=>typeof x==='function'),candidate=h.r3Candidates()[0];
  listener({origin:'https://malicious.example',source:candidate.window,
    data:{protocol:'r20eb:import:v3',type:'result',id:record.message.id,snapshot:{schema:3}}});
  let finished=false;p.then(()=>finished=true);await Promise.resolve();
  assert.equal(finished,false);
  const snap={schema:3,name:'NIER'};
  listener({origin:'https://advanced-sheets.production.roll20preflight.net',source:candidate.window,
    data:{protocol:'r20eb:import:v3',type:'result',id:record.message.id,snapshot:snap}});
  assert.equal((await p).name,'NIER');
});
