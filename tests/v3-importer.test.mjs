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
  vm.runInContext(code+'\nglobalThis.testApi={r3Capture,r3CaptureHealth,r3ReaderScan,r3ReaderPeer,r3ReaderAnnounce,r3ReaderReceive,r3ReaderChanged,r3CurrentTabLabel,r3StartReader,r3Merge,r3InventoryZero,r3InventoryPrune,r3InventoryStepper,r3InventoryRowFor,r3AutoStoreSnapshot,R3_AUTO,r3Empty,r3Coverage,r3Field,r3String,r3Candidates,r3StartEditorBridge,r3SendScan,r3Listen,r3CollectAllTabs,r3Escape,R3_UI};',context);
  return {h:context.testApi,context,fixture};
}
test('new production userscript bundles only v3 (not legacy profile reconciliation)',()=>{
  const compiled=readFileSync(join(root,'roll20-embetterment.user.js'),'utf8');
  assert.match(compiled,/\/\/ @version\s+3\.2\.3/);
  assert.match(compiled,/function r3Capture\(/);
  assert.doesNotMatch(compiled,/function autoRefreshCharacterStats\(/);
  assert.doesNotMatch(compiled,/function sheetTourFrameScan\(/);
  assert.deepEqual(files,['00_capture.js','10_reader.js','20_ui.js','22_hud.js','25_auto.js','30_boot.js']);
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
  assert.equal(s.spells[1].castingTime,'Casting Time: Reaction');
  assert.match(s.spells[1].duration,/Duration: 1 round/);
  assert.equal(s.inventory[0].visible,'Rope 50 feet');
  assert.equal(s.attacks[0].tab,'Combat');
});
test('official skill rows remain keyed skill bonuses, not array cards (reported Floorp crash)',()=>{
  const skillRow={
    innerText:'Athletics +7',getClientRects(){return [{}]},
    getAttribute(){return null},closest(){return null},
    querySelector(sel){return sel==='button.skill__name'?
      {innerText:'Athletics',getClientRects(){return [{}]}}:null},
    querySelectorAll(){return []}
  };
  const fixture=docFixture({
    inputs:[input({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:'84'})],
    cards:{spells:[card('spells','Shield','Shield Level 1')]}
  });
  const original=fixture.body.querySelectorAll.bind(fixture.body);
  fixture.body.querySelectorAll=selector=>selector==='.skill'?[skillRow]:
    selector.includes('skill-row')?[skillRow]:original(selector);
  const {h}=harness(fixture);
  assert.doesNotThrow(()=>h.r3Capture(fixture.body,'Skills'));
  const snap=h.r3Capture(fixture.body,'Skills');
  assert.equal(snap.stats.hp,82);assert.equal(snap.stats.maxHp,84);
  assert.equal(snap.skills.Athletics,7);
  assert.equal(Array.isArray(snap.skills),false);
  assert.equal(snap.spells.length,1);
  assert.equal(snap.coverage.skills,1);
  const merged=h.r3Merge(h.r3Empty(),snap);
  assert.equal(merged.skills.Athletics,7);
  assert.equal(merged.coverage.skills,1);
  assert.equal(merged.coverage.spells,1);
});
test('importer card schema excludes keyed skills and protects against future array/object mismatch',()=>{
  const {h,fixture}=harness(docFixture({cards:{
    skills:[card('skills','Athletics','Athletics +7')],
    features:[card('features','Second Wind','Second Wind 1/1 Bonus Action')]
  }}));
  const snap=h.r3Capture(fixture.body);
  assert.equal(snap.features.length,1);
  assert.deepEqual({...snap.skills},{});
  assert.equal(snap.coverage.features,1);
});

function namedInventoryRow(name,description){
  const row=card('inventory',name,description);
  const title={innerText:name,getClientRects(){return [{}]},getAttribute(){return null},
    closest(selector){return selector.includes('item-row')?row:null},parentElement:row};
  row.querySelectorAll=selector=>selector.includes('.span--item-row-title')?[title]:[];
  return {row,title};
}
function namedResourceTracker(name,description,checkValues=[]){
  const owner=card('features',name,description);
  const marker={innerText:name,getClientRects(){return [{}]},getAttribute(){return null}};
  const checks=checkValues.map(checked=>({
    checked,getAttribute(){return null},getClientRects(){return [{}]}
  }));
  const tracker={innerText:description,disabled:false,getClientRects(){return [{}]},
    getAttribute(){return null},
    closest(selector){if(selector.startsWith('[hidden]'))return null;
      return selector.includes('.resource-item')?tracker:selector.includes('.item-row')?owner:null},
    querySelector(selector){return selector.includes('resource-name')?marker:null},
    querySelectorAll(selector){return selector.includes('checkbox')?checks:[]}
  };
  return {owner,tracker};
}
test('Inventory main tab detects named 2024 item-row titles without legacy inventory classes',()=>{
  const a=namedInventoryRow('Potion of Healing','Potion of Healing Qty 2 Weight 1 lb');
  const b=namedInventoryRow('Rope, Hempen','Rope, Hempen Qty 1 50 ft');
  const fixture=docFixture();
  const previous=fixture.body.querySelectorAll.bind(fixture.body);
  fixture.body.querySelectorAll=selector=>{
    if(selector.startsWith('.span--item-row-title,'))return [a.title,b.title];
    return previous(selector);
  };
  const {h}=harness(fixture);
  const snapshot=h.r3Capture(fixture.body,'Inventory');
  assert.deepEqual([...snapshot.inventory.map(x=>x.name)],['Potion of Healing','Rope, Hempen']);
  assert.equal(snapshot.inventory[0].visible,'Potion of Healing Qty 2 Weight 1 lb');
  const combat=h.r3Capture(fixture.body,'Combat');
  assert.equal(combat.inventory.length,0,'generic item rows are not inventory on other tabs');
});
test('2024 embedded feature resource tracker is imported with checkbox observations, not invented remaining charges',()=>{
  const r=namedResourceTracker('Second Wind','Second Wind Bonus Action Uses',[true,false,false]);
  const fixture=docFixture();
  const previous=fixture.body.querySelectorAll.bind(fixture.body);
  fixture.body.querySelectorAll=selector=>
    selector.startsWith('.resource-tracker,')?[r.tracker]:previous(selector);
  const {h}=harness(fixture);
  const snap=h.r3Capture(fixture.body,'Features & Traits');
  assert.equal(snap.resources.length,1);
  assert.equal(snap.resources[0].name,'Second Wind');
  assert.deepEqual({...snap.resources[0].checkboxes},{total:3,checked:1});
  assert.equal(snap.resources[0].current,undefined,'checkbox semantics are not assumed');
  assert.equal(snap.coverage.resources,1);
  const merged=h.r3Merge(h.r3Empty(),snap);
  assert.equal(merged.resources.length,1);
});
test('Import all tabs reacquires Vue-replaced tab nodes and reaches inventory after many filter tabs',async()=>{
  const item=namedInventoryRow('Dagger','Dagger Qty 1');
  const resource=namedResourceTracker('Ki Points','Ki Points Uses',[false,true]);
  const fixture=docFixture();
  const {h,context}=harness(fixture);
  let active='Combat',render=0;
  const labels=[...Array.from({length:17},(_,i)=>'Filter '+(i+1)),
    'Combat','Spells','Inventory','Features & Traits'];
  const group={className:'main-sheet-tabs',getAttribute(key){return key==='aria-label'?'Main tabs':null}};
  context.document.querySelectorAll=selector=>{
    if(selector.startsWith('[role="tab"]'))return labels.map(label=>{
      const born=render;
      return {className:label===active?'active':'',isConnected:born===render,
        disabled:false,getClientRects(){return [{}]},
        getAttribute(key){return key==='aria-selected'?String(label===active):
          key==='aria-label'?label:null},
        closest(selector){return selector==='[role="tablist"]'?group:null},
        click(){if(born!==render)throw new Error('Clicked stale Vue tab');active=label;render++;}};
    });
    return [];
  };
  context.setTimeout=callback=>{callback();return 1;};
  const previous=fixture.body.querySelectorAll.bind(fixture.body);
  fixture.body.querySelectorAll=selector=>{
    if(active==='Inventory'&&selector.startsWith('.span--item-row-title,'))return [item.title];
    if(active==='Features & Traits'&&selector.startsWith('.resource-tracker,'))return [resource.tracker];
    return previous(selector);
  };
  const scan=await h.r3CollectAllTabs();
  assert.equal(active,'Combat','selected view restored');
  assert.ok(scan.diagnostics.tabs.includes('Inventory'));
  assert.ok(scan.diagnostics.tabs.includes('Features & Traits'));
  assert.equal(scan.coverage.inventory,1);
  assert.equal(scan.coverage.resources,1);
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

test('live Nier export identifies temp HP, all five coin amounts, and named feature sliders',()=>{
  // Minimal fixture from exported control labels only. Do not commit the
  // character JSON: it also contains private notes and full backstory.
  const {h,fixture}=harness(docFixture({inputs:[
    input({id:'tempHP',title:'Temp',value:'0'}),
    input({title:'Copper',value:'0'}),input({title:'Silver',value:'3'}),
    input({title:'Electrum',value:'2'}),input({title:'Gold',value:'29'}),
    input({title:'Platinum',value:'1'}),
    input({title:'Action Surge',type:'range',value:'1'}),
    input({title:'Second Wind',type:'range',value:'1'}),
    input({title:'Unleash Incarnation',type:'range',value:'2'}),
    input({title:'Fleet-Footed Resources',type:'range',value:'1'}),
    input({id:'11111111-2222-4333-8444-555555555555',value:'17'}),
    input({id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',value:'55'})
  ]}));
  const s=h.r3Capture(fixture.body,'Features & Traits');
  assert.equal(s.stats.tempHp,0);
  assert.deepEqual({cp:s.stats.cp,sp:s.stats.sp,ep:s.stats.ep,gp:s.stats.gp,pp:s.stats.pp},
    {cp:0,sp:3,ep:2,gp:29,pp:1});
  assert.deepEqual([...s.resources.map(x=>x.name+':'+x.observedValue)],[
    'Action Surge:1','Second Wind:1','Unleash Incarnation:2','Fleet-Footed Resources:1']);
  assert.equal(s.stats.ac,undefined,'unlabeled 17 cannot be assigned to armor class');
  assert.equal(s.stats.speed,undefined,'unlabeled 55 cannot be assigned to speed');
  const again=h.r3Capture(fixture.body,'Combat');
  assert.equal(h.r3Merge(s,again).resources.length,4,'same named sliders deduplicate across tabs');
});
test('named 2024 slider observations are retained without guessing expended charges',()=>{
  const {h,fixture}=harness(docFixture({inputs:[
    input({title:"Healer's Kit",type:'range',value:'9'}),
    input({title:'Action Surge',type:'range',value:'1'})
  ]}));
  const s=h.r3Capture(fixture.body,'Combat');
  assert.equal(s.coverage.resources,2);
  assert.equal(s.resources[0].controlType,'range');
  assert.equal(s.resources[0].observedValue,9);
  assert.equal(s.resources[0].remaining,undefined);
  assert.match(s.resources[0].visible,/not verified/);
});
test('spell metadata never treats free-text range or duration as structured labels',()=>{
  const {h,fixture}=harness(docFixture({cards:{spells:[
    card('spells','Druidcraft','Druidcraft 30 feet 1 action V S Whispering to spirits, within range: You create a tiny effect for the duration.'),
    card('spells','Blade of Disaster','Blade of Disaster 60 feet +3 Attack 4d12 Bonus Action V S C You create a blade. The blade lasts for the duration.'),
    card('spells','Detect Magic','Detect Magic Self 30 ft radius 1 action V S R C For the duration, you sense magic.')
  ]}}));
  const s=h.r3Capture(fixture.body,'Spells');
  assert.equal(s.spells[0].range,'30 feet');
  assert.equal(s.spells[0].castingTime,'1 action');
  assert.equal(s.spells[0].duration,undefined);
  assert.equal(s.spells[0].concentration,undefined);
  assert.equal(s.spells[1].range,'60 feet');
  assert.equal(s.spells[1].castingTime,'Bonus Action');
  assert.equal(s.spells[2].range,'Self 30 ft radius');
});

test('actual Nier spell headers prevent save DC from becoming casting time',()=>{
  const {h,fixture}=harness(docFixture({cards:{spells:[
    card('spells','Power Word Pain','Power Word Pain 60 feet CON 11 Action V You speak a word of power within range.'),
    card('spells','Druidcraft','Druidcraft 30 feet 1 action V S Whispering to nature.')
  ]}}));
  const s=h.r3Capture(fixture.body,'Spells');
  assert.equal(s.spells[0].castingTime,'Action');
  assert.equal(s.spells[0].components,'V');
  assert.equal(s.spells[0].range,'60 feet');
  assert.equal(s.spells[1].castingTime,'1 action');
  assert.equal(s.spells[1].components,'V S');
});
test('compact official V S R C flags do not accidentally read descriptive prose',()=>{
  const {h,fixture}=harness(docFixture({cards:{spells:[
    card('spells','Detect Magic','Detect Magic Self 30 ft radius 1 action V S R C For the duration you sense magic.'),
    card('spells','Blade of Disaster','Blade of Disaster 60 feet +3 Attack 4d12 Bonus Action V S C You create a blade.'),
    card('spells','Frost','Frost 60 feet Action V S You can perform a ritual involving concentration.')
  ]}}));
  const s=h.r3Capture(fixture.body,'Spells');
  assert.equal(s.spells[0].components,'V S');
  assert.equal(s.spells[0].ritual,true);
  assert.equal(s.spells[0].concentration,true);
  assert.equal(s.spells[1].concentration,true);
  assert.equal(s.spells[1].ritual,undefined);
  assert.equal(s.spells[2].ritual,undefined);
  assert.equal(s.spells[2].concentration,undefined);
});
test('explicit aria-labelledby identifies armor class while UUID-only speed remains unknown',()=>{
  const fixture=docFixture({inputs:[]});
  const ac=input({id:'11111111-2222-4333-8444-555555555555',value:'17'});
  const sp=input({id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',value:'55'});
  const get=ac.getAttribute.bind(ac);
  ac.getAttribute=k=>k==='aria-labelledby'?'armor-label':get(k);
  ac.ownerDocument={getElementById:id=>id==='armor-label'?{innerText:'Armor Class'}:null};
  fixture.body.querySelectorAll=sel=>sel==='input,textarea,select,[data-attribute]'?[ac,sp]:[];
  const {h}=harness(fixture);
  const snap=h.r3Capture(fixture.body);
  assert.equal(snap.stats.ac,17);
  assert.equal(snap.stats.speed,undefined);
});
test('anonymous numeric field exports only bounded local text and no guessed value',()=>{
  const fixture=docFixture({inputs:[]});
  const mystery=input({id:'11111111-2222-4333-8444-555555555555',value:'55'});
  mystery.parentElement={innerText:'Speed 55 feet',querySelectorAll:()=>[mystery],parentElement:null};
  fixture.body.querySelectorAll=sel=>sel==='input,textarea,select,[data-attribute]'?[mystery]:[];
  const {h}=harness(fixture);
  const snap=h.r3Capture(fixture.body);
  assert.equal(snap.stats.speed,undefined);
  assert.deepEqual([...snap.observations[0].nearbyText],['Speed 55 feet']);
});


test('one-second HP reader only samples labeled live health controls, not full sheet collections',async()=>{
  const {h,fixture}=harness(docFixture({inputs:[
    input({id:'hp-current',title:'Current Hitpoints',value:'81',ariaMax:'84'}),
    input({title:'Max Hitpoints',value:'92'}),
    input({title:'Temporary Hitpoints',value:'0'}),
    input({title:'STR',value:'18'}),
    input({title:'Current Hitpoints',value:'44',visible:false}),
    input({title:'unrelated counter',value:'700'})
  ],cards:{inventory:[card('inventory','Rope','Rope 50 ft')]}}));
  const snap=h.r3CaptureHealth(fixture.body);
  assert.equal(snap.name,'NIER');
  assert.deepEqual({...snap.stats},{hp:81,maxHp:92,tempHp:0});
  assert.equal(snap.abilities.str,undefined);
  assert.equal(snap.inventory.length,0);
  assert.equal(snap.observations.length,0);
  const routed=await h.r3ReaderScan('hp');
  assert.equal(routed.stats.hp,81);
});
test('HP watch rejects malformed and fully hidden health inputs without returning zero',()=>{
  const {h,fixture}=harness(docFixture({inputs:[
    input({title:'Current Hitpoints',value:'broken'}),
    input({title:'Maximum Hitpoints',value:'84',visible:false}),
    input({title:'temporary hp',value:'-1'})
  ]}));
  const snap=h.r3CaptureHealth(fixture.body);
  assert.equal(snap.stats.hp,undefined);
  assert.equal(snap.stats.maxHp,undefined);
  assert.equal(snap.stats.tempHp,undefined);
});


test('official popout reader announces and answers only its Roll20 opener',async()=>{
  const {h,context}=harness(docFixture({inputs:[
    input({id:'hp-current',title:'Current Hitpoints',value:'70',ariaMax:'84'})
  ]}));
  const delivered=[];
  const editor={closed:false,postMessage(data,origin){delivered.push({data,origin});}};
  context.window.parent=context.window;
  context.window.opener=editor;
  context.location.origin='https://advanced-sheets.production.roll20preflight.net';
  context.location.pathname='/dnd2024byroll20/test';
  assert.equal(h.r3ReaderPeer(),editor);
  h.r3ReaderAnnounce();
  assert.equal(delivered.at(-1).data.type,'ready');
  assert.equal(delivered.at(-1).data.mode,'popout');
  assert.equal(delivered.at(-1).data.name,'NIER');
  await h.r3ReaderReceive({source:editor,origin:'https://app.roll20.net',
    data:{protocol:'r20eb:import:v3',type:'scan',mode:'hp',id:'r3-popup-valid-100'}});
  assert.equal(delivered.at(-1).data.type,'result');
  assert.equal(delivered.at(-1).data.snapshot.stats.hp,70);
  const count=delivered.length;
  await h.r3ReaderReceive({source:{},origin:'https://example.invalid',
    data:{protocol:'r20eb:import:v3',type:'scan',mode:'hp',id:'r3-popup-invalid-100'}});
  assert.equal(delivered.length,count);
});

test('sheet input/change events debounce to one authenticated popup dirty hint',()=>{
  const {h,context}=harness();
  const notices=[],scheduled=new Map();let seq=0;
  const opener={closed:false,postMessage(value,origin){notices.push({value,origin});}};
  context.window.parent=context.window;context.window.opener=opener;
  context.setTimeout=(fn,ms)=>{const id=++seq;scheduled.set(id,{fn,ms});return id;};
  context.clearTimeout=id=>scheduled.delete(id);
  const control={tagName:'INPUT',getClientRects:()=>[{}],closest:()=>null};
  h.r3ReaderChanged({type:'input',target:control});
  h.r3ReaderChanged({type:'input',target:control});
  h.r3ReaderChanged({type:'change',target:control});
  assert.equal(scheduled.size,1,'typing and the final change share one trailing timer');
  const timer=[...scheduled.values()][0];
  assert.equal(timer.ms,350);assert.equal(notices.length,0);
  timer.fn();
  assert.equal(notices.length,1);
  assert.equal(notices[0].origin,'https://app.roll20.net');
  assert.equal(notices[0].value.type,'dirty');
  assert.equal(notices[0].value.name,'NIER');
  assert.match(notices[0].value.session,/^[\w.:-]{6,100}$/);
});
test('reader ignores generic clicks but tracks incrementers and editable controls',()=>{
  const {h,context}=harness();
  const scheduled=[],original=(fn,ms)=>{scheduled.push(ms);return scheduled.length;};
  context.setTimeout=original;
  const button={className:'regular button',getAttribute:()=>null};
  const target={tagName:'SPAN',getClientRects:()=>[{}],closest:sel=>sel.startsWith('button')?button:null};
  h.r3ReaderChanged({type:'click',target});
  assert.equal(scheduled.length,0,'ordinary clicks must not trigger a heavyweight re-read');
  button.className='utility-incrementer__button';
  h.r3ReaderChanged({type:'click',target});
  assert.equal(scheduled.length,1,'official increment buttons notify the editor');
  h.r3ReaderChanged({type:'input',target:{tagName:'DIV',getClientRects:()=>[{}]}});
  assert.equal(scheduled.length,1,'irrelevant DIV input event is ignored');
});
test('reader registers capture-phase form and incrementer event listeners',()=>{
  const {h,context}=harness();
  const added=[],windowAdded=[];
  context.window.addEventListener=(type)=>windowAdded.push(type);
  context.document.addEventListener=(type,callback,capture)=>added.push({type,callback,capture});
  context.window.parent=context.window;context.window.opener=null;
  h.r3StartReader();
  assert.deepEqual(added.map(x=>x.type),['input','change','click']);
  assert.ok(added.every(x=>x.capture===true&&typeof x.callback==='function'));
  assert.ok(windowAdded.includes('message')&&windowAdded.includes('focus'));
});

test('current view recognizes an active 2024 Inventory tab even with a nested filter',async()=>{
  const fixture=docFixture();
  const tab=(label,active)=>({getClientRects:()=>[{}],disabled:false,
    getAttribute:k=>k==='aria-label'?label:k==='aria-selected'?(active?'true':'false'):null,
    className:'',closest:()=>null});
  fixture.document.querySelectorAll=sel=>sel.startsWith('[role="tab"]')?[
    tab('Combat',false),tab('Inventory',true),tab('All Items',true)
  ]:[];
  const {h}=harness(fixture);
  assert.equal(h.r3CurrentTabLabel(),'Inventory');
  const s=await h.r3ReaderScan('current');
  assert.deepEqual([...s.diagnostics.tabs],['Inventory']);
});
test('current Inventory scan observes zero quantity and checked/toggled controls independently of row text',async()=>{
  const fixture=docFixture({name:'NIER'});
  const row={innerText:'Healer Kit',className:'item-row',getClientRects:()=>[{}],
    getAttribute:()=>null,closest:()=>null};
  const control=(value,attributes={})=>({value,tagName:'INPUT',type:'number',
    className:'utility-incrementer__input',getClientRects:()=>[{}],
    getAttribute:k=>attributes[k]??(k==='data-testid'?'utility-incrementer__input':null),
    closest:sel=>sel.includes('item-row')?row:null});
  const quantity=control('4');
  const checkbox={tagName:'INPUT',type:'checkbox',checked:true,value:'on',
    getClientRects:()=>[{}],getAttribute:()=>null,
    closest:sel=>sel.includes('item-row')?row:null};
  const toggle={tagName:'BUTTON',type:'button',getClientRects:()=>[{}],
    getAttribute:k=>k==='aria-pressed'?'false':k==='aria-label'?'Use item':null,
    closest:sel=>sel.includes('item-row')?row:null};
  const title={innerText:'Healer Kit',getClientRects:()=>[{}],getAttribute:()=>null,
    closest:sel=>sel.includes('item-row')?row:null};
  row.querySelectorAll=sel=>{
    if(sel==='button')return [toggle];
    if(sel.includes('input,select,[role="spinbutton"]'))return [quantity,checkbox,toggle];
    if(sel.includes('.span--item-row-title'))return [title];
    return [];
  };
  row.querySelector=()=>null;
  fixture.body.querySelectorAll=sel=>{
    if(sel.startsWith('.span--item-row-title,'))return [title];
    return [];
  };
  const active={getClientRects:()=>[{}],disabled:false,className:'',
    getAttribute:k=>k==='aria-label'?'Inventory':k==='aria-selected'?'true':null,
    closest:()=>null};
  fixture.document.querySelectorAll=sel=>sel.startsWith('[role="tab"]')?[active]:[];
  const {h}=harness(fixture);
  const before=await h.r3ReaderScan('current');
  assert.equal(before.inventory.length,1);
  assert.equal(before.inventory[0].quantity,4);
  assert.equal(before.inventory[0].controls.find(c=>c.kind==='toggle').value,true);
  assert.equal(before.inventory[0].tab,'Inventory');
  quantity.value='0';checkbox.checked=false;
  const after=await h.r3ReaderScan('current');
  assert.equal(after.inventory[0].quantity,0,'zero is a real observed value, never missing');
  assert.equal(after.inventory[0].controls.find(c=>c.kind==='toggle').value,false);
  assert.equal(after.inventory[0].visible,before.inventory[0].visible,
    'visible row text is unchanged, so captured controls must distinguish new state');
});

test('2024 inventory toggle buttons emit change hints without observing unrelated clicks',()=>{
  const {h,context}=harness();
  const timers=[];
  context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};
  const row={};
  const toggle={tagName:'BUTTON',className:'item-use-toggle',getClientRects:()=>[{}],
    getAttribute:k=>k==='aria-pressed'?'false':null};
  const child={tagName:'SPAN',getClientRects:()=>[{}],
    closest:sel=>sel.startsWith('button')?toggle:sel.includes('item-row')?row:null};
  h.r3ReaderChanged({type:'click',target:child});
  assert.equal(timers.length,1);
  assert.equal(timers[0].ms,350);
});

test('zero-count inventory rows stay in reader snapshots as explicit deletion observations',()=>{
  const {h}=harness();
  const s=h.r3Empty();s.name='NIER';
  s.inventory=[{name:'Potion',_key:'potion||',quantity:0}];
  h.r3Coverage(s);
  assert.equal(s.inventory.length,1,'reader must preserve zero rows for current-view merges');
  assert.equal(h.r3InventoryZero(s.inventory[0]),true);
  assert.equal(h.r3InventoryZero({name:'Potion'}),false);
  assert.equal(h.r3InventoryZero({name:'Potion',quantity:'0'}),false,
    'string zero is not a trusted numeric observation');
  assert.equal(h.r3InventoryZero({name:'Potion',quantity:undefined}),false);
  const published=h.r3InventoryPrune(s);
  assert.equal(published.inventory.length,0);
  assert.equal(published.coverage.inventory,0);
});
test('full tab merge uses later zero observation instead of earlier positive inventory quantity',()=>{
  const {h}=harness();
  const prior=h.r3Empty();prior.name='NIER';
  prior.inventory=[{name:'Potion',_key:'potion||',quantity:3,tab:'Current view'}];
  const later=h.r3Empty();later.name='NIER';
  later.inventory=[{name:'Potion',_key:'potion||',quantity:0,tab:'Inventory'}];
  h.r3Merge(prior,later);
  assert.equal(prior.inventory.length,1,'zero is not silently discarded in full reader merge');
  assert.equal(prior.inventory[0].quantity,0);
  assert.equal(h.r3InventoryPrune(prior).inventory.length,0);
});

function screenshotInventoryFixture(){
  // Reproduce the visible Crowbar row: name, switch and a − 0 + quantity
  // cluster whose text input has only a generated ID, no quantity metadata.
  const fixture=docFixture({name:'NIER'});
  const row={innerText:'Crowbar Gear',getClientRects:()=>[{}],getAttribute:()=>null,closest:()=>null};
  const nested={getClientRects:()=>[{}],querySelectorAll:()=>[]};
  const sign=text=>({tagName:'BUTTON',innerText:text,className:'',getClientRects:()=>[{}],
    getAttribute:()=>null,closest:sel=>sel.includes('item-row')?row:null});
  const minus=sign('−'),plus=sign('+');
  const cluster={parentElement:row,querySelectorAll:sel=>sel==='button'?[minus,plus]:
    sel==='input,[role="spinbutton"]'?[quantity]:[]};
  const quantity={tagName:'INPUT',type:'text',value:'0',className:'',parentElement:cluster,
    getClientRects:()=>[{}],getAttribute:key=>key==='id'?'11111111-2222-4333-8444-555555555555':null,
    closest:sel=>sel.includes('.item-row')?row:null};
  const sw={tagName:'BUTTON',type:'button',innerText:'',getClientRects:()=>[{}],
    getAttribute:key=>key==='id'?'headlessui-switch-100':
      key==='role'?'switch':key==='aria-checked'?'true':null,
    closest:sel=>sel.includes('item-row')?row:null};
  const title={innerText:'Crowbar',getClientRects:()=>[{}],getAttribute:()=>null,
    parentElement:nested,closest:sel=>sel.includes('item-row__')?nested:
      sel.includes('item-row')?row:null};
  row.querySelectorAll=sel=>sel==='button'?[minus,plus,sw]:
    sel.startsWith('input,select,[role="spinbutton"]')?[quantity,sw]:
    sel.includes('.span--item-row-title')?[title]:[];
  row.querySelector=()=>null;
  fixture.body.querySelectorAll=sel=>sel.startsWith('.span--item-row-title,')?[title]:[];
  const activeTab={getClientRects:()=>[{}],disabled:false,className:'',
    getAttribute:key=>key==='aria-label'?'Inventory':key==='aria-selected'?'true':null,
    closest:()=>null};
  fixture.document.querySelectorAll=sel=>sel.startsWith('[role="tab"]')?[activeTab]:[];
  return {fixture,row,title,quantity,minus,plus,sw};
}
test('Crowbar screenshot-like unlabelled minus/count/plus controls report exact numeric zero',async()=>{
  const x=screenshotInventoryFixture(),{h}=harness(x.fixture);
  assert.equal(h.r3InventoryRowFor(x.title),x.row,
    'prefer enclosing item row instead of its nested title wrapper');
  assert.equal(h.r3InventoryStepper(x.quantity),true);
  const result=await h.r3ReaderScan('current');
  assert.equal(result.inventory.length,1);
  assert.equal(result.inventory[0].name,'Crowbar');
  assert.equal(result.inventory[0].quantity,0,
    'the screenshot stepper uses an unlabelled numeric input');
  assert.equal(result.inventory[0].controls.find(x=>x.kind==='quantity').value,0);
  assert.equal(result.inventory[0].controls.find(x=>x.kind==='quantity').source,
    'observed adjacent minus/plus buttons','no accessible quantity hint is present');
  assert.equal(result.inventory[0].controls.find(x=>x.kind==='toggle').value,true);
  assert.equal(h.r3InventoryPrune(result).inventory.length,0);
});
test('Crowbar screenshot-like current scan removes its imported item, but not another item',async()=>{
  const x=screenshotInventoryFixture(),{h}=harness(x.fixture);
  const prev=h.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.inventory=[{name:'Crowbar',_key:'crowbar||',tab:'Inventory'},
    {name:'Net',_key:'net||',tab:'Inventory',quantity:1}];
  h.R3_UI.snapshot=h.r3Coverage(prev);h.R3_AUTO.name='NIER';
  h.r3AutoStoreSnapshot(await h.r3ReaderScan('current'),'current');
  assert.deepEqual([...h.R3_UI.snapshot.inventory.map(x=>x.name)],['Net']);
  x.quantity.value='2';
  h.r3AutoStoreSnapshot(await h.r3ReaderScan('current'),'current');
  assert.deepEqual([...h.R3_UI.snapshot.inventory.map(x=>x.name)],['Net','Crowbar']);
  assert.equal(h.R3_UI.snapshot.inventory[1].quantity,2);
  assert.equal(h.R3_UI.snapshot.stats.hp,82);
});
test('paired plus/minus are not enough to erase an ambiguous row with two number inputs',async()=>{
  const x=screenshotInventoryFixture(),{h}=harness(x.fixture);
  const another={tagName:'INPUT',type:'text',value:'0',getClientRects:()=>[{}]};
  x.quantity.getAttribute=()=>null;
  const old=x.quantity.parentElement.querySelectorAll;
  x.quantity.parentElement.querySelectorAll=sel=>
    sel==='input,[role="spinbutton"]'?[x.quantity,another]:old(sel);
  const result=await h.r3ReaderScan('current');
  assert.equal(result.inventory[0].quantity,undefined,
    'several controls in one group are not proof of item quantity');
  assert.equal(h.r3InventoryPrune(result).inventory.length,1);
});
test('unlabeled quantity must be next to both decrement and increment, not an unrelated number',async()=>{
  const x=screenshotInventoryFixture(),{h}=harness(x.fixture);
  const old=x.quantity.parentElement.querySelectorAll;
  x.quantity.parentElement.querySelectorAll=sel=>sel==='button'?[x.minus]:old(sel);
  const result=await h.r3ReaderScan('current');
  assert.equal(result.inventory[0].quantity,undefined);
  assert.equal(h.r3InventoryPrune(result).inventory.length,1);
});
test('live unlabelled inventory plus/minus clicks signal the authenticated reader',()=>{
  const x=screenshotInventoryFixture(),{h,context}=harness(x.fixture);
  const calls=[];context.setTimeout=(fn,ms)=>{calls.push(ms);return calls.length};
  const target={tagName:'SPAN',getClientRects:()=>[{}],
    closest:sel=>sel.startsWith('button')?x.minus:sel.includes('item-row')?x.row:null};
  h.r3ReaderChanged({type:'click',target});
  assert.deepEqual(calls,[350]);
});


test('exported UUID-named AC 17 and speed 55 recover from exact nearby labels',()=>{
  const {h}=harness();
  const snap=h.r3Empty();snap.name='Nier';
  snap.observations=[
    {label:'59a75333-038c-491a-a93f-be3022111d42',value:'17',
      nearbyText:['ARMOR CLASS'],tab:'COMBAT',element:'INPUT'},
    {label:'b89b2c57-491e-4f8c-b43f-7b21bc42aa96',value:'55',
      nearbyText:['SPEED (ft)'],tab:'COMBAT',element:'INPUT'},
    {label:'b89b2c57-491e-4f8c-b43f-7b21bc42aa96',value:'55',
      nearbyText:['SPEED (ft)'],tab:'INVENTORY',element:'INPUT'}
  ];
  h.r3Coverage(snap);
  assert.equal(snap.stats.ac,17);assert.equal(snap.stats.speed,55);
  assert.equal(snap.provenance['stats.ac'].kind,'exact nearby control caption');
  assert.equal(snap.provenance['stats.speed'].label,'SPEED (ft)');
});
test('raw UUID observations without exactly identifiable labels never fabricate stats',()=>{
  const {h}=harness();
  const snap=h.r3Empty();snap.name='Nier';
  snap.observations=[
    {label:'59a75333-038c-491a-a93f-be3022111d42',value:'17',nearbyText:['Random item AC +17']},
    {label:'b89b2c57-491e-4f8c-b43f-7b21bc42aa96',value:'55',nearbyText:['Speed 55 feet']},
    {label:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',value:'15',nearbyText:['Perception']}
  ];
  h.r3Coverage(snap);
  assert.equal(snap.stats.ac,undefined);
  assert.equal(snap.stats.speed,undefined);
  assert.equal(snap.stats.passivePerception,undefined);
});
test('inconsistent AC evidence across visited tabs remains unresolved',()=>{
  const {h}=harness();const snap=h.r3Empty();
  snap.observations=[
    {label:'59a75333-038c-491a-a93f-be3022111d42',value:'17',nearbyText:['ARMOR CLASS']},
    {label:'59a75333-038c-491a-a93f-be3022111d42',value:'18',nearbyText:['ARMOR CLASS']}
  ];
  h.r3Coverage(snap);assert.equal(snap.stats.ac,undefined);
  // An authoritative labeled value wins, even with old conflicting raw samples.
  snap.stats.ac=19;h.r3Coverage(snap);assert.equal(snap.stats.ac,19);
});
