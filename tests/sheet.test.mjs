import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const names=['00_core.js','10_roll20_bridge.js','15_sheet_link.js','20_ui.js','30_events.js'];
const source=names.map(name=>readFileSync(join(root,'src',name),'utf8')).join('\n')
 .replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');
function env(){
 const store=new Map();
 const scope={location:{search:'?id=123',pathname:'/editor/'},URLSearchParams,console,crypto,Date,Math,Number,String,Array,
  setTimeout(){},clearTimeout(){},setInterval(){},window:{},document:{querySelectorAll(){return []}},
  localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}}};
 vm.createContext(scope);
 vm.runInContext(source+'\nload();globalThis.expose={RB,profile,snapshotSheet,applySheetSnapshot,readSheetFields,parseSheetPaste,syncSheet,sheetUI};',scope);
 return scope.expose;
}
const sample={character_name:'Thorin',class:'Paladin',level:'7',race:'Dwarf',hp:{current:'32',max:'56'},
 hp_temp:'5',ac:'18',speed:'25',pb:'3',strength:'18',strength_mod:'4',
 strength_save_bonus:'7',perception_bonus:'5',lvl1_slots_total:'4',lvl1_slots_expended:'3',
 class_resource_name:'Lay on Hands',class_resource:{current:'9',max:'35'},gp:'81',
 'repeating_spell-1_$0_spellname':'Bless','repeating_spell-1_$0_spellconcentration':'1',
 'repeating_spell-1_$0_spelldescription':'Bless up to three allies',
 'repeating_attack_$0_atkname':'Warhammer','repeating_attack_$0_atkbonus':'+7',
 'repeating_inventory_$0_itemname':'Potion','repeating_inventory_$0_itemcount':'2',
 'repeating_traits_$0_name':'Divine Sense','repeating_traits_$0_description':'Detect undead'};
test('reads 2014 HP, max HP, AC, skills, saves, levels and slots',()=>{
 const a=env(),s=a.snapshotSheet(sample);
 assert.equal(s.name,'Thorin');assert.equal(s.stats.hp,32);assert.equal(s.stats.maxHp,56);
 assert.equal(s.stats.ac,18);assert.equal(s.abilityMods.str,4);assert.equal(s.saveBonuses.str,7);
 assert.equal(s.skillBonuses.Perception,5);assert.equal(s.spellSlots[1],4);assert.equal(s.usedSlots[1],1);
 assert.equal(s.currency.gp,81);assert.equal(s.details.class,'Paladin');
});
test('maps attacks, spells, equipment, features and resources',()=>{
 const s=env().snapshotSheet(sample);
 assert.equal(s.attacks[0].name,'Warhammer');
 assert.match(s.attacks[0].command,/repeating_attack_\$0_attack/);
 assert.equal(s.spells[0].name,'Bless');assert.equal(s.spells[0].concentration,true);
 assert.match(s.spells[0].command,/repeating_spell-1_\$0_spell/);
 assert.equal(s.inventory[0].qty,2);assert.equal(s.features[0].name,'Divine Sense');
 assert.equal(s.resources[0].max,35);
});
test('sync is idempotent and never removes player-created entries',()=>{
 const a=env(),p=a.profile();p.notes='Quest notes';
 p.spells.push({id:'local',name:'Homebrew',notes:'custom'});
 p.inventory.push({id:'localitem',name:'Rope',qty:1,weight:10});
 const s=a.snapshotSheet(sample);a.applySheetSnapshot(p,s);a.applySheetSnapshot(p,s);
 assert.equal(p.spells.length,2);assert.equal(p.inventory.length,2);assert.equal(p.notes,'Quest notes');
 a.applySheetSnapshot(p,a.snapshotSheet({hp:'29',ac:'17'}));
 assert.equal(p.spells.length,2);assert.equal(p.stats.hp,29);assert.equal(p.stats.maxHp,56);
});
test('absent and empty fields do not erase existing stats',()=>{
 const a=env(),p=a.profile();p.stats.hp=46;
 a.applySheetSnapshot(p,a.snapshotSheet({hp:'',ac:'17',lvl1_slots_total:''}));
 assert.equal(p.stats.hp,46);assert.equal(p.stats.ac,17);assert.equal(p.spellSlots[1],0);
});
test('handles 2024 named attributes without inventing repeating actions',()=>{
 const s=env().snapshotSheet({hit_points:{current:21,max:35},armor_class:'15',
  strength_bonus:'+3',acrobatics_bonus:'+4',proficiency_bonus:'3'});
 assert.equal(s.stats.hp,21);assert.equal(s.stats.maxHp,35);assert.equal(s.stats.ac,15);
 assert.equal(s.abilityMods.str,3);assert.equal(s.skillBonuses.Acrobatics,4);
 assert.equal(s.attacks.length,0);assert.equal(s.spells.length,0);
});
test('JSON-array fallback escapes user-supplied HTML',()=>{
 const a=env(),s=a.parseSheetPaste(JSON.stringify([{name:'character_name',current:'<img src=x onerror=alert(1)>'},
  {name:'hp',current:'17',max:'32'}]));
 a.applySheetSnapshot(a.profile(),s);
 assert.equal(a.profile().stats.maxHp,32);
 assert.doesNotMatch(a.sheetUI(),/<img src=x onerror/);
});
test('reads repeating field DOM without changing original inputs',()=>{
 const a=env(),row={id:'-ABc123',getAttribute(){return null},parentElement:{querySelectorAll(){return [row]}},
  closest(){return {className:'repeating_inventory'}}};
 const field=(name,val,type='',checked=false)=>({value:val,type,checked,
  getAttribute(key){return key==='name'?name:null},hasAttribute(){return false},closest(){return row}});
 const inputs=[field('attr_itemname','Arcane Focus'),field('attr_equipped','','checkbox',true)];
 const raw=a.readSheetFields({querySelectorAll(){return inputs}});
 assert.equal(raw['repeating_inventory_-ABc123_itemname'].current,'Arcane Focus');
 assert.equal(raw['repeating_inventory_-ABc123_equipped'].current,'1');
});
test('a missing open sheet cannot silently replace player data',()=>{
 const a=env(),before=JSON.stringify(a.profile());
 assert.equal(a.syncSheet({quiet:true}),false);assert.equal(JSON.stringify(a.profile()),before);
});
