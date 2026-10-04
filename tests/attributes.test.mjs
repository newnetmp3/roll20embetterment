import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

const src=resolve(import.meta.dirname,'..','src');
const modules=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const program=modules.map(m=>readFileSync(join(src,m),'utf8')).join('\n')
 .replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');
function createHarness(doc){
 const values=new Map();
 const context={console,crypto,Math,Date,Number,String,Array,URLSearchParams,
   location:{search:'?id=1',pathname:'/editor/'},
   document:doc||{querySelectorAll(){return []}},
   window:{innerWidth:1600,innerHeight:900},
   setTimeout(fn){fn();return 1},clearTimeout(){},setInterval(){},
   localStorage:{getItem(k){return values.get(k)||null},setItem(k,v){values.set(k,v)}}
 };
 vm.createContext(context);
 vm.runInContext(program+'\nload();globalThis.it={readSheetFields,sheetReadBeaconAttributeRows,sheetHarvestBeaconRows,snapshotSheet,findSheetForms,scanSheets,syncSheet,profile,RB}',context);
 return context.it;
}
function cell(value){
 return {innerText:String(value),textContent:String(value),children:[],parentElement:null};
}
function row(name,description,value) {
 const cells=[cell(name),cell(description),cell(value)];
 const r={children:cells,matches(){return false}};
 for(const c of cells)c.parentElement=r;
 return r;
}
function content(rows){
 return {querySelectorAll(selector){
   if(selector.startsWith('tbody tr'))return rows;
   if(selector.startsWith('span,div,p'))return rows.flatMap(r=>r.children);
   return [];
 }};
}
const sample=[
 row('weight','Weight of character','Pounds'),
 row('weighttotal',"The total weight of the character's items, rounded to two decimal places.",'215.2'),
 row('whispertoggle','The whisper state. "/w gm" if whispering is set, otherwise ""',''),
 row('wisdom','-',15),
 row('wisdom_base','-',15),
 row('wisdom_bonus','-',2),
 row('wisdom_mod','-',2),
 row('wisdom_save_bonus','-',2),
 row('wisdom_save_mod','-',2),
 row('wisdom_save_prof','-',0),
 row('wtype','The whisper state. "/w gm" if whispering is set, otherwise ""','')
];
test('Beacon imports dynamic attribute names and values from supplied 2024 rows',()=>{
 const h=createHarness();
 const attrs=h.readSheetFields(content(sample));
 assert.equal(Object.keys(attrs).length,11);
 assert.equal(attrs.weight.current,'Pounds');
 assert.equal(attrs.weighttotal.current,'215.2');
 assert.equal(attrs.whispertoggle.current,'');
 assert.equal(attrs.wtype.current,'');
 assert.equal(attrs.wisdom.current,'15');
 assert.equal(attrs.wisdom_mod.current,'2');
 assert.equal(attrs.wisdom_save_bonus.current,'2');
 assert.equal(attrs.wisdom_save_prof.current,'0');
 assert.equal(h.snapshotSheet(attrs,'NIER').abilityScores.wis,15);
 assert.equal(h.snapshotSheet(attrs,'NIER').saveBonuses.wis,2);
});
test('blank values never inherit the description column',()=>{
 const h=createHarness(),attrs=h.readSheetFields(content([
   row('custom_ability','a description only',''),
   row('unknownfield','-',0),
   row('weight','Character weight','Pounds')
 ]));
 assert.equal(attrs.custom_ability.current,'');
 assert.equal(attrs.unknownfield.current,'0');
 assert.equal(attrs.weight.current,'Pounds');
});
test('roll20 Attribute list need not use legacy attr_* input controls',()=>{
 const h=createHarness();const attrs=h.readSheetFields(content(sample));
 assert.ok(attrs.wisdom_bonus);
 assert.equal(Object.keys(attrs).length,11);
});
test('pencil settings dialog is rejected in favor of character-sheet attributes',()=>{
 const wrong={innerText:'pencil',querySelectorAll(){return []},querySelector(){return {textContent:'pencil'}},
   getAttribute(){return null},matches(){return false},closest(){return null}};
 const sheet=content(sample);
 sheet.innerText='NIER\\nCharacter Sheet\\nAdvanced Tools\\nAttributes\\nwisdom 15';
 sheet.querySelector=(selector)=>selector==='[data-testid="character-name"]'?{textContent:'NIER'}:null;
 sheet.getAttribute=()=>null;sheet.closest=()=>null;sheet.matches=()=>false;
 const doc={querySelectorAll(selector){
   if(selector.includes('form.charsheet'))return [wrong,sheet];
   return [];
 }};
 const h=createHarness(doc),found=h.findSheetForms(doc);
 assert.equal(found.length,1);
 assert.equal(found[0].name,'NIER');
 assert.equal(found[0].readableFields,11);
 assert.notEqual(found[0].name,'pencil');
});
test('scrollable virtual attribute table yields rows throughout its entire list and restores position',async()=>{
 const pages=[
  [row('strength','-',18),row('dexterity','-',14)],
  [row('wisdom','-',15),row('wisdom_mod','-',2)],
  [row('weighttotal','-',215.2),row('wtype','State','')]
 ];
 let top=0;
 const scroll={clientHeight:200,scrollHeight:600,get scrollTop(){return top},
   set scrollTop(v){top=Math.max(0,Math.min(400,v))}};
 const scope={querySelectorAll(sel){
   const idx=Math.min(2,Math.floor(top/135));
   if(sel.startsWith('tbody tr'))return pages[idx];
   if(sel.startsWith('span,div,p'))return pages[idx].flatMap(r=>r.children);
   if(sel.startsWith('span,div,td'))return pages[idx].flatMap(r=>r.children);
   return [];
 }};
 // The real element's ancestor chain identifies the scroll container.
 for(const page of pages)for(const r of page)for(const c of r.children)c.parentElement={children:[c],parentElement:scroll};
 scroll.parentElement=null;scroll.children=[];
 const h=createHarness(),scan=await h.sheetHarvestBeaconRows(scope);
 assert.ok(scan.scannedPages>1);
 assert.equal(scan.fields.strength.current,'18');
 assert.equal(scan.fields.wisdom.current,'15');
 assert.equal(scan.fields.weighttotal.current,'215.2');
 assert.equal(scan.fields.wtype.current,'');
 assert.equal(top,0);
});
