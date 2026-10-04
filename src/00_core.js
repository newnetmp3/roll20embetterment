// roll20 Embetterment - core and player profiles
'use strict';
const RB = {
  version: '2.0.1',
  prefix: 'r20e',
  key: 'roll20-embetterment:' + (new URLSearchParams(location.search).get('id') || location.pathname.match(/(?:setcampaign|editor)\/(\d+)/)?.[1] || 'editor'),
  state: null, root: null, shadow: null, panel: null, tab: 'Home', visible: false,
  paletteOpen: false, selectedAdv: 'normal', search: '', noteTimer: null, drag: null,
  toastTimer: null, chatNode: null, chatObserver: null, paletteSelection: 0
};
const skillNames = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
const skillsByAbility = {Acrobatics:'dex', 'Animal Handling':'wis', Arcana:'int', Athletics:'str', Deception:'cha', History:'int', Insight:'wis', Intimidation:'cha', Investigation:'int', Medicine:'wis', Nature:'int', Perception:'wis', Performance:'cha', Persuasion:'cha', Religion:'int', 'Sleight of Hand':'dex', Stealth:'dex', Survival:'wis'};
const abilities = ['str','dex','con','int','wis','cha'];
const conditions = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const int = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, int(v)));
const short = (s, n=38) => String(s || '').length > n ? String(s).slice(0,n-1)+'…' : String(s||'');
const signed = v => int(v) < 0 ? String(int(v)) : '+' + int(v);
const baseMacros = () => [
  {id:'d20', name:'D20 Roll', command:'/roll 1d20', favorite:true, category:'Dice'},
  {id:'adv', name:'Advantage', command:'/roll 2d20kh1', favorite:true, category:'Dice'},
  {id:'dis', name:'Disadvantage', command:'/roll 2d20kl1', favorite:true, category:'Dice'},
  {id:'initiative', name:'Initiative (selected token)', command:'/roll 1d20 &{tracker}', favorite:true, category:'Combat'},
  {id:'damage', name:'Damage (prompted)', command:'/roll ?{Damage dice|1d8}', favorite:true, category:'Combat'},
  {id:'perception', name:'Perception (sheet, 2014)', command:'%{selected|perception}', favorite:false, category:'Skills'},
  {id:'save', name:'Saving Throw (prompted)', command:'/roll 1d20+?{Save bonus|0}', favorite:false, category:'Saves'},
  {id:'whisper', name:'Whisper GM', command:'/w gm ?{Message|Hello}', favorite:false, category:'Social'}
];
function newProfile(name='Adventurer') {
  return {id:uid(), name, stats:{hp:10,maxHp:10,tempHp:0,ac:10,speed:30,init:0,proficiency:2,level:1},
    abilityMods:{str:0,dex:0,con:0,int:0,wis:0,cha:0}, skillBonuses:{}, saveBonuses:{},
    abilityScores:{},sheetDetails:{},sheetLink:null,attacks:[],features:[],proficiencies:[],tools:[],
    spellSlots:[0,0,0,0,0,0,0,0,0,0], usedSlots:[0,0,0,0,0,0,0,0,0,0],
    spells:[], inventory:[], macrosSlots:['macro:d20','macro:adv','macro:dis','macro:initiative','macro:damage','macro:perception','macro:save','macro:whisper'],
    resources:[{id:uid(),name:'Hit Dice',current:1,max:1,reset:'long'}],
    currency:{cp:0,sp:0,ep:0,gp:0,pp:0}, notes:'', quests:[], conditions:[], concentration:'',
    inspiration:false, actionUsed:false, bonusUsed:false, reactionUsed:false, movementUsed:0,
    death:{success:0,fail:0}, sessionLog:[], journalSearch:''};
}
function initialState() {
  const p = newProfile();
  return {schema:1, settings:{theme:'bg3',visualMigration:1,scale:1,hotkeys:false,showBar:false,showHud:false,showFab:false,chatSearch:'',chatKind:'all',reducedMotion:false,alwaysOpen:false,radialMigration:2},
    profiles:[p], current:p.id, macros:baseMacros(),
    ui:{panelX:null,panelY:null,panelWidth:520,lastTab:'Home',barCollapsed:false}};
}
function profile() { return RB.state.profiles.find(p=>p.id === RB.state.current) || RB.state.profiles[0]; }
function normalizeProfile(p) {
  const d = newProfile();
  if (!p || typeof p !== 'object') return d;
  const cleaned = {...d, ...p};
  cleaned.id = String(p.id || d.id).slice(0,100);
  cleaned.name = String(p.name || d.name).slice(0,100);
  for (const key of ['stats','abilityMods','skillBonuses','saveBonuses','currency','death']) cleaned[key] = {...d[key], ...(p[key] && typeof p[key] === 'object' && !Array.isArray(p[key]) ? p[key] : {})};
  for (const key of ['spells','inventory','resources','quests','conditions','sessionLog','macrosSlots','spellSlots','usedSlots','attacks','features','proficiencies','tools']) cleaned[key] = Array.isArray(p[key]) ? p[key].slice(0,key === 'sessionLog' ? 500 : 200) : d[key];
  cleaned.abilityScores={...d.abilityScores,...(p.abilityScores||{})};
  cleaned.sheetDetails={...d.sheetDetails,...(p.sheetDetails||{})};
  cleaned.sheetLink=p.sheetLink && typeof p.sheetLink==='object'?p.sheetLink:null;
  cleaned.notes = String(p.notes || '').slice(0,100000);
  cleaned.concentration = String(p.concentration || '').slice(0,300);
  cleaned.macrosSlots = [...cleaned.macrosSlots.slice(0,8),...Array(8).fill('')].slice(0,8);
  cleaned.spellSlots = [...cleaned.spellSlots.slice(0,10),...Array(10).fill(0)].slice(0,10).map(n=>clamp(n,0,99));
  cleaned.usedSlots = [...cleaned.usedSlots.slice(0,10),...Array(10).fill(0)].slice(0,10).map(n=>clamp(n,0,99));
  return cleaned;
}
function load() {
  const d = initialState();
  try {
    const stored = JSON.parse(localStorage.getItem(RB.key) || 'null');
    if (stored && stored.schema === 1) {
      d.settings = {...d.settings, ...stored.settings};
      // V2 turns off the old overlay chrome once while retaining imported character data.
      if(!stored.settings?.radialMigration){d.settings.showBar=false;d.settings.showHud=false;d.settings.showFab=false;d.settings.alwaysOpen=false;d.settings.radialMigration=2;}
      // Move the previous default to the new look once, without changing chosen alternate themes.
      if (!stored.settings?.visualMigration && stored.settings?.theme === 'midnight') d.settings.theme='bg3';
      d.ui = {...d.ui, ...stored.ui};
      d.macros = Array.isArray(stored.macros) ? stored.macros.slice(0,300).map(m=>({id:String(m.id||uid()),name:String(m.name||'Macro').slice(0,120),command:String(m.command||'').slice(0,3000),favorite:!!m.favorite,category:String(m.category||'Custom').slice(0,50)})) : d.macros;
      d.profiles = Array.isArray(stored.profiles) && stored.profiles.length ? stored.profiles.slice(0,30).map(normalizeProfile) : d.profiles;
      d.current = d.profiles.some(p=>p.id===stored.current) ? stored.current : d.profiles[0].id;
    }
  } catch (err) { console.warn('[roll20 Embetterment] Could not load saved state', err); }
  RB.state=d; RB.tab=d.ui.lastTab || 'Home';
}
function save() {
  try { localStorage.setItem(RB.key, JSON.stringify(RB.state)); }
  catch (err) { toast('Could not save: browser storage may be full. Export a backup.'); console.warn('[roll20 Embetterment]',err); }
}
function record(text) {
  const p=profile(); p.sessionLog.unshift({at:new Date().toISOString(), text:String(text).slice(0,350)}); p.sessionLog=p.sessionLog.slice(0,500); save();
}
function setValue(path,value) {
  const p=profile(); const parts=path.split('.');
  if (parts.length!==2 || !['stats','abilityMods','currency','death','skillBonuses','saveBonuses'].includes(parts[0])) return;
  const target=p[parts[0]];
  if (!target || !/^[a-zA-Z ]{1,40}$/.test(parts[1])) return;
  target[parts[1]]=clamp(value,-999999,999999); save();
}