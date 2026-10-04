// ==UserScript==
// @name         roll20 Embetterment
// @namespace    https://github.com/newnetmp3/roll20embetterment
// @version      1.0.0
// @description  Player-first D&D 5E HUD, action bar, macros, spells, quick rolls, inventory, notes, chat filters, and command palette.
// @author       roll20 Embetterment contributors
// @match        https://app.roll20.net/editor/*
// @match        https://app.roll20.net/editor
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// @downloadURL  https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// ==/UserScript==

(()=>{
// ===== 00_core.js =====
// roll20 Embetterment - core and player profiles
'use strict';
const RB = {
  version: '1.0.0',
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
    spellSlots:[0,0,0,0,0,0,0,0,0,0], usedSlots:[0,0,0,0,0,0,0,0,0,0],
    spells:[], inventory:[], macrosSlots:['macro:d20','macro:adv','macro:dis','macro:initiative','macro:damage','macro:perception','macro:save','macro:whisper'],
    resources:[{id:uid(),name:'Hit Dice',current:1,max:1,reset:'long'}],
    currency:{cp:0,sp:0,ep:0,gp:0,pp:0}, notes:'', quests:[], conditions:[], concentration:'',
    inspiration:false, actionUsed:false, bonusUsed:false, reactionUsed:false, movementUsed:0,
    death:{success:0,fail:0}, sessionLog:[], journalSearch:''};
}
function initialState() {
  const p = newProfile();
  return {schema:1, settings:{theme:'midnight',scale:1,hotkeys:false,showBar:true,showHud:true,showFab:true,chatSearch:'',chatKind:'all',reducedMotion:false,alwaysOpen:false},
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
  for (const key of ['spells','inventory','resources','quests','conditions','sessionLog','macrosSlots','spellSlots','usedSlots']) cleaned[key] = Array.isArray(p[key]) ? p[key].slice(0,key === 'sessionLog' ? 500 : 200) : d[key];
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

// ===== 10_roll20_bridge.js =====
// Roll20 integration: use supported chat commands, never private page globals.
function chatForm() {
  const field = document.querySelector('#textchat-input textarea, #textchat-input input[type="text"], [data-testid="textchat-input"] textarea');
  const submit = document.querySelector('#textchat-input button.btn, #textchat-input button[type="submit"], #textchat-input .btn, [data-testid="textchat-input"] button');
  return field && submit && !submit.disabled ? {field,submit} : null;
}
function setNativeInput(element, value) {
  const own = Object.getOwnPropertyDescriptor(element, 'value');
  const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
  const setter = proto?.set || own?.set;
  if (setter) setter.call(element,value); else element.value=value;
  element.dispatchEvent(new Event('input', {bubbles:true}));
  element.dispatchEvent(new Event('change', {bubbles:true}));
}
function sendToRoll20(command) {
  const cmd=String(command||'').trim();
  if (!cmd) {toast('This action needs a Roll20 macro command.'); return false;}
  const form=chatForm();
  if (form && String(form.field.value||'').trim()) {RB.pendingCommand=cmd;RB.modal='copy';render();toast('Your unsent chat draft was preserved. Copy this command when ready.');return false;}
  if (!form) {RB.pendingCommand=cmd; RB.modal='copy'; render(); toast('Roll20 chat not found. Copy this command into chat.'); return false;}
  try {
    setNativeInput(form.field,cmd);
    form.submit.click();
    RB.lastCommand=cmd;
    return true;
  } catch (err) {
    console.warn('[roll20 Embetterment] Chat send failed',err);
    RB.pendingCommand=cmd; RB.modal='copy'; render(); toast('Roll20 rejected the action; copy the command manually.');
    return false;
  }
}
function makeRoll(bonus=0, mode=RB.selectedAdv, tracker=false) {
  const dice = mode==='adv' ? '2d20kh1' : mode==='dis' ? '2d20kl1' : '1d20';
  return '/roll '+dice+(int(bonus)<0 ? int(bonus) : '+'+int(bonus))+(tracker ? ' &{tracker}' : '');
}
function quickRoll(kind,name) {
  const p=profile(); let bonus=0;
  if (kind==='ability') bonus=p.abilityMods[name]||0;
  if (kind==='save') bonus=p.saveBonuses[name] ?? p.abilityMods[name] ?? 0;
  if (kind==='skill') bonus=p.skillBonuses[name] ?? p.abilityMods[skillsByAbility[name]] ?? 0;
  if (kind==='initiative') bonus=p.stats.init;
  const sent=sendToRoll20(makeRoll(bonus, RB.selectedAdv, kind==='initiative'));
  if (sent) record('Rolled '+(kind==='initiative'?'Initiative':kind+' '+name)+' ('+signed(bonus)+', '+RB.selectedAdv+')');
}
function executeSlot(slot) {
  const p=profile(); const v=p.macrosSlots[slot];
  if (!v) return toast('Configure this slot under Macros.');
  if (v.startsWith('macro:')) {
    const m=RB.state.macros.find(m=>m.id===v.slice(6));
    if (!m) return toast('Macro no longer exists; edit this slot.');
    if (sendToRoll20(m.command)) record('Used macro: '+m.name);
  } else if (v.startsWith('spell:')) {
    const s=p.spells.find(s=>s.id===v.slice(6));
    if (!s) return toast('Spell no longer exists.');
    useSpell(s.id);
  }
}
function useSpell(id) {
  const p=profile(), spell=p.spells.find(s=>s.id===id);
  if (!spell) return;
  // No automatic slot expenditure: cantrips/rituals/free casts complicate this.
  if (spell.command) {if (sendToRoll20(spell.command)) record('Cast/used '+spell.name);}
  else {toast('No Roll20 command set for '+spell.name+'. Add one using Edit.');}
  if (spell.concentration && spell.command) {
    p.concentration=spell.name; save();
    toast('Concentrating on '+spell.name+' (local reminder).');
  }
  render();
}
function applyDamage(dmg) {
  const p=profile(); let n=clamp(dmg,0,100000); if (!n) return;
  const initial=n, absorbed=Math.min(p.stats.tempHp,n);
  p.stats.tempHp-=absorbed; n-=absorbed; p.stats.hp=Math.max(0,p.stats.hp-n);
  record('Local damage '+initial+(absorbed?' ('+absorbed+' temp HP absorbed)':''));
  if (p.concentration) toast('Concentration check: CON save DC '+Math.max(10,Math.floor(initial/2))+' for '+p.concentration+'.');
  save(); render();
}
function rest(type) {
  const p=profile();
  p.resources.forEach(r=>{if (r.reset===type || (type==='long' && r.reset==='short')) r.current=int(r.max);});
  if (type==='long') {
    p.usedSlots=p.usedSlots.map(()=>0);
    p.actionUsed=p.bonusUsed=p.reactionUsed=false;
    p.movementUsed=0; p.death={success:0,fail:0};
  }
  record(type==='long'?'Long rest: local resources/slots reset':'Short rest: local short-rest resources reset');
  save(); render();
}
function downloadText(filename,content,type='text/plain;charset=utf-8') {
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportBackup() {
  downloadText('roll20-embetterment-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(RB.state,null,2),'application/json');
}
function importBackup(file) {
  if (!file || file.size > 2*1024*1024) return toast('Choose a JSON backup smaller than 2 MB.');
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const raw=JSON.parse(reader.result);
      if (!raw || raw.schema!==1 || !Array.isArray(raw.profiles)) throw new Error('Not an Embetterment v1 backup');
      if (!confirm('Replace all Embetterment settings and character profiles for this campaign?')) return;
      localStorage.setItem(RB.key,JSON.stringify(raw)); load(); RB.visible=true; render(); toast('Backup imported.');
    } catch(err){toast('Import failed: '+err.message);}
  }; reader.readAsText(file);
}
function notesMarkdown() {
  const p=profile();
  const quests=p.quests.map(q=>'- ['+(q.done?'x':' ')+'] '+q.text).join('\n');
  const log=p.sessionLog.map(x=>'- '+new Date(x.at).toLocaleString()+': '+x.text).join('\n');
  return '# '+p.name+' — Session Journal\n\n## Notes\n'+p.notes+'\n\n## Quests\n'+quests+'\n\n## Session Log\n'+log+'\n';
}
function toast(message) {
  RB.toastText=String(message);
  const n=RB.shadow?.querySelector('#rbe-toast');
  if (n) {n.textContent=RB.toastText;n.hidden=false;}
  clearTimeout(RB.toastTimer);
  RB.toastTimer=setTimeout(()=>{const el=RB.shadow?.querySelector('#rbe-toast');if (el) el.hidden=true;},4400);
}
function copyText(text) {
  const copied=()=>toast('Copied to clipboard.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(copied,()=>fallbackCopy(text));
  else fallbackCopy(text);
}
function fallbackCopy(text) {
  const el=document.createElement('textarea'); el.value=text;
  el.style.cssText='position:fixed;left:-10000px;'; document.body.append(el); el.select();
  try {document.execCommand('copy');toast('Copied to clipboard.');}
  catch {toast('Select and copy the displayed command manually.');}
  el.remove();
}
function applyChatFilter() {
  const settings=RB.state.settings;
  const node=document.querySelector('#textchat .content, #textchat .message-list, #textchat [data-testid="chat-messages"]');
  if (!node) { if (RB.tab==='Chat') toast('Chat history container unavailable in this Roll20 layout.'); return; }
  if (RB.chatNode!==node) {
    RB.chatObserver?.disconnect();RB.chatNode=node;
    RB.chatObserver=new MutationObserver(()=>{clearTimeout(RB.chatTimer);RB.chatTimer=setTimeout(()=>filterChatMessages(node),120);});
    RB.chatObserver.observe(node,{childList:true,subtree:true});
  }
  filterChatMessages(node);
}
function filterChatMessages(node) {
  const search=(RB.state.settings.chatSearch||'').toLowerCase().trim();
  const kind=RB.state.settings.chatKind||'all';
  const messages=node.querySelectorAll('.message, .chatmessage, [data-testid="chat-message"]');
  for (const msg of messages) {
    const t=(msg.textContent||'').toLowerCase();
    const roll=!!msg.querySelector('.inlinerollresult,.rollresult,.sheet-rolltemplate-default,[class*="rolltemplate-"]') || /\brolled\b|\brolling\b/.test(t);
    const whisper=msg.classList.contains('whisper') || !!msg.querySelector('.whisper') || /\(to gm\)|\(whisper\)/.test(t);
    const match=(!search || t.includes(search)) && (kind==='all' || (kind==='rolls' && roll) || (kind==='chat' && !roll) || (kind==='whispers' && whisper));
    if (match) msg.removeAttribute('data-rbe-hidden'); else msg.setAttribute('data-rbe-hidden','1');
  }
}
function clearChatFilter() {
  RB.state.settings.chatSearch='';RB.state.settings.chatKind='all';save();
  if (RB.chatNode) RB.chatNode.querySelectorAll('[data-rbe-hidden]').forEach(n=>n.removeAttribute('data-rbe-hidden'));
}

// ===== 20_ui.js =====
// Isolated player UI — all markup is inside a ShadowRoot.
const STYLE = `
:host{all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:14px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:var(--text,#ebf0fa);--bg:#17202d;--panel:#1e2938;--raised:#28374b;--border:#405066;--text:#ebf0fa;--muted:#a7b7ca;--accent:#d1a869;--green:#65c891;--red:#ef8582;--shadow:0 16px 52px #060a13bf}
:host([data-theme="parchment"]){--bg:#f6f1e4;--panel:#fffaf0;--raised:#efe3cb;--border:#b8a78a;--text:#2d251d;--muted:#695c4a;--accent:#79511f;--green:#326643;--red:#a13b38;--shadow:0 12px 35px #2b211855}
:host([data-reduced-motion="true"]) *{scroll-behavior:auto!important;animation:none!important;transition:none!important}
:host([data-theme="violet"]){--bg:#1e182a;--panel:#2b2039;--raised:#3b2b4e;--border:#705682;--text:#f5eafb;--muted:#ccb9d7;--accent:#e3adff;--green:#85d4ae;--red:#ff94aa;--shadow:0 16px 52px #15091fcc}
*{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.45}input,textarea,select{color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px;min-width:0}input[type="checkbox"]{width:auto}input:focus,textarea:focus,select:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}textarea{width:100%;min-height:80px;resize:vertical}select{max-width:100%}label{color:var(--muted);font-size:.85em}button{background:var(--raised);border:1px solid var(--border);border-radius:7px;color:var(--text);padding:7px 11px;white-space:nowrap}button:hover{border-color:var(--accent);filter:brightness(1.13)}button.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:700}button.small{padding:3px 7px;font-size:.87em}button.warn{color:var(--red)}button.on{background:#466d5f;border-color:var(--green);color:white}h2,h3{margin:0 0 9px;line-height:1.3;font-weight:650}h2{font-size:1.18em}h3{font-size:1em;color:var(--accent)}p{margin:0 0 10px}.muted,.hint{color:var(--muted)}.hint{font-size:.86em}.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.between{justify-content:space-between}.grow{flex:1;min-width:0}.stack{display:flex;flex-direction:column;gap:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}.card{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:11px;min-width:0}.pill{padding:2px 8px;border-radius:30px;font-size:.79em;background:var(--raised);border:1px solid var(--border)}.stat{font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}.field{display:flex;flex-direction:column;gap:3px;flex:1 1 95px;min-width:86px}.field input{width:100%}.field.narrow{flex:0 0 88px}.mini{width:68px;text-align:center}.wide{width:100%}.sep{height:1px;background:var(--border);margin:10px 0}.scroll{max-height:190px;overflow:auto}.list-entry{padding:8px 0;border-top:1px solid var(--border)}.list-entry:first-child{border-top:none}.barslot{min-width:63px;max-width:113px;flex:1;padding:7px 5px;text-align:center;overflow:hidden;text-overflow:ellipsis}.barslot .index{font-size:.75em;color:var(--muted)}
#rbe-fab,#rbe-bar,#rbe-hud,#rbe-panel,#rbe-palette,#rbe-toast,#rbe-copy-modal{pointer-events:auto;color:var(--text);font-size:calc(14px * var(--scale,1))}
#rbe-fab{position:fixed;bottom:14px;left:14px;padding:12px;border:1px solid var(--accent);border-radius:15px;background:var(--bg);color:var(--accent);box-shadow:var(--shadow);font-weight:800}
#rbe-hud{position:fixed;left:14px;bottom:78px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 12px;box-shadow:var(--shadow);max-width:min(380px,calc(100vw - 24px));min-width:195px}
#rbe-hud .hpbar{height:7px;background:var(--raised);border-radius:8px;overflow:hidden;margin:6px 0}#rbe-hud .hpbar>span{display:block;height:100%;background:var(--red)}
#rbe-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:11px;display:flex;gap:4px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:12px;max-width:calc(100vw - 155px);box-shadow:var(--shadow);overflow-x:auto}
#rbe-panel{position:fixed;right:16px;bottom:108px;width:min(var(--panel-width,520px),calc(100vw - 20px));max-height:min(77vh,790px);display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--border);border-radius:13px;box-shadow:var(--shadow);overflow:hidden}
#rbe-header{background:var(--panel);padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:7px;cursor:grab;touch-action:none;user-select:none}
#rbe-header strong{color:var(--accent);font-size:1.06em}#rbe-tabs{display:flex;overflow-x:auto;gap:2px;padding:7px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0}
#rbe-tabs button{padding:6px 10px;border-radius:5px;font-size:.89em}#rbe-tabs button.active{border-color:var(--accent);color:var(--accent);background:var(--raised)}
#rbe-body{overflow-y:auto;min-height:140px;padding:13px;scrollbar-color:var(--border) transparent;overscroll-behavior:contain}
#rbe-toast{position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--accent);color:var(--text);padding:11px 17px;border-radius:10px;max-width:min(430px,90vw);box-shadow:var(--shadow);text-align:center}#rbe-toast[hidden]{display:none}
#rbe-palette,#rbe-copy-modal{position:fixed;inset:0;background:#070b10ad;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
#rbe-palette .dialog,#rbe-copy-modal .dialog{background:var(--bg);border:1px solid var(--accent);padding:15px;border-radius:12px;box-shadow:var(--shadow);width:min(540px,90vw);max-height:70vh;overflow-y:auto}
#rbe-palette input{width:100%;font-size:1.1em;padding:12px}.palette-choice{display:block;text-align:left;width:100%;margin:4px 0;white-space:normal}.table-scroll{overflow-x:auto}.table-scroll table{width:100%;border-collapse:collapse}.table-scroll td,.table-scroll th{padding:6px 3px;text-align:left;border-bottom:1px solid var(--border);font-size:.89em}.table-scroll th{color:var(--muted)}.tabs-inline{display:flex;gap:4px;flex-wrap:wrap}.key{color:var(--accent);font-weight:650}.note{border-left:3px solid var(--accent);padding:8px 10px;background:var(--panel);font-size:.88em}
@media(max-width:680px){#rbe-panel{bottom:75px!important;right:5px!important;left:5px!important;top:auto!important;width:calc(100vw - 10px)!important;max-height:76vh}#rbe-hud{display:none}#rbe-bar{left:76px;right:4px;transform:none;max-width:calc(100vw - 80px)}#rbe-fab{bottom:12px;left:5px;padding:10px}}
`;
const field = (label,path,value,opts={}) => `<label class="field ${opts.cls||''}">${html(label)}<input data-field="${html(path)}" type="${opts.type||'number'}" value="${html(value)}" ${opts.min!==undefined?'min="'+opts.min+'"':''} ${opts.max!==undefined?'max="'+opts.max+'"':''}></label>`;
const button = (label,action,extra='',cls='') => `<button data-action="${html(action)}" ${extra} class="${cls}">${label}</button>`;
const progress = (cur,max) => `<div class="hpbar"><span style="width:${max?Math.max(0,Math.min(100,cur/max*100)):0}%"></span></div>`;
function homeUI() {
  const p=profile(),s=p.stats;
  return `<div class="stack"><div class="row between"><h2>${html(p.name)} — Player HUD <span class="pill">local tracking</span></h2>${button('⚙ Profiles','profiles')}</div>
  <div class="card"><div class="row between"><strong>Hit Points <span class="stat">${int(s.hp)} / ${int(s.maxHp)}</span></strong><span class="hint">Temp: ${int(s.tempHp)} • AC ${int(s.ac)} • Speed ${int(s.speed)} ft</span></div>${progress(s.hp,s.maxHp)}
   <div class="row">${field('Current HP','stats.hp',s.hp,{cls:'narrow'})}${field('Max HP','stats.maxHp',s.maxHp,{cls:'narrow'})}${field('Temp HP','stats.tempHp',s.tempHp,{cls:'narrow'})}${field('AC','stats.ac',s.ac,{cls:'narrow'})}${field('Speed','stats.speed',s.speed,{cls:'narrow'})}</div>
   <div class="row"><input id="rbe-hp-adjust" type="number" value="5" class="mini" min="1" aria-label="HP adjustment">${button('− Damage','damage')} ${button('+ Heal','heal')} ${button('+ Temp HP','addTemp')}</div>
   <p class="hint">HUD HP is a personal tracker; it does not modify the actual Roll20 sheet or token bars.</p></div>
  <div class="card"><h3>Turn assistant</h3><div class="row">${toggle('Action','actionUsed',p.actionUsed)}${toggle('Bonus action','bonusUsed',p.bonusUsed)}${toggle('Reaction','reactionUsed',p.reactionUsed)}${button('New turn ↻','newTurn')}</div>
   <div class="row">${field('Movement used (ft)','movementUsed',p.movementUsed,{cls:'narrow'})}<span class="muted">Remaining: <strong>${Math.max(0,int(s.speed)-int(p.movementUsed))} ft</strong></span></div>
   <div class="row">${button(p.inspiration?'★ Inspiration ON':'☆ Inspiration OFF','inspiration','',p.inspiration?'on':'')}${button('Short rest','shortRest')}${button('Long rest','longRest')}</div></div>
  <div class="card"><h3>Concentration & conditions</h3><div class="row">${field('Concentrating on','concentration',p.concentration,{type:'text'})}${button('End','endConcentration')}</div>
   <div class="row">${conditions.map(c=>`<button class="small ${p.conditions.includes(c)?'on':''}" data-action="condition" data-value="${html(c)}">${html(c)}</button>`).join('')}</div>
   <p class="hint">Conditions are local reminders, not shared status markers.</p></div>
  <div class="grid"><div class="card"><h3>Death saves</h3><div class="row">Success ${[0,1,2].map(i=>`<input type="checkbox" data-death="success" data-count="${i+1}" ${p.death.success>i?'checked':''} aria-label="Success ${i+1}">`).join('')}</div><div class="row">Failure ${[0,1,2].map(i=>`<input type="checkbox" data-death="fail" data-count="${i+1}" ${p.death.fail>i?'checked':''} aria-label="Failure ${i+1}">`).join('')}</div>${button('Clear','clearDeath')}</div>
  <div class="card"><h3>Spell slots remaining</h3><div class="row">${p.spellSlots.map((n,i)=>i&&n?`<span class="pill">L${i}: ${Math.max(0,n-p.usedSlots[i])}/${n}</span>`:'').join('')||'<span class="muted">Set spell slots on Spells tab</span>'}</div></div></div>
  <div class="card"><div class="row between"><h3>Class resources</h3>${button('+ Resource','addResource')}</div>
   ${p.resources.map(r=>`<div class="row list-entry"><strong class="grow">${html(r.name)}</strong>${button('−','resourceDec',`data-id="${html(r.id)}"`,'small')}<span>${int(r.current)} / ${int(r.max)}</span>${button('+','resourceInc',`data-id="${html(r.id)}"`,'small')}${button('Edit','resourceEdit',`data-id="${html(r.id)}"`,'small')}${button('✕','resourceDelete',`data-id="${html(r.id)}"`,'small warn')}</div>`).join('')}</div></div>`;
}
function toggle(label,key,val) {return `<button class="${val?'on':''}" data-action="turnToggle" data-value="${key}">${val?'✓':'○'} ${label}</button>`;}
function rollsUI() {
  const p=profile();
  return `<div class="stack"><div class="card"><h2>Quick rolls <span class="pill">Roll20 dice</span></h2><div class="row"><span class="muted">Roll mode:</span>${['normal','adv','dis'].map(v=>`<button class="${RB.selectedAdv===v?'on':''}" data-action="adv" data-value="${v}">${v==='normal'?'Normal':v==='adv'?'Advantage':'Disadvantage'}</button>`).join('')}
  ${button('Initiative (select token)','rollInitiative')}</div><p class="hint">Bonuses are local values. Rolls go through Roll20 chat; initiative requires a selected token.</p></div>
  <div class="card"><h3>Ability checks & saves</h3><div class="table-scroll"><table><thead><tr><th>Ability</th><th>Check mod</th><th>Check</th><th>Save mod</th><th>Save</th></tr></thead><tbody>${abilities.map(a=>`<tr><td>${a.toUpperCase()}</td><td><input class="mini" type="number" data-field="abilityMods.${a}" value="${int(p.abilityMods[a])}"></td><td>${button('Roll','rollAbility',`data-value="${a}"`,'small')}</td><td><input class="mini" type="number" data-field="saveBonuses.${a}" value="${int(p.saveBonuses[a]??p.abilityMods[a])}"></td><td>${button('Save','rollSave',`data-value="${a}"`,'small')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Skill checks</h3><div class="table-scroll"><table><thead><tr><th>Skill</th><th>Ability</th><th>Total bonus</th><th>Roll</th></tr></thead><tbody>${skillNames.map(n=>`<tr><td>${html(n)}</td><td class="muted">${skillsByAbility[n].toUpperCase()}</td><td><input class="mini" type="number" data-field="skillBonuses.${html(n)}" value="${int(p.skillBonuses[n]??p.abilityMods[skillsByAbility[n]])}"></td><td>${button('Roll','rollSkill',`data-value="${html(n)}"`,'small')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Custom dice</h3><div class="row"><input id="rbe-custom-dice" class="grow" placeholder="2d6+3" value="1d20">${button('Public roll','customRoll')}${button('GM roll','gmRoll')}</div><p class="hint">Supports Roll20 dice notation. Rolls are made by Roll20, not by this script.</p></div></div>`;
}
function macroUI() {
  const macros=[...RB.state.macros].sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||a.name.localeCompare(b.name));
  const p=profile(), edit=RB.editMacro && RB.state.macros.find(m=>m.id===RB.editMacro);
  const slotOptions = [`<option value="">— Unassigned —</option>`, ...RB.state.macros.map(m=>`<option value="macro:${html(m.id)}">${html(m.name)}</option>`), ...p.spells.map(s=>`<option value="spell:${html(s.id)}">Spell: ${html(s.name)}</option>`)].join('');
  return `<div class="stack"><div class="card"><h2>${edit?'Edit macro':'Add player macro'}</h2><div class="row"><label class="field">Name<input id="rbe-macro-name" maxlength="120" value="${html(edit?.name||'')}"></label><label class="field">Category<input id="rbe-macro-cat" maxlength="50" value="${html(edit?.category||'Custom')}"></label></div><label class="field">Roll20 chat command<textarea id="rbe-macro-command" rows="2" placeholder="/roll 1d20+5">${html(edit?.command||'')}</textarea></label><div class="row">${button(edit?'Save changes':'Add macro','saveMacro','', 'primary')}${edit?button('Cancel edit','cancelMacro'):''}</div>
  <p class="hint">Commands beginning with # call existing Roll20 macros, while %{selected|...} references character-sheet buttons. Commands run with your Roll20 chat permissions.</p></div>
  <div class="card"><h3>Action bar configuration</h3><div class="grid">${p.macrosSlots.map((v,i)=>`<label class="field">Slot ${i+1}<select data-slot="${i}">${slotOptions.replace(`value="${html(v)}"`,`value="${html(v)}" selected`)}</select></label>`).join('')}</div><p class="hint">Action-bar numbers 1–8 can be enabled under Settings (off by default so they won't conflict with Roll20 shortcuts).</p></div>
  <div class="card"><h3>Macro library (${macros.length})</h3><input id="rbe-macro-search" class="wide" placeholder="Filter macros" value="${html(RB.macroSearch||'')}">
  <div id="rbe-macro-results">${macroListHTML(macros)}</div></div></div>`;
}
function macroListHTML(macros) {
  const q=(RB.macroSearch||'').toLowerCase();
  return macros.filter(m=>m.name.toLowerCase().includes(q)||m.category.toLowerCase().includes(q)).map(m=>`<div class="list-entry"><div class="row"><strong class="grow">${m.favorite?'★ ':''}${html(m.name)}</strong><span class="pill">${html(m.category)}</span>${button('Run','runMacro',`data-id="${html(m.id)}"`,'small primary')}${button(m.favorite?'★':'☆','favMacro',`data-id="${html(m.id)}"`,'small')}${button('Edit','editMacro',`data-id="${html(m.id)}"`,'small')}${button('✕','deleteMacro',`data-id="${html(m.id)}"`,'small warn')}</div><div class="hint">${html(short(m.command,100))}</div></div>`).join('') || '<p class="hint">No matching macros.</p>';
}
function spellsUI() {
  const p=profile(), editing=p.spells.find(s=>s.id===RB.editSpell);
  return `<div class="stack"><div class="card"><h2>Spell slots (local)</h2><div class="grid">${Array.from({length:9},(_,i)=>i+1).map(i=>`<div class="stack"><label>Level ${i}</label><div class="row"><input class="mini" type="number" min="0" max="99" data-slot-max="${i}" value="${p.spellSlots[i]}"><input class="mini" type="number" min="0" max="99" data-slot-used="${i}" value="${p.usedSlots[i]}"></div><span class="hint">Total / used</span>${button('Use','useSlot',`data-index="${i}"`,'small')}${button('Restore','restoreSlot',`data-index="${i}"`,'small')}</div>`).join('')}</div><p class="hint">Tracking is local. Casting does not automatically use a spell slot (rituals, free casts, etc.). Use the slot buttons when appropriate.</p></div>
  <div class="card"><h3>${editing?'Edit spell':'Add spell / feature'}</h3><div class="row"><label class="field">Name<input id="rbe-spell-name" value="${html(editing?.name||'')}"></label><label class="field narrow">Level (0–9)<input id="rbe-spell-level" type="number" min="0" max="9" value="${editing?.level??0}"></label><label class="field">Range / target<input id="rbe-spell-range" value="${html(editing?.range||'')}"></label></div>
  <label class="field">Roll20 cast command (optional)<input id="rbe-spell-command" placeholder="%{selected|repeating_spell-...}" value="${html(editing?.command||'')}"></label><label class="field">Notes / components<textarea id="rbe-spell-notes" rows="2">${html(editing?.notes||'')}</textarea></label><div class="row"><label><input type="checkbox" id="rbe-spell-conc" ${editing?.concentration?'checked':''}> Concentration</label>${button(editing?'Save spell':'Add spell','saveSpell','', 'primary')}${editing?button('Cancel edit','cancelSpell'):''}</div></div>
  <div class="card"><h3>Spellbook (${p.spells.length})</h3><input class="wide" id="rbe-spell-search" placeholder="Search spells and notes" value="${html(RB.spellSearch||'')}"><div id="rbe-spell-results">${spellListHTML()}</div></div></div>`;
}
function spellListHTML() {
  const p=profile(), q=(RB.spellSearch||'').toLowerCase();
  return p.spells.filter(s=>(s.name+' '+s.notes).toLowerCase().includes(q)).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)).map(s=>`<div class="list-entry"><div class="row"><strong class="grow">${html(s.name)}</strong><span class="pill">${s.level?'Level '+s.level:'Cantrip'}</span>${s.concentration?'<span class="pill">Concentration</span>':''}${button('Cast','castSpell',`data-id="${html(s.id)}"`,'small primary')}${button('Edit','editSpell',`data-id="${html(s.id)}"`,'small')}${button('✕','deleteSpell',`data-id="${html(s.id)}"`,'small warn')}</div><p class="hint">${html(s.range||'')}${s.notes?' • '+html(short(s.notes,140)):''}</p></div>`).join('')||'<p class="hint">No spells yet. Add spells and optionally link their sheet macros.</p>';
}
function inventoryUI() {
  const p=profile(), weight=p.inventory.reduce((acc,x)=>acc+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.weight)||0),0);
  return `<div class="stack"><div class="card"><h2>Inventory <span class="pill">${weight.toFixed(1)} lb</span></h2><div class="row"><label class="field">Item<input id="rbe-item-name" placeholder="Potion of Healing"></label><label class="field narrow">Quantity<input id="rbe-item-qty" type="number" value="1" min="1"></label><label class="field narrow">Weight each (lb)<input id="rbe-item-weight" type="number" value="0" min="0" step="0.1"></label></div><div class="row"><label class="field">Category<input id="rbe-item-cat" value="Gear"></label>${button('+ Add item','addItem','', 'primary')}</div>
   <div class="table-scroll"><table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Wt</th><th></th></tr></thead><tbody>${p.inventory.map(x=>`<tr><td>${html(x.name)}</td><td>${html(x.category||'Gear')}</td><td><input class="mini" type="number" min="0" data-item-qty="${html(x.id)}" value="${x.qty}"></td><td>${Number(x.weight||0).toFixed(1)}</td><td>${button('✕','deleteItem',`data-id="${html(x.id)}"`,'small warn')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Coins</h3><div class="row">${['cp','sp','ep','gp','pp'].map(k=>field(k.toUpperCase(),'currency.'+k,p.currency[k],{cls:'narrow'})).join('')}</div></div></div>`;
}
function journalUI() {
  const p=profile();
  return `<div class="stack"><div class="card"><div class="row between"><h2>Personal journal</h2>${button('Export Markdown','exportNotes')}</div><textarea id="rbe-notes" rows="10" placeholder="NPCs, places, clues, session summaries, important details...">${html(p.notes)}</textarea><p class="hint">Auto-saved locally as you type, per character and campaign. Not shared with other players.</p></div>
  <div class="card"><h3>Quest tracker</h3><div class="row"><input id="rbe-quest-text" class="grow" placeholder="Find the missing cartographer">${button('+ Add quest','addQuest')}</div>${p.quests.map(q=>`<div class="row list-entry"><input type="checkbox" data-quest="${html(q.id)}" ${q.done?'checked':''}><span class="grow" style="${q.done?'text-decoration:line-through;opacity:.6':''}">${html(q.text)}</span>${button('✕','deleteQuest',`data-id="${html(q.id)}"`,'small warn')}</div>`).join('')}</div>
  <div class="card"><div class="row between"><h3>Personal activity log</h3>${button('Add timestamp','timestamp')}</div><input id="rbe-log-entry" class="wide" placeholder="A clue, event or note"><div class="row">${button('Add log entry','addLog')}</div><div class="scroll">${p.sessionLog.slice(0,80).map(e=>`<div class="list-entry"><span class="hint">${html(new Date(e.at).toLocaleString())}</span><br>${html(e.text)}</div>`).join('')}</div></div></div>`;
}
function chatUI() {
  return `<div class="stack"><div class="card"><h2>Chat visibility filters</h2><label class="field">Search visible chat<input id="rbe-chat-search" placeholder="Character, phrase, or roll" value="${html(RB.state.settings.chatSearch)}"></label><div class="row"><select id="rbe-chat-kind"><option value="all">All chat</option><option value="rolls" ${RB.state.settings.chatKind==='rolls'?'selected':''}>Likely rolls</option><option value="chat" ${RB.state.settings.chatKind==='chat'?'selected':''}>Non-roll messages</option><option value="whispers" ${RB.state.settings.chatKind==='whispers'?'selected':''}>Visible whispers</option></select>${button('Apply','applyChat','', 'primary')}${button('Clear filters','clearChat')}</div><p class="hint">Only hides messages in your browser; never deletes Roll20 history. Category detection is approximate and depends on Roll20's markup.</p></div>
  <div class="card"><h3>Quick chat commands</h3><label class="field">Message<textarea id="rbe-chat-message" rows="3" placeholder="Your message..."></textarea></label><div class="row">${button('Speak','sendText')}${button('Emote','sendEmote')}${button('OOC','sendOOC')}${button('Whisper GM','sendWhisper')}</div></div></div>`;
}
function settingsUI() {
  const s=RB.state.settings,p=profile();
  return `<div class="stack"><div class="card"><h2>Settings</h2><div class="row"><label class="field">Theme<select data-setting="theme"><option value="midnight" ${s.theme==='midnight'?'selected':''}>Midnight</option><option value="violet" ${s.theme==='violet'?'selected':''}>Arcane Violet</option><option value="parchment" ${s.theme==='parchment'?'selected':''}>Parchment</option></select></label><label class="field">UI size<select data-setting="scale"><option value="0.85" ${s.scale==.85?'selected':''}>Compact</option><option value="1" ${s.scale==1?'selected':''}>Normal</option><option value="1.15" ${s.scale==1.15?'selected':''}>Large</option></select></label></div>
  ${[['showBar','Show the bottom action bar'],['showHud','Show compact HP HUD'],['showFab','Show Embetterment launcher'],['hotkeys','Enable 1–8 keyboard action slots'],['reducedMotion','Reduced animation']].map(([key,label])=>`<div><label><input type="checkbox" data-setting="${key}" ${s[key]?'checked':''}> ${label}</label></div>`).join('')}
  <p class="hint">Shortcuts: Alt+Shift+E opens the panel; Alt+Shift+K opens the command palette. Both are ignored while typing except the palette shortcut.</p></div>
  <div class="card"><h3>Panel width</h3><label class="field">Width <input data-panel-width type="range" min="360" max="920" step="20" value="${RB.state.ui.panelWidth||520}"></label><p class="hint">You can also drag the panel by its title bar.</p></div>
  <div class="card"><h3>Character profiles</h3><div class="row"><select id="rbe-profile-select" class="grow">${RB.state.profiles.map(x=>`<option value="${html(x.id)}" ${x.id===p.id?'selected':''}>${html(x.name)}</option>`).join('')}</select>${button('Switch','switchProfile')}${button('New','newProfile')}${button('Rename','renameProfile')}${button('Delete','deleteProfile','', 'warn')}</div><p class="hint">Every character has separate HP, spells, inventory, notes, slots, and action bar assignments.</p></div>
  <div class="card"><h3>Backup & privacy</h3><div class="row">${button('Export JSON backup','exportBackup','', 'primary')}<label class="field">Import backup<input type="file" id="rbe-import" accept=".json,application/json"></label>${button('Reset panel position','resetPosition')}</div><p class="hint">Everything stays in this browser's localStorage. This script makes no external requests and has no analytics. Export backups before clearing browser data.</p></div>
  <div class="note">Roll20 Embetterment v${RB.version}. Sheet-independent 5E tools work with both 2014 and 2024 sheets. Local trackers do not change authoritative Roll20 attributes or provide GM-only information.</div></div>`;
}
function referenceUI() {
  return `<div class="stack"><h2>5E quick reference</h2><div class="card"><h3>Action economy</h3><p>Generally on your turn: movement up to speed, one action, and a bonus action if a feature permits. Reactions are triggered separately and normally recharge at the start of your turn. Extra Attack and class features modify this.</p></div>
  <div class="card"><h3>Common combat actions</h3><p>Attack • Dash • Disengage • Dodge • Help • Hide • Ready • Search • Use an Object (2014). Some actions differ in 2024; use your campaign's rules.</p></div>
  <div class="card"><h3>Concentration</h3><p>When you take damage while concentrating, make a Constitution saving throw. DC is the higher of 10 or half the damage (rounded down). A new concentration spell ends the prior one.</p></div>
  <div class="card"><h3>Advantage and disadvantage</h3><p>Roll two d20s and use the higher result for advantage or the lower for disadvantage; if both apply, they cancel.</p></div>
  <div class="card"><h3>Roll20 syntax</h3><p><code>/roll 1d20+5</code> • <code>/roll 2d20kh1+5</code> • <code>/roll 2d20kl1+5</code> • <code>/roll 1d20+3 &amp;{tracker}</code> (select token) • <code>#MacroName</code></p></div>
  <p class="hint">Convenience summary only. Your table's official rules edition and DM rulings take precedence.</p></div>`;
}
function paletteEntries() {
  const tabs=['Home','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  return [...tabs.map(t=>({name:'Open '+t,kind:'tab',value:t})),
    ...RB.state.macros.map(m=>({name:'Macro: '+m.name,kind:'macro',value:m.id})),
    ...profile().spells.map(s=>({name:'Spell: '+s.name,kind:'spell',value:s.id})),
    ...skillNames.map(n=>({name:'Skill: '+n,kind:'skill',value:n})),
    ...abilities.map(n=>({name:'Save: '+n.toUpperCase(),kind:'save',value:n}))];
}
function paletteUI() {
  if (!RB.paletteOpen) return '';
  const q=(RB.paletteQuery||'').toLowerCase(), choices=paletteEntries().filter(x=>x.name.toLowerCase().includes(q)).slice(0,30);
  return `<div id="rbe-palette"><div class="dialog"><div class="row between"><strong>⌘ Player command palette</strong>${button('✕','closePalette')}</div><input id="rbe-palette-input" placeholder="Find a macro, spell, skill, or panel…" value="${html(RB.paletteQuery||'')}"><div id="rbe-palette-results">${choices.map((x,i)=>`<button class="palette-choice ${i===RB.paletteSelection?'on':''}" data-action="paletteGo" data-value="${html(x.kind)}" data-id="${html(x.value)}">${html(x.name)}</button>`).join('')||'<p class="hint">Nothing found.</p>'}</div><p class="hint">↑ ↓ to choose • Enter to execute • Escape to close</p></div></div>`;
}
function modalUI() {
  if (RB.modal!=='copy') return '';
  return `<div id="rbe-copy-modal"><div class="dialog"><div class="row between"><h3>Paste into Roll20 chat</h3>${button('✕','closeModal')}</div><p>Roll20's chat input was not found, so the command was not sent.</p><textarea id="rbe-fallback-command" rows="4" readonly>${html(RB.pendingCommand||'')}</textarea><div class="row">${button('Copy command','copyCommand','', 'primary')}${button('Close','closeModal')}</div></div></div>`;
}
function barUI() {
  const p=profile();
  if (!RB.state.settings.showBar) return '';
  return `<div id="rbe-bar" title="Click to run a Roll20 macro or spell">${p.macrosSlots.map((v,i)=>{
    const m=v.startsWith('macro:')?RB.state.macros.find(m=>m.id===v.slice(6)):null;
    const s=v.startsWith('spell:')?p.spells.find(s=>s.id===v.slice(6)):null;
    const name=m?.name || s?.name || 'Empty';
    return `<button class="barslot" data-action="slot" data-index="${i}" title="${html(name)}"><div class="index">${i+1}</div>${html(short(name,15))}</button>`;
  }).join('')}</div>`;
}
function hudUI() {
  const p=profile(),s=p.stats;
  if (!RB.state.settings.showHud) return '';
  return `<div id="rbe-hud" title="Local HP tracker, not synced with Roll20"><div class="row between"><strong>${html(short(p.name,25))}</strong><span class="pill">AC ${int(s.ac)}</span><span class="pill">Temp ${int(s.tempHp)}</span></div>${progress(s.hp,s.maxHp)}<div class="row between"><strong>♥ ${int(s.hp)}/${int(s.maxHp)}</strong><span class="hint">${p.concentration?'◎ '+html(short(p.concentration,25)):'No concentration'}</span>${button('Open','open','', 'small')}</div></div>`;
}
function render() {
  if (!RB.shadow || !RB.state) return;
  const s=RB.state.settings; RB.root.style.setProperty('--scale',s.scale); RB.root.setAttribute('data-theme',s.theme); RB.root.setAttribute('data-reduced-motion',String(!!s.reducedMotion));
  const tabs=['Home','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  const panels={Home:homeUI,Rolls:rollsUI,Macros:macroUI,Spells:spellsUI,Inventory:inventoryUI,Journal:journalUI,Chat:chatUI,Reference:referenceUI,Settings:settingsUI};
  RB.shadow.innerHTML=`<style>${STYLE}</style>${s.showFab?`<button id="rbe-fab" data-action="toggle" title="roll20 Embetterment — Alt+Shift+E">⚔ R20E</button>`:''}${hudUI()}${barUI()}
  ${RB.visible?`<section id="rbe-panel" role="complementary" aria-label="roll20 Embetterment"><header id="rbe-header"><strong>⚔ roll20 Embetterment</strong><div class="row">${button('⌕','openPalette','title="Command palette"','small')}${button('—','close','title="Minimize"','small')}</div></header><nav id="rbe-tabs">${tabs.map(t=>`<button data-action="tab" data-value="${t}" class="${t===RB.tab?'active':''}">${t}</button>`).join('')}</nav><div id="rbe-body">${(panels[RB.tab]||homeUI)()}</div></section>`:''}
  ${paletteUI()}${modalUI()}<div id="rbe-toast" role="status" hidden></div>`;
  RB.panel=RB.shadow.querySelector('#rbe-panel');
  const u=RB.state.ui;
  if (RB.panel) { RB.panel.style.setProperty('--panel-width',(clamp(u.panelWidth||520,360,920))+'px'); if (Number.isFinite(u.panelX)&&Number.isFinite(u.panelY)) {RB.panel.style.left=u.panelX+'px';RB.panel.style.top=u.panelY+'px';RB.panel.style.right='auto';RB.panel.style.bottom='auto';} }
  if (RB.tab==='Chat' && RB.visible) applyChatFilter();
}

// ===== 30_events.js =====
// Event delegation and state changes; no Roll20 internal models are accessed.
function getInput(id) {return RB.shadow.querySelector('#rbe-'+id);}
function getText(id) {return (getInput(id)?.value || '').trim();}
function changedProfile() {save();render();}
function runMacro(id) {
  const m=RB.state.macros.find(x=>x.id===id);
  if (m && sendToRoll20(m.command)) record('Macro: '+m.name);
}
function action(name, el) {
  const p=profile(), s=RB.state.settings;
  const id=el.dataset.id, v=el.dataset.value, ix=int(el.dataset.index);
  switch (name) {
    case 'open': case 'toggle': RB.visible=name==='open'?true:!RB.visible; render(); break;
    case 'close': RB.visible=false;render();break;
    case 'tab': RB.tab=v;RB.state.ui.lastTab=v;changedProfile();break;
    case 'profiles': RB.tab='Settings';RB.visible=true;changedProfile();break;
    case 'damage': applyDamage(getInput('hp-adjust')?.value||0);break;
    case 'heal': p.stats.hp=Math.min(Math.max(0,int(p.stats.maxHp)),p.stats.hp+clamp(getInput('hp-adjust')?.value,0,999999));record('Local healing');changedProfile();break;
    case 'addTemp': p.stats.tempHp=Math.max(0,int(p.stats.tempHp)+clamp(getInput('hp-adjust')?.value,0,999999));changedProfile();break;
    case 'turnToggle':if(['actionUsed','bonusUsed','reactionUsed'].includes(v)){p[v]=!p[v];changedProfile();}break;
    case 'newTurn':p.actionUsed=p.bonusUsed=p.reactionUsed=false;p.movementUsed=0;record('Started new turn');changedProfile();break;
    case 'inspiration':p.inspiration=!p.inspiration;changedProfile();break;
    case 'shortRest': if(confirm('Apply a short rest to local resources?'))rest('short');break;
    case 'longRest': if(confirm('Apply a long rest to local resources and spell slots?'))rest('long');break;
    case 'endConcentration':p.concentration='';changedProfile();break;
    case 'condition':p.conditions=p.conditions.includes(v)?p.conditions.filter(x=>x!==v):[...p.conditions,v];changedProfile();break;
    case 'clearDeath':p.death={success:0,fail:0};changedProfile();break;
    case 'rollInitiative':quickRoll('initiative','');break;
    case 'rollAbility':quickRoll('ability',v);break;
    case 'rollSave':quickRoll('save',v);break;
    case 'rollSkill':quickRoll('skill',v);break;
    case 'adv':RB.selectedAdv=v;render();break;
    case 'customRoll': case 'gmRoll': {
      const expression=getText('custom-dice');
      if(!/^\d{1,3}d\d{1,4}(?:\s*(?:k[hl]\d{1,2}|[+\-*/()]|\d|\s))*$/i.test(expression)) return toast('Enter a simple dice expression, such as 2d6+3.');
      sendToRoll20((name==='gmRoll'?'/gmroll ':'/roll ')+expression);break;
    }
    case 'slot':executeSlot(ix);break;
    case 'runMacro':runMacro(id);break;
    case 'editMacro':RB.editMacro=id;render();break;
    case 'cancelMacro':RB.editMacro=null;render();break;
    case 'favMacro': {const m=RB.state.macros.find(x=>x.id===id);if(m)m.favorite=!m.favorite;changedProfile();break;}
    case 'deleteMacro':if(confirm('Delete this local macro?')){RB.state.macros=RB.state.macros.filter(x=>x.id!==id);p.macrosSlots=p.macrosSlots.map(x=>x==='macro:'+id?'':x);changedProfile();}break;
    case 'saveMacro': {
      const macroName=getText('macro-name').slice(0,120), command=getText('macro-command').slice(0,3000);
      if(!macroName||!command)return toast('Macro needs a name and command.');
      const m=RB.state.macros.find(x=>x.id===RB.editMacro);
      const values={name:macroName,command,category:getText('macro-cat').slice(0,50)||'Custom'};
      if(m)Object.assign(m,values);else RB.state.macros.push({id:uid(),favorite:false,...values});
      RB.editMacro=null;changedProfile();break;
    }
    case 'saveSpell': {
      const spellName=getText('spell-name').slice(0,120);
      if(!spellName)return toast('Enter the spell name.');
      const spell={name:spellName,level:clamp(getInput('spell-level')?.value,0,9),range:getText('spell-range').slice(0,120),command:getText('spell-command').slice(0,3000),notes:getText('spell-notes').slice(0,2500),concentration:!!getInput('spell-conc')?.checked};
      const existing=p.spells.find(x=>x.id===RB.editSpell);
      if(existing)Object.assign(existing,spell);else p.spells.push({id:uid(),...spell});
      RB.editSpell=null;changedProfile();break;
    }
    case 'editSpell':RB.editSpell=id;render();break;
    case 'cancelSpell':RB.editSpell=null;render();break;
    case 'deleteSpell':if(confirm('Remove this local spell?')){p.spells=p.spells.filter(x=>x.id!==id);p.macrosSlots=p.macrosSlots.map(x=>x==='spell:'+id?'':x);changedProfile();}break;
    case 'castSpell':useSpell(id);break;
    case 'useSlot':if(ix>0&&ix<10&&p.usedSlots[ix]<p.spellSlots[ix]){p.usedSlots[ix]++;changedProfile();}else toast('No spell slots available at that level.');break;
    case 'restoreSlot':if(ix>0&&ix<10){p.usedSlots[ix]=Math.max(0,p.usedSlots[ix]-1);changedProfile();}break;
    case 'addResource':{const r=prompt('Resource name?','Lay on Hands');if(!r?.trim())break;const max=clamp(prompt('Maximum uses or points?','5'),0,99999);p.resources.push({id:uid(),name:r.trim().slice(0,120),max,current:max,reset:'long'});changedProfile();break;}
    case 'resourceDec':case 'resourceInc':{const r=p.resources.find(x=>x.id===id);if(r){r.current=clamp(r.current+(name==='resourceInc'?1:-1),0,r.max);changedProfile();}break;}
    case 'resourceEdit':{const r=p.resources.find(x=>x.id===id);if(!r)break;const title=prompt('Resource name',r.name);if(title===null)break;const max=prompt('Maximum',String(r.max));if(max===null)break;const reset=prompt('Reset on short or long rest?',r.reset||'long');if(reset===null)break;r.name=title.trim().slice(0,120)||r.name;r.max=clamp(max,0,99999);r.current=clamp(r.current,0,r.max);r.reset=reset==='short'?'short':'long';changedProfile();break;}
    case 'resourceDelete':if(confirm('Delete this local resource?')){p.resources=p.resources.filter(x=>x.id!==id);changedProfile();}break;
    case 'addItem': {
      const itemName=getText('item-name').slice(0,120);if(!itemName)return toast('Enter an item name.');
      p.inventory.push({id:uid(),name:itemName,qty:clamp(getInput('item-qty')?.value,1,99999),weight:Math.max(0,Math.min(100000,Number(getInput('item-weight')?.value)||0)),category:getText('item-cat').slice(0,70)||'Gear'});changedProfile();break;
    }
    case 'deleteItem':if(confirm('Remove this local item?')){p.inventory=p.inventory.filter(x=>x.id!==id);changedProfile();}break;
    case 'exportNotes':downloadText('roll20-journal-'+new Date().toISOString().slice(0,10)+'.md',notesMarkdown(),'text/markdown;charset=utf-8');break;
    case 'addQuest': {const q=getText('quest-text').slice(0,500);if(q){p.quests.push({id:uid(),text:q,done:false});changedProfile();}break;}
    case 'deleteQuest':p.quests=p.quests.filter(x=>x.id!==id);changedProfile();break;
    case 'timestamp':p.notes+='\n['+new Date().toLocaleString()+'] ';changedProfile();break;
    case 'addLog': {const entry=getText('log-entry');if(entry){record(entry);render();}break;}
    case 'applyChat':s.chatSearch=getText('chat-search');s.chatKind=getInput('chat-kind')?.value||'all';save();applyChatFilter();toast('Local chat filter applied.');break;
    case 'clearChat':clearChatFilter();render();break;
    case 'sendText':case 'sendEmote':case 'sendOOC':case 'sendWhisper': {
      const msg=getText('chat-message');if(!msg)return toast('Enter a message.');
      const prefix=({sendText:'',sendEmote:'/em ',sendOOC:'/ooc ',sendWhisper:'/w gm '})[name];
      if(sendToRoll20(prefix+msg))getInput('chat-message').value='';break;
    }
    case 'switchProfile':RB.state.current=getInput('profile-select').value;RB.editSpell=null;RB.editMacro=null;changedProfile();break;
    case 'newProfile':{const name=prompt('Name for new character profile?','New Adventurer');if(name?.trim()){const next=newProfile(name.trim().slice(0,100));RB.state.profiles.push(next);RB.state.current=next.id;changedProfile();}break;}
    case 'renameProfile':{const name=prompt('Rename current profile?',p.name);if(name?.trim()){p.name=name.trim().slice(0,100);changedProfile();}break;}
    case 'deleteProfile':if(RB.state.profiles.length===1)toast('Keep at least one profile.');else if(confirm('Delete '+p.name+' and all locally saved character data?')){RB.state.profiles=RB.state.profiles.filter(x=>x.id!==p.id);RB.state.current=RB.state.profiles[0].id;changedProfile();}break;
    case 'resetPosition':RB.state.ui.panelX=null;RB.state.ui.panelY=null;RB.state.ui.panelWidth=520;changedProfile();break;
    case 'exportBackup':exportBackup();break;
    case 'copyCommand':copyText(RB.pendingCommand||'');break;
    case 'closeModal':RB.modal=null;render();break;
    case 'openPalette':RB.paletteOpen=true;RB.paletteQuery='';RB.paletteSelection=0;render();getInput('palette-input')?.focus();break;
    case 'closePalette':RB.paletteOpen=false;render();break;
    case 'paletteGo':navigatePalette(el.dataset.value,el.dataset.id);break;
    default:console.warn('[roll20 Embetterment] Unknown action',name);
  }
}
function navigatePalette(kind,id) {
  RB.paletteOpen=false;
  if(kind==='tab'){RB.tab=id;RB.state.ui.lastTab=id;RB.visible=true;save();render();}
  else if(kind==='macro') {runMacro(id);render();}
  else if(kind==='spell')useSpell(id);
  else if(kind==='skill'||kind==='save') {quickRoll(kind,id);render();}
}
function onClick(e) {
  const control=e.target.closest('[data-action]');
  if(!control||!RB.shadow.contains(control))return;
  e.preventDefault();action(control.dataset.action,control);
}
function onChange(e) {
  const el=e.target,p=profile();
  if(el.matches('[data-field]')) {
    const field=el.dataset.field;
    if(field==='concentration') p.concentration=el.value.slice(0,300);
    else if(field==='movementUsed') p.movementUsed=clamp(el.value,0,9999);
    else setValue(field,el.value);
    save();render();
  } else if(el.matches('[data-toggle]')){p[el.dataset.toggle]=el.checked;save();render();}
  else if(el.matches('[data-death]')){p.death[el.dataset.death]=el.checked?int(el.dataset.count):int(el.dataset.count)-1;save();render();}
  else if(el.matches('[data-panel-width]')){RB.state.ui.panelWidth=clamp(el.value,360,920);save();render();}
  else if(el.matches('[data-slot]')){p.macrosSlots[clamp(el.dataset.slot,0,7)]=el.value;save();render();}
  else if(el.matches('[data-slot-max]')){const i=clamp(el.dataset.slotMax,1,9);p.spellSlots[i]=clamp(el.value,0,99);p.usedSlots[i]=Math.min(p.usedSlots[i],p.spellSlots[i]);save();render();}
  else if(el.matches('[data-slot-used]')){const i=clamp(el.dataset.slotUsed,1,9);p.usedSlots[i]=clamp(el.value,0,p.spellSlots[i]);save();render();}
  else if(el.matches('[data-item-qty]')){const item=p.inventory.find(x=>x.id===el.dataset.itemQty);if(item)item.qty=clamp(el.value,0,99999);save();render();}
  else if(el.matches('[data-quest]')){const q=p.quests.find(x=>x.id===el.dataset.quest);if(q)q.done=el.checked;save();render();}
  else if(el.id==='rbe-import') importBackup(el.files?.[0]);
}
function onSettingChange(e) {
  const el=e.target;
  if(!el.matches('[data-setting]'))return;
  const key=el.dataset.setting,s=RB.state.settings;
  if(!Object.hasOwn(s,key))return;
  s[key]=el.type==='checkbox'?el.checked:key==='scale'?Number(el.value):el.value;
  save();render();
}
function onInput(e) {
  const el=e.target;
  if(el.id==='rbe-notes'){profile().notes=el.value.slice(0,100000);clearTimeout(RB.noteTimer);RB.noteTimer=setTimeout(save,250);}
  if(el.id==='rbe-macro-search'){RB.macroSearch=el.value;const n=getInput('macro-results');if(n)n.innerHTML=macroListHTML(RB.state.macros);}
  if(el.id==='rbe-spell-search'){RB.spellSearch=el.value;const n=getInput('spell-results');if(n)n.innerHTML=spellListHTML();}
  if(el.id==='rbe-palette-input'){RB.paletteQuery=el.value;RB.paletteSelection=0; // defer to preserve focus and caret
    const choices=paletteEntries().filter(x=>x.name.toLowerCase().includes(el.value.toLowerCase())).slice(0,30);
    const n=getInput('palette-results');if(n)n.innerHTML=choices.map((x,i)=>`<button class="palette-choice ${i===0?'on':''}" data-action="paletteGo" data-value="${html(x.kind)}" data-id="${html(x.value)}">${html(x.name)}</button>`).join('')||'<p class="hint">Nothing found.</p>';
  }
}
function onKeyDown(e) {
  if(e.key==='Escape' && (RB.paletteOpen||RB.modal)){RB.paletteOpen=false;RB.modal=null;render();return;}
  const origin=e.composedPath?.()[0] || e.target;
  const editing=origin?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  if(e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyE'){
    e.preventDefault();RB.visible=!RB.visible;render();return;
  }
  if(e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyK'){
    e.preventDefault();RB.paletteOpen=!RB.paletteOpen;RB.paletteSelection=0;RB.paletteQuery='';render();getInput('palette-input')?.focus();return;
  }
  if(RB.paletteOpen && origin?.id==='rbe-palette-input'){
    const options=paletteEntries().filter(x=>x.name.toLowerCase().includes((RB.paletteQuery||'').toLowerCase())).slice(0,30);
    if(e.key==='ArrowDown'){e.preventDefault();RB.paletteSelection=Math.min(options.length-1,RB.paletteSelection+1);highlightPalette();}
    if(e.key==='ArrowUp'){e.preventDefault();RB.paletteSelection=Math.max(0,RB.paletteSelection-1);highlightPalette();}
    if(e.key==='Enter'){e.preventDefault();const selected=options[RB.paletteSelection];if(selected)navigatePalette(selected.kind,selected.value);}
    return;
  }
  if(!editing&&RB.state.settings.hotkeys&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey && /^Digit[1-8]$/.test(e.code)){
    e.preventDefault();executeSlot(Number(e.code.slice(-1))-1);
  }
}
function highlightPalette() {RB.shadow.querySelectorAll('.palette-choice').forEach((e,i)=>e.classList.toggle('on',i===RB.paletteSelection));}
function onDragStart(e) {
  if(e.target.closest('button,input,select,textarea'))return;
  if(!e.target.closest('#rbe-header')||!RB.panel)return;
  e.preventDefault();const r=RB.panel.getBoundingClientRect();RB.drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};
}
function onPointerMove(e) {
  if(!RB.drag)return;
  RB.state.ui.panelX=clamp(RB.drag.left+e.clientX-RB.drag.x,0,Math.max(0,window.innerWidth-100));
  RB.state.ui.panelY=clamp(RB.drag.top+e.clientY-RB.drag.y,0,Math.max(0,window.innerHeight-70));
  RB.panel.style.left=RB.state.ui.panelX+'px';RB.panel.style.top=RB.state.ui.panelY+'px';RB.panel.style.right='auto';RB.panel.style.bottom='auto';
}
function onPointerUp() {if(RB.drag){RB.drag=null;save();}}
function boot() {
  if(document.getElementById('roll20-embetterment-host'))return;
  load();
  RB.root=document.createElement('div');RB.root.id='roll20-embetterment-host';
  RB.root.attachShadow({mode:'open'});RB.shadow=RB.root.shadowRoot;
  document.body.append(RB.root);
  const css=document.createElement('style');css.id='rbe-chat-filter-css';css.textContent='[data-rbe-hidden="1"]{display:none!important}';document.head.append(css);
  RB.shadow.addEventListener('click',onClick);
  RB.shadow.addEventListener('change',e=>{onSettingChange(e);if(!e.target.matches('[data-setting]'))onChange(e);});
  RB.shadow.addEventListener('input',onInput);
  RB.shadow.addEventListener('pointerdown',onDragStart);
  window.addEventListener('pointermove',onPointerMove);
  window.addEventListener('pointerup',onPointerUp);
  document.addEventListener('keydown',onKeyDown,true);
  window.addEventListener('beforeunload',save);
  RB.visible=!!RB.state.settings.alwaysOpen;render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();