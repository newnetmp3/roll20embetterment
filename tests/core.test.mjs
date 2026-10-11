import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const files=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','17_frame_bridge.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const program=files.map(f=>readFileSync(join(root,'src',f),'utf8')).join('\n').replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');
function environment(query='?id=123'){
  const store=new Map();const sent=[];const toasts=[];
  let draft='', allowed=true;
  const field={get value(){return draft;},set value(v){draft=v;},dispatchEvent(){}};
  const submit={disabled:false,click(){sent.push(draft);draft='';}};
  const document={querySelector(sel){return allowed&&(sel.includes('textarea')||sel.includes('textchat-input'))?(sel.includes('button')?submit:field):null},contains(){return true}};
  const scope={location:{search:query,pathname:'/editor/'},URLSearchParams,crypto,console,document,
    localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}},
    Event:class {constructor(type,opts){this.type=type;this.bubbles=opts.bubbles;}},
    setTimeout:()=>1,clearTimeout(){},Date,Math,Number,String,Array,Blob,URL,
    navigator:{clipboard:{writeText:()=>Promise.resolve()}},
    confirm:()=>true,prompt:()=>null,window:{innerWidth:1200,innerHeight:900}
  };
  vm.createContext(scope);vm.runInContext(program,scope);
  vm.runInContext('load(); RB.shadow={querySelector(){return null},querySelectorAll(){return []},innerHTML:""}; RB.root={style:{setProperty(){}},setAttribute(){}}; globalThis.h={RB,profile,makeRoll,quickRoll,sendToRoll20,executeSlot,applyDamage,rest,html,save,load,setValue,newProfile,render,notesMarkdown,baseMacros,action,rollsUI,homeUI,inventoryUI,spellListHTML,normalizeProfile,clearImportedSheetData,resetCurrentProfileData,debugUI,filterChatMessages,onKeyDown,keepEmbettermentKeysLocal,sheetUI,paletteEntries,navigatePalette}',scope);
  return {h:scope.h,scope,store,sent,toasts,setDraft(v){draft=v},getDraft(){return draft},setChatAvailable(v){allowed=v}};
}
test('initializes per-campaign key and a local profile with 8 action slots',()=>{const {h}=environment();assert.match(h.RB.key,/123$/);assert.equal(h.profile().macrosSlots.length,8);assert.equal(h.RB.state.profiles.length,1);});
test('escapes HTML inserted in user names, notes, and CSS-adjacent attributes',()=>{const {h}=environment();assert.equal(h.html(`<img src=x onerror="a()">`),'&lt;img src=x onerror=&quot;a()&quot;&gt;');h.profile().name='<svg/onload=alert(1)>';assert.doesNotMatch(h.homeUI(),/<svg\/onload/);});
test('Roll20 5E advantage and disadvantage syntax',()=>{const {h}=environment();assert.equal(h.makeRoll(5,'normal'),'/roll 1d20+5');assert.equal(h.makeRoll(-2,'adv'),'/roll 2d20kh1-2');assert.equal(h.makeRoll(3,'dis',true),'/roll 2d20kl1+3 &{tracker}');});
test('Roll20 chat submit runs supported command when clear',()=>{const e=environment();assert.equal(e.h.sendToRoll20('/roll 1d20'),true);assert.deepEqual(e.sent,['/roll 1d20']);});
test('keeps a typed Roll20 draft and offers copy instead',()=>{const e=environment();e.setDraft('I am typing');e.h.RB.shadow={querySelector(){return null}};assert.equal(e.h.sendToRoll20('/roll 1d20'),false);assert.equal(e.getDraft(),'I am typing');assert.equal(e.h.RB.pendingCommand,'/roll 1d20');assert.equal(e.sent.length,0);});
test('uses copy fallback when Roll20 chat DOM is unavailable',()=>{const e=environment();e.setChatAvailable(false);assert.equal(e.h.sendToRoll20('/roll 1d20'),false);assert.equal(e.h.RB.modal,'copy');assert.equal(e.h.RB.pendingCommand,'/roll 1d20');});
test('damage consumes temporary HP before real HP and leaves Roll20 data untouched',()=>{const {h}=environment();const p=h.profile();p.stats.hp=40;p.stats.tempHp=7;h.applyDamage(12);assert.equal(p.stats.hp,35);assert.equal(p.stats.tempHp,0);});
test('short and long rests reset matching local resources and spell slots',()=>{const {h}=environment();const p=h.profile();p.resources=[{id:'s',name:'Short',current:0,max:2,reset:'short'},{id:'l',name:'Long',current:0,max:3,reset:'long'}];p.usedSlots[1]=2;h.rest('short');assert.equal(p.resources[0].current,2);assert.equal(p.resources[1].current,0);assert.equal(p.usedSlots[1],2);h.rest('long');assert.equal(p.resources[1].current,3);assert.equal(p.usedSlots[1],0);});
test('rolls configured skill values rather than guessing proficiency',()=>{const e=environment();const p=e.h.profile();p.skillBonuses.Perception=7;e.h.quickRoll('skill','Perception');assert.equal(e.sent[0],'/roll 1d20+7');});
test('runs action-bar macros through Roll20 chat',()=>{const e=environment();e.h.executeSlot(0);assert.equal(e.sent[0],'/roll 1d20');});
test('local state save/load persists character data',()=>{const e=environment();const p=e.h.profile();p.stats.hp=8;p.notes='Find goblins';e.h.save();p.stats.hp=55;e.h.load();assert.equal(e.h.profile().stats.hp,8);assert.equal(e.h.profile().notes,'Find goblins');});
test('normalizes malformed spell slot data and avoids excessive arrays',()=>{const {h}=environment();const raw={spellSlots:[-2,500],usedSlots:[1000],inventory:Array(1000).fill({name:'x'})};const result=h.normalizeProfile(raw);assert.equal(result.spellSlots[0],0);assert.equal(result.spellSlots[1],99);assert.equal(result.usedSlots[0],99);assert.equal(result.inventory.length,200);});
test('session journal exports plain Markdown and quests',()=>{const {h}=environment();const p=h.profile();p.notes='A mysterious note';p.quests=[{id:'a',text:'Find the map',done:false}];assert.match(h.notesMarkdown(),/A mysterious note/);assert.match(h.notesMarkdown(),/- \[ \] Find the map/);});
test('default templates and tabs render the expected feature panels',()=>{const {h}=environment();assert.match(h.homeUI(),/Concentration & conditions/);assert.match(h.rollsUI(),/Skill checks/);assert.match(h.inventoryUI(),/Coins/);assert.match(h.spellListHTML(),/No spells yet/);});
test('stale chat filter marks non-matches without deleting messages',()=>{const {h}=environment();const m={textContent:'Hello party',classList:{contains(){return false}},querySelector(){return null},removeAttribute(){this.hidden=false},setAttribute(){this.hidden=true}};h.RB.state.settings.chatSearch='dragon';h.filterChatMessages({querySelectorAll(){return [m]}});assert.equal(m.hidden,true);h.RB.state.settings.chatSearch='';h.filterChatMessages({querySelectorAll(){return [m]}});assert.equal(m.hidden,false);});

test('shadow-DOM inputs never trigger global action-bar hotkeys',()=>{
  const e=environment();e.h.RB.state.settings.hotkeys=true;
  const editable={id:'rbe-notes',closest(){return this}};
  const shadowHost={closest(){return null}};
  const ev={target:shadowHost,composedPath(){return [editable,shadowHost]},code:'Digit1',key:'1',altKey:false,shiftKey:false,metaKey:false,ctrlKey:false,preventDefault(){throw Error('Should not intercept typing')}};
  e.h.onKeyDown(ev);assert.equal(e.sent.length,0);
});

test('B/V/Z keyboard events remain local without preventing text input',()=>{
  const {h}=environment();
  for(const key of ['b','v','z','B','V','Z','ArrowLeft','Backspace','Enter','1']){
    for(const type of ['keydown','keypress','keyup']){
      let stops=0;
      h.keepEmbettermentKeysLocal({type,key,stopPropagation(){stops++;},preventDefault(){throw Error('Default typing should never be canceled');}});
      assert.equal(stops,1,`Expected ${type} for ${key} to stop at the ShadowRoot`);
    }
  }
});

test('action hotkeys do not run when focus is on an Embetterment button',()=>{
  const e=environment();e.h.RB.state.settings.hotkeys=true;
  const button={closest(){return null}};
  const event={target:e.h.RB.root,composedPath(){return [button,e.h.RB.shadow,e.h.RB.root]},code:'Digit1',key:'1',altKey:false,shiftKey:false,metaKey:false,ctrlKey:false,preventDefault(){throw Error('Must not run a hotkey in the panel')}};
  e.h.onKeyDown(event);assert.equal(e.sent.length,0);
});

test('Debug tab clearly marks maintenance as local-only and exposes both reset levels',()=>{
  const {h}=environment();
  const ui=h.debugUI();
  assert.match(ui,/Debug & local maintenance/);
  assert.match(ui,/never write to, delete from, or modify the authoritative Roll20 character sheet/);
  assert.match(ui,/data-action="debugClearImported"/);
  assert.match(ui,/data-action="debugResetCharacter"/);
  assert.match(ui,/data-action="debugExport"/);
});
test('clearing imported sheet data removes sheet-origin values but preserves local character content',()=>{
  const e=environment(),p=e.h.profile(),id=p.id,name=p.name;
  p.notes='Keep my journal';
  p.quests=[{id:'q',text:'Keep this quest',done:false}];
  p.stats.hp=84;p.stats.maxHp=84;p.abilityScores.wis=15;p.abilityMods.wis=2;
  p.currency.gp=250;p.spellSlots[1]=4;p.usedSlots[1]=2;p.sheetDetails.class='Wizard';
  p.sheetLink={name:'Character',edition:'2024'};
  p.attacks=[{id:'sheet:atk',origin:'sheet',name:'Sword'},{id:'local:atk',origin:'local',name:'Custom'}];
  p.spells=[{id:'sheet:spell',origin:'sheet',name:'Bless'},{id:'local:spell',name:'Homebrew'}];
  p.inventory=[{id:'sheet:item',origin:'sheet',name:'Potion'},{id:'local:item',name:'Rope'}];
  p.resources=[{id:'sheet:r',origin:'sheet',name:'Sheet Resource'},{id:'local:r',name:'Local Resource',current:1,max:2}];
  p.macrosSlots[0]='attack:sheet:atk';p.macrosSlots[1]='spell:sheet:spell';
  e.h.clearImportedSheetData();
  const out=e.h.profile();
  assert.equal(out.id,id);assert.equal(out.name,name);
  assert.equal(out.sheetLink,null);assert.equal(out.stats.hp,10);assert.equal(out.stats.maxHp,10);
  assert.deepEqual(Object.keys(out.abilityScores),[]);assert.equal(out.currency.gp,0);
  assert.equal(out.spellSlots[1],0);assert.equal(out.usedSlots[1],0);
  assert.equal(out.notes,'Keep my journal');assert.equal(out.quests.length,1);
  assert.deepEqual(out.attacks.map(x=>x.id),['local:atk']);
  assert.deepEqual(out.spells.map(x=>x.id),['local:spell']);
  assert.deepEqual(out.inventory.map(x=>x.id),['local:item']);
  assert.deepEqual(out.resources.map(x=>x.id),['local:r']);
  assert.equal(out.macrosSlots[0],'');assert.equal(out.macrosSlots[1],'');
  assert.equal(e.sent.length,0,'local reset must not submit anything to Roll20 chat');
});
test('clearing current R20eb character data preserves profile identity but resets all local character content',()=>{
  const e=environment(),p=e.h.profile(),id=p.id,name=p.name;
  p.notes='delete me';p.inventory=[{id:'x',name:'Sword'}];p.spells=[{id:'s',name:'Spell'}];
  p.stats.hp=42;p.sheetLink={name:'Linked'};
  const out=e.h.resetCurrentProfileData();
  assert.equal(out.id,id);assert.equal(out.name,name);
  assert.equal(out.notes,'');assert.equal(out.inventory.length,0);assert.equal(out.spells.length,0);
  assert.equal(out.stats.hp,10);assert.equal(out.sheetLink,null);
  assert.equal(e.h.profile(),out);
  assert.equal(e.sent.length,0,'full local reset must not submit anything to Roll20');
});

test('Sheet panel renders official weapon hit, damage and other native roll buttons',()=>{
  const {h}=environment(),p=h.profile();
  p.attacks=[{id:'axe',name:'Handaxe',command:''},{id:'blank',name:'Unmapped',command:''}];
  p.sheetRolls=[{id:'hit',kind:'attack',name:'Handaxe',action:'attack',tab:'Combat'},
    {id:'dmg',kind:'attack',name:'Handaxe',action:'damage',tab:'Combat'},
    {id:'tool',kind:'tool',name:'Thieves Tools',action:'roll',tab:'Skills & Tools'}];
  const ui=h.sheetUI();
  assert.match(ui,/Attack · official/);assert.match(ui,/Damage · official/);
  assert.match(ui,/Official sheet rolls \(3\)/);
  for(const id of ['hit','dmg','tool'])assert.match(ui,new RegExp('data-action="runNativeSheetRoll" data-id="'+id+'"'));
  assert.doesNotMatch(ui,/data-action="runSheetAction" data-id="blank"/);
});
test('Sheet and palette native actions share bridge and never generate chat roll formulas',async()=>{
  const {h,scope,sent}=environment(),p=h.profile(),called=[];
  p.attacks=[{id:'axe',name:'Handaxe',command:''}];
  p.sheetRolls=[{id:'hit',kind:'attack',name:'Handaxe',action:'attack',tab:'Combat'},
    {id:'dmg',kind:'attack',name:'Handaxe',action:'damage',tab:'Combat'},
    {id:'tool',kind:'tool',name:'Thieves Tools',action:'roll',tab:'Skills & Tools'}];
  scope.nativeRollHook=ref=>{called.push({...ref});return Promise.resolve(true)};
  vm.runInContext('executeOfficialSheetRoll=(ref)=>nativeRollHook(ref)',scope);
  const entries=h.paletteEntries();
  assert.equal(entries.find(x=>x.name==='Attack: Handaxe · official')?.value,'hit');
  assert.ok(entries.some(x=>x.name.includes('Thieves Tools')&&x.kind==='sheetRoll'));
  assert.equal(entries.filter(x=>x.value==='hit').length,1);
  h.action('runSheetAction',{dataset:{id:'axe'}});
  await Promise.resolve();await Promise.resolve();
  assert.equal(p.actionUsed,true);
  h.navigatePalette('sheetRoll','dmg');
  await Promise.resolve();await Promise.resolve();
  h.action('runNativeSheetRoll',{dataset:{id:'tool'}});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(called.map(x=>x.id),['hit','dmg','tool']);
  assert.equal(sent.length,0);
});
test('palette uses official save and skill controls with legacy fallback',async()=>{
  const {h,scope,sent}=environment(),p=h.profile(),called=[];
  p.sheetRolls=[{id:'save-str',kind:'save',name:'STR',action:'save'},
    {id:'acro',kind:'skill',name:'Acrobatics',action:'skill'}];
  scope.nativeRollHook=ref=>{called.push(ref.id);return Promise.resolve(true)};
  vm.runInContext('executeOfficialSheetRoll=(ref)=>nativeRollHook(ref)',scope);
  h.navigatePalette('save','str');h.navigatePalette('skill','Acrobatics');
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(called,['save-str','acro']);
  h.navigatePalette('skill','Perception');
  assert.equal(sent.length,1);
});

test('Spells panel distinguishes native attack/damage, legacy casting and local marking',()=>{
  const {h}=environment(),p=h.profile();
  p.spells=[{id:'bolt',name:'Fire Bolt',level:0,command:''},
    {id:'shield',name:'Shield',level:1,command:'%{selected|shield}'}];
  p.sheetRolls=[{id:'bolt-hit',kind:'spell',name:'Fire Bolt',action:'attack',tab:'Spells'},
    {id:'bolt-dmg',kind:'spell',name:'Fire Bolt',action:'damage',tab:'Spells'}];
  const ui=h.spellListHTML();
  assert.match(ui,/Mark cast \(local\)/);
  assert.match(ui,/Roll attack \(official\)/);
  assert.match(ui,/Roll damage \(official\)/);
  assert.match(ui,/Cast via Roll20/);
  assert.match(ui,/data-id="bolt-hit"/);
  assert.match(ui,/data-id="bolt-dmg"/);
  assert.equal((ui.match(/data-action="castSpell"/g)||[]).length,1);
});
test('palette separates local mark-cast from actual Roll20 casting and native spell rolls',()=>{
  const {h}=environment(),p=h.profile();
  p.spells=[{id:'bless',name:'Bless',command:''},{id:'burning',name:'Burning Hands',command:'/roll 1d6'}];
  p.sheetRolls=[{id:'bless-native',kind:'spell',name:'Bless',action:'damage'}];
  const entries=h.paletteEntries();
  assert.ok(entries.some(x=>x.name==='Mark cast (local): Bless'&&x.kind==='markCast'));
  assert.ok(!entries.some(x=>x.kind==='spell'&&x.value==='bless'));
  assert.ok(entries.some(x=>x.name==='Cast via Roll20: Burning Hands'&&x.kind==='spell'));
  assert.ok(entries.some(x=>x.kind==='sheetRoll'&&x.value==='bless-native'));
});
