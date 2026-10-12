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
  vm.runInContext(code+'\nglobalThis.testApi={r3Capture,r3CaptureHealth,r3ReaderScan,r3ReaderPeer,r3ReaderAnnounce,r3ReaderReceive,r3Merge,r3Empty,r3Coverage,r3Field,r3String,r3Candidates,r3StartEditorBridge,r3SendScan,r3Listen,r3CollectAllTabs,r3Escape,R3_UI};',context);
  return {h:context.testApi,context,fixture};
}
test('new production userscript bundles only v3 (not legacy profile reconciliation)',()=>{
  const compiled=readFileSync(join(root,'roll20-embetterment.user.js'),'utf8');
  assert.match(compiled,/\/\/ @version\s+3\.1\.3/);
  assert.match(compiled,/function r3Capture\(/);
  assert.doesNotMatch(compiled,/function autoRefreshCharacterStats\(/);
  assert.doesNotMatch(compiled,/function sheetTourFrameScan\(/);
  assert.deepEqual(files,['00_capture.js','10_reader.js','20_ui.js','25_auto.js','30_boot.js']);
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
