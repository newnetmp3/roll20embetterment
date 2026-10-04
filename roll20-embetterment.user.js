// ==UserScript==
// @name         roll20 Embetterment
// @namespace    https://github.com/newnetmp3/roll20embetterment
// @version      2.2.1
// @description  Token-anchored concentric D&D 5e combat HUD with sheet-linked actions, spells and resources.
// @author       roll20 Embetterment contributors
// @match        https://app.roll20.net/editor/*
// @match        https://app.roll20.net/editor
// @match        https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// @downloadURL  https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// ==/UserScript==

(()=>{
// ===== 00_core.js =====
// roll20 Embetterment - core and player profiles
'use strict';
const RB = {
  version: '2.2.1',
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
  } else if (v.startsWith('attack:')) {
    const atk=(p.attacks||[]).find(x=>x.id===v.slice(7));
    if(atk?.command){if(sendToRoll20(atk.command))record('Attack: '+atk.name);}
    else toast('No accessible Roll20 action button for this attack.');
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

// ===== 14_beacon_dom.js =====
'use strict';
// DOM-only adapter for Roll20 Beacon (2024) Advanced Tools > Attributes.
// Never reads private React state, calls Roll20 endpoints, or edits sheet values.
const SHEET_ATTRIBUTE_KEY=/^[a-z][a-z0-9_$.-]{0,119}$/i;
const SHEET_COMMON_KEYS=new Set(['ac','hp','hp_max','speed','level','class','name','race','species','pb','gp','cp','sp','ep','pp','wtype','initiative','inspiration']);
function sheetVisibleText(el) {
  if(!el)return '';
  const value=typeof el.innerText==='string'?el.innerText:el.textContent;
  return String(value??'').replace(/\u00a0/g,' ').trim();
}
function sheetAttributeKey(value,loose=false) {
  const key=String(value??'').trim().replace(/^attr_/i,'');
  if(!SHEET_ATTRIBUTE_KEY.test(key)||/^(NAME|DESCRIPTION|VALUE|CURRENT|MAX|LOCK|LOCKED|ATTRIBUTES|EDIT|DELETE|CANCEL|SAVE|PENCIL|UNLOCK)$/i.test(key))return '';
  return loose||key.includes('_')||key.includes('-')||SHEET_COMMON_KEYS.has(key.toLowerCase())?key:'';
}
function sheetAttributeRow(row,loose=false) {
  if(!row)return null;
  // Preserve empty cells. 2024 Advanced Tools renders Name | Description |
  // Value | Lock, and filtering empties shifts descriptions into value slots.
  const cells=Array.from(row.children||[]).map(c=>sheetVisibleText(c));
  if(cells.length<3||cells.length>12)return null;
  const pos=cells.findIndex((v,i)=>i<2&&!!sheetAttributeKey(v,loose));
  if(pos<0||cells.length<=pos+2)return null;
  const key=sheetAttributeKey(cells[pos],loose),value=cells[pos+2];
  if(value.length>10000)return null;
  return {key,value};
}
function sheetReadBeaconAttributeRows(scope) {
  const out={};
  if(!scope?.querySelectorAll)return out;
  const read=(row,loose=false)=>{
    const found=sheetAttributeRow(row,loose);
    if(found&&!(found.key in out))out[found.key]={current:found.value,max:''};
  };
  const explicit=scope.querySelectorAll('tbody tr,[role="row"],[data-testid*="attribute-row"],[data-testid*="attributeRow"],[class*="attribute-row"],[class*="AttributeRow"]');
  for(const row of Array.from(explicit||[]).slice(0,7000))read(row,true);
  // Beacon's Advanced Tools can render rows as anonymous nested divs.
  const leaves=scope.querySelectorAll('span,div,p,td,label,[role="cell"]');
  for(const el of Array.from(leaves||[]).slice(0,16000)){
    const name=sheetAttributeKey(sheetVisibleText(el),true);
    if(!name)continue;
    if(Array.from(el.children||[]).some(child=>sheetVisibleText(child)===name))continue;
    let parent=el.parentElement;
    for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
      if(sheetVisibleText(parent).length>650)break;
      const found=sheetAttributeRow(parent,true);
      if(found&&found.key===name){out[name]={current:found.value,max:''};break;}
    }
  }
  return out;
}
function sheetScrollableAttributeContainer(scope) {
  if(!scope?.querySelectorAll)return null;
  // Some Beacon lists put the scrollbar on a parent of the visible row,
  // not on the element containing the values themselves.
  const sources=[
    ...Array.from(scope.querySelectorAll('tbody tr,[role="row"],[data-testid*="attribute-row"],[class*="attribute-row"]')||[]),
    ...Array.from(scope.querySelectorAll('span,div,td,label,[role="cell"]')||[])
  ].slice(0,16000);
  let best=null,highest=-Infinity;
  for(const source of sources){
    const label=sheetVisibleText(source);
    // Use visible attribute rows rather than a generic dialog's scroll area.
    if(!sheetAttributeKey(label,true) &&
       !sheetAttributeRow(source,true) &&
       !Array.from(source.children||[]).some(el=>sheetAttributeKey(sheetVisibleText(el),true)))continue;
    let node=source;
    for(let depth=0;node&&depth<13;depth++,node=node.parentElement){
      if(node===scope?.ownerDocument?.body)break;
      const height=Number(node.clientHeight),total=Number(node.scrollHeight);
      if(!(height>=65&&total>height+18&&total<2500000))continue;
      let overflow='';
      try{overflow=node.ownerDocument?.defaultView?.getComputedStyle?.(node)?.overflowY||'';}catch{}
      const isScroll=/auto|scroll|overlay/i.test(overflow);
      const score=(isScroll?100:0)+Math.min(25,Math.log2(total/height)*6)-depth*4;
      if(score>highest){highest=score;best=node;}
      // A close, explicitly scrollable ancestor is more reliable than a
      // distant modal containing multiple scrollable panels.
      if(isScroll)break;
    }
  }
  // Avoid touching Roll20's whole tabletop/page when no attribute scroller
  // can be reliably identified.
  return best;
}
function sheetExpectedAttributeCount(scope) {
  const text=sheetVisibleText(scope).slice(0,55000);
  const matches=[...text.matchAll(/\bAttributes\s*(?:\(|:)?\s*(\d{2,4})\b/gi)].map(m=>Number(m[1]));
  return matches.find(n=>n>0&&n<=6000)||0;
}
function sheetFrozenScrollCover(scroll) {
  // Clone only the user's already visible portion into a noninteractive
  // overlay. React can render virtual rows underneath without a visible
  // scroll animation. It is discarded immediately after the scan.
  const doc=scroll?.ownerDocument,rect=scroll?.getBoundingClientRect?.();
  if(!doc?.body?.appendChild||!doc.createElement||!scroll.cloneNode||!rect||rect.width<40||rect.height<50)return ()=>{};
  let cover=null,original='',priority='';
  try{
    const clone=scroll.cloneNode(true);
    clone.removeAttribute?.('id');
    clone.querySelectorAll?.('script,iframe,[id]')?.forEach(el=>{
      if(el.matches?.('script,iframe'))el.remove();
      else el.removeAttribute('id');
    });
    cover=doc.createElement('div');
    cover.setAttribute?.('aria-hidden','true');
    cover.style.cssText='position:fixed;z-index:2147483000;pointer-events:none;overflow:hidden;isolation:isolate;';
    Object.assign(cover.style,{left:rect.left+'px',top:rect.top+'px',
      width:rect.width+'px',height:rect.height+'px'});
    clone.style.width='100%';clone.style.height='100%';
    clone.style.maxWidth='none';clone.style.maxHeight='none';
    clone.style.pointerEvents='none';clone.style.overflow='hidden';
    cover.appendChild(clone);
    doc.body.appendChild(cover);
    if(Number.isFinite(scroll.scrollTop))clone.scrollTop=scroll.scrollTop;
    original=scroll.style?.getPropertyValue?.('visibility')||'';
    priority=scroll.style?.getPropertyPriority?.('visibility')||'';
    scroll.style?.setProperty?.('visibility','hidden','important');
    return ()=>{
      if(original)scroll.style?.setProperty?.('visibility',original,priority);
      else scroll.style?.removeProperty?.('visibility');
      cover.remove?.();
    };
  }catch(err){
    if(original)scroll.style?.setProperty?.('visibility',original,priority);
    else scroll.style?.removeProperty?.('visibility');
    cover?.remove?.();
    return ()=>{};
  }
}
function sheetSetScrollTop(element,value) {
  element.scrollTop=value;
  // Some virtual list implementations use explicit scroll listeners.
  // Assignment normally emits scroll, so avoid duplicate synthetic events.
}
async function sheetHarvestBeaconRows(scope,notify) {
  const result=readSheetFields(scope),scroll=sheetScrollableAttributeContainer(scope);
  if(!scroll)return {fields:result,scannedPages:1,full:false,expected:sheetExpectedAttributeCount(scope)};
  const expected=sheetExpectedAttributeCount(scope);
  const original=Number(scroll.scrollTop)||0;
  const freeze=sheetFrozenScrollCover(scroll);
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const collect=()=>Object.assign(result,readSheetFields(scope));
  const step=Math.max(45,Math.floor(scroll.clientHeight*.58));
  let scannedPages=0,full=false,atBottom=0;
  let previousNames='',still=0;
  const started=Date.now();
  try{
    sheetSetScrollTop(scroll,0);
    await pause(110);
    for(let i=0;i<320&&Date.now()-started<35000;i++){
      collect();
      scannedPages++;
      const names=Object.keys(result).sort().join('|');
      still=names===previousNames?still+1:0;
      previousNames=names;
      if(notify&&i%22===0)notify(Object.keys(result).length);
      const bottom=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
      if(expected&&Object.keys(result).length>=expected){full=true;break;}
      if(scroll.scrollTop>=bottom-3){
        // Lazy loading may increase scrollHeight only after a render/network
        // tick; wait and re-check instead of stopping at the first "bottom".
        atBottom++;
        await pause(atBottom===1?350:300);
        collect();
        const updatedBottom=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
        if(scroll.scrollTop>=updatedBottom-3&&atBottom>=5){
          full=!expected||Object.keys(result).length>=expected;
          break;
        }
        if(updatedBottom>scroll.scrollTop+3){atBottom=0;continue;}
      }else atBottom=0;
      const old=scroll.scrollTop;
      sheetSetScrollTop(scroll,Math.min(bottom,old+step));
      await pause(120);
      collect();
      if(scroll.scrollTop<=old&&bottom>old){
        // Frameworks can defer a scroll operation until the next frame.
        await pause(220);
        if(scroll.scrollTop<=old)break;
      }
      if(still>9){await pause(280);still=0;}
    }
  }finally{
    // Always restore Roll20's scroll position and unfreeze the visible list,
    // even if a scan throws or the user closes a sheet mid-import.
    try{sheetSetScrollTop(scroll,original);}finally{freeze();}
  }
  collect();
  return {fields:result,scannedPages,full,expected};
}
function sheetFormCandidates(root){
  if(!root?.querySelectorAll)return [];
  const selectors='form.charsheet,.charsheet,.sheetform,.characterdialog,[data-testid*="character-sheet"],[class*="character-sheet"],.ui-dialog,[role="dialog"],[aria-modal="true"],[data-sheet-id],[data-character-id]';
  let nodes=[];
  try{nodes=Array.from(root.querySelectorAll(selectors)||[]);}catch{return nodes;}
  if(root.nodeType===9&&root.body)nodes.push(root.body);
  return Array.from(new Set(nodes)).slice(0,160);
}
function sheetMeaningfulName(name){
  return name&&!/^(?:Open character sheet|Character Sheet|pencil|edit|settings|attributes|advanced tools|character|sheet)$/i.test(name.trim());
}
function sheetSheetHint(text){
  return /(?:\bCharacter Sheet\b|\bAdvanced Tools\b|\bHIT POINTS\b|\bABILITIES\b|\bSAVING THROWS\b|\bATTRIBUTES\b)/i.test(text);
}
function sheetCandidateScore(fields,visible,text,name,node) {
  const count=Object.keys(fields).length;
  if(count===0 && visible.coverage.visibleFields===0)return -1;
  let score=Math.min(count,400)*2+visible.coverage.visibleFields*9;
  if(sheetMeaningfulName(name))score+=55;
  if(sheetSheetHint(text))score+=30;
  if(/\bAdvanced Tools\b/i.test(text)&&/\bAttributes\b/i.test(text))score+=22;
  if(node.matches?.('.ui-dialog,[role="dialog"],[data-character-id]'))score+=10;
  return score;
}

// ===== 15_sheet_link.js =====
// Character-sheet importer. Reads ONLY the currently open player-accessible DOM.
const sheetFull={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'};
const sheetSlug=value=>String(value??'').replace(/[^A-Za-z0-9_$-]/g,'').slice(0,100);
const sheetText=(value,n=3000)=>String(value??'').trim().slice(0,n);
const sheetNum=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);
const sheetOn=v=>['1','on','true','yes','checked','✓'].includes(String(v??'').trim().toLowerCase());
function sheetAttributes(input){
  const out={};
  if(Array.isArray(input)){
    for(const obj of input.slice(0,6000))if(obj&&typeof obj.name==='string'&&obj.name.length<160)
      out[obj.name.replace(/^attr_/,'')]={current:sheetText(obj.current??obj.value,10000),max:sheetText(obj.max,1000)};
  }else if(input&&typeof input==='object'){
    for(const [name,val] of Object.entries(input).slice(0,6000))if(name.length<160)
      out[name.replace(/^attr_/,'')]=val&&typeof val==='object'&&!Array.isArray(val)
        ?{current:sheetText(val.current??val.value,10000),max:sheetText(val.max,1000)}:{current:sheetText(val,10000),max:''};
  }
  return out;
}
function readSheetFields(scope){
  const result={};
  if(!scope?.querySelectorAll)return result;
  for(const el of Array.from(scope.querySelectorAll('input,textarea,select,[data-attribute]')).slice(0,6000)){
    const name=el.getAttribute?.('name')||el.getAttribute?.('data-attribute')||'';
    const alias=sheetText(el.getAttribute?.('aria-label')||el.getAttribute?.('data-testid'),100).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const known=/^(?:character_name|hp|hit_points|hit_points_current|hit_points_max|temporary_hit_points|ac|armor_class|speed|movement_speed|walking_speed|initiative_bonus|proficiency_bonus|level|class|race|species|background|alignment|spell_save_dc|spell_attack_bonus|passive_perception|(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:_score|_bonus|_mod|_save_bonus)?|(?:acrobatics|animal_handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight_of_hand|stealth|survival)_bonus)$/;
    if(!name.startsWith('attr_')&&!el.hasAttribute?.('data-attribute')&&!known.test(alias))continue;
    if(el.type==='radio'&&!el.checked)continue;
    let key=(name.startsWith('attr_')||el.hasAttribute?.('data-attribute')?name:alias).replace(/^attr_/,'');
    if(!key.startsWith('repeating_')){
      const row=el.closest?.('.repitem,[data-reprowid],[data-rowid]');
      const section=row?.closest?.('fieldset[class*="repeating_"],.repcontainer[class*="repeating_"]');
      const sec=String(section?.className||'').match(/(?:^|\s)repeating_([\w-]+)/)?.[1];
      if(row&&sec){
        const siblings=Array.from(row.parentElement?.querySelectorAll?.(':scope > .repitem')||[]);
        const id=sheetSlug(row.getAttribute?.('data-reprowid')||row.getAttribute?.('data-rowid')||row.id||('$'+Math.max(0,siblings.indexOf(row))));
        if(id)key='repeating_'+sec+'_'+id+'_'+key;
      }
    }
    if(!key||key.length>160)continue;
    const v=el.type==='checkbox'?(el.checked?'1':'0'):('value'in el?el.value:el.textContent);
    result[key]={current:sheetText(v,10000),max:result[key]?.max||''};
  }
  // 2024/Beacon Advanced Tools displays text rows, not attr_* controls.
  // Keep explicit 2014 fields authoritative when both adapters see a key.
  for(const [key,entry] of Object.entries(sheetReadBeaconAttributeRows(scope)))if(!(key in result))result[key]=entry;
  return result;
}
// Prefer an actual character-name label rather than generic dialog titles. 2024
// Beacon layouts can place the title outside the sheet's inner form.
function readVisibleSheetName(node,parent){
  const usable=value=>{
    const name=sheetText(value,120).replace(/\s+/g,' ').trim();
    return name.length>0 && name.length<=100 &&
      !/^(open character sheet|character sheet|character|sheet|bio & info|advanced tools|attributes|actions|combat|spells|pencil|edit|settings|character macros|new attribute)$/i.test(name);
  };
  const selectors=[
    '.asv__header__name','[name="attr_character_name"]','[name="attr_charactername"]',
    '[data-testid="character-name"]','[data-testid*="characterName"]',
    '[data-testid*="character-name"]','.charactername',
    '[class*="character-name"]','[class*="characterName"]',
    '.ui-dialog-title','[role="dialog"] header h1','[role="dialog"] header h2'
  ];
  const contexts=[node,parent,parent?.parentElement,parent?.parentElement?.parentElement];
  try {
    const frame=node?.ownerDocument?.defaultView?.frameElement;
    if(frame)contexts.push(frame.closest?.('.ui-dialog,[role="dialog"]')||frame.parentElement);
  }catch{/* cross-origin frame labels are not available */}
  for(const selector of selectors){
    for(const root of contexts){
      const el=root?.matches?.(selector)?root:root?.querySelector?.(selector);
      const value=el?.value||el?.textContent||el?.getAttribute?.('title');
      if(usable(value))return sheetText(value,100).replace(/\s+/g,' ').trim();
    }
  }
  const accessibleName=parent?.getAttribute?.('aria-label')||node?.getAttribute?.('aria-label');
  return usable(accessibleName)?sheetText(accessibleName,100):'Open character sheet';
}
function findSheetForms(doc=document){
  const options=[],used=new Set();
  // Real Jumpgate / Beacon markup: the character name is in
  // .asv__header__name and the 2024 React sheet is cross-origin in
  // iframe#advanced-charsheet-dialog__charsheet, not the VTT document.
  for(const dialog of Array.from(doc.querySelectorAll?.('.characterdialog')||[])){
    if(dialog.closest?.('#roll20-embetterment-host'))continue;
    const frame=dialog.querySelector?.('iframe#advanced-charsheet-dialog__charsheet,iframe[src*="/dnd2024byroll20/"]');
    if(!frame)continue;
    let url;
    try{url=new URL(frame.src||frame.getAttribute('src'),location.href);}catch{continue;}
    if(url.origin!==RBE_BEACON_ORIGIN||!/^\/dnd2024byroll20(?:\/|$)/.test(url.pathname))continue;
    const title=String(dialog.querySelector?.('.asv__header__name')?.textContent||'').trim()||
      String(frame.getAttribute?.('title')||'').replace(/^Character sheet for\s+/i,'').trim();
    const name=sheetMeaningfulName(title)?sheetText(title,100):'Open character sheet';
    const id=dialog.querySelector?.('#advanced-printsheet')?.getAttribute?.('data-charid') ||
      frame.getAttribute?.('name')||'beacon-'+(options.length+1);
    options.push({id,name,root:dialog,frame,readableFields:0,
      visibleFields:0,kind:'D&D 2024 sheet iframe',score:2000});
    used.add(dialog);
  }
  const seen=new Set();
  function inspect(root,level=0){
    if(!root||level>2||seen.has(root))return;
    seen.add(root);
    for(const node of sheetFormCandidates(root)){
      if(node.closest?.('#roll20-embetterment-host'))continue;
      if(level===0&&node===root.body)continue;
      // Avoid reading icon/tool controls as the data of a 2024 sheet:
      // the cross-origin iframe reader handles these separately.
      if(Array.from(used).some(d=>d===node||d.contains?.(node)))continue;
      const parent=node.closest?.('.ui-dialog,.characterdialog,[data-character-id]')||node;
      const fields=readSheetFields(node),visible=beaconImportVisible(node,readVisibleSheetName(node,parent));
      const text=sheetVisibleText(node).slice(0,40000);
      const count=Object.keys(fields).length;
      // Two incidental attributes cannot establish the presence of a sheet.
      if(count<3 && visible.coverage.visibleFields<2 && !(count>=2&&/\bAdvanced Tools\b/i.test(text)&&/\bAttributes\b/i.test(text)))continue;
      const name=readVisibleSheetName(node,parent);
      const score=sheetCandidateScore(fields,visible,text,name,node);
      if(score<0)continue;
      options.push({id:parent.getAttribute?.('data-character-id')||'open-'+(options.length+1),
        name:sheetMeaningfulName(name)?name:visible.name,root:node,readableFields:count,
        visibleFields:visible.coverage.visibleFields,kind:'Visible Roll20 sheet',score});
    }
    for(const frame of Array.from(root.querySelectorAll?.('iframe')||[]).slice(0,30)){
      try{if(frame.contentDocument?.body)inspect(frame.contentDocument,level+1);}catch{/* cross-origin */}
    }
  }
  inspect(doc);
  options.sort((a,b)=>b.score-a.score);
  return options.filter((x,i)=>!options.slice(0,i).some(y=>
    x.root===y.root||x.root.contains?.(y.root)||y.root.contains?.(x.root))).slice(0,25);
}
function snapshotSheet(input,label='Character'){
  const attrs=sheetAttributes(input),values=Object.fromEntries(Object.entries(attrs).map(([key,val])=>[key.toLowerCase(),val]));
  const pick=(...names)=>names.map(k=>values[k.toLowerCase()]?.current).find(v=>v!==undefined&&v!=='');
  const number=(...names)=>sheetNum(pick(...names));
  const snap={name:sheetText(pick('character_name','charactername','name')||label,100),attrs,edition:'Named/visible attributes',
    stats:{},abilityMods:{},abilityScores:{},saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},currency:{},details:{},
    spells:[],attacks:[],inventory:[],features:[],resources:[],proficiencies:[],tools:[],
    coverage:{attributes:Object.keys(attrs).length,mapped:0,unmapped:[]}};
  const fields={hp:['hp','hit_points','hit_points_current','current_hp'],maxHp:['hp_max','hit_points_max','max_hp'],
    tempHp:['hp_temp','temporary_hit_points','temp_hp'],ac:['ac','armor_class'],speed:['speed','walking_speed','movement_speed'],
    init:['initiative_bonus','init_bonus'],proficiency:['pb','proficiency_bonus'],level:['level','character_level','base_level']};
  for(const [k,names] of Object.entries(fields)){const n=number(...names);if(n!==null)snap.stats[k]=n;}
  if(snap.stats.maxHp===undefined){const max=sheetNum(values.hp?.max||values.hit_points?.max);if(max!==null)snap.stats.maxHp=max;}
  for(const [abbr,long] of Object.entries(sheetFull)){
    const s=number(long,long+'_score',abbr+'_score');
    const m=number(long+'_mod',long+'_bonus',abbr+'_mod');
    const sv=number(long+'_save_bonus',long+'_saving_throw_bonus',abbr+'_save_bonus');
    if(s!==null)snap.abilityScores[abbr]=s;
    if(m!==null)snap.abilityMods[abbr]=m;
    if(sv!==null)snap.saveBonuses[abbr]=sv;
  }
  for(const skill of skillNames){
    const slug=skill.toLowerCase().replaceAll(' ','_');
    const v=number(slug+'_bonus',slug+'_mod');
    if(v!==null)snap.skillBonuses[skill]=v;
  }
  for(const k of ['cp','sp','ep','gp','pp']){const v=number(k,k+'_coins');if(v!==null)snap.currency[k]=v;}
  const details={class:['class','class_name','classes'],subclass:['subclass'],race:['race','species','ancestry'],
    background:['background'],alignment:['alignment'],experience:['experience','xp'],
    hitDice:['hit_dice'],hitDieType:['hitdietype'],spellSaveDC:['spell_save_dc','spell_dc'],
    spellAttack:['spell_attack_bonus','spell_attack_mod'],passivePerception:['passive_wisdom','passive_perception'],
    passiveInsight:['passive_insight'],passiveInvestigation:['passive_investigation'],size:['size'],languages:['languages'],
    personality:['personality_traits'],ideals:['ideals'],bonds:['bonds'],flaws:['flaws']};
  for(const [k,names] of Object.entries(details)){const val=pick(...names);if(val!==undefined)snap.details[k]=sheetText(val);}
  const insp=pick('inspiration','heroic_inspiration');if(insp!==undefined)snap.inspiration=sheetOn(insp);
  for(let n=1;n<=9;n++){
    const max=number('lvl'+n+'_slots_total','level_'+n+'_spell_slots_total','spell_slots_'+n+'_max');
    const left=number('lvl'+n+'_slots_expended','level_'+n+'_spell_slots_remaining','spell_slots_'+n+'_remaining');
    if(max!==null){snap.spellSlots[n]=max;if(left!==null)snap.usedSlots[n]=Math.max(0,max-left);}
  }
  const rows=new Map();
  for(const [key,record] of Object.entries(attrs)){
    const m=key.match(/^repeating_(spell-cantrip|spell-[1-9]|spell-npc|inventory|attack|traits|proficiencies|tool|resource|npcaction|npcbonusaction|npcreaction)_([^_]+)_(.+)$/i);
    if(!m)continue;
    const section=m[1].toLowerCase(),id=m[2],field=m[3].toLowerCase(),rowkey=section+'/'+id;
    if(!rows.has(rowkey))rows.set(rowkey,{section,id,fields:{},maxes:{}});
    rows.get(rowkey).fields[field]=record.current;
    if(record.max)rows.get(rowkey).maxes[field]=record.max;
  }
  for(const row of rows.values()){
    const f=row.fields,base={id:'sheet:'+row.section+'/'+row.id,origin:'sheet'},valid=/^[A-Za-z0-9_$-]{1,100}$/.test(row.id);
    if(row.section.startsWith('spell')){
      const name=sheetText(f.spellname||f.spellname_base||f.name,120);if(!name)continue;
      const level=row.section==='spell-cantrip'?0:Number(row.section.match(/\d+/)?.[0]||0);
      const notes=[f.spelldescription,f.spellathigherlevels].filter(Boolean).map(x=>sheetText(x,1500)).join('\n');
      snap.spells.push({...base,name,level,range:sheetText(f.spellrange,100),notes,
        concentration:sheetOn(f.spellconcentration||f.spellconcentrationflag),
        prepared:sheetOn(f.spellprepared||f.prep),ritual:sheetOn(f.spellritual||f.spellritualflag),
        school:sheetText(f.spellschool,80),castTime:sheetText(f.spellcastingtime,80),duration:sheetText(f.spellduration,100),
        materials:sheetText(f.spellcomp_materials,400),
        components:['v','s','m'].filter(x=>sheetOn(f['spellcomp_'+x])).join(',').toUpperCase(),
        command:valid&&row.section!=='spell-npc'?'%{selected|repeating_'+row.section+'_'+row.id+'_spell}':''});
    }else if(row.section==='inventory'){
      const name=sheetText(f.itemname,120);if(!name)continue;
      snap.inventory.push({...base,name,qty:Math.max(0,sheetNum(f.itemcount)??1),weight:Math.max(0,sheetNum(f.itemweight)??0),
        equipped:sheetOn(f.equipped),description:sheetText(f.itemcontent,2000),properties:sheetText(f.itemproperties,800),category:'Sheet'});
    }else if(['attack','npcaction','npcbonusaction','npcreaction'].includes(row.section)){
      const name=sheetText(f.atkname||f.name,120);if(!name)continue;
      snap.attacks.push({...base,name,toHit:sheetText(f.atkbonus||f.attack_tohit,80),
        damage:sheetText(f.dmgbase||f.attack_damage||f.dmg1base,160),damageType:sheetText(f.dmgtype||f.attack_damagetype,120),
        range:sheetText(f.atkrange||f.attack_range,100),description:sheetText(f.description,1600),
        command:valid?'%{selected|repeating_'+row.section+'_'+row.id+'_'+(row.section==='attack'?'attack':'npc_action')+'}':''});
    }else if(row.section==='traits'){
      const name=sheetText(f.name,120);
      if(name)snap.features.push({...base,name,description:sheetText(f.description,4000),source:sheetText(f.source,120)});
    }else if(['proficiencies','tool'].includes(row.section)){
      const name=sheetText(f.name||f.prof_name||f.toolname,120);
      if(name)snap[row.section==='tool'?'tools':'proficiencies'].push({...base,name,description:sheetText(f.description,1200)});
    }else if(row.section==='resource'){
      for(const side of ['left','right']){
        const name=sheetText(f['resource_'+side+'_name'],120);if(!name)continue;
        snap.resources.push({...base,id:base.id+':'+side,name,current:sheetNum(f['resource_'+side])??0,
          max:sheetNum(row.maxes['resource_'+side]||f['resource_'+side+'_max'])??0,reset:'manual'});
      }
    }
  }
  for(const key of ['class_resource','other_resource']){
    const name=sheetText(pick(key+'_name'),120);
    if(name)snap.resources.push({id:'sheet:'+key,origin:'sheet',name,current:number(key)??0,max:number(key+'_max')??sheetNum(values[key]?.max)??0,reset:'manual'});
  }
  snap.edition=Object.keys(attrs).some(k=>k.startsWith('repeating_spell-')||k==='pb')?'2014 / legacy':'2024 / visible attributes';
  const known=new Set(Object.values(fields).flat().concat(Object.values(details).flat(),['inspiration','heroic_inspiration','hp_max','hp','cp','sp','ep','gp','pp'],
    ...Object.values(sheetFull).map(long=>[long,long+'_score',long+'_mod',long+'_bonus',long+'_save_bonus',long+'_saving_throw_bonus']),
    ...skillNames.map(n=>[n.toLowerCase().replaceAll(' ','_')+'_bonus',n.toLowerCase().replaceAll(' ','_')+'_mod'])));
  const unknown=Object.keys(attrs).filter(k=>!known.has(k.toLowerCase())&&!k.startsWith('repeating_')&&!/^lvl[1-9]_slots_/.test(k));
  snap.coverage.unmapped=unknown.slice(0,250);
  snap.coverage.mapped=Object.keys(attrs).length-unknown.length;
  return snap;
}
function mergeSheetList(previous,incoming){
  const map=new Map((Array.isArray(previous)?previous:[]).map(item=>[item.id,item]));
  for(const item of incoming.slice(0,200))map.set(item.id,item);
  return Array.from(map.values()).slice(0,300);
}
function applySheetSnapshot(p,s){
  if(!s||(s.coverage.attributes<1&&!(s.coverage.visibleFields>0)))return false;
  if(['Adventurer','New Adventurer','pencil','Open character sheet'].includes(p.name)&&s.name&&sheetMeaningfulName(s.name))p.name=s.name;
  for(const k of ['stats','abilityMods','skillBonuses','saveBonuses','currency'])Object.assign(p[k],s[k]);
  p.abilityScores={...(p.abilityScores||{}),...s.abilityScores};
  p.sheetDetails={...(p.sheetDetails||{}),...s.details};
  if(s.inspiration!==undefined)p.inspiration=s.inspiration;
  for(const [n,v] of Object.entries(s.spellSlots))p.spellSlots[+n]=clamp(v,0,99);
  for(const [n,v] of Object.entries(s.usedSlots))p.usedSlots[+n]=clamp(v,0,p.spellSlots[+n]);
  for(const k of ['spells','inventory','resources','attacks','features','proficiencies','tools']){
    if(s[k].length||(p[k]||[]).some(x=>x.origin==='sheet'))p[k]=mergeSheetList(p[k],s[k]);
  }
  p.sheetLink={...(p.sheetLink||{}),name:s.name,edition:s.edition,lastSync:new Date().toISOString(),
    coverage:s.coverage,counts:Object.fromEntries(['spells','inventory','resources','attacks','features','proficiencies','tools'].map(k=>[k,s[k].length]))};
  return true;
}
function scanSheets(){
  RB.openSheets=findSheetForms(document);
  if(!RB.openSheets.length){toast('Open your sheet inside Roll20 (disable pop-out), then Scan again.');return;}
  const current=profile().sheetLink?.name,idx=RB.openSheets.findIndex(x=>x.name===current);
  RB.selectedSheet=idx>=0?idx:0;RB.sheetSignature=null;
  render();toast('Found '+RB.openSheets.length+' open sheet(s).');
  sheetPrefetchAttributes(RB.openSheets[RB.selectedSheet||0]);
}
function syncSheet({quiet=false,fieldsOverride=null}={}){
  const candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!candidate){if(!quiet)toast('Scan for an open sheet first.');return false;}
  if(candidate.root?.isConnected===false){if(!quiet)toast('Sheet closed; reopen and scan.');return false;}
  if(candidate.frame){if(!quiet)toast('Importing 2024 iframe sheet…');return false;}
  const live=readSheetFields(candidate.root);
  const cached=RB.sheetWarm?.root===candidate.root?RB.sheetWarm?.scan?.fields:null;
  const fields=fieldsOverride || (cached?{...cached,...live}:live);
  const visual=beaconImportVisible(candidate.root,candidate.name);
  const data=mergeBeaconSnapshot(snapshotSheet(fields,candidate.name),visual);
  if(!data.coverage.attributes&&!data.coverage.visibleFields){
    if(!quiet)toast('No readable fields. Open Character Sheet or Advanced Tools / Attributes, then scan again.');
    return false;
  }
  const signature=JSON.stringify(fields)+'|'+visual.signature;
  if(quiet&&signature===RB.sheetSignature)return true;
  if(!applySheetSnapshot(profile(),data))return false;
  candidate.name=data.name;candidate.readableFields=data.coverage.attributes;
  candidate.visibleFields=data.coverage.visibleFields;profile().sheetLink.source=candidate.id;
  RB.sheetSignature=signature;save();
  if(!quiet){render();toast('Imported '+data.coverage.attributes+' named and '+data.coverage.visibleFields+' visible fields.');}
  else if(RB.visible&&['Sheet','Home','Spells','Inventory','Rolls'].includes(RB.tab)){
    const active=RB.shadow?.activeElement;
    if(!active?.matches?.('input,textarea,select'))render();
  }
  return true;
}
// Warm the virtualized attribute list without changing player data. The
// explicit Import action uses the collected fields and can retry if needed.
function sheetPrefetchAttributes(candidate){
  if(!candidate?.root)return;
  if(candidate.frame){
    const existing=RB.sheetWarm;
    if(existing?.frame===candidate.frame&&(existing.promise||Date.now()-(existing.at||0)<20000))return;
    const cache={frame:candidate.frame,root:candidate.root,at:0,promise:null,scan:null};
    RB.sheetWarm=cache;
    cache.promise=requestBeaconFrame(candidate,true).then(scan=>{
      cache.scan=scan;cache.at=Date.now();
      candidate.readableFields=Object.keys(scan.fields).length;
      candidate.visibleFields=scan.visible?.coverage?.visibleFields||0;
      if(RB.sheetWarm===cache&&RB.visible&&RB.tab==='Sheet')render();
      return scan;
    }).catch(err=>{
      console.warn('[roll20 Embetterment] Sheet iframe not accessible',err);
      if(RB.sheetWarm===cache)RB.sheetWarm=null;
      toast(err.message);
      return null;
    }).finally(()=>{cache.promise=null;});
    return;
  }
  if(!sheetScrollableAttributeContainer(candidate.root))return;
  if(RB.sheetWarm?.root===candidate.root &&
     (RB.sheetWarm.promise || Date.now()-(RB.sheetWarm.at||0)<20000))return;
  const cache={root:candidate.root,at:0,promise:null,scan:null};
  RB.sheetWarm=cache;
  cache.promise=sheetHarvestBeaconRows(candidate.root).then(scan=>{
    cache.scan=scan;cache.at=Date.now();
    if(RB.sheetWarm!==cache)return scan;
    candidate.readableFields=Math.max(candidate.readableFields||0,Object.keys(scan.fields).length);
    if(RB.visible&&RB.tab==='Sheet'&&
      !RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
    return scan;
  }).catch(err=>{
    console.warn('[roll20 Embetterment] Background attribute scan',err);
    if(RB.sheetWarm===cache)RB.sheetWarm=null;
    return null;
  }).finally(()=>{cache.promise=null;});
}
async function syncSheetDeep(){
  if(RB.sheetDeepSync)return;
  let candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!candidate||candidate.root?.isConnected===false||(!candidate.readableFields&&!candidate.visibleFields)){
    scanSheets();
    candidate=RB.openSheets?.[RB.selectedSheet||0];
  }
  if(!candidate)return;
  const originalProfile=RB.state.current;
  RB.sheetDeepSync=true;
  try{
    if(candidate.frame){
      const cache=RB.sheetWarm?.frame===candidate.frame?RB.sheetWarm:null;
      let scan=cache?.promise?await cache.promise:cache?.scan;
      if(!scan||Date.now()-(cache?.at||0)>30000)scan=await requestBeaconFrame(candidate,true);
      if(!RB.openSheets?.includes(candidate)||RB.state.current!==originalProfile)return;
      if(beaconFrameSnapshot(candidate,scan)){
        RB.sheetWarm={root:candidate.root,frame:candidate.frame,scan,at:Date.now(),promise:null};
        toast('Imported '+Object.keys(scan.fields).length+' 2024 attributes and '+
          (scan.visible?.coverage?.visibleFields||0)+' visible values from '+candidate.name+'.');
      }else toast('The iframe replied, but its current tab contains no readable character data.');
      return;
    }
    // If background preloading is in progress, share it rather than visibly
    // traversing the same list a second time.
    const warmed=RB.sheetWarm?.root===candidate.root?RB.sheetWarm:null;
    let scan=warmed?.promise?await warmed.promise:warmed?.scan;
    if(!scan || Date.now()-(warmed?.at||0)>30000)
      scan=await sheetHarvestBeaconRows(candidate.root);
    if(!scan||!RB.openSheets?.includes(candidate)||RB.state.current!==originalProfile)return;
    // Preserve cached rows hidden by virtualization while preferring fresh DOM
    // values for any attributes currently rendered on the character sheet.
    const fields={...scan.fields,...readSheetFields(candidate.root)};
    const ok=syncSheet({fieldsOverride:fields});
    if(ok){
      RB.sheetWarm={root:candidate.root,scan:{...scan,fields},at:Date.now(),promise:null};
      toast('Imported '+Object.keys(fields).length+' attributes'+
        (scan.expected?' of '+scan.expected:'')+(scan.full?' (list complete).':' (available rows).'));
    }else toast('No readable values yet. Keep Advanced Tools → Attributes open.');
  }catch(err){
    console.warn('[roll20 Embetterment] Advanced sheet sync failed',err);
    toast('Character scan failed: '+String(err.message||err).slice(0,160));
  }finally{RB.sheetDeepSync=false;}
}
function sheetAutoTick(){
  // Do not overwrite a multi-tab snapshot with a single-tab auto-refresh.
  if(RB.sheetTourBusy)return;
  const link=profile().sheetLink,candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!link?.auto||!link.lastSync||!candidate)return;
  if(link.source!==candidate.id&&link.name!==candidate.name)return;
  if(candidate.frame){
    if(RB.frameRefreshBusy)return;
    RB.frameRefreshBusy=true;
    requestBeaconFrame(candidate,false).then(scan=>{
      if(RB.openSheets?.includes(candidate) && (profile().sheetLink?.source===candidate.id||
        profile().sheetLink?.name===candidate.name))beaconFrameSnapshot(candidate,scan,{quiet:true});
    }).catch(()=>{}).finally(()=>{RB.frameRefreshBusy=false;});
    return;
  }
  syncSheet({quiet:true});
}
function parseSheetPaste(text){
  const obj=JSON.parse(text);
  return snapshotSheet(obj.attributes||obj,obj.characterName||obj.name||'Imported sheet');
}

// ===== 16_beacon_visible.js =====
// 2024/Beacon sheet adapter: inspect only text currently rendered to the player.
// Uses no Roll20 internal APIs, no hidden state and no network requests.
function beaconVisibleText(scope) {
  const el=scope?.nodeType===9?scope.body:scope;
  return typeof el?.innerText==='string' ? el.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ').slice(0,45000) : '';
}
function beaconRegion(text,start,ends=[],limit=2400) {
  const first=text.match(start);
  if(!first)return '';
  const region=text.slice(first.index,first.index+limit);
  const lead=first[0].length,tail=region.slice(lead);
  let end=tail.length;
  for(const re of ends){const m=tail.match(re);if(m)end=Math.min(end,m.index);}
  return region.slice(0,lead+end);
}
function beaconImportVisible(scope,label='Open character sheet') {
  const text=beaconVisibleText(scope);
  const result={name:label,stats:{},abilityScores:{},abilityMods:{},saveBonuses:{},
    skillBonuses:{},spellSlots:{},usedSlots:{},resources:[],attacks:[],details:{},
    coverage:{visibleFields:0,sections:[],names:[]},signature:text.slice(0,35000)};
  if(!text.trim())return result;
  const count=(group,name)=>{result.coverage.visibleFields++;if(!result.coverage.sections.includes(group))result.coverage.sections.push(group);result.coverage.names.push(name);};
  const num=(value,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:null;};
  const lines=text.split('\n').map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
  if(/^(?:Open character sheet|Character Sheet)$/i.test(result.name)){
    const top=lines.slice(0,12).find(x=>/^[A-Za-z][\w '’.-]{1,55}(?:\s+He\/Him|\s+She\/Her|\s+They\/Them)?$/i.test(x)
      && !/^(?:Public|Whisper|Advantage|Disadvantage|Automatic|Query|Combat|Spells|Sheet Settings|Character Sheet)$/i.test(x));
    if(top)result.name=top.replace(/\s+(?:He\/Him|She\/Her|They\/Them)$/i,'');
  }
  const hp=beaconRegion(text,/\bHIT\s*POINTS\b/i,[/\bABILITIES\b/i,/\bAC\s*\/\s*SPEED\b/i],500);
  const hpPair=hp.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  if(hpPair){
    const current=num(hpPair[1],0,9999),maximum=num(hpPair[2],1,9999);
    if(current!==null&&maximum!==null&&current<=maximum+999){
      result.stats.hp=current;result.stats.maxHp=maximum;count('Combat','HP/max HP');
    }
    const next=hp.slice(hpPair.index+hpPair[0].length,hpPair.index+hpPair[0].length+30);
    const temp=next.match(/^\s*(\d{1,4})(?:\s|$)/);
    if(temp){const n=num(temp[1],0,9999);if(n!==null){result.stats.tempHp=n;count('Combat','Temporary HP');}}
  }
  const ac=text.match(/\bARMOR\s*CLASS\s*:?\s*(\d{1,2})\b/i);
  if(ac){const n=num(ac[1],1,40);if(n!==null){result.stats.ac=n;count('Combat','AC');}}
  const speed=text.match(/\bSPEED\s*(?:\(\s*(?:ft|feet)\s*\))?\s*:?\s*(\d{1,3})\b/i);
  if(speed){const n=num(speed[1],0,500);if(n!==null){result.stats.speed=n;count('Combat','Speed');}}
  const pb=text.match(/\bProficiency\s+Bonus\s*:?\s*\+?\s*(\d{1,2})\b/i);
  if(pb){const n=num(pb[1],1,15);if(n!==null){result.stats.proficiency=n;count('Combat','Proficiency');}}
  const classMatch=text.match(/\b(Fighter|Paladin|Rogue|Ranger|Cleric|Druid|Wizard|Sorcerer|Warlock|Bard|Barbarian|Monk)\s+(\d{1,2})(?:\s*[-–]\s*([A-Za-z][A-Za-z '’]{2,80}))?/i);
  if(classMatch){
    result.details.class=classMatch[1];
    const level=num(classMatch[2],1,20);if(level!==null){result.stats.level=level;count('Identity','Level');}
    if(classMatch[3])result.details.subclass=classMatch[3].trim();
    count('Identity','Class');
  }
  const abilities=beaconRegion(text,/\bABILITIES\b/i,[/\bAC\s*\/\s*SPEED\b/i,/\bSKILLS\b/i,/\bCOMBAT\b/i,/\bRESOURCES\b/i],2000);
  const regex=/\b(STR|DEX|CON|INT|WIS|CHA)\s+(\d{1,2})\s+([+-]\s*\d{1,2})\s+([+-]\s*\d{1,2})(?=\s|$)/gi;
  for(const m of abilities.matchAll(regex)){
    const score=num(m[2],1,30),mod=num(m[3].replace(/\s/g,''),-15,20),save=num(m[4].replace(/\s/g,''),-15,30);
    if(score===null||mod===null||save===null||Math.abs(Math.floor((score-10)/2)-mod)>1)continue;
    const key=m[1].toLowerCase();
    result.abilityScores[key]=score;result.abilityMods[key]=mod;result.saveBonuses[key]=save;
    count('Abilities',m[1]+'/save');
  }
  const skills=beaconRegion(text,/\bSKILLS\b/i,[/\bCOMBAT\b/i,/\bSPELLS\b/i,/\bINVENTORY\b/i,/\bFEATURES\b/i,/\bRESOURCES\b/i],3800);
  for(const skill of skillNames){
    const escaped=skill.replace(/ /g,'\\s+');
    const rx=new RegExp('(?:^|\\n)\\s*'+escaped+'\\s+(?:(?:STR|DEX|CON|INT|WIS|CHA)\\s+)?([+-]\\s*\\d{1,2})(?:\\s|$)','im');
    const m=skills.match(rx);
    if(m){const n=num(m[1].replace(/\s/g,''),-15,35);if(n!==null){result.skillBonuses[skill]=n;count('Skills',skill);}}
  }
  const resources=beaconRegion(text,/\bRESOURCES\b/i,[/\b(?:SHEET SETTINGS|CHARACTER SHEET|ABILITY CHECKS|PERSONAL JOURNAL)\b/i],1600);
  const resourceLines=resources.split('\n').map(s=>s.trim()).filter(Boolean),seenResources=new Set();
  for(let i=1;i<resourceLines.length&&i<75;i++){
    const m=resourceLines[i].match(/^[−-]?\s*(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if(!m)continue;
    const name=resourceLines[i-1],current=num(m[1],0,999),max=num(m[2],1,999);
    if(current===null||max===null||current>max||!name||name.length>90||
      /^(?:HIT POINTS|RESOURCES|CURRENT|MAX|TEMP|SLOTS|DAMAGE|HEAL)$/i.test(name))continue;
    const id='sheet:beacon:resource:'+name.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,85);
    if(seenResources.has(id))continue;
    seenResources.add(id);
    result.resources.push({id,origin:'sheet',name,current,max,reset:'manual'});
    count('Resources',name);
  }
  // Visible attacks are informational only; legacy repeating commands are
  // never synthesized for Beacon.
  const attacks=beaconRegion(text,/\bATTACKS\b/i,
    [/\b(?:SPELLS|INVENTORY|FEATURES\s*(?:&|AND)\s*TRAITS|NOTES|ABOUT|RESOURCES)\b/i],3500);
  const rows=attacks.split('\n').map(s=>s.trim()).filter(Boolean),seenAttacks=new Set();
  for(let i=2;i<rows.length&&i<100;i++){
    const dmg=rows[i].match(/\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)\b/i);
    if(!dmg)continue;
    const preceding=rows.slice(Math.max(0,i-7),i);
    const index=preceding.findLastIndex(s=>/^(?:Melee|Ranged|Thrown|Reach)(?:\s|$)/i.test(s));
    if(index<1)continue;
    const name=preceding[index-1];
    if(!name||name.length>85||/^(?:Attack|Damage|Range|Hit|DC|Melee|Ranged)$/i.test(name))continue;
    const key=name.toLowerCase();if(seenAttacks.has(key))continue;
    seenAttacks.add(key);
    const tail=preceding.slice(index).join(' ');
    const toHit=tail.match(/([+-]\s*\d{1,2})\s*Attack/i);
    const range=tail.match(/(\d{1,3})\s*ft/i);
    result.attacks.push({id:'sheet:beacon:attack:'+key.replace(/[^a-z0-9]/g,'-').slice(0,80),
      origin:'sheet',name,toHit:toHit?.[1]?.replace(/\s/g,'')||'',
      damage:dmg[1].replace(/\s/g,''),range:range?range[1]+' ft':'',
      description:'Visible on Roll20 2024. Use the original sheet to roll.',command:''});
    count('Attacks',name);
  }
  result.coverage.names=result.coverage.names.slice(0,120);
  return result;
}
function mergeBeaconSnapshot(named,visible){
  for(const section of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','spellSlots','usedSlots']){
    for(const [k,v] of Object.entries(visible[section]||{})){
      if(named[section]?.[k]===undefined)named[section][k]=v;
    }
  }
  named.details={...visible.details,...named.details};
  for(const section of ['resources','attacks']){
    const existing=new Set(named[section].map(x=>x.name.toLowerCase()));
    for(const x of visible[section]){
      if(!existing.has(x.name.toLowerCase())){named[section].push(x);existing.add(x.name.toLowerCase());}
    }
  }
  if((!named.name||/^(?:Open character sheet|Character Sheet)$/i.test(named.name))&&visible.name)named.name=visible.name;
  named.coverage.visibleFields=visible.coverage.visibleFields;
  named.coverage.visibleSections=visible.coverage.sections;
  named.coverage.visibleNames=visible.coverage.names;
  if(!named.coverage.attributes&&visible.coverage.visibleFields)named.edition='2024 / visible sheet';
  return named;
}

// ===== 17_frame_bridge.js =====
// Communication between the Roll20 editor and the separate D&D 2024 sheet iframe.
// Only a recognized, player-opened Roll20 sheet iframe is allowed to exchange data.
const RBE_BEACON_ORIGIN='https://advanced-sheets.production.roll20preflight.net';
const RBE_EDITOR_ORIGIN='https://app.roll20.net';
const RBE_BRIDGE_MARKER='roll20-embetterment:beacon-sheet:v1';
const rbeFramePending=new Map();
let rbeFrameCounter=0;
function isBeaconFrame(){
  return location.hostname==='advanced-sheets.production.roll20preflight.net' &&
    /^\/dnd2024byroll20(?:\/|$)/.test(location.pathname) && window.parent!==window;
}
function isRoll20Editor(){
  return location.hostname==='app.roll20.net'&&/^\/editor(?:\/|$)/.test(location.pathname);
}
function beaconFrameForMessage(event){
  if(event.origin!==RBE_BEACON_ORIGIN||!event.source)return null;
  for(const candidate of RB.openSheets||[]){
    const f=candidate.frame;
    if(f?.contentWindow===event.source &&
      new URL(f.src||f.getAttribute?.('src'),location.href).origin===RBE_BEACON_ORIGIN)return candidate;
  }
  return null;
}
function onBeaconFrameMessage(event){
  const message=event.data;
  if(!message||message.bridge!==RBE_BRIDGE_MARKER)return;
  const candidate=beaconFrameForMessage(event);
  if(!candidate)return;
  if(message.type==='ready'){
    candidate.frameReady=true;
    sheetPrefetchAttributes(candidate);
    return;
  }
  if(message.type!=='snapshot'||typeof message.id!=='string')return;
  const pending=rbeFramePending.get(message.id);
  if(!pending||pending.frame!==candidate.frame)return;
  rbeFramePending.delete(message.id);clearTimeout(pending.timeout);
  if(message.error)return pending.reject(new Error(String(message.error).slice(0,160)));
  const fields=sheetAttributes(message.fields);
  if(Object.keys(fields).length>6000)return pending.reject(new Error('Character sheet returned too many fields'));
  const visible=message.visible&&typeof message.visible==='object'?message.visible:
    beaconImportVisible({innerText:''},candidate.name);
  // The window title, not a generic icon or panel heading, identifies the
  // character. Local file data still gets validated by snapshotSheet.
  pending.resolve({fields,visible,full:!!message.full,expected:Math.max(0,int(message.expected)),
    scannedPages:Math.max(1,int(message.scannedPages)),tabs:Array.isArray(message.tabs)?message.tabs.slice(0,48).map(x=>String(x).slice(0,100)):[],at:Date.now()});
}
function requestBeaconFrame(candidate,deep=false,options={}){
  return new Promise((resolve,reject)=>{
    const f=candidate?.frame;
    if(!f?.contentWindow)return reject(new Error('Character sheet iframe is no longer open'));
    let src;
    try{src=new URL(f.src||f.getAttribute('src'),location.href);}catch{return reject(new Error('Invalid character sheet iframe'));}
    if(src.origin!==RBE_BEACON_ORIGIN||!/^\/dnd2024byroll20(?:\/|$)/.test(src.pathname))
      return reject(new Error('Unrecognized sheet origin'));
    const id='rbe'+(++rbeFrameCounter);
    const timeout=setTimeout(()=>{
      rbeFramePending.delete(id);
      reject(new Error('No reply from the 2024 sheet reader. Reload Roll20 and allow Tampermonkey on advanced-sheets.production.roll20preflight.net.'));
    },options.tour?90000:18000);
    rbeFramePending.set(id,{frame:f,resolve,reject,timeout});
    try{
      f.contentWindow.postMessage({bridge:RBE_BRIDGE_MARKER,type:'scan',id,deep:!!deep,tour:!!options.tour},RBE_BEACON_ORIGIN);
    }catch(err){rbeFramePending.delete(id);clearTimeout(timeout);reject(err);}
  });
}
function beaconFrameSnapshot(candidate,scan,{quiet=false}={}){
  if(!scan||!candidate?.frame)return false;
  const visual=scan.visible&&typeof scan.visible==='object'?scan.visible:
    beaconImportVisible({innerText:''},candidate.name);
  const data=mergeBeaconSnapshot(snapshotSheet(scan.fields,candidate.name),visual);
  if(!data.coverage.attributes&&!data.coverage.visibleFields)return false;
  // Identity comes from .asv__header__name in the VTT parent and is never
  // inferred from a neighboring pencil icon or a different sheet.
  data.name=candidate.name;
  if(!applySheetSnapshot(profile(),data))return false;
  candidate.readableFields=data.coverage.attributes;
  candidate.visibleFields=data.coverage.visibleFields;
  profile().sheetLink.source=candidate.id;
  RB.sheetSignature=JSON.stringify(scan.fields)+'|'+(visual.signature||'');
  save();
  if(!quiet)render();
  else if(RB.visible&&RB.tab==='Sheet'&&!RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
  return true;
}
async function beaconFrameReadRequest(event){
  if(event.origin!==RBE_EDITOR_ORIGIN || event.source!==window.parent)return;
  const message=event.data;
  if(!message||message.bridge!==RBE_BRIDGE_MARKER||message.type!=='scan'||
    typeof message.id!=='string'||message.id.length>100)return;
  try{
    const scope=document.body;
    const scan=message.tour?await sheetTourFrameScan():(message.deep?await sheetHarvestBeaconRows(scope):{
      fields:readSheetFields(scope),full:false,expected:sheetExpectedAttributeCount(scope),scannedPages:1
    });
    const visible=message.tour?scan.visible:beaconImportVisible(scope,'Open character sheet');
    const fields=Object.fromEntries(Object.entries(scan.fields).slice(0,6000));
    window.parent.postMessage({bridge:RBE_BRIDGE_MARKER,type:'snapshot',id:message.id,
      fields,visible,full:scan.full,expected:scan.expected,scannedPages:scan.scannedPages,tabs:scan.tabs||[]},RBE_EDITOR_ORIGIN);
  }catch(err){
    window.parent.postMessage({bridge:RBE_BRIDGE_MARKER,type:'snapshot',id:message.id,
      error:String(err.message||err).slice(0,160)},RBE_EDITOR_ORIGIN);
  }
}
function startBeaconFrameReader(){
  window.addEventListener('message',beaconFrameReadRequest);
  window.parent.postMessage({bridge:RBE_BRIDGE_MARKER,type:'ready'},RBE_EDITOR_ORIGIN);
  // First ready may be posted before the VTT parent has discovered the
  // character dialog. It still responds to explicit scan requests later.
}
function startBeaconParentBridge(){
  window.addEventListener('message',onBeaconFrameMessage);
}

// ===== 18_sheet_tour.js =====
// Guided, read-only import across the visible Roll20 D&D 2024 sheet tabs.
// No private Roll20 models, endpoint calls, action rolls, or character writes.
const RBE_SHEET_TOUR_MAIN=['Character Sheet','Bio & Info','Advanced Tools'];
const RBE_SHEET_TOUR_INNER=[
  'Combat','Spells','Inventory','Features & Traits','Features and Traits',
  'Notes','Actions','Resources','Skills','Equipment','Character','Details',
  'Background','Feats','Cantrips',...Array.from({length:9},(_,i)=>'Level '+(i+1))
];
const sheetTourDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sheetTourStatus(text) {
  RB.sheetTourStatus=text;
  const el=RB.shadow?.querySelector?.('#rbe-sheet-tour-status');
  if(el)el.textContent=text;
}
function sheetTourLabel(el) {
  return String(el?.innerText??el?.textContent??'').replace(/\s+/g,' ').trim();
}
function sheetTourTabs(scope,labels,selector) {
  if(!scope?.querySelectorAll)return [];
  const set=new Set(labels.map(s=>s.toLowerCase()));
  const found=[];
  for(const el of Array.from(scope.querySelectorAll(selector)||[]).slice(0,1200)){
    if(!set.has(sheetTourLabel(el).toLowerCase()) || el.disabled)continue;
    // Never click an in-game action just because its text happens to match.
    const isTab=selector==='.asv__header__nav__tabs_link' ||
      el.getAttribute?.('role')==='tab' ||
      !!el.closest?.('nav,[role="tablist"],[class*="tabs"],[class*="tab-list"],[class*="navigation"]') ||
      /(?:^|[\s_-])tab(?:$|[\s_-])/i.test(String(el.className||''));
    if(isTab&&!found.some(x=>sheetTourLabel(x)===sheetTourLabel(el)))found.push(el);
  }
  return found;
}
function sheetTourActive(tab) {
  return tab?.getAttribute?.('aria-selected')==='true' ||
    tab?.getAttribute?.('data-state')==='active' ||
    /(?:^|\s)(active|selected|current)(?:\s|$)/i.test(String(tab?.className||'')) ||
    /(?:^|\s)(active|selected|current)(?:\s|$)/i.test(String(tab?.parentElement?.className||''));
}
function sheetTourMergeVisible(target,source) {
  if(!source)return target;
  for(const k of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','spellSlots','usedSlots','details']){
    Object.assign(target[k],source[k]||{});
  }
  for(const key of ['attacks','resources','spells','inventory','features','proficiencies','tools']){
    const list=Array.isArray(source[key])?source[key]:[];
    if(!Array.isArray(target[key]))target[key]=[];
    const existing=new Set(target[key].map(x=>x.id||x.name));
    for(const entry of list){
      if(!entry||existing.has(entry.id||entry.name))continue;
      target[key].push(entry);existing.add(entry.id||entry.name);
    }
  }
  const names=target.coverage.names||[];
  for(const name of source.coverage?.names||[])if(!names.includes(name))names.push(name);
  target.coverage.names=names.slice(0,400);
  target.coverage.visibleFields=names.length;
  const sections=target.coverage.sections||[];
  for(const section of source.coverage?.sections||[])if(!sections.includes(section))sections.push(section);
  target.coverage.sections=sections;
  target.signature=(target.signature||'').slice(0,25000)+'|'+String(source.signature||'').slice(0,12000);
  return target;
}
function sheetTourAccumulator() {
  return {fields:{},visible:beaconImportVisible({innerText:''}),full:false,
    expected:0,scannedPages:0,tabs:[]};
}
function sheetTourAdd(acc,scan,label) {
  Object.assign(acc.fields,scan.fields||{});
  sheetTourMergeVisible(acc.visible,scan.visible);
  acc.scannedPages+=scan.scannedPages||1;
  acc.expected=Math.max(acc.expected,scan.expected||0);
  if(scan.full)acc.full=true;
  if(label&&!acc.tabs.includes(label))acc.tabs.push(label);
  for(const tab of scan.tabs||[])if(typeof tab==='string'&&!acc.tabs.includes(tab))acc.tabs.push(tab);
  return acc;
}
async function sheetTourCollect(scope,acc,label,deep=true) {
  if(!scope?.querySelectorAll)return;
  const scroll=deep&&sheetScrollableAttributeContainer(scope);
  const batch=scroll?await sheetHarvestBeaconRows(scope):
    {fields:readSheetFields(scope),full:false,expected:sheetExpectedAttributeCount(scope),scannedPages:1};
  batch.visible=beaconImportVisible(scope,'Open character sheet');
  sheetTourAdd(acc,batch,label);
}
async function sheetTourFrameScan() {
  const scope=document.body;
  const acc=sheetTourAccumulator();
  const tabs=sheetTourTabs(document,RBE_SHEET_TOUR_INNER,
    'button,[role="tab"],nav a,[class*="tabs"] a');
  const original=tabs.find(sheetTourActive)||tabs[0]||null;
  let count=0;
  const gather=async label=>{
    if(++count>36)return;
    sheetTourStatus('Reading '+label+'…');
    await sheetTourCollect(scope,acc,label,true);
  };
  try{
    await gather('Current view');
    for(const tab of tabs.slice(0,14)){
      if(count>34)break;
      if(!tab.isConnected && tab.isConnected!==undefined)continue;
      if(!sheetTourActive(tab)){tab.click?.();await sheetTourDelay(230);}
      const label=sheetTourLabel(tab);
      await gather(label);
      // Some Roll20 sections expose further tabs only after opening them.
      if(/^(?:Spells|Inventory|Features & Traits|Features and Traits|Combat)$/i.test(label)){
        const secondary=sheetTourTabs(document,RBE_SHEET_TOUR_INNER,
          '[role="tab"],nav button,nav a,[class*="tabs"] button,[class*="tabs"] a')
          .filter(x=>!tabs.includes(x)).slice(0,16);
        const selected=secondary.find(sheetTourActive);
        try{
          for(const child of secondary){
            if(count>34)break;
            if(!child.isConnected && child.isConnected!==undefined)continue;
            if(!sheetTourActive(child)){child.click?.();await sheetTourDelay(160);}
            await gather(label+' / '+sheetTourLabel(child));
          }
        }finally{
          if(selected&&selected.isConnected!==false&&!sheetTourActive(selected)){
            selected.click?.();await sheetTourDelay(130);
          }
        }
      }
    }
  }finally{
    if(original&&original.isConnected!==false&&!sheetTourActive(original)){
      original.click?.();await sheetTourDelay(180);
    }
  }
  return acc;
}
function sheetTourPromptOpen() {
  RB.sheetTourWaiting=true;
  RB.sheetTourStatus='Open your character sheet in Roll20’s Journal. Import will begin automatically.';
  RB.visible=true;RB.tab='Sheet';RB.state.ui.lastTab='Sheet';
  render();
  if(RB.sheetTourWatch)return;
  const started=Date.now();
  RB.sheetTourWatch=setInterval(()=>{
    if(!RB.sheetTourWaiting || Date.now()-started>120000){
      sheetTourCancel();
      if(Date.now()-started>120000)sheetTourStatus('Waiting timed out. Click Import all tabs to try again.');
      return;
    }
    const options=findSheetForms(document);
    if(!options.length)return;
    clearInterval(RB.sheetTourWatch);RB.sheetTourWatch=null;
    RB.sheetTourWaiting=false;
    RB.openSheets=options;
    const name=profile().sheetLink?.name||profile().name;
    RB.selectedSheet=Math.max(0,options.findIndex(x=>x.name?.toLowerCase()===name?.toLowerCase()));
    sheetTourStart().catch(err=>console.warn('[roll20 Embetterment] Auto sheet import',err));
  },650);
}
function sheetTourCancel(){
  RB.sheetTourWaiting=false;
  if(RB.sheetTourWatch)clearInterval(RB.sheetTourWatch);
  RB.sheetTourWatch=null;
  RB.sheetTourStatus='Import cancelled.';
  if(RB.visible&&RB.tab==='Sheet')render();
}
async function sheetTourStart() {
  if(RB.sheetTourBusy)return;
  const sheets=findSheetForms(document);
  if(!sheets.length){sheetTourPromptOpen();return;}
  if(RB.sheetTourWaiting)sheetTourCancel();
  RB.openSheets=sheets;
  const preferred=profile().sheetLink?.source;
  const selected=RB.openSheets.findIndex(s=>s.id===preferred);
  RB.selectedSheet=selected>=0?selected:Math.min(RB.selectedSheet||0,sheets.length-1);
  const candidate=RB.openSheets[RB.selectedSheet],profileId=RB.state.current;
  RB.sheetTourBusy=true;
  sheetTourStatus('Importing '+candidate.name+' — reading all available tabs…');
  if(RB.visible&&RB.tab==='Sheet')render();
  const acc=sheetTourAccumulator(),dialog=candidate.root;
  const tabs=sheetTourTabs(dialog,RBE_SHEET_TOUR_MAIN,'.asv__header__nav__tabs_link');
  const original=tabs.find(sheetTourActive)||tabs[0]||null;
  try{
    // Read the active tab before changing it.
    await sheetTourCollect(dialog,acc,'Current Roll20 view',false);
    const main=tabs.find(x=>sheetTourLabel(x)==='Character Sheet');
    if(main && !sheetTourActive(main)){main.click?.();await sheetTourDelay(250);}
    if(candidate.frame){
      sheetTourStatus('Reading Combat, Spells, Inventory and Features…');
      const scan=await requestBeaconFrame(candidate,true,{tour:true});
      sheetTourAdd(acc,scan,'Character Sheet');
    }else{
      await sheetTourCollect(dialog,acc,'Character Sheet',true);
    }
    for(const label of ['Bio & Info','Advanced Tools']){
      const tab=tabs.find(x=>sheetTourLabel(x)===label);
      if(!tab)continue;
      if(!sheetTourActive(tab)){tab.click?.();await sheetTourDelay(280);}
      sheetTourStatus('Reading '+label+'…');
      if(label==='Advanced Tools'){
        const attrs=Array.from(dialog.querySelectorAll?.('button,[role="tab"]')||[])
          .find(el=>/^Attributes(?:\s+\d+)?$/i.test(sheetTourLabel(el)) &&
            !el.disabled);
        if(attrs){attrs.click?.();await sheetTourDelay(300);}
      }
      await sheetTourCollect(dialog,acc,label,true);
    }
    if(RB.state.current!==profileId||dialog.isConnected===false)
      throw new Error('Character sheet or local profile changed during import.');
    // One transaction: no intermediate partial tab results overwrite the profile.
    const didImport=candidate.frame?beaconFrameSnapshot(candidate,acc):
      applySheetSnapshot(profile(),mergeBeaconSnapshot(snapshotSheet(acc.fields,candidate.name),acc.visible));
    if(!didImport)throw new Error('No accessible values were found in the opened sheet.');
    if(!candidate.frame){profile().sheetLink.source=candidate.id;save();}
    profile().sheetLink.tabsVisited=acc.tabs;
    RB.sheetWarm={frame:candidate.frame,root:dialog,scan:acc,at:Date.now(),promise:null};
    save();
    sheetTourStatus('Imported '+Object.keys(acc.fields).length+' named attributes and '+
      acc.visible.coverage.visibleFields+' visible values from '+acc.tabs.length+' views.');
    toast('Character import complete: '+candidate.name+' ('+acc.tabs.length+' views).');
  }catch(err){
    sheetTourStatus('Import incomplete: '+String(err.message||err).slice(0,150));
    toast(RB.sheetTourStatus);
    console.warn('[roll20 Embetterment] Full sheet tour',err);
  }finally{
    if(original&&original.isConnected!==false&&!sheetTourActive(original)){
      original.click?.();await sheetTourDelay(180);
    }
    RB.sheetTourBusy=false;
    if(RB.visible&&RB.tab==='Sheet')render();
  }
}

// ===== 19_radial_hud.js =====
// Concentric combat wheel. Roll20 data remains read-only; chat commands remain user initiated.
 const RADIAL_STYLE=String.raw`
 #rbe-radial-layer{position:fixed;inset:0;pointer-events:none;z-index:4;--gold:#e9c88d;--iron:#241c19}
 #rbe-radial-wheel{position:fixed;width:520px;height:520px;transform:translate(-50%,-50%) scale(var(--wheel-scale,1));transform-origin:center;pointer-events:none;filter:drop-shadow(0 12px 24px #000b)}
 #rbe-radial-wheel svg.rbe-wheel{width:520px;height:520px;overflow:visible;pointer-events:none}
 #rbe-radial-wheel .rbe-wedge{pointer-events:visiblePainted;cursor:pointer;outline:none;transition:opacity .17s,filter .17s}
 #rbe-radial-wheel .rbe-wedge path{fill:url(#rbe-wedge-metal);stroke:#947b53;stroke-width:1.4;transition:fill .18s,stroke .18s}
 #rbe-radial-wheel .rbe-wedge:hover path,#rbe-radial-wheel .rbe-wedge:focus-visible path{fill:#685239;stroke:#ffe5a7;stroke-width:2.5}
 #rbe-radial-wheel .rbe-wedge.is-selected path{fill:url(#rbe-wedge-selected);stroke:#ffe6a7;stroke-width:2.3}
 #rbe-radial-wheel .rbe-wedge.is-muted{opacity:.18}
 #rbe-radial-wheel .rbe-wedge.is-muted:hover,#rbe-radial-wheel .rbe-wedge.is-muted:focus-visible{opacity:.76}
 #rbe-radial-wheel .rbe-wedge text{fill:#f0d6a0;font:600 10px Georgia,'Times New Roman',serif;letter-spacing:.05px;paint-order:stroke;stroke:#1a1410;stroke-width:2px;stroke-linejoin:round;pointer-events:none}
 #rbe-radial-wheel .rbe-wedge .rbe-option-name{font-weight:700}
 #rbe-radial-wheel .rbe-wedge .rbe-option-meta{font-size:8.5px;fill:#dbbd86;stroke-width:1.6px}
 #rbe-radial-wheel .rbe-wedge .rbe-glyph{font:24px Georgia,serif;stroke-width:1px;fill:#ffe2a4}
 #rbe-radial-wheel .rbe-wedge.is-muted text{fill:#9c876c}
 #rbe-radial-wheel .rbe-ring{animation:rbe-ring-bloom .21s ease-out both;transform-origin:center}
 #rbe-radial-wheel .rbe-core{fill:#10101723;stroke:#d2aa6c;stroke-width:2;stroke-dasharray:4 6;pointer-events:none}
 #rbe-radial-wheel .rbe-center{fill:#f7d999;stroke:#241916;stroke-width:1;font:600 12px Georgia,serif;pointer-events:none}
 #rbe-radial-wheel .rbe-tether-hub{fill:none;stroke:#ad9164;stroke-width:2;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-title{position:absolute;left:50%;top:calc(50% - var(--rbe-outer-radius,112px) - 22px);transform:translate(-50%,-50%);font:700 14px Georgia,serif;color:#f5d8a8;letter-spacing:1.8px;text-shadow:0 2px 8px black;white-space:nowrap}
 #rbe-radial-layer .rbe-wheel-footer{position:absolute;left:50%;top:calc(50% + var(--rbe-outer-radius,112px) + 12px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:7px;max-width:520px;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-info{position:static;transform:none;white-space:nowrap;max-width:500px;overflow:hidden;text-overflow:ellipsis;padding:5px 12px;background:#151115dc;border:1px solid #8d754b;border-radius:20px;color:#f0d6a7;font:12px Georgia,serif;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-toolbar{pointer-events:auto;position:static;transform:none;display:flex;align-items:center;gap:4px;background:#19131be6;padding:5px;border:1px solid #91764b;border-radius:30px;white-space:nowrap}
 #rbe-radial-layer .rbe-wheel-toolbar button{border:0;background:transparent;color:#e6cb9d;font:600 12px system-ui;padding:4px 7px}
 #rbe-radial-layer .rbe-wheel-toolbar button:hover{background:#614a32}
 #rbe-radial-layer #rbe-radial-dock{position:fixed;bottom:15px;left:15px;display:flex;gap:6px;align-items:center;pointer-events:auto;background:#1c1720ec;border:2px ridge #a98956;border-radius:25px;box-shadow:0 4px 25px #000b;padding:6px}
 #rbe-radial-layer #rbe-radial-dock button{color:#f9dfa8;background:#3a2b28;border-color:#977951;border-radius:24px;font:600 12px Georgia,serif}
 #rbe-radial-layer #rbe-radial-dock .rbe-dock-caption{font:11px system-ui;color:#d3bf9e;max-width:220px;padding:0 6px}
 #rbe-radial-layer #rbe-token-tether{position:fixed;inset:0;width:100vw;height:100vh;overflow:visible;pointer-events:none}
 #rbe-radial-layer #rbe-tether-path{stroke:#c7a46c;stroke-width:2;stroke-dasharray:3 6;fill:none;opacity:.75}
 @keyframes rbe-ring-bloom{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
 :host([data-reduced-motion="true"]) #rbe-radial-wheel .rbe-ring{animation:none!important}
 @media(max-width:600px){#rbe-radial-layer .rbe-wheel-info{max-width:330px;font-size:10px}#rbe-radial-layer .rbe-wheel-toolbar button{font-size:11px;padding:4px 5px}}
 `;
 RB.radial={open:true,pin:false,path:[],pages:{},anchor:null,manual:null,source:'none',lastPosition:'',lastPresence:false};
 const radialNode=(id,label,glyph,children=[],kind='',value='',detail='',subtitle='')=>({id,label,glyph,children,kind,value,detail,subtitle});
 function radialAttackLeaves(attacks){
   return attacks.slice(0,32).map(a=>radialNode('a:'+a.id,a.name,'⚔',[
     radialNode('roll','Roll','⚄',[],'attack',a.id),
     radialNode('details','Details','⌕',[],'detail',a.id),
     radialNode('sheet','Sheet','▤',[],'panel','Sheet')
   ],'', '',[a.toHit,a.damage,a.damageType,a.range].filter(Boolean).join(' · '),
   [a.toHit,a.range||a.damage].filter(Boolean).join(' · ')));
 }
 function radialSpellLeaves(spells){
   return spells.slice(0,38).map(s=>radialNode('s:'+s.id,s.name,'✧',[
     radialNode('cast','Cast','✧',[],'spell',s.id),
     radialNode('info','Info','⌕',[],'spellInfo',s.id),
     ...(Number(s.level)>0?[radialNode('slot','Use slot','◈',[],'spendSlot',String(s.level))]:[])
   ],'','',[s.castTime,s.range,s.duration].filter(Boolean).join(' · '),
   [Number(s.level)?'L'+s.level:'Cantrip',s.concentration?'Conc.':null,s.castTime].filter(Boolean).join(' · ')));
 }
 function radialItemLeaves(items){
   return items.slice(0,40).map(i=>radialNode('i:'+i.id,i.name,'◆',[
     radialNode('use','Announce','◈',[],'announceItem',i.id),
     radialNode('subtract','Use one','−',[],'consume',i.id),
     radialNode('inspect','Details','⌕',[],'itemInfo',i.id)
   ],'','',String(i.qty??1)+' carried',
   '×'+String(i.qty??1)+(i.category?' · '+String(i.category):'')));
 }
 function radialCategories(){
   const p=profile(),attacks=p.attacks||[],spells=p.spells||[],items=p.inventory||[],features=p.features||[];
   const group=(id,name,glyph,children)=>radialNode(id,name,glyph,children.length?children:[radialNode('empty','Open sheet','▤',[],'panel','Sheet')]);
   const ranged=a=>/range|bow|crossbow|sling|gun|thrown|javelin/i.test([a.range,a.name,a.description].join(' '));
   const reaction=features.filter(f=>/reaction|counterspell|shield/i.test([f.name,f.description].join(' ')));
   const bonusSpells=spells.filter(s=>/bonus/i.test(s.castTime||''));
   return [
     radialNode('attack','ATTACK','⚔',[
       group('melee','Melee','⚔',radialAttackLeaves(attacks.filter(a=>!ranged(a)))),
       group('ranged','Ranged','➶',radialAttackLeaves(attacks.filter(ranged))),
       group('all','Arsenal','✥',radialAttackLeaves(attacks))
     ]),
     radialNode('spells','SPELLS','✧',[
       ...Array.from({length:10},(_,n)=>n).filter(n=>spells.some(s=>Number(s.level)===n))
         .map(n=>group('lvl'+n,n?'Level '+n:'Cantrips',n?'✦':'❋',radialSpellLeaves(spells.filter(s=>Number(s.level)===n)))),
       group('all','All Magic','✧',radialSpellLeaves(spells))
     ]),
     radialNode('bonus','BONUS','✦',[
       group('bonusSpells','Bonus Spells','✧',radialSpellLeaves(bonusSpells)),
       group('bonusAbilities','Features','✥',features.filter(f=>/bonus action/i.test([f.name,f.description].join(' '))).slice(0,14).map(f=>radialNode('f:'+f.id,f.name,'✦',[],'feature',f.id))),
       radialNode('offhand','Off-hand','⚔',[],'declare','bonus'),
       radialNode('hide','Hide','◈',[],'declare','bonus')
     ]),
     radialNode('items','ITEMS','◆',[
       group('consumable','Consumable','✚',radialItemLeaves(items.filter(i=>/potion|scroll|consum|food|drink|healing/i.test([i.name,i.category].join(' '))))),
       group('all','Backpack','◆',radialItemLeaves(items))
     ]),
     radialNode('defense','DEFEND','⛨',[
       ...['Dodge','Disengage','Help','Ready','Search','Hide'].map(a=>radialNode(a.toLowerCase(),a,'⛨',[],'declare','action')),
       radialNode('conditions','Conditions','◉',conditions.map(c=>radialNode(c.toLowerCase(),c,'◉',[],'condition',c)))
     ]),
     radialNode('movement','MOVE','➤',[
       radialNode('move5','Move 5 ft','➤',[],'move','5'),radialNode('move10','Move 10 ft','➤',[],'move','10'),
       radialNode('move30','Move 30 ft','➤',[],'move','30'),
       radialNode('stand','Stand Up','↑',[],'stand',''),
       radialNode('dash','Dash','➤',[],'declare','action'),
       radialNode('clear','Reset move','↺',[],'resetMove','')
     ]),
     radialNode('reactions','REACT','↯',[
       radialNode('opportunity','Opportunity','⚔',[],'declare','reaction'),
       group('class','Features','✥',reaction.slice(0,16).map(f=>radialNode('r:'+f.id,f.name,'↯',[],'feature',f.id))),
       radialNode('used','Mark spent','✓',[],'toggle','reactionUsed')
     ]),
     radialNode('checks','ROLLS','⚄',[
       group('skills','Skills','⚄',skillNames.map(n=>radialNode(n.toLowerCase(),n,'⚄',[],'skill',n))),
       group('saves','Saves','⛨',abilities.map(a=>radialNode(a,a.toUpperCase(),'⛨',[],'save',a))),
       group('abilities','Abilities','◆',abilities.map(a=>radialNode(a,a.toUpperCase(),'◆',[],'ability',a))),
       radialNode('initiative','Initiative','⚑',[],'initiative','')
     ]),
     radialNode('more','MORE','⚙',[
       radialNode('newTurn','New turn','↻',[],'newTurn',''),
       radialNode('sheet','Sheet import','▤',[],'panel','Sheet'),
       radialNode('macros','Macros','⚙',[],'panel','Macros'),
       group('favorites','Favorites','★',RB.state.macros.filter(m=>m.favorite).map(m=>radialNode('m:'+m.id,m.name,'★',[],'macro',m.id))),
       radialNode('settings','Settings','⚙',[],'panel','Settings'),
       radialNode('reanchor','Re-anchor','◎',[],'pin','')
     ])
   ];
 }
 function radialRadii(count){
   const presets={
     1:[[42,112]],2:[[33,75],[84,157]],
     3:[[28,61],[68,119],[127,201]],
     4:[[25,49],[54,91],[99,156],[164,238]]
   };
   return presets[Math.max(1,Math.min(4,count))];
 }
 function radialOuterRadius(count){
   const radii=radialRadii(count);
   return radii[radii.length-1][1];
 }
 function radialPoint(radius,deg){const a=deg*Math.PI/180;return {x:radius*Math.cos(a),y:radius*Math.sin(a)};}
 function radialSector(inner,outer,start,end){
   const p=radialPoint(outer,start),q=radialPoint(outer,end),r=radialPoint(inner,end),s=radialPoint(inner,start);
   const large=end-start>180?1:0;
   return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} A ${outer} ${outer} 0 ${large} 1 ${q.x.toFixed(2)} ${q.y.toFixed(2)} L ${r.x.toFixed(2)} ${r.y.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${s.x.toFixed(2)} ${s.y.toFixed(2)} Z`;
 }
 // More than a dozen wedges would force weapon names down to six letters.
 // Page large lists instead, keeping the same selection path and ring depth.
 const RADIAL_PAGE_SIZE=10;
 function radialVisiblePage(items,key){
   if(items.length<=12)return items;
   const total=Math.ceil(items.length/RADIAL_PAGE_SIZE);
   const page=Math.max(0,Math.min(total-1,Math.trunc(RB.radial.pages?.[key]||0)));
   const result=items.slice(page*RADIAL_PAGE_SIZE,(page+1)*RADIAL_PAGE_SIZE);
   const controls=[];
   if(page>0)controls.push(radialNode('page:prev','Previous','‹',[],'page',key+':'+(page-1)));
   if(page<total-1)controls.push(radialNode('page:next','Next','›',[],'page',key+':'+(page+1)));
   return [...result,...controls];
 }
 function radialTreeRings(){
   const root=radialCategories(),rings=[],path=RB.radial.path.slice(0,3);
   let branch=root;
   for(let depth=0;depth<=path.length;depth++){
     rings.push(radialVisiblePage(branch,path.slice(0,depth).join('/')));
     const node=branch.find(x=>x.id===path[depth]);
     if(!node?.children?.length)break;
     branch=node.children;
   }
   return rings;
 }
 // Word-aware wrapping for SVG text: never trim a weapon name to six
 // characters just because its parent ring contains many actions.
 function radialLabelLines(raw,width,limit){
   const words=String(raw??'').trim().replace(/\\s+/g,' ').split(' ').filter(Boolean);
   if(!words.length)return [''];
   const lines=[];
   for(let word of words){
     while(word.length>width){
       if(lines.length && lines[lines.length-1].length<width){
         const free=width-lines[lines.length-1].length-1;
         if(free>0){lines[lines.length-1]+=' '+word.slice(0,free);word=word.slice(free);}
       }
       if(word.length>width){lines.push(word.slice(0,width));word=word.slice(width);}
     }
     if(!word)continue;
     if(lines.length&&lines[lines.length-1].length+1+word.length<=width)
       lines[lines.length-1]+=' '+word;
     else lines.push(word);
   }
   if(lines.length<=limit)return lines;
   // Very long imports still retain the full text in SVG title and aria-label.
   const result=lines.slice(0,limit);
   result[limit-1]=result[limit-1].slice(0,Math.max(1,width-1))+'…';
   return result;
 }
 function radialLabelRotation(angle){
   const deg=((angle+90)%360+360)%360;
   return deg>=90&&deg<=270?deg-180:deg;
 }
 function radialLabelMarkup(node,step,inner,outer,angle){
   const thickness=outer-inner,midRadius=(inner+outer)/2;
   const width=Math.max(6,Math.min(22,Math.floor((2*midRadius*Math.sin(step*Math.PI/360)-12)/5.6)));
   const glyph=html(node.glyph||'✦');
   // Contracted rings cannot hold text and an icon simultaneously.
   if(thickness<34)return `<text x="0" y="5" text-anchor="middle"><tspan class="rbe-glyph" style="font-size:17px">${glyph}</tspan></text>`;
   const lines=radialLabelLines(node.label,width,thickness<43?1:thickness<60?2:3);
   const meta=thickness>=63&&lines.length<=2?String(node.subtitle||'').trim():'';
   const wrappedMeta=meta?radialLabelLines(meta,width,1)[0]:'';
   // Center the glyph + name lines + optional stat line within the band.
   const gap=11,iconHeight=thickness<47?15:20,metaHeight=wrappedMeta?10:0;
   const blockHeight=iconHeight+lines.length*gap+metaHeight;
   const top=-blockHeight/2;
   const fontSize=width<9?8.3:width<12?9:10;
   const iconY=top+iconHeight-3;
   const nameBase=top+iconHeight+8;
   const names=lines.map((line,i)=>
     `<text class="rbe-option-name" x="0" y="${(nameBase+i*gap).toFixed(1)}" style="font-size:${fontSize}px" text-anchor="middle">${html(line)}</text>`).join('');
   const subtitle=wrappedMeta?`<text class="rbe-option-meta" x="0" y="${(nameBase+lines.length*gap-1).toFixed(1)}" text-anchor="middle">${html(wrappedMeta)}</text>`:'';
   return `<text x="0" y="${iconY.toFixed(1)}" text-anchor="middle"><tspan class="rbe-glyph" style="font-size:${thickness<47?15:20}px">${glyph}</tspan></text>${names}${subtitle}`;
 }
 function radialWheelSVG(){
   const rings=radialTreeRings(),radius=radialRadii(rings.length);
   const content=rings.map((items,d)=>{
     const [inner,outer]=radius[d],step=360/Math.max(items.length,1);
     const nodes=items.map((node,i)=>{
       const chosen=RB.radial.path[d]===node.id,muted=RB.radial.path[d]&&!chosen,angle=-90+step*(i+.5);
       const gap=Math.min(2.4,step*.12),start=-90+i*step+gap,end=-90+(i+1)*step-gap;
       const mid=radialPoint((inner+outer)*.5,angle),rotation=radialLabelRotation(angle);
       const detail=[node.label,node.subtitle,node.detail].filter(Boolean).join(' · ');
       return `<g class="rbe-wedge ${chosen?'is-selected':''} ${muted?'is-muted':''}" data-action="radialPick" data-depth="${d}" data-index="${i}" role="button" tabindex="0" aria-label="${html(detail)}" aria-selected="${!!chosen}"><title>${html(detail)}</title><path d="${radialSector(inner,outer,start,end)}"></path><g transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${rotation.toFixed(1)})">${radialLabelMarkup(node,step,inner,outer,angle)}</g></g>`;
     }).join('');
     return `<g class="rbe-ring" data-ring="${d}" style="animation-delay:${d*35}ms">${nodes}</g>`;
   }).join('');
   const p=profile(),hp=Number(p.stats.hp)||0,max=Number(p.stats.maxHp)||0;
   return `<svg class="rbe-wheel" viewBox="-260 -260 520 520" aria-label="Concentric combat action menu" role="group">
     <defs><radialGradient id="rbe-wedge-metal"><stop stop-color="#53402b" offset="0"/><stop stop-color="#211a22" offset=".75"/><stop stop-color="#130f17" offset="1"/></radialGradient>
     <linearGradient id="rbe-wedge-selected"><stop stop-color="#b9914f"/><stop stop-color="#5c3a21" offset=".53"/><stop stop-color="#332332" offset="1"/></linearGradient></defs>
     <circle r="23" class="rbe-core"/><text class="rbe-center" x="0" y="4" text-anchor="middle">${Math.max(0,hp)}/${Math.max(0,max)}</text>
     ${content}</svg>`;
 }
 function radialHTML(){
   const r=RB.radial,active=r.anchor&&r.open,p=profile();
   const trail=radialTreeRings(),parts=r.path.map((id,i)=>trail[i]?.find(x=>x.id===id)?.label||id);
   const outerRadius=radialOuterRadius(trail.length);
   return `<div id="rbe-radial-layer"><svg id="rbe-token-tether" aria-hidden="true"><path id="rbe-tether-path" d=""></path></svg>
    ${active?`<div id="rbe-radial-wheel" style="left:${Math.round(r.anchor.x)}px;top:${Math.round(r.anchor.y)}px;--rbe-outer-radius:${outerRadius}px">
      <div class="rbe-wheel-title">${html(short(p.name,27))} · COMBAT</div>${radialWheelSVG()}
      <div class="rbe-wheel-footer"><div class="rbe-wheel-toolbar"><button data-action="radialBack" ${r.path.length?'':'disabled'} title="One ring back">← Back</button>
      <button data-action="radialHome" title="Reset all choices">⌂ Root</button><button data-action="radialPin" title="Click your token to anchor">◎ Pin</button>
      <button data-action="radialPanel" title="Open character sheet importer">▤ Sheet</button><button data-action="radialToggle" title="Collapse radial menu">✕</button></div>
      <div class="rbe-wheel-info">${html(parts.join(' / ')||'Choose an action')}${r.source==='manual'?' · screen-pinned':' · selected token'}</div></div>
     </div>`:''}
    ${!active?`<div id="rbe-radial-dock"><button data-action="radialToggle">⚔ ${r.open?'Combat wheel':'Open wheel'}</button><button data-action="radialPin">${r.pin?'Click token…':'◎ Pin to token'}</button><span class="rbe-dock-caption">${r.pin?'Click the center of your token on the tabletop':r.anchor?'HUD minimized':'Select a token or pin the HUD'}</span></div>`:''}
   </div>`;
 }
 function radialPick(depth,index){
   const rings=radialTreeRings(),node=rings[depth]?.[index];if(!node)return;
   if(node.kind==='page'){
     const pos=node.value.lastIndexOf(':');
     const key=node.value.slice(0,pos),page=Number(node.value.slice(pos+1));
     RB.radial.pages[key]=page;
     render();radialPosition();return;
   }
   if(node.children?.length){
     RB.radial.path=[...RB.radial.path.slice(0,depth),node.id];
     render();radialPosition();return;
   }
   radialExecute(node);
 }
 function radialExecute(node){
   const p=profile(),item=p.inventory.find(x=>x.id===node.value),attack=(p.attacks||[]).find(x=>x.id===node.value);
   const spell=p.spells.find(x=>x.id===node.value),feature=p.features.find(x=>x.id===node.value);
   let success=false;
   switch(node.kind){
     case 'attack':
       if(!attack?.command){toast('No safe Roll20 action for this weapon. Use its character sheet button.');break;}
       success=sendToRoll20(attack.command);if(success){p.actionUsed=true;record('Attacked: '+attack.name);}break;
     case 'spell':
       if(!spell?.command){toast('No Roll20 command for '+(spell?.name||'this spell')+'. Set it on the Spells tab.');break;}
       success=sendToRoll20(spell.command);
       if(success){if(/bonus/i.test(spell.castTime||''))p.bonusUsed=true;else p.actionUsed=true;
         if(spell.concentration)p.concentration=spell.name;record('Cast '+spell.name);}
       break;
     case 'macro':{const m=RB.state.macros.find(m=>m.id===node.value);if(m){success=sendToRoll20(m.command);if(success)record('Macro '+m.name);}break;}
     case 'initiative':quickRoll('initiative','');success=true;break;
     case 'skill':case 'save':case 'ability':quickRoll(node.kind,node.value);success=true;break;
     case 'declare':
       success=sendToRoll20('/em '+p.name+' declares '+node.label+'.');
       if(success){p[node.value==='bonus'?'bonusUsed':node.value==='reaction'?'reactionUsed':'actionUsed']=true;record('Combat action: '+node.label);}
       break;
     case 'move':p.movementUsed=clamp(int(p.movementUsed)+int(node.value),0,9999);save();success=true;break;
     case 'stand':p.movementUsed=clamp(int(p.movementUsed)+Math.floor(int(p.stats.speed)/2),0,9999);save();success=true;break;
     case 'resetMove':p.movementUsed=0;save();success=true;break;
     case 'toggle':p[node.value]=!p[node.value];save();success=true;break;
     case 'condition':p.conditions=p.conditions.includes(node.value)?p.conditions.filter(x=>x!==node.value):[...p.conditions,node.value];save();success=true;break;
     case 'newTurn':p.actionUsed=p.bonusUsed=p.reactionUsed=false;p.movementUsed=0;record('New turn started');success=true;break;
     case 'spendSlot':{const lv=int(node.value);if(lv>0&&lv<10&&p.usedSlots[lv]<p.spellSlots[lv]){p.usedSlots[lv]++;save();success=true;}else toast('No remaining spell slot at this level.');break;}
     case 'consume':if(item&&int(item.qty)>0){item.qty=int(item.qty)-1;record('Used 1 '+item.name);success=true;}else toast('Nothing left to use.');break;
     case 'announceItem':if(item){success=sendToRoll20('/em '+p.name+' uses '+item.name+'.');if(success)record('Used item '+item.name);}break;
     case 'detail':toast(attack?`${attack.name}: ${[attack.toHit,attack.damage,attack.damageType,attack.range].filter(Boolean).join(' · ')}`:'No attack details imported.');break;
     case 'spellInfo':toast(spell?`${spell.name}: ${[spell.castTime,spell.range,spell.duration,spell.notes].filter(Boolean).join(' · ').slice(0,300)}`:'No spell details imported.');break;
     case 'itemInfo':toast(item?`${item.name} · ${item.qty??1} carried · ${short(item.description||item.properties||'',220)}`:'No details imported.');break;
     case 'feature':toast(feature?`${feature.name}: ${short(feature.description||'Open your character sheet to activate this ability.',300)}`:'Feature unavailable.');break;
     case 'panel':RB.tab=node.value;RB.state.ui.lastTab=node.value;RB.visible=true;success=true;break;
     case 'pin':RB.radial.pin=true;toast('Click the center of your token on the tabletop.');success=true;break;
     default:toast('No usable command for this selection.');break;
   }
   if(success){RB.radial.path=[];save();render();radialPosition();}
 }
 function radialDomToken(){
   // Modern VTT may expose a selected token as an accessible DOM element.
   const el=document.querySelector('[data-token-id][aria-selected="true"],[data-token-id][data-selected="true"],.token.selected[data-token-id]');
   if(!el)return null;
   const b=el.getBoundingClientRect();
   return b.width>12&&b.width<500&&b.height>12&&b.height<500?{x:b.left+b.width/2,y:b.top+b.height/2}:null;
 }
 function radialCanvasToken(){
   // Legacy Fabric adapter; explicitly optional because modern Roll20 need not expose it.
   try{
     const canvas=window.d20?.engine?.canvas;
     if(!canvas)return null;
     const objects=canvas.getActiveObjects?.()||[canvas.getActiveObject?.()];
     const o=objects.find(x=>x&&(x.type==='image'||x.model?.get?.('type')==='image'));
     const viewport=canvas.viewportTransform||canvas.getViewportTransform?.()||[1,0,0,1,0,0];
     const base=canvas.upperCanvasEl||document.querySelector('canvas.upper-canvas');
     const center=o?.getCenterPoint?.()||((Number.isFinite(o?.left)&&Number.isFinite(o?.top))?{x:o.left,y:o.top}:null);
     if(!center||!base)return null;
     const rect=base.getBoundingClientRect(),w=canvas.getWidth?.()||base.width,h=canvas.getHeight?.()||base.height;
     const x=rect.left+(center.x*viewport[0]+center.y*viewport[2]+viewport[4])*rect.width/w;
     const y=rect.top+(center.x*viewport[1]+center.y*viewport[3]+viewport[5])*rect.height/h;
     return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
   }catch{return null;}
 }
 function radialPosition(){
   if(!RB.shadow||!RB.state)return;
   const r=RB.radial,auto=radialDomToken()||radialCanvasToken();
   if(auto){r.anchor=auto;r.source='selected';}
   else if(r.manual){r.anchor=r.manual;r.source='manual';}
   else{r.anchor=null;r.source='none';}
   const present=!!r.anchor;
   if(present!==r.lastPresence){r.lastPresence=present;render();}
   const wheel=RB.shadow.querySelector('#rbe-radial-wheel'),tether=RB.shadow.querySelector('#rbe-tether-path');
   if(!wheel||!r.anchor)return;
   // Clamp the full wheel including its footer, not just the SVG.
   const outer=radialOuterRadius(radialTreeRings().length);
   const above=outer+45,below=outer+95;
   const scale=Math.max(.4,Math.min(1,(innerWidth-16)/545,(innerHeight-16)/(above+below)));
   const marginX=260*scale+5;
   const cx=innerWidth<marginX*2?innerWidth/2:Math.max(marginX,Math.min(innerWidth-marginX,r.anchor.x));
   const topLimit=above*scale+7,bottomLimit=below*scale+7;
   const cy=innerHeight<topLimit+bottomLimit?innerHeight/2:
     Math.max(topLimit,Math.min(innerHeight-bottomLimit,r.anchor.y));
   wheel.style.left=cx+'px';wheel.style.top=cy+'px';wheel.style.setProperty('--wheel-scale',String(scale));
   if(tether)tether.setAttribute('d',Math.hypot(cx-r.anchor.x,cy-r.anchor.y)>25?`M ${r.anchor.x} ${r.anchor.y} L ${cx} ${cy}`:'');
 }
 function radialCapturePin(e){
   if(!RB.radial.pin||e.composedPath().includes(RB.root))return;
   const canvas=e.target.closest?.('canvas,.canvas-container,#editor-wrapper,#finalcanvas,.canvas-wrapper');
   if(!canvas)return;
   e.preventDefault();e.stopImmediatePropagation();
   RB.radial.manual={x:e.clientX,y:e.clientY};RB.radial.anchor=RB.radial.manual;
   RB.radial.source='manual';RB.radial.pin=false;RB.radial.open=true;RB.radial.path=[];
   RB.radial.lastPresence=true;render();radialPosition();toast('HUD pinned. Re-pin after panning if the token cannot be tracked.');
 }
 function startRadialTracking(){
   document.addEventListener('pointerdown',radialCapturePin,true);
   window.addEventListener('resize',radialPosition);
   setInterval(()=>{if(document.visibilityState==='visible')radialPosition();},160);
   radialPosition();
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
function sheetUI() {
  const p=profile(),link=p.sheetLink,options=RB.openSheets||[];
  const section=(title,items,description,withRoll=false)=>
    '<div class="card"><h3>'+title+' ('+items.length+')</h3>'+
    (items.length?'<div class="scroll">'+items.map(item=>
      '<div class="list-entry"><div class="row"><strong class="grow">'+html(item.name)+'</strong>'+
      (withRoll&&item.command?button('Roll','runSheetAction','data-id="'+html(item.id)+'"','small primary'):'')+
      '</div><p class="hint">'+html(short(description(item),450))+'</p></div>').join('')+'</div>':
      '<p class="hint">Nothing accessible in the last scan.</p>')+'</div>';
  return '<div class="stack"><div class="card"><h2>Link character sheet</h2>'+
    '<p class="hint">Import accessible character data in one run. Embetterment visits Character Sheet, Bio & Info, Advanced Tools → Attributes, and the available combat/spell sections, then restores the original tabs. Read-only; no rolls or sheet edits.</p>'+
    '<div class="row">'+button('Import all sheet tabs','sheetTourAll','','primary')+button('Find open sheets','scanSheets')+button('② Import visible attributes','syncSheet')+'</div>'+
    '<p id="rbe-sheet-tour-status" role="status" class="hint">'+html(RB.sheetTourStatus||'Ready to import.')+'</p>'+
    (RB.sheetTourWaiting?'<div class="card"><strong>Open your character sheet in Roll20 now</strong><p class="hint">Open Journal → '+html(p.name)+' → Character Sheet. Embetterment will detect the sheet and automatically start importing its available tabs.</p>'+button('Cancel waiting','sheetTourCancel')+'</div>':'')+
    (options.length?'<label class="field">Open sheet<select data-sheet-pick>'+options.map((sheet,i)=>
      '<option value="'+i+'" '+(i===(RB.selectedSheet||0)?'selected':'')+'>'+html(sheet.name)+' · '+int(sheet.readableFields)+' named / '+int(sheet.visibleFields)+' visible</option>').join('')+'</select></label>'+
      '<p class="hint">Found '+options.length+' candidate sheet(s). <strong>'+int(options[RB.selectedSheet||0]?.readableFields)+' named attributes</strong> and <strong>'+int(options[RB.selectedSheet||0]?.visibleFields)+' visible values</strong> detected. Scanning automatically gathers the full scrollable Attributes list behind a frozen view and restores your position. Click <strong>Import visible attributes</strong> to apply the gathered values locally. For attacks and spells not exposed as attributes, switch to Character Sheet → Combat / Spells, then scan again.</p>':
      '<p class="hint">No sheets scanned yet. Click Import all sheet tabs to be prompted to open your character sheet.</p>')+
    '<label><input type="checkbox" data-sheet-auto '+(link?.auto?'checked':'')+'> Refresh while the linked sheet is open (every 12 seconds)</label>'+
    '<p class="hint">Local notes, macros, equipment, and custom spells are preserved. Imports are read-only local copies. Beacon fields only import when their values can be identified confidently.</p></div>'+
    '<div class="card"><h3>Import coverage</h3>'+
    (link?'<strong>'+html(link.name||p.name)+'</strong> <span class="pill">'+html(link.edition||'Sheet')+'</span>'+
      '<p class="hint">Last sync: '+html(link.lastSync?new Date(link.lastSync).toLocaleString():'Never')+
      ' · '+int(link.coverage?.attributes)+' named attributes · '+int(link.coverage?.visibleFields)+' visible values · '+int(link.coverage?.unmapped?.length)+' not mapped</p>'+
      '<div class="row">'+Object.entries(link.counts||{}).map(([k,v])=>'<span class="pill">'+html(k)+' '+int(v)+'</span>').join('')+'</div>'+
      '<p class="hint">Unmapped names: '+html(short((link.coverage?.unmapped||[]).join(', '),700)||'None')+'</p>':
      '<p class="hint">Nothing linked yet.</p>')+
    '<div class="row">'+button('Export named attributes','exportSheetFields')+button('Export scan report','exportSheetReport')+button('Unlink','unlinkSheet')+'</div></div>'+
    '<div class="card"><h3>Attribute JSON fallback</h3><p class="hint">For fields hidden by the 2024 sheet, paste a JSON object of named attributes or an array with name/current/max entries.</p>'+
    '<textarea id="rbe-sheet-json" rows="3" placeholder="Paste sheet attribute JSON here"></textarea>'+
    button('Import pasted attributes','pasteSheet')+'</div>'+
    section('Attacks and actions',p.attacks||[],x=>[x.toHit&&'To hit '+x.toHit,x.damage&&'Damage '+x.damage,x.damageType,x.range,x.description].filter(Boolean).join(' · '),true)+
    section('Class features and feats',p.features||[],x=>[x.source,x.description].filter(Boolean).join(' · '))+
    section('Proficiencies',p.proficiencies||[],x=>x.description||'')+
    section('Tools',p.tools||[],x=>x.description||'')+
    '<div class="card"><h3>Character details</h3>'+
    Object.entries(p.sheetDetails||{}).map(([k,v])=>'<div class="list-entry"><strong>'+html(k.replace(/([A-Z])/g,' $1'))+
      '</strong><p class="hint">'+html(short(v,1200))+'</p></div>').join('')+
    '</div><p class="hint">Spells and slots appear under Spells, equipment under Inventory, HP/resources under Home, and skills/saves under Rolls.</p></div>';
}

function homeUI() {
  const p=profile(),s=p.stats;
  return `<div class="stack"><div class="row between"><h2>${html(p.name)} — Player HUD <span class="pill">${p.sheetLink?'sheet-linked · local copy':'local tracking'}</span></h2>${button('⚙ Profiles','profiles')}</div>
  <div class="card"><div class="row between"><strong>Character-sheet import</strong>${button(p.sheetLink?'View linked sheet':'Import character sheet','tab','data-value="Sheet"','primary')}</div><p class="hint">Open your D&amp;D 5E sheet inside Roll20, then scan and sync from the Sheet tab.</p></div>
  ${RB.state.settings.theme==='bg3'? `<div class="rbe-hero" role="group" aria-label="Adventurer profile"><div class="rbe-hero-seal" aria-hidden="true">✦</div><div class="rbe-hero-copy"><div class="rbe-eyebrow">THE ADVENTURER</div><div class="rbe-hero-name">${html(p.name)}</div><div class="rbe-hero-meta">Level ${int(s.level)} ${html(p.sheetDetails?.class||'Adventurer')}${p.sheetDetails?.race?' · '+html(p.sheetDetails.race):''}</div><span class="pill">${p.sheetLink?'Sheet-linked · read only':'Local character record'}</span></div></div>` : ''}
  <div class="card"><div class="row between"><strong>Hit Points <span class="stat">${int(s.hp)} / ${int(s.maxHp)}</span></strong><span class="hint">Temp: ${int(s.tempHp)} • AC ${int(s.ac)} • Speed ${int(s.speed)} ft</span></div>${progress(s.hp,s.maxHp)}
   <div class="row">${field('Current HP','stats.hp',s.hp,{cls:'narrow'})}${field('Max HP','stats.maxHp',s.maxHp,{cls:'narrow'})}${field('Temp HP','stats.tempHp',s.tempHp,{cls:'narrow'})}${field('AC','stats.ac',s.ac,{cls:'narrow'})}${field('Speed','stats.speed',s.speed,{cls:'narrow'})}</div>
   <div class="row"><input id="rbe-hp-adjust" type="number" value="5" class="mini" min="1" aria-label="HP adjustment">${button('− Damage','damage')} ${button('+ Heal','heal')} ${button('+ Temp HP','addTemp')}</div>
   <p class="hint">HUD HP is a local copy. The Sheet tab can refresh it from Roll20; edits here never write back.</p></div>
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
  const slotOptions = [`<option value="">— Unassigned —</option>`, ...RB.state.macros.map(m=>`<option value="macro:${html(m.id)}">${html(m.name)}</option>`), ...p.spells.map(s=>`<option value="spell:${html(s.id)}">Spell: ${html(s.name)}</option>`), ...((p.attacks||[]).filter(x=>x.command).map(a=>`<option value="attack:${html(a.id)}">Attack: ${html(a.name)}</option>`))].join('');
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
  return p.spells.filter(s=>(s.name+' '+(s.notes||'')).toLowerCase().includes(q)).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)).map(s=>`<div class="list-entry"><div class="row"><strong class="grow">${html(s.name)}</strong><span class="pill">${s.level?'Level '+s.level:'Cantrip'}</span>${s.concentration?'<span class="pill">Concentration</span>':''}${s.origin==='sheet'?'<span class="pill">Sheet</span>':''}${s.prepared?'<span class="pill">Prepared</span>':''}${button('Cast','castSpell',`data-id="${html(s.id)}"`,'small primary')}${button('Edit','editSpell',`data-id="${html(s.id)}"`,'small')}${button('✕','deleteSpell',`data-id="${html(s.id)}"`,'small warn')}</div><p class="hint">${html([s.range,s.castTime,s.duration,s.components,s.school].filter(Boolean).join(' · '))}${s.notes?' • '+html(short(s.notes,140)):''}</p></div>`).join('')||'<p class="hint">No spells yet. Add spells and optionally link their sheet macros.</p>';
}
function inventoryUI() {
  const p=profile(), weight=p.inventory.reduce((acc,x)=>acc+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.weight)||0),0);
  return `<div class="stack"><div class="card"><h2>Inventory <span class="pill">${weight.toFixed(1)} lb</span></h2><div class="row"><label class="field">Item<input id="rbe-item-name" placeholder="Potion of Healing"></label><label class="field narrow">Quantity<input id="rbe-item-qty" type="number" value="1" min="1"></label><label class="field narrow">Weight each (lb)<input id="rbe-item-weight" type="number" value="0" min="0" step="0.1"></label></div><div class="row"><label class="field">Category<input id="rbe-item-cat" value="Gear"></label>${button('+ Add item','addItem','', 'primary')}</div>
   <div class="table-scroll"><table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Wt</th><th></th></tr></thead><tbody>${p.inventory.map(x=>`<tr><td>${html(x.name)} ${x.equipped?'✓':''}</td><td>${html(x.category||'Gear')}</td><td><input class="mini" type="number" min="0" data-item-qty="${html(x.id)}" value="${x.qty}"></td><td>${Number(x.weight||0).toFixed(1)}</td><td>${button('✕','deleteItem',`data-id="${html(x.id)}"`,'small warn')}</td></tr>`).join('')}</tbody></table></div></div>
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
  return `<div class="stack"><div class="card"><h2>Settings</h2><div class="row"><label class="field">Theme<select data-setting="theme"><option value="bg3" ${s.theme==='bg3'?'selected':''}>Baldurian • Dark Fantasy (default)</option><option value="midnight" ${s.theme==='midnight'?'selected':''}>Midnight</option><option value="violet" ${s.theme==='violet'?'selected':''}>Arcane Violet</option><option value="parchment" ${s.theme==='parchment'?'selected':''}>Parchment</option></select></label><label class="field">UI size<select data-setting="scale"><option value="0.85" ${s.scale==.85?'selected':''}>Compact</option><option value="1" ${s.scale==1?'selected':''}>Normal</option><option value="1.15" ${s.scale==1.15?'selected':''}>Large</option></select></label></div>
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
  const tabs=['Home','Sheet','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  return [...tabs.map(t=>({name:'Open '+t,kind:'tab',value:t})),
    ...RB.state.macros.map(m=>({name:'Macro: '+m.name,kind:'macro',value:m.id})),
    ...profile().spells.map(s=>({name:'Spell: '+s.name,kind:'spell',value:s.id})),
    ...(profile().attacks||[]).map(a=>({name:'Attack: '+a.name,kind:'attack',value:a.id})),
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
  const p=profile(), fantasy=RB.state.settings.theme==='bg3';
  if (!RB.state.settings.showBar) return '';
  return `<div id="rbe-bar" aria-label="Quick action bar" title="Click to use a configured Roll20 macro, attack or spell">
    ${fantasy?'<div class="rbe-hotbar-label" aria-hidden="true"><span>⚔</span>Quick<br>Actions</div>':''}
    ${p.macrosSlots.map((v,i)=>{
      const m=v.startsWith('macro:')?RB.state.macros.find(m=>m.id===v.slice(6)):null;
      const sp=v.startsWith('spell:')?p.spells.find(s=>s.id===v.slice(6)):null;
      const a=v.startsWith('attack:')?(p.attacks||[]).find(a=>a.id===v.slice(7)):null;
      const name=m?.name || sp?.name || a?.name || 'Empty';
      const glyph=sp?'✧':a?'⚔':m?'⚄':'◇';
      return `<button class="barslot ${v?'is-filled':'is-empty'}" data-action="slot" data-index="${i}" title="${html(name)}" aria-label="Quick slot ${i+1}: ${html(name)}">${fantasy?`<span class="rbe-slot-glyph" aria-hidden="true">${glyph}</span>`:''}<span class="rbe-slot-title">${html(short(name,15))}</span><span class="index">${i+1}</span></button>`;
    }).join('')}
  </div>`;
}
function hudUI() {
  const p=profile(),s=p.stats;
  if (!RB.state.settings.showHud) return '';
  return `<div id="rbe-hud" title="Personal stat tracker; values may be refreshed from an open character sheet" role="complementary" aria-label="Character status">
    <div class="row between"><strong class="rbe-hud-name">${html(short(p.name,25))}</strong><span class="pill">AC ${int(s.ac)}</span><span class="pill">Temp ${int(s.tempHp)}</span></div>
    ${progress(s.hp,s.maxHp)}
    <div class="row between"><strong>♥ ${int(s.hp)}/${int(s.maxHp)} HP</strong><span class="hint">${p.concentration?'◎ '+html(short(p.concentration,25)):'No concentration'}</span>${button('Open','open','', 'small')}</div>
  </div>`;
}
function themeHeading(tab) {
  const sections={
    Home:['The Adventurer','Character overview and combat resources','♜'],
    Sheet:['Character Archive','Read-only Roll20 sheet linking and import','✥'],
    Rolls:['Dice & Destiny','Ability checks, saving throws and skills','⚄'],
    Macros:['Combat Arsenal','Custom commands and quick action slots','⚔'],
    Spells:['The Spellbook','Prepared magic and spellcasting resources','✧'],
    Inventory:['The Traveller’s Pack','Equipment, coin and carried treasures','◆'],
    Journal:['Chronicle & Quests','Notes, objectives and session history','✎'],
    Chat:['Tavern Whispers','Conversation and rolls within the tabletop','☷'],
    Reference:['Adventurer’s Codex','Rules and battlefield reminders','❖'],
    Settings:['Companion Settings','Theme, profiles, accessibility and privacy','⚙']
  };
  const [title,description,glyph]=sections[tab]||sections.Home;
  return `<div class="rbe-section-heading"><div><h2>${html(title)}</h2><small>${html(description)}</small></div><span class="rbe-section-mark" aria-hidden="true">${glyph}</span></div>`;
}
const THEME_TAB_GLYPHS={Home:'♜',Sheet:'✥',Rolls:'⚄',Macros:'⚔',Spells:'✧',Inventory:'◆',Journal:'✎',Chat:'☷',Reference:'❖',Settings:'⚙'};
function render() {
  if (!RB.shadow || !RB.state) return;
  const s=RB.state.settings; RB.root.style.setProperty('--scale',s.scale); RB.root.setAttribute('data-theme',s.theme); RB.root.setAttribute('data-reduced-motion',String(!!s.reducedMotion));
  const tabs=['Home','Sheet','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  const panels={Home:homeUI,Sheet:sheetUI,Rolls:rollsUI,Macros:macroUI,Spells:spellsUI,Inventory:inventoryUI,Journal:journalUI,Chat:chatUI,Reference:referenceUI,Settings:settingsUI};
  RB.shadow.innerHTML=`<style>${STYLE}${BG3_STYLE}${RADIAL_STYLE}</style>${s.showFab?`<button id="rbe-fab" data-action="toggle" title="roll20 Embetterment — Alt+Shift+E">⚔ R20E</button>`:''}${hudUI()}${barUI()}
  ${RB.visible?`<section id="rbe-panel" role="complementary" aria-label="roll20 Embetterment"><header id="rbe-header">${s.theme==='bg3'?'<span class="rbe-header-crest" aria-hidden="true">✥</span><span class="rbe-header-copy"><strong>roll20 <em>Embetterment</em></strong><span class="rbe-header-sub">Adventurer’s Companion</span></span>':'<strong>⚔ roll20 Embetterment</strong>'}<div class="row">${button('⌕','openPalette','title="Command palette"','small')}${button('—','close','title="Minimize"','small')}</div></header><nav id="rbe-tabs">${tabs.map(t=>`<button data-action="tab" data-value="${t}" class="${t===RB.tab?'active':''}" title="${html(t)}">${s.theme==='bg3'?`<span class="rbe-nav-glyph" aria-hidden="true">${THEME_TAB_GLYPHS[t]}</span><span class="rbe-nav-label">${html(t)}</span>`:html(t)}</button>`).join('')}</nav><div id="rbe-body" data-panel="${html(RB.tab)}">${s.theme==='bg3'?themeHeading(RB.tab):''}${(panels[RB.tab]||homeUI)()}</div></section>`:''}
  ${radialHTML()}${paletteUI()}${modalUI()}<div id="rbe-toast" role="status" hidden></div>`;
  RB.panel=RB.shadow.querySelector('#rbe-panel');
  const u=RB.state.ui;
  if (RB.panel) { RB.panel.style.setProperty('--panel-width',(clamp(u.panelWidth||520,360,920))+'px'); if (Number.isFinite(u.panelX)&&Number.isFinite(u.panelY)) {RB.panel.style.left=u.panelX+'px';RB.panel.style.top=u.panelY+'px';RB.panel.style.right='auto';RB.panel.style.bottom='auto';} }
  if (RB.tab==='Chat' && RB.visible) applyChatFilter();
}

// ===== 25_bg3_theme.js =====
// A self-contained, original BG3-inspired theme; no external images, fonts or network requests.
const BG3_STYLE = String.raw`
/* Original, asset-free dark-fantasy treatment inspired by tabletop RPG interfaces.
   Scoped exclusively to the BG3-inspired theme inside Embetterment's ShadowRoot. */
:host([data-theme="bg3"]) {
  --bg:#171212; --panel:#27201d; --raised:#392c25; --border:#7b6549;
  --text:#f4ead6; --muted:#c4b59b; --accent:#e5c587; --green:#9ac8a0;
  --red:#d87368; --shadow:0 24px 72px #050303e8,0 0 0 1px #090806;
  --gold-dim:#95744b; --wine:#612f36; --inner:#17110f;
  font-family:"Segoe UI",Arial,sans-serif;
  color-scheme:dark;
}
:host([data-theme="bg3"]) #rbe-panel,
:host([data-theme="bg3"]) #rbe-hud,
:host([data-theme="bg3"]) #rbe-bar,
:host([data-theme="bg3"]) #rbe-fab,
:host([data-theme="bg3"]) #rbe-palette .dialog,
:host([data-theme="bg3"]) #rbe-copy-modal .dialog {
  background:radial-gradient(ellipse at 50% -5%,#49352b 0%,transparent 70%),linear-gradient(155deg,#302722,#1a1515 67%,#100e10);
  border:1px solid #a1865f;
  box-shadow:inset 0 0 0 1px #160f0b,inset 0 0 0 4px #a3834740,0 20px 55px #090406df,0 0 25px #ebbb6333;
  color:var(--text);
}
:host([data-theme="bg3"]) #rbe-panel {
  border-radius:9px;
  min-height:340px;
  max-height:min(83vh,850px);
  isolation:isolate;
}
:host([data-theme="bg3"]) #rbe-panel::before,
:host([data-theme="bg3"]) #rbe-panel::after {
  content:"✦";pointer-events:none;position:absolute;z-index:5;color:#f5d69a;
  text-shadow:0 1px 4px #000,0 0 12px #cf944f;font-size:13px;line-height:1;
}
:host([data-theme="bg3"]) #rbe-panel::before{top:3px;left:5px}
:host([data-theme="bg3"]) #rbe-panel::after{top:3px;right:5px}
:host([data-theme="bg3"]) #rbe-header{
  background:linear-gradient(180deg,#533a30 0%,#302322 60%,#241b1b);
  border-bottom:1px solid #ab8b59;
  padding:14px 19px 13px;
  min-height:74px;
  box-shadow:inset 0 -3px 0 #100d0b,0 3px 14px #09060588;
}
:host([data-theme="bg3"]) .rbe-header-crest{
  width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;
  font-family:Georgia,serif;font-size:26px;color:#f4d79c;
  background:radial-gradient(circle,#6d483b,#291d1b 72%);
  border:2px double #bf945c;border-radius:50%;
  box-shadow:inset 0 0 0 3px #2d1a16,0 2px 8px #0c0909;
}
:host([data-theme="bg3"]) .rbe-header-copy{display:flex;flex:1;flex-direction:column;min-width:0;gap:1px}
:host([data-theme="bg3"]) #rbe-header strong{
  font:small-caps 700 1.37em/1.08 Georgia,"Times New Roman",serif;
  letter-spacing:.045em;color:#ffe5ab;
  text-shadow:0 2px 4px #080505;
}
:host([data-theme="bg3"]) #rbe-header strong em{font-style:normal;color:#f2c77a}
:host([data-theme="bg3"]) .rbe-header-sub{font-size:.67em;letter-spacing:.2em;text-transform:uppercase;color:#c2ad88}
:host([data-theme="bg3"]) #rbe-header button{
  min-width:32px;min-height:31px;
  background:linear-gradient(#4b3a2d,#2b221f);
  border:1px solid #957a51;
}
:host([data-theme="bg3"]) #rbe-tabs{
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;
  padding:11px 12px 10px;overflow:visible;
  border-bottom:1px solid #886942;
  background:linear-gradient(180deg,#1c1717,#29201d);
  box-shadow:inset 0 -3px 0 #110d0c;
}
:host([data-theme="bg3"]) #rbe-tabs button{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  min-width:0;min-height:45px;padding:5px 2px;
  border:1px solid #594431;border-bottom:2px solid #4f3c2b;border-radius:3px;
  background:linear-gradient(#342923,#241c19);color:#cbbca3;
  font-family:Georgia,serif;font-size:.81em;letter-spacing:.01em;
  white-space:normal;overflow-wrap:anywhere;line-height:1.1;
}
:host([data-theme="bg3"]) #rbe-tabs .rbe-nav-glyph{
  display:block;font-family:Georgia,serif;font-size:1.4em;
  color:#bca17b;line-height:1.05;
}
:host([data-theme="bg3"]) #rbe-tabs button:is(:hover,:focus-visible),
:host([data-theme="bg3"]) #rbe-tabs button.active{
  color:#ffe9c2;border-color:#ccaa6a;border-bottom-color:#eec583;
  background:radial-gradient(ellipse at top,#6d4835,#34231f 90%);
  box-shadow:inset 0 0 11px #d9a56338,0 0 8px #e9bc6533;
}
:host([data-theme="bg3"]) #rbe-tabs button.active .rbe-nav-glyph{color:#f6d38c}
:host([data-theme="bg3"]) #rbe-body{
  position:relative;flex:1;min-height:155px;
  background:repeating-linear-gradient(112deg,#4b34270a 0,#4b34270a 2px,transparent 2px,transparent 8px),
    radial-gradient(ellipse at 50% 0,#46322755,transparent 65%);
  padding:17px 18px 20px;scrollbar-width:thin;scrollbar-color:#8b704b #211a17;
}
:host([data-theme="bg3"]) #rbe-body::before{
  content:"";position:sticky;display:block;top:-17px;margin:-17px -8px 12px;height:4px;
  background:linear-gradient(90deg,transparent,#b38f5788,transparent);pointer-events:none;
}
:host([data-theme="bg3"]) .rbe-section-heading{
  display:flex;justify-content:space-between;align-items:end;gap:10px;
  border-bottom:1px solid #7a6142;
  padding:4px 0 13px;margin-bottom:14px;position:relative;
}
:host([data-theme="bg3"]) .rbe-section-heading::after{
  content:"✦";position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);
  background:#261d1a;padding:0 7px;color:#e1bb7d;font-size:12px;
}
:host([data-theme="bg3"]) .rbe-section-heading h2{
  color:#f3d49b;font:small-caps 700 1.35em/1.2 Georgia,serif;
  letter-spacing:.085em;margin:0;
}
:host([data-theme="bg3"]) .rbe-section-heading small{
  display:block;margin-top:2px;font-size:.76em;color:#c0af98;letter-spacing:.04em;
}
:host([data-theme="bg3"]) .rbe-section-heading .rbe-section-mark{font:23px/1 Georgia,serif;color:#c8a66d}
:host([data-theme="bg3"]) h2,
:host([data-theme="bg3"]) h3{font-family:Georgia,"Times New Roman",serif;font-variant:small-caps;letter-spacing:.05em}
:host([data-theme="bg3"]) h2{color:#f9dca3;font-size:1.28em}
:host([data-theme="bg3"]) h3{color:#edcb90;font-size:1.05em;margin-bottom:10px}
:host([data-theme="bg3"]) .card{
  position:relative;
  background:linear-gradient(135deg,#392920ad,#281e1cee 48%,#1b1616ec);
  border:1px solid #765b3d;border-radius:5px;padding:15px 14px;
  box-shadow:inset 0 0 0 1px #0c0a09,inset 0 0 18px #2a120622,0 3px 10px #0a07064f;
}
:host([data-theme="bg3"]) .card::before{
  content:"";position:absolute;left:8px;right:8px;top:3px;height:1px;
  background:linear-gradient(90deg,transparent,#d9aa645b,transparent);
  pointer-events:none;
}
:host([data-theme="bg3"]) .stack{gap:11px}
:host([data-theme="bg3"]) .grid{gap:9px}
:host([data-theme="bg3"]) .list-entry{
  padding:10px 9px;border-top:1px solid #69533e;
  background:linear-gradient(90deg,#9d724d0c,transparent);
}
:host([data-theme="bg3"]) .list-entry:first-child{border-top:0}
:host([data-theme="bg3"]) .hint,
:host([data-theme="bg3"]) .muted,
:host([data-theme="bg3"]) label{color:#c5b8a0}
:host([data-theme="bg3"]) .stat,
:host([data-theme="bg3"]) .key{color:#f3cd8c}
:host([data-theme="bg3"]) .pill{
  display:inline-flex;align-items:center;gap:4px;
  border-radius:4px;border:1px solid #967647;background:linear-gradient(#493626,#30241e);
  color:#ead7af;font-size:.78em;padding:3px 8px;letter-spacing:.035em;
}
:host([data-theme="bg3"]) button{
  background:linear-gradient(#534031,#30251f);
  border:1px solid #997d54;border-radius:4px;
  color:#f3e5c9;box-shadow:inset 0 1px #f7d5a21b,0 2px 3px #08070666;
  text-shadow:0 1px #140e0b;
  transition:background-color .16s,border-color .16s,box-shadow .16s,transform .16s;
}
:host([data-theme="bg3"]) button:hover{
  background:linear-gradient(#725139,#42302a);border-color:#edc17d;
  box-shadow:inset 0 1px #ffe3a53d,0 0 8px #d19a4844;filter:none;
}
:host([data-theme="bg3"]) button:active{transform:translateY(1px)}
:host([data-theme="bg3"]) button.primary{
  background:linear-gradient(#efd49a,#b58a4b);
  border-color:#f9e1a7;color:#291a12;text-shadow:none;font-weight:700;
}
:host([data-theme="bg3"]) button.primary:hover{background:linear-gradient(#ffe7b0,#ce9b51)}
:host([data-theme="bg3"]) button.on{
  background:linear-gradient(#305d4c,#243b35);border-color:#87c6a1;
}
:host([data-theme="bg3"]) button.warn{color:#f2aea4}
:host([data-theme="bg3"]) :is(input,textarea,select){
  background:linear-gradient(180deg,#171210,#251b18);border:1px solid #826849;
  color:#fff0d3;border-radius:4px;accent-color:#cda266;
}
:host([data-theme="bg3"]) :is(input,textarea,select)::placeholder{color:#aa997f}
:host([data-theme="bg3"]) :is(input,textarea,select,button):focus-visible{
  outline:2px solid #ffe0a1;outline-offset:2px;
}
:host([data-theme="bg3"]) select option{background:#241c19;color:#f4e8d1}
:host([data-theme="bg3"]) :is(input,textarea)[readonly]{opacity:.9}
:host([data-theme="bg3"]) .table-scroll{border:1px solid #684f35;border-radius:4px}
:host([data-theme="bg3"]) .table-scroll th{
  background:#392a23;color:#f2d09a;font-family:Georgia,serif;font-variant:small-caps;
  letter-spacing:.05em;padding:10px 8px;
}
:host([data-theme="bg3"]) .table-scroll td{
  padding:9px 7px;background:#221a19aa;border-color:#624e3b;
}
:host([data-theme="bg3"]) .table-scroll tbody tr:nth-child(even) td{background:#33251f9a}
:host([data-theme="bg3"]) .note{
  border:1px solid #715538;border-left:3px solid #b68a51;
  background:linear-gradient(90deg,#473122,#231c18);border-radius:3px;
  color:#e6d7bb;
}
:host([data-theme="bg3"]) .rbe-hero{
  display:flex;align-items:center;gap:15px;padding:17px;
  border:1px solid #bd925c;border-radius:6px;
  background:radial-gradient(circle at 15% 50%,#75483b64,transparent 50%),linear-gradient(135deg,#45332b,#1c1717);
  box-shadow:inset 0 0 0 2px #221813,0 3px 15px #070506aa;
}
:host([data-theme="bg3"]) .rbe-hero-seal{
  flex:0 0 62px;width:62px;height:62px;display:grid;place-items:center;
  border:2px solid #caa26c;border-radius:50%;
  background:radial-gradient(#6f4a34,#251a19 75%);
  color:#ffe1a3;font:35px Georgia,serif;
  box-shadow:inset 0 0 0 4px #493120,0 0 12px #9b64394d;
}
:host([data-theme="bg3"]) .rbe-hero-copy{min-width:0;flex:1}
:host([data-theme="bg3"]) .rbe-eyebrow{
  color:#d1ae77;letter-spacing:.23em;text-transform:uppercase;font-size:.72em;font-weight:650;
}
:host([data-theme="bg3"]) .rbe-hero-name{
  color:#ffe1ae;font:small-caps 700 1.58em Georgia,serif;
  letter-spacing:.035em;margin:1px 0 4px;overflow-wrap:anywhere;
}
:host([data-theme="bg3"]) .rbe-hero-meta{font-size:.82em;color:#decaa6;line-height:1.4}
:host([data-theme="bg3"]) .rbe-hero .pill{margin-top:4px}
:host([data-theme="bg3"]) #rbe-hud{
  border-radius:7px;max-width:min(340px,calc(100vw - 24px));min-width:230px;padding:11px 13px;
}
:host([data-theme="bg3"]) #rbe-hud .rbe-hud-name{font:small-caps 700 1.15em Georgia,serif;color:#f9d798}
:host([data-theme="bg3"]) #rbe-hud .hpbar{
  height:11px;background:#170e12;border:1px solid #8b5a49;border-radius:3px;overflow:hidden;
}
:host([data-theme="bg3"]) #rbe-hud .hpbar>span{
  background:linear-gradient(180deg,#ee9788,#aa343e);
  box-shadow:inset 0 2px 2px #ffb5a766,0 0 8px #9d343688;
}
:host([data-theme="bg3"]) #rbe-bar{
  border-radius:8px;align-items:stretch;gap:5px;padding:8px 10px;
  max-width:calc(100vw - 115px);
}
:host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label{
  width:61px;min-width:61px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font:small-caps 700 .79em Georgia,serif;letter-spacing:.07em;color:#e0bd80;
  border-right:1px solid #9c7950;padding-right:8px;margin-right:3px;
}
:host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label span{font-size:2em;line-height:1.2}
:host([data-theme="bg3"]) #rbe-bar .barslot{
  min-width:59px;max-width:102px;display:flex;align-items:center;
  flex-direction:column;justify-content:center;gap:2px;
  border:1px solid #bd925e;border-bottom:3px solid #7a5034;border-radius:4px;
  padding:6px 5px 4px;background:radial-gradient(ellipse at top,#534031,#241c1b);
}
:host([data-theme="bg3"]) #rbe-bar .barslot.is-empty{opacity:.62}
:host([data-theme="bg3"]) #rbe-bar .rbe-slot-glyph{font:25px/1 Georgia,serif;color:#efd39e;text-shadow:0 0 7px #e4b77d52}
:host([data-theme="bg3"]) #rbe-bar .rbe-slot-title{font-size:.75em;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
:host([data-theme="bg3"]) #rbe-bar .barslot .index{
  border-radius:3px;background:#190f12;padding:0 4px;font:700 .7em monospace;color:#e8c389;
}
:host([data-theme="bg3"]) #rbe-fab{
  font:small-caps 700 1.07em Georgia,serif;letter-spacing:.04em;border-radius:50%;
  width:58px;height:58px;padding:5px;display:grid;place-items:center;
}
:host([data-theme="bg3"]) #rbe-palette,
:host([data-theme="bg3"]) #rbe-copy-modal{background:#080609c9;backdrop-filter:blur(3px)}
:host([data-theme="bg3"]) :is(#rbe-palette,#rbe-copy-modal) .dialog{
  border-radius:7px;padding:18px 20px;
}
:host([data-theme="bg3"]) #rbe-toast{
  border:1px solid #d6ad77;border-radius:6px;background:#33241f;
  color:#ffe5b8;box-shadow:0 8px 25px #080405;
}
@media(max-width:680px){
  :host([data-theme="bg3"]) #rbe-panel{max-height:79vh;min-height:220px}
  :host([data-theme="bg3"]) #rbe-header{padding:11px 13px;min-height:62px}
  :host([data-theme="bg3"]) #rbe-header strong{font-size:1.05em}
  :host([data-theme="bg3"]) .rbe-header-crest{width:34px;height:34px;flex-basis:34px;font-size:20px}
  :host([data-theme="bg3"]) #rbe-tabs{padding:7px 6px;gap:3px}
  :host([data-theme="bg3"]) #rbe-tabs button{font-size:.71em;min-height:39px;padding:3px 1px}
  :host([data-theme="bg3"]) #rbe-body{padding:12px 10px}
  :host([data-theme="bg3"]) .rbe-hero{gap:9px;padding:11px}
  :host([data-theme="bg3"]) .rbe-hero-seal{width:43px;height:43px;flex-basis:43px;font-size:24px}
  :host([data-theme="bg3"]) .rbe-hero-name{font-size:1.2em}
  :host([data-theme="bg3"]) #rbe-bar{max-width:calc(100vw - 75px)}
  :host([data-theme="bg3"]) #rbe-bar .rbe-hotbar-label{display:none}
  :host([data-theme="bg3"]) #rbe-bar .barslot{min-width:54px}
}
@media(prefers-reduced-motion:reduce){
  :host([data-theme="bg3"]) *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}

/* Distinctive panel treatments keep spellbooks, inventory and journals legible. */
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .list-entry{
  position:relative;padding:12px 10px 12px 35px;
  border:1px solid #5d4d62;margin:7px 0;border-radius:4px;
  background:linear-gradient(110deg,#352c43aa,#251c25dd);
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .list-entry::before{
  content:"✧";position:absolute;left:10px;top:12px;color:#b9a7f7;
  font:21px Georgia,serif;text-shadow:0 0 7px #9278f7;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] #rbe-spell-results .pill{
  border-color:#807098;background:#322b46;color:#e5d8fc;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] [data-slot-max],
:host([data-theme="bg3"]) #rbe-body[data-panel="Spells"] [data-slot-used]{
  background:radial-gradient(#3b2c49,#221b25);border-color:#8d759d;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll{
  border:2px ridge #a17f4b;background:#241c16;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll tbody tr:hover td{
  background:#50372a;color:#fff1cc;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .table-scroll td:first-child{
  color:#f5d69d;font-family:Georgia,serif;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Inventory"] .card:last-child .field{
  position:relative;padding:4px 6px;border:1px solid #715630;
  background:#30231ac9;border-radius:3px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] #rbe-notes{
  color:#30251e;
  background:repeating-linear-gradient(transparent 0,transparent 27px,#806b4933 28px),
    linear-gradient(110deg,#bca98c,#ecdebe 15%,#e2d3ae 96%);
  border:2px solid #b69866;
  line-height:28px;padding:13px 17px;min-height:190px;
  box-shadow:inset 6px 0 8px #94795655,inset 0 0 17px #806f5433;
  font-family:Georgia,"Times New Roman",serif;font-size:1.02em;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] #rbe-notes::placeholder{
  color:#78664e;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Journal"] .list-entry{
  border-left:2px solid #bb9667;
  padding-left:12px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] .card:first-of-type{
  border-color:#c09a5f;box-shadow:inset 0 0 0 1px #1a100c,0 0 13px #b58d4d24;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="scanSheets"],
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="syncSheet"]{
  min-height:34px;font-family:Georgia,serif;letter-spacing:.02em;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Rolls"] [data-action="adv"].on{
  background:linear-gradient(#58734b,#2d4735);border-color:#afc38b;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Rolls"] .table-scroll th:first-child,
:host([data-theme="bg3"]) #rbe-body[data-panel="Macros"] #rbe-macro-results strong{
  color:#eed19a;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Chat"] #rbe-chat-message{
  border-left:3px solid #be9a63;min-height:95px;
}
:host([data-theme="bg3"]) #rbe-body[data-panel="Settings"] .card label{
  line-height:1.6;
}
:host([data-theme="bg3"]) :is(#rbe-palette,#rbe-copy-modal) .dialog h3,
:host([data-theme="bg3"]) #rbe-palette strong{
  color:#f6d69e;font:small-caps 700 1.25em Georgia,serif;
}
:host([data-theme="bg3"]) #rbe-palette .palette-choice.on{
  border-color:#ead099;background:#534132;
}

/* Screenshot-driven readability adjustment, especially beside a 2024 character sheet. */
:host([data-theme="bg3"]) #rbe-panel{
  font-size:calc(15px * var(--scale,1));line-height:1.5;
}
:host([data-theme="bg3"]) #rbe-body .hint{
  font-size:.94em;line-height:1.53;color:#d0c2aa;
}
:host([data-theme="bg3"]) #rbe-body .card p{line-height:1.56}
:host([data-theme="bg3"]) #rbe-body .card{padding:16px 15px}
:host([data-theme="bg3"]) #rbe-body .card button{white-space:normal}
:host([data-theme="bg3"]) #rbe-body select,
:host([data-theme="bg3"]) #rbe-body input,
:host([data-theme="bg3"]) #rbe-body textarea{font-size:1em}
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="scanSheets"],
:host([data-theme="bg3"]) #rbe-body[data-panel="Sheet"] [data-action="syncSheet"]{
  min-height:39px;
}
`;

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
    case 'radialPick':radialPick(int(el.dataset.depth),int(el.dataset.index));break;
    case 'radialBack':RB.radial.path.pop();render();radialPosition();break;
    case 'radialHome':RB.radial.path=[];render();radialPosition();break;
    case 'radialPin':RB.radial.pin=true;toast('Click the center of your token on the tabletop.');break;
    case 'radialPanel':RB.tab='Sheet';RB.state.ui.lastTab='Sheet';RB.visible=true;render();break;
    case 'radialToggle':RB.radial.open=!RB.radial.open;RB.radial.path=[];render();radialPosition();break;
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
    case 'scanSheets':scanSheets();if(!RB.openSheets?.length)sheetTourPromptOpen();break;
    case 'sheetTourAll':sheetTourStart();break;
    case 'sheetTourCancel':sheetTourCancel();break;
    case 'syncSheet':syncSheetDeep();break;
    case 'unlinkSheet':if(confirm('Stop syncing? Imported entries remain until deleted.')){p.sheetLink=null;RB.sheetSignature=null;changedProfile();}break;
    case 'pasteSheet':{
      try{const snap=parseSheetPaste(getText('sheet-json'));if(!snap.coverage.attributes)throw Error('No named attributes found');
        applySheetSnapshot(p,snap);p.sheetLink.auto=false;RB.sheetSignature=null;changedProfile();
        toast('Imported '+snap.coverage.attributes+' pasted attributes.');
      }catch(err){toast('Invalid sheet JSON: '+err.message);}break;
    }
    case 'exportSheetFields':{
      const found=RB.openSheets?.[RB.selectedSheet||0];
      if(!found){toast('Scan an open sheet first.');break;}
      downloadText('roll20-visible-sheet-attributes.json',JSON.stringify(found.frame?RB.sheetWarm?.scan?.fields||{}:readSheetFields(found.root),null,2),'application/json');break;
    }
    case 'exportSheetReport':{
      const found=RB.openSheets?.[RB.selectedSheet||0];
      if(!found){toast('Scan an open character sheet first.');break;}
      const named=found.frame?RB.sheetWarm?.scan?.fields||{}:readSheetFields(found.root),visible=found.frame?RB.sheetWarm?.scan?.visible||beaconImportVisible({innerText:''},found.name):beaconImportVisible(found.root,found.name);
      // User-triggered local file only; never upload or automatically transmit.
      downloadText('roll20-embetterment-local-sheet-scan.json',JSON.stringify({
        guide:'Contains sheet text visible to you, including character details. Review before sharing.',
        character:found.name,
        namedAttributeNames:Object.keys(named),
        visibleSections:visible.coverage.sections,
        visibleFieldNames:visible.coverage.names,
        extracted:{stats:visible.stats,abilityScores:visible.abilityScores,
          abilityMods:visible.abilityMods,saveBonuses:visible.saveBonuses,
          skillBonuses:visible.skillBonuses,resources:visible.resources,attacks:visible.attacks},
        renderedText:beaconVisibleText(found.root).slice(0,18000)
      },null,2),'application/json');break;
    }
    case 'runSheetAction':{
      const chosen=(p.attacks||[]).find(x=>x.id===id);
      if(chosen?.command)sendToRoll20(chosen.command);
      else toast('No accessible Roll20 attack button. Roll from the original character sheet.');break;
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
    case 'switchProfile':RB.state.current=getInput('profile-select').value;RB.editSpell=null;RB.editMacro=null;RB.openSheets=[];RB.sheetSignature=null;changedProfile();break;
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
  else if(kind==='attack'){const a=(profile().attacks||[]).find(x=>x.id===id);if(a?.command)sendToRoll20(a.command);else toast('Sheet action button unavailable.');}
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
  else if(el.matches('[data-sheet-pick]')){RB.selectedSheet=clamp(el.value,0,Math.max(0,(RB.openSheets||[]).length-1));RB.sheetSignature=null;save();render();}
  else if(el.matches('[data-sheet-auto]')){p.sheetLink=p.sheetLink||{name:p.name};p.sheetLink.auto=el.checked;save();render();}
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
// Roll20 shortcuts are registered outside this ShadowRoot. Stop keyboard
// events at the ShadowRoot, after inputs receive them, so Roll20 cannot treat
// B, V, Z and other typed keys as tabletop commands. Never preventDefault.
function keepEmbettermentKeysLocal(e) { e.stopPropagation(); }
function onKeyDown(e) {
  if(e.key==='Escape' && RB.radial?.path?.length){RB.radial.path.pop();render();radialPosition();return;}
  if(e.key==='Escape' && (RB.paletteOpen||RB.modal)){RB.paletteOpen=false;RB.modal=null;render();return;}
  const origin=e.composedPath?.()[0] || e.target;
  const editing=origin?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  const insideEmbetterment=e.composedPath?.().includes(RB.root) || false;
  if(!editing&&e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyR'){e.preventDefault();RB.radial.open=!RB.radial.open;render();radialPosition();return;}
  if(insideEmbetterment&&['Enter',' '].includes(e.key)&&origin?.dataset?.action==='radialPick'){e.preventDefault();radialPick(int(origin.dataset.depth),int(origin.dataset.index));return;}
  if(!editing&&e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyE'){
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
  if(!editing&&!insideEmbetterment&&RB.state.settings.hotkeys&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey && /^Digit[1-8]$/.test(e.code)){
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
  for (const type of ['keydown','keypress','keyup']) RB.shadow.addEventListener(type,keepEmbettermentKeysLocal);
  RB.shadow.addEventListener('pointerdown',onDragStart);
  window.addEventListener('pointermove',onPointerMove);
  window.addEventListener('pointerup',onPointerUp);
  document.addEventListener('keydown',onKeyDown,true);
  window.addEventListener('beforeunload',save);
  startBeaconParentBridge();
  setInterval(sheetAutoTick,12000);
  RB.visible=!!RB.state.settings.alwaysOpen;render();startRadialTracking();
}
// Never install the combat HUD inside the external character-sheet iframe.
const rbeStartup=isBeaconFrame()?startBeaconFrameReader:isRoll20Editor()?boot:null;
if(rbeStartup){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rbeStartup,{once:true});
  else rbeStartup();
}
})();