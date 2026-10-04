import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const names=['00_core.js','10_roll20_bridge.js','15_sheet_link.js','16_beacon_visible.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
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
 vm.runInContext(script+'\nload();RB.visible=true;RB.shadow={innerHTML:"",querySelector(){return null},querySelectorAll(){return []}};RB.root={style:{setProperty(){}},setAttribute(){}};globalThis.h={RB,profile,scanSheets,syncSheet,beaconImportVisible,mergeBeaconSnapshot,snapshotSheet,beaconVisibleText,sheetUI,readSheetFields};',scope);
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
