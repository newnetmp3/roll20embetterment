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
  vm.runInContext(script+'\nload();globalThis.api={RB,profile,sheetTourTabs,sheetTourActive,sheetTourMergeVisible,sheetTourAccumulator,sheetTourAdd,sheetTourFrameScan,sheetTourStart,sheetTourImportCandidate,sheetTourCancel,sheetTourPromptOpen,sheetUI,autoDiscoverControlledTokens,autoTokenRecord,autoCharacterAttributeFields,autoAssignControlledTokens,autoProfileForCharacter,autoSelectedTokenAssignment,autoActivateSelectedTokenProfile,autoImportControlledCharacters,startAutoControlledCharacterImport};',scope);
  return {api:scope.api,intervals,doc:page,context:scope};
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

test('outer Roll20 tabs are visited and original view restored before committing',async()=>{
  const chosen={value:'Character Sheet'},history=[];
  const frame={src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/?embedded=0',
    getAttribute(){return 'iframe_abc'},contentWindow:{postMessage(){}}};
  const outer=['Character Sheet','Bio & Info','Advanced Tools'].map(n=>({
    innerText:n,textContent:n,isConnected:true,
    get parentElement(){return {className:chosen.value===n?'active':''}},
    getAttribute(attr){return attr==='aria-selected'?(chosen.value===n?'true':'false'):null},
    click(){chosen.value=n;history.push(n)}
  }));
  const attribute={innerText:'Attributes',textContent:'Attributes',disabled:false,click(){history.push('Attributes')}};
  const rows={'Character Sheet':[field('hp',84)],
    'Bio & Info':[field('background','Knight')],
    'Advanced Tools':[field('wisdom',15)]};
  const dialog={isConnected:true,
    get innerText(){return chosen.value==='Advanced Tools'?'Advanced Tools Attributes':'Character Sheet '+chosen.value},
    closest(){return null},contains(){return false},
    querySelector(sel){
      if(sel.startsWith('iframe#advanced'))return frame;
      if(sel==='.asv__header__name')return {textContent:'Nier'};
      return null;
    },
    querySelectorAll(sel){
      if(sel==='.asv__header__nav__tabs_link')return outer;
      if(sel.startsWith('input,textarea'))return rows[chosen.value];
      if(sel==='button,[role="tab"]')return chosen.value==='Advanced Tools'?[attribute]:[];
      return [];
    }
  };
  const doc={querySelectorAll(sel){
    if(sel==='.characterdialog')return [dialog];
    return [];
  }};
  const {api,context}=harness(doc);
  const mocked={fields:{hp:{current:'84',max:'84'}},
    visible:{stats:{hp:84,maxHp:84},abilityScores:{},abilityMods:{},
      saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},
      details:{},attacks:[],resources:[],
      coverage:{visibleFields:1,names:['HP'],sections:['Combat']}},
    scannedPages:3,tabs:['Combat','Spells','Inventory']};
  vm.runInContext('requestBeaconFrame=async()=>('+JSON.stringify(mocked)+')',context);
  await api.sheetTourStart();
  const p=api.profile();
  assert.equal(p.name,'Nier');
  assert.equal(p.stats.hp,84);
  assert.equal(p.abilityScores.wis,15);
  assert.equal(p.sheetDetails.background,'Knight');
  assert.equal(chosen.value,'Character Sheet');
  assert.ok(history.includes('Bio & Info'));
  assert.ok(history.includes('Advanced Tools'));
  assert.ok(history.includes('Attributes'));
  assert.ok(p.sheetLink.tabsVisited.includes('Spells'));
  assert.equal(api.RB.sheetTourBusy,false);
});

test('official popout desktop tabs from captured D&D 2024 markup are toured and restored',async()=>{
  const selected={value:'Combat'},history=[];
  const labels=['Combat','Skills & Tools','Spells','Inventory','Features & Traits','Notes','About'];
  const tabs=labels.map(label=>({
    innerText:label,textContent:label,isConnected:true,className:'layout-tabbed-panel__tab-link nav-link u-aria-focus-text',
    getAttribute(attr){return attr==='role'?'tab':attr==='aria-selected'?(selected.value===label?'true':'false'):null},
    closest(){return {nodeName:'NAV'}},
    getBoundingClientRect(){return {width:100,height:28}},
    click(){selected.value=label;history.push(label)}
  }));
  const values={
    'Combat':[field('hp',42)],
    'Skills & Tools':[field('perception_bonus',6)],
    'Spells':[field('spell_attack_bonus',8)],
    'Inventory':[field('gp',123)],
    'Features & Traits':[field('level',7)],
    'Notes':[],
    'About':[field('background','Sailor')]
  };
  const body={
    get innerText(){return 'Character Sheet\n'+selected.value+'\nHIT POINTS\n42 / 42\nABILITIES\nWIS 16 +3\nSKILLS';},
    querySelectorAll(selector){return selector.startsWith('input,textarea')?values[selected.value]:[]}
  };
  const doc={body,querySelectorAll(selector){
    if(selector.includes('[role="tab"]')||selector.startsWith('button'))return tabs;
    return [];
  }};
  const {api}=harness(doc);
  const result=await api.sheetTourFrameScan();
  assert.equal(result.fields.hp.current,'42');
  assert.equal(result.fields.perception_bonus.current,'6');
  assert.equal(result.fields.spell_attack_bonus.current,'8');
  assert.equal(result.fields.gp.current,'123');
  assert.equal(result.fields.background.current,'Sailor');
  for(const label of labels)assert.ok(result.tabs.includes(label),label+' should be recorded');
  assert.equal(selected.value,'Combat','original popout tab restored');
  assert.ok(history.includes('Skills & Tools'));
  assert.ok(history.includes('About'));
});

function backboneModel(id,attrs){
  return {id,get(key){return key==='id'?id:attrs[key]},attributes:{id,...attrs}};
}
test('discovers every current-player-controlled token with a represented character',()=>{
  const {api,context}=harness();
  const chars=new Map([
    ['char-a',backboneModel('char-a',{name:'Aria Moonfall',controlledby:'player-1'})],
    ['char-b',backboneModel('char-b',{name:'Borin Stone',controlledby:'other,player-1'})],
    ['char-c',backboneModel('char-c',{name:'Enemy',controlledby:'other'})]
  ]);
  const tokens=[
    backboneModel('tok-a',{name:'Aria',type:'image',represents:'char-a',controlledby:''}),
    backboneModel('tok-a2',{name:'Aria Familiar',type:'image',represents:'char-a',controlledby:'player-1'}),
    backboneModel('tok-b',{name:'Borin',type:'image',represents:'char-b',controlledby:''}),
    backboneModel('tok-c',{name:'Enemy',type:'image',represents:'char-c',controlledby:''}),
    backboneModel('generic',{name:'Generic',type:'image',represents:'',controlledby:'player-1'})
  ];
  context.window.currentPlayer={id:'player-1'};context.window.is_gm=false;
  context.window.d20={Campaign:{activePage(){return {thegraphics:{models:tokens}}},characters:{get(id){return chars.get(id)||null}}}};
  const found=api.autoDiscoverControlledTokens();
  assert.deepEqual(Array.from(found,x=>x.tokenId),['tok-a','tok-a2','tok-b']);
  assert.deepEqual(Array.from(new Set(found.map(x=>x.characterId))),['char-a','char-b']);
});
test('multiple controlled tokens for one character share one profile and distinct characters get distinct profiles',()=>{
  const {api}=harness();
  const records=[
    {tokenId:'tok-a',tokenName:'Aria',characterId:'char-a',characterName:'Aria Moonfall'},
    {tokenId:'tok-a2',tokenName:'Aria Familiar',characterId:'char-a',characterName:'Aria Moonfall'},
    {tokenId:'tok-b',tokenName:'Borin',characterId:'char-b',characterName:'Borin Stone'}
  ];
  const groups=api.autoAssignControlledTokens(records);
  assert.equal(groups.size,2);
  const a=api.RB.state.tokenAssignments['tok-a'],a2=api.RB.state.tokenAssignments['tok-a2'],b=api.RB.state.tokenAssignments['tok-b'];
  assert.equal(a.profileId,a2.profileId);assert.notEqual(a.profileId,b.profileId);
  assert.equal(api.RB.state.profiles.find(p=>p.id===a.profileId).roll20CharacterId,'char-a');
  assert.equal(api.RB.state.profiles.find(p=>p.id===b.profileId).roll20CharacterId,'char-b');
});
test('selecting an assigned controlled token switches R20eb to its associated profile',()=>{
  const {api,context}=harness();
  const pa=api.profile(),pb=vm.runInContext("newProfile('Second Character')",context);api.RB.state.profiles.push(pb);
  api.RB.state.tokenAssignments={'tok-a':{tokenId:'tok-a',characterId:'char-a',profileId:pa.id,characterName:'First',tokenName:'First'},'tok-b':{tokenId:'tok-b',characterId:'char-b',profileId:pb.id,characterName:'Second Character',tokenName:'Second'}};
  context.window.d20={engine:{selected(){return [{model:{id:'tok-b'}}]}}};
  assert.equal(api.autoActivateSelectedTokenProfile(),true);assert.equal(api.RB.state.current,pb.id);assert.equal(api.autoSelectedTokenAssignment().characterId,'char-b');
});
test('automatic import processes each represented character once even with multiple tokens',async()=>{
  const {api,context}=harness();
  context.location.hostname='app.roll20.net';context.location.pathname='/editor/123';context.window.currentPlayer={id:'player-1'};context.window.is_gm=false;
  const chars=new Map([['char-a',backboneModel('char-a',{name:'Aria Moonfall',controlledby:'player-1'})],['char-b',backboneModel('char-b',{name:'Borin Stone',controlledby:'player-1'})]]);
  const tokens=[backboneModel('tok-a',{name:'Aria',type:'image',represents:'char-a',controlledby:''}),backboneModel('tok-a2',{name:'Aria Copy',type:'image',represents:'char-a',controlledby:''}),backboneModel('tok-b',{name:'Borin',type:'image',represents:'char-b',controlledby:''})];
  context.window.d20={Campaign:{activePage(){return {thegraphics:{models:tokens}}},characters:{get(id){return chars.get(id)||null}}}};
  const imported=[];context.importedHook=(characterId,profileId,assignedId)=>imported.push({characterId,profileId,assignedId});
  vm.runInContext("autoEnsureSheetCandidate=async record=>({candidate:{id:record.characterId,characterId:record.characterId,name:record.characterName,root:{isConnected:true,querySelectorAll(){return []}},frame:null,popoutWindow:null},opened:false,hidden:null}); sheetTourImportCandidate=async(candidate,target,opts)=>{importedHook(candidate.id,target.id,opts.characterId);target.sheetLink={name:candidate.name,source:candidate.id,characterId:opts.characterId};return {candidate,profile:target,acc:{tabs:['Combat']}};};",context);
  await api.autoImportControlledCharacters();
  assert.equal(imported.length,2);assert.deepEqual(Array.from(imported,x=>x.characterId).sort(),['char-a','char-b']);
  assert.equal(api.RB.state.tokenAssignments['tok-a'].profileId,api.RB.state.tokenAssignments['tok-a2'].profileId);
  assert.notEqual(api.RB.state.tokenAssignments['tok-a'].profileId,api.RB.state.tokenAssignments['tok-b'].profileId);
  assert.equal(api.RB.autoCharacterImported.size,2);
});

test('controlled character Backbone attributes seed the automatic import without scrolling the sheet',()=>{
  const {api}=harness();
  const character={attribs:{toJSON(){return [
    {name:'hp',current:'27',max:'35'},
    {name:'wisdom',current:'16',max:''},
    {name:'spell_attack_bonus',current:'7',max:''}
  ]}}};
  const fields=api.autoCharacterAttributeFields(character);
  assert.equal(fields.hp.current,'27');assert.equal(fields.hp.max,'35');
  assert.equal(fields.wisdom.current,'16');
  assert.equal(fields.spell_attack_bonus.current,'7');
});
test('GM universal access is not mistaken for an explicit player-controlled token assignment',()=>{
  const {api,context}=harness();
  const character=backboneModel('char-gm',{name:'GM NPC',controlledby:''});
  const token=backboneModel('tok-gm',{name:'GM NPC',type:'image',represents:'char-gm',controlledby:''});
  token.currentPlayerControls=()=>true;
  context.window.currentPlayer={id:'gm-player'};context.window.is_gm=true;
  context.window.d20={Campaign:{activePage(){return {thegraphics:{models:[token]}}},
    characters:{get(){return character}}}};
  assert.equal(api.autoDiscoverControlledTokens().length,0);
});
