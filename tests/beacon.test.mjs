import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const names=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','17_frame_bridge.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const script=names.map(n=>readFileSync(join(root,'src',n),'utf8')).join('\n')
 .replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');
const visible=[
 'NIER He/Him','Fighter 7 - Echo Knight','HIT POINTS','84 / 84','0','Current','Max','Temp',
 'ABILITIES','STR','18','+4','+7','Mod','Save','DEX','14','+2','+2','Mod','Save',
 'CON','15','+2','+5','Mod','Save','INT','12','+1','+1','Mod','Save',
 'WIS','15','+2','+2','Mod','Save','CHA','10','+0','+0','Mod','Save',
 'AC/SPEED','ARMOR CLASS','17','SPEED (ft)','55',
 'SKILLS','Acrobatics','DEX +2','Arcana','INT +1',
 'COMBAT','ATTACKS','Range','Hit / DC','Damage','Dagger','Melee','5 ft','+7 Attack','1d4+4',
 'RESOURCES',"Healer's Kit",'9/10','Fleet-Footed Resources','1/1','Unleash Incarnation','2/2'
].join('\n');
function env(text=visible){
 const store=new Map();
 const fakeSheet={
  innerText:text,isConnected:true,ownerDocument:null,
  querySelectorAll(sel){
   if(sel==='[aria-label],[data-testid]')return [{},{},{},{},{},{}];
   return [];
  },
  querySelector(){return null},
  closest(){return null},
  getAttribute(){return null},
  matches(){return false}
 };
 const document={querySelectorAll(sel){
   return sel==='iframe'?[]:[fakeSheet];
 },querySelector(){return null},getElementById(){return null}};
 const scope={console,document,URLSearchParams,location:{search:'?id=123',pathname:'/editor/'},
  crypto,Date,Math,Number,String,Array,Blob,URL,
  setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},
  window:{innerWidth:1200,innerHeight:900},
  localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}}
 };
 vm.createContext(scope);
 vm.runInContext(script+'\nload();RB.visible=true;RB.shadow={innerHTML:"",querySelector(){return null},querySelectorAll(){return []}};RB.root={style:{setProperty(){}},setAttribute(){}};globalThis.h={RB,profile,scanSheets,syncSheet,beaconImportVisible,beaconCollectRollActions,mergeBeaconSnapshot,snapshotSheet,beaconVisibleText,sheetUI,readSheetFields};',scope);
 return {h:scope.h,fakeSheet,store};
}
test('Beacon 2024 visible stats reflect Nier screenshot values',()=>{
 const {h,fakeSheet}=env();const data=h.beaconImportVisible(fakeSheet,'Open character sheet');
 assert.equal(data.name,'NIER');
 assert.equal(data.stats.hp,84);assert.equal(data.stats.maxHp,84);
 assert.equal(data.stats.tempHp,0);assert.equal(data.stats.ac,17);
 assert.equal(data.stats.speed,55);assert.equal(data.stats.level,7);
 assert.equal(data.details.class,'Fighter');
});
test('all six ability scores, modifiers and saving throws are parsed',()=>{
 const {h,fakeSheet}=env();const d=h.beaconImportVisible(fakeSheet,'NIER');
 assert.deepEqual({...d.abilityScores},{str:18,dex:14,con:15,int:12,wis:15,cha:10});
 assert.deepEqual({...d.abilityMods},{str:4,dex:2,con:2,int:1,wis:2,cha:0});
 assert.deepEqual({...d.saveBonuses},{str:7,dex:2,con:5,int:1,wis:2,cha:0});
});
test('visible skill bonuses are imported from their named row',()=>{
 const {h,fakeSheet}=env();const d=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(d.skillBonuses.Acrobatics,2);assert.equal(d.skillBonuses.Arcana,1);
});
test('resources use explicit name, current and max values',()=>{
 const {h,fakeSheet}=env();const d=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(d.resources.length,3);
 assert.equal(d.resources[0].name,"Healer's Kit");assert.equal(d.resources[0].current,9);assert.equal(d.resources[0].max,10);
 assert.equal(d.resources[2].current,2);assert.equal(d.resources[2].max,2);
});
test('attacks are informational only and never receive guessed legacy macros',()=>{
 const {h,fakeSheet}=env();const d=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(d.attacks.length,1);assert.equal(d.attacks[0].name,'Dagger');
 assert.equal(d.attacks[0].toHit,'+7');assert.equal(d.attacks[0].damage,'1d4+4');
 assert.equal(d.attacks[0].command,'');
});
test('scan works without even one legacy attr_* field',()=>{
 const {h}=env();h.scanSheets();
 assert.equal(h.RB.openSheets.length,1);
 assert.equal(h.RB.openSheets[0].readableFields,0);
 assert.ok(h.RB.openSheets[0].visibleFields>=10);
 assert.equal(h.RB.openSheets[0].name,'NIER');
 assert.match(h.sheetUI(),/0 named \/ /);
});
test('sync imports only visible values into local profile',()=>{
 const {h}=env();h.scanSheets();assert.equal(h.syncSheet(),true);
 assert.equal(h.profile().stats.hp,84);
 assert.equal(h.profile().stats.ac,17);
 assert.equal(h.profile().stats.speed,55);
 assert.equal(h.profile().saveBonuses.str,7);
 assert.equal(h.profile().resources.some(x=>x.name==='Healer\'s Kit'),true);
 assert.equal(h.profile().attacks[0].name,'Dagger');
 assert.ok(h.profile().sheetLink.coverage.visibleFields>0);
});
test('resync does not duplicate 2024 attacks or resources',()=>{
 const {h}=env();h.scanSheets();h.syncSheet();
 const size=h.profile().resources.length, attacks=h.profile().attacks.length;
 h.syncSheet();assert.equal(h.profile().resources.length,size);assert.equal(h.profile().attacks.length,attacks);
});
test('empty or unrecognized sheet does not erase existing player values',()=>{
 const {h}=env('No readable information');h.profile().stats.hp=29;
 h.scanSheets();assert.equal(h.syncSheet(),false);assert.equal(h.profile().stats.hp,29);
});
test('visible-only fields never override authoritative named fields',()=>{
 const {h,fakeSheet}=env();
 const legacy=h.snapshotSheet({hp:{current:'12',max:'22'},ac:19},'NIER');
 const d=h.mergeBeaconSnapshot(legacy,h.beaconImportVisible(fakeSheet,'NIER'));
 assert.equal(d.stats.hp,12);assert.equal(d.stats.maxHp,22);assert.equal(d.stats.ac,19);
 assert.equal(d.stats.speed,55);
});
test('hidden textContent is not scanned when nothing is visible',()=>{
 const {h}=env();const data=h.beaconImportVisible({
  textContent:'HIT POINTS 999 / 999 ARMOR CLASS 30',innerText:''
 },'Blank');
 assert.equal(data.coverage.visibleFields,0);
});


function officialIncrementer({id='',title='',value='',ariaMax=null,visible=true,official=true}={}){
  const attrs={id,title,role:'spinbutton',...official?{'data-testid':'utility-incrementer__input'}:{}};
  if(ariaMax!==null)attrs['aria-valuemax']=String(ariaMax);
  return {id,type:'text',value:String(value),disabled:false,parentElement:null,
    getAttribute(name){return attrs[name]??null;},closest(){return null;},
    getClientRects(){return visible?[{}]:[];}};
}
function inputOnlyBeacon(inputs){
  return {innerText:'',querySelectorAll(sel){return sel==='input'?inputs:[];},
    querySelector(){return null;}};
}
test('actual 2024 Vue incrementers import 82/84 HP and STR 18 without panel text',()=>{
  const {h}=env();
  const hp=officialIncrementer({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:84});
  const str=officialIncrementer({id:'60J__jQcN-ohd8YX_aHEj',title:'STR',value:'18'});
  const data=h.beaconImportVisible(inputOnlyBeacon([hp,str]),'NIER');
  assert.equal(data.stats.hp,82);
  assert.equal(data.stats.maxHp,84);
  assert.equal(data.abilityScores.str,18);
  assert.ok(data.coverage.visibleFields>=3);
});
test('explicit labelled HP max and temporary HP override current input aria maximum',()=>{
  const {h}=env();
  const inputs=[
    officialIncrementer({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:84}),
    officialIncrementer({title:'Max Hitpoints',value:'86'}),
    officialIncrementer({title:'Temporary Hitpoints',value:'7'})
  ];
  const data=h.beaconImportVisible(inputOnlyBeacon(inputs),'NIER');
  assert.deepEqual({...data.stats},{hp:82,maxHp:86,tempHp:7});
});
test('hidden, invalid, unrelated and unlabelled inputs do not create false HP or abilities',()=>{
  const {h}=env();
  const inputs=[
    officialIncrementer({id:'hp-current',title:'Current Hitpoints',value:'82',ariaMax:84,visible:false}),
    officialIncrementer({title:'STR',value:'18',visible:false}),
    officialIncrementer({title:'STR',value:'18',official:false}),
    officialIncrementer({title:'DEX',value:'abc'}),
    officialIncrementer({title:'WIS',value:'',ariaMax:20}),
    officialIncrementer({title:'Current Hitpoints',value:'',ariaMax:84})
  ];
  const data=h.beaconImportVisible(inputOnlyBeacon(inputs),'NIER');
  assert.deepEqual({...data.stats},{});
  assert.deepEqual({...data.abilityScores},{});
});

function rollButton(text){
  return {innerText:text,textContent:text,disabled:false,click(){}};
}
function namedCard(name,buttons,nameSelector){
  return {querySelector(selector){
    if(selector===nameSelector)return {innerText:name,textContent:name};
    return buttons[selector]||null;
  }};
}
test('official 2024 Combat controls harvest separate native attack and damage actions',()=>{
  const {h}=env();
  const attack=rollButton('+7 Attack'),damage=rollButton('1d6+4');
  const handaxe=namedCard('Handaxe',{
    '.poly-button--hit-dc button':attack,
    '.poly-button--damage button':damage
  },'.span--item-row-title');
  const panel={querySelectorAll(selector){return selector==='.attack-item'?[handaxe]:[]}};
  const scope={
    querySelector(selector){
      if(selector==='[role="tab"][aria-selected="true"]')return {innerText:'Combat'};
      if(selector==='[role="tabpanel"]:not([style*="display: none"])')return panel;
      return null;
    },
    querySelectorAll(selector){return []}
  };
  const actions=h.beaconCollectRollActions(scope);
  assert.equal(actions.length,2);
  assert.deepEqual(Array.from(actions,x=>[x.kind,x.name,x.action,x.label,x.tab]),[
    ['attack','Handaxe','attack','+7 Attack','Combat'],
    ['attack','Handaxe','damage','1d6+4','Combat']
  ]);
  assert.notEqual(actions[0].id,actions[1].id);
});
test('official 2024 sheet-wide skill ability save and initiative rolls are harvested once without tab identity',()=>{
  const {h}=env();
  const skillButton=rollButton('Acrobatics');
  const skill={querySelector(sel){return sel==='button.skill__name'?skillButton:null}};
  const abilityButton=rollButton('+4'),saveButton=rollButton('+7');
  const ability={innerText:'STR 18 +4 +7',textContent:'STR 18 +4 +7',
    querySelector(sel){
      if(sel==='.poly-button--ability button')return abilityButton;
      if(sel==='.poly-button--compact-saving-throw button')return saveButton;
      return null;
    }};
  const initiative=rollButton('+2.14');
  const scope={
    querySelector(selector){
      if(selector==='[role="tab"][aria-selected="true"]')return {innerText:'Spells'};
      if(selector==='[role="tabpanel"]:not([style*="display: none"])')return {querySelectorAll(){return []}};
      if(selector==='.initiative-btn button')return initiative;
      return null;
    },
    querySelectorAll(selector){
      if(selector==='.skill')return [skill];
      if(selector==='.inline-ability')return [ability];
      return [];
    }
  };
  const actions=h.beaconCollectRollActions(scope);
  assert.ok(actions.some(x=>x.kind==='skill'&&x.name==='Acrobatics'&&x.tab===''));
  assert.ok(actions.some(x=>x.kind==='ability'&&x.name==='STR'&&x.tab===''));
  assert.ok(actions.some(x=>x.kind==='save'&&x.name==='STR'&&x.tab===''));
  assert.ok(actions.some(x=>x.kind==='initiative'&&x.name==='Initiative'&&x.tab===''));
});
test('official 2024 spell and healing controls are harvested as executable sheet actions',()=>{
  const {h}=env();
  const spellAttack=rollButton('+8 Attack'),spellDamage=rollButton('2d10');
  const spell=namedCard('Fire Bolt',{
    '.poly-button--hit-dc button':spellAttack,
    '.poly-button--damage button':spellDamage
  },'.spell-item__name.span--item-row-title');
  const heal=rollButton('2d4+4');
  const action=namedCard('Second Wind',{
    '.poly-button--healing button':heal
  },'.action-item__name');
  const panel={querySelectorAll(selector){
    if(selector==='.spell-item')return [spell];
    if(selector==='.action-item')return [action];
    return [];
  }};
  const scope={
    querySelector(selector){
      if(selector==='[role="tab"][aria-selected="true"]')return {innerText:'Spells'};
      if(selector==='[role="tabpanel"]:not([style*="display: none"])')return panel;
      return null;
    },
    querySelectorAll(){return []}
  };
  const actions=h.beaconCollectRollActions(scope);
  assert.ok(actions.some(x=>x.kind==='spell'&&x.name==='Fire Bolt'&&x.action==='attack'));
  assert.ok(actions.some(x=>x.kind==='spell'&&x.name==='Fire Bolt'&&x.action==='damage'));
  assert.ok(actions.some(x=>x.kind==='action'&&x.name==='Second Wind'&&x.action==='healing'));
});

test('explicit Roll-labeled tool checks and Hit Dice are harvested without arbitrary button access',()=>{
  const {h}=env();
  const make=(text,aria)=>({innerText:text,textContent:text,
    getAttribute(name){return name==='aria-label'?aria:null},disabled:false,click(){}});
  const tool=make('Guitar (or any string variation)','Roll a Guitar (or any string variation) check');
  const hitDie=make('D10 (Fighter)','Roll a d10 hit die for Fighter');
  const notARoll=make('Short Rest','Short Rest');
  const scope={
    querySelector(selector){
      if(selector==='[role="tabpanel"]:not([style*="display: none"])')return {querySelectorAll(){return []}};
      return null;
    },
    querySelectorAll(selector){return selector==='button[aria-label]'?[tool,hitDie,notARoll]:[]}
  };
  const actions=h.beaconCollectRollActions(scope);
  assert.equal(actions.length,2);
  assert.ok(actions.some(x=>x.kind==='generic'&&x.action==='roll'&&x.name==='Guitar (or any string variation)'&&/^Roll a Guitar/.test(x.ariaLabel)));
  assert.ok(actions.some(x=>x.kind==='generic'&&x.action==='roll'&&x.name==='D10 (Fighter)'&&/^Roll a d10/.test(x.ariaLabel)));
  assert.equal(actions.some(x=>x.name==='Short Rest'),false);
});

test('live 2024 values supersede stale named attrs only with explicit sheet priority',()=>{
 const {h,fakeSheet}=env();
 const current=[
   'NIER He/Him','Fighter 7 - Echo Knight','INITIATIVE +2.14',
   'HIT POINTS','82 / 84','0','Current','Max','Temp',
   'ABILITIES','STR','18','+4','+7','Mod','Save','DEX','14','+2','+2','Mod','Save',
   'CON','15','+2','+5','Mod','Save','INT','12','+1','+1','Mod','Save',
   'WIS','15','+2','+2','Mod','Save','CHA','10','+0','+0','Mod','Save',
   'AC/SPEED','ARMOR CLASS','17','SPEED (ft)','55','SKILLS'
 ].join('\n');
 fakeSheet.innerText=current;
 const visual=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(visual.stats.hp,82);
 assert.equal(visual.stats.ac,17);
 assert.equal(visual.stats.speed,55);
 assert.equal(visual.stats.init,2.14);
 assert.equal(visual.abilityScores.str,18);
 assert.equal(visual.abilityScores.cha,10);
 const named=h.snapshotSheet({hp:{current:'69',max:'84'},ac:'10',speed:'30',
   strength_mod:'4',initiative_bonus:'0'},'NIER');
 const defaultMerge=h.mergeBeaconSnapshot(named,visual);
 assert.equal(defaultMerge.stats.hp,69,'legacy unnamed merge stays named-first');
 const live=h.mergeBeaconSnapshot(h.snapshotSheet({hp:{current:'69',max:'84'},ac:'10',speed:'30',
   initiative_bonus:'0'},'NIER'),visual,{preferVisibleStats:true});
 assert.equal(live.stats.hp,82);
 assert.equal(live.stats.ac,17);
 assert.equal(live.stats.speed,55);
 assert.equal(live.stats.init,2.14);
 assert.deepEqual({...live.abilityScores},{str:18,dex:14,con:15,int:12,wis:15,cha:10});
});


test('official 2024 input values are imported when innerText omits editable HP and score values',()=>{
 const {h,fakeSheet}=env('NIER\nHIT POINTS\nCurrent\nMax\nTemp\nABILITIES\nSTR\nMod\nSave');
 const hpPanel={innerText:'HIT POINTS\nCurrent\nMax\nTemp\nDamage',parentElement:fakeSheet,
   querySelectorAll(sel){return sel==='input'?hpInputs:[]}};
 const numeric=(value,parent)=>({value:String(value),type:'number',parentElement:parent,
   getClientRects(){return [{}]},closest(){return null}});
 const hpInputs=[82,84,0,1].map(v=>numeric(v,hpPanel));
 const ability={innerText:'STR\nMod\nSave',querySelectorAll(sel){
   return sel==='input'?[abilityInput]:[];
 },querySelector(sel){
   if(sel==='.poly-button--ability button')return {innerText:'+4'};
   if(sel==='.poly-button--compact-saving-throw button')return {innerText:'+7'};
   return null;
 }};
 const abilityInput=numeric(18,ability);
 fakeSheet.querySelectorAll=sel=>{
   if(sel==='input')return [...hpInputs,abilityInput];
   if(sel==='.inline-ability')return [ability];
   return [];
 };
 fakeSheet.querySelector=sel=>sel==='.initiative-btn button'?{innerText:'+2.14'}:null;
 const data=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(data.stats.hp,82);assert.equal(data.stats.maxHp,84);
 assert.equal(data.stats.tempHp,0);assert.equal(data.stats.init,2.14);
 assert.equal(data.abilityScores.str,18);
 assert.equal(data.abilityMods.str,4);assert.equal(data.saveBonuses.str,7);
});

test('hidden and unrelated resource inputs cannot be mistaken for visible character HP',()=>{
 const {h,fakeSheet}=env('NIER\nHIT POINTS\nCurrent\nMax\nTemp');
 const panel={innerText:'HIT POINTS\nCurrent\nMax\nTemp',parentElement:fakeSheet,
   querySelectorAll(sel){return sel==='input'?hidden:[]}};
 const hidden=[69,84,0].map(value=>({
   value:String(value),parentElement:panel,type:'number',
   getClientRects(){return []},closest(){return null}
 }));
 fakeSheet.querySelectorAll=sel=>sel==='input'?hidden:[];
 const data=h.beaconImportVisible(fakeSheet,'NIER');
 assert.equal(data.stats.hp,undefined);
 assert.equal(data.stats.maxHp,undefined);
});
