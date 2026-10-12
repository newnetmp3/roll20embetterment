// Opt-in background importer for a character the player can already open.
// Never fetch privileged data, synthesize character records, or scan other sheets.
const R3_AUTO={
  enabled:false,name:'',characterId:'',running:false,active:false,opened:false,openedAt:0,
  lastScan:0,lastFull:0,lastOpenAttempt:0,lastError:'',timer:null,healthTimer:null,
  healthRunning:false,lastHealth:0,generation:0,preOpenDialogs:null,
  ownedDialog:null,originalPosition:null
};
function r3AutoKey(){return r3StorageKey()+':auto';}
function r3AutoLoad(){
  try{
    const stored=JSON.parse(localStorage.getItem(r3AutoKey())||'null');
    if(stored?.enabled&&typeof stored.name==='string'&&stored.name.length<120){
      R3_AUTO.enabled=true;R3_AUTO.name=stored.name;
      R3_AUTO.characterId=r3String(stored.characterId,100);
    }
  }catch{}
}
function r3AutoSave(){
  try{localStorage.setItem(r3AutoKey(),JSON.stringify({
    enabled:R3_AUTO.enabled,name:R3_AUTO.name,characterId:R3_AUTO.characterId
  }));}catch{}
}
function r3AutoDisplay(message){
  // Routine UI refreshes must not erase a useful "journal not loaded" status.
  if(message!==undefined)R3_AUTO.lastError=message||'';
  const status=R3_UI.root?.getElementById('r3-auto-status');
  if(status)status.textContent=R3_AUTO.enabled?
    ('Auto-sync: '+(R3_AUTO.lastError||'watching for your character sheet')):'Auto-sync is off';
  const toggle=R3_UI.root?.getElementById('r3-auto');
  if(toggle)toggle.textContent=R3_AUTO.enabled?'Auto-sync: On':'Auto-sync: Off';
}
function r3AutoDialogFor(candidate){
  return candidate?.frame?.closest?.('.characterdialog[data-characterid],.characterdialog')||null;
}
function r3AutoId(candidate){
  return r3String(candidate?.characterId||r3AutoDialogFor(candidate)?.getAttribute?.('data-characterid'),100);
}
function r3AutoCandidate(){
  const choices=r3Candidates().filter(c=>c.type==='iframe'&&c.visible);
  // An explicit, conflicting character ID is never overridden by a name
  // match. Duplicate names without a stable ID are ambiguous: fail closed.
  const eligible=choices.filter(c=>!R3_AUTO.characterId||!r3AutoId(c)||
    r3AutoId(c)===R3_AUTO.characterId);
  const named=eligible.filter(c=>r3String(c.name,120).toLowerCase()===R3_AUTO.name.toLowerCase());
  if(R3_AUTO.characterId){
    const exact=eligible.filter(c=>r3AutoId(c)===R3_AUTO.characterId);
    if(exact.length===1)return exact[0];
    if(exact.length>1)return null;
  }
  return named.length===1?named[0]:null;
}
function r3AutoRemember(candidate){
  const charId=r3AutoId(candidate);
  if(charId&&!R3_AUTO.characterId){
    R3_AUTO.characterId=charId;r3AutoSave();
  }
}
function r3AutoJournalEntry(){
  // Only journal entries, never chat messages, roll cards or dialog buttons.
  const found=Array.from(document.querySelectorAll(
    '#journal [data-characterid],#journal [data-itemid],#journal .character,'+
    '#journal [data-id],.journalitem[data-characterid],.journalitem[data-itemid]'
  )||[]).slice(0,500);
  const id=R3_AUTO.characterId,name=R3_AUTO.name.toLowerCase();
  if(id){
    const exact=found.find(el=>[el.getAttribute?.('data-characterid'),
      el.getAttribute?.('data-itemid'),el.getAttribute?.('data-id')]
      .some(v=>v===id));
    if(exact)return exact;
  }
  const matches=found.filter(el=>{
    const title=r3String(el.getAttribute?.('title')||
      el.getAttribute?.('aria-label')||el.querySelector?.('.name,.journalitem-name')?.textContent||
      el.textContent,120).toLowerCase();
    return title===name;
  });
  return matches.length===1?matches[0]:null;
}
function r3AutoOpenFromJournal(now){
  if(R3_AUTO.opened&&now-R3_AUTO.openedAt<30000)return false;
  if(R3_AUTO.opened){
    R3_AUTO.opened=false;
    r3AutoDisplay('Roll20 did not expose the requested sheet; open its Journal entry manually if needed.');
  }
  if(now-R3_AUTO.lastOpenAttempt<60000)return false;
  R3_AUTO.lastOpenAttempt=now;
  const entry=r3AutoJournalEntry();
  if(!entry){
    r3AutoDisplay('Waiting for a matching journal entry. If Roll20 has not loaded the Journal, open its sidebar tab once.');
    return false;
  }
  // Roll20's normal double-click is the only supported open action here.
  // Do not clone the generic headless iframe: its URL has no character ID,
  // and cloning it cannot supply Roll20's official character handshake.
  try{
    // Only a dialog CREATED by this request may be moved offscreen.
    R3_AUTO.preOpenDialogs=new Set(document.querySelectorAll('.characterdialog')||[]);
    entry.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
    R3_AUTO.opened=true;R3_AUTO.openedAt=Date.now();
    r3AutoDisplay('Requested character sheet from the Roll20 journal; waiting for it to load');
    return true;
  }catch(e){
    r3AutoDisplay('Journal entry could not be opened automatically: '+r3String(e?.message||e,130));
    return false;
  }
}
function r3AutoMoveOffscreen(candidate){
  const dialog=r3AutoDialogFor(candidate);
  if(!dialog)return false;
  // The 30s check only applies to claiming a newly opened dialog.
  // A dialog already owned by auto-sync remains a background reader for
  // later five-minute full scans until the feature is turned off.
  if(R3_AUTO.ownedDialog===dialog)return true;
  if(R3_AUTO.preOpenDialogs?.has(dialog))return false;
  if(!R3_AUTO.opened||Date.now()-R3_AUTO.openedAt>30000){
    R3_AUTO.opened=false;return false;
  }
  // Preserve layout/rendering rather than display:none (which would prevent
  // Vue controls from mounting and being imported). Only move a dialog the
  // script itself asked the journal to open, never a player-opened dialog.
  R3_AUTO.ownedDialog=dialog;
  R3_AUTO.originalPosition={left:dialog.style.left,top:dialog.style.top,
    position:dialog.style.position};
  dialog.style.position='fixed';
  dialog.style.left='-20000px';
  dialog.style.top='-20000px';
  return true;
}
function r3AutoRestoreDialog(){
  if(R3_AUTO.ownedDialog?.style&&R3_AUTO.originalPosition){
    const d=R3_AUTO.ownedDialog.style,p=R3_AUTO.originalPosition;
    d.left=p.left;d.top=p.top;d.position=p.position;
  }
  R3_AUTO.ownedDialog=null;R3_AUTO.originalPosition=null;
  R3_AUTO.opened=false;R3_AUTO.openedAt=0;R3_AUTO.preOpenDialogs=null;
}
function r3AutoSignature(s){
  return JSON.stringify([s.name,s.stats,s.abilities,s.modifiers,s.saves,s.skills,s.slots,
    s.spells,s.attacks,s.inventory,s.features,s.resources]);
}
function r3AutoCombine(prev,current){
  if(!prev||r3String(prev.name).toLowerCase()!==r3String(current.name).toLowerCase())
    return r3Coverage(current);
  // Current-view scans refresh only fields they genuinely observed; don't
  // erase saved inventory/spells/features because their tabs were not visited.
  const merged={...prev,capturedAt:current.capturedAt,stats:{...prev.stats,...current.stats},
    abilities:{...prev.abilities,...current.abilities},modifiers:{...prev.modifiers,...current.modifiers},
    saves:{...prev.saves,...current.saves},skills:{...prev.skills,...current.skills},
    slots:{...prev.slots,...current.slots},provenance:{...prev.provenance,...current.provenance}};
  for(const kind of ['resources','attacks','spells','inventory','features']){
    const indexed=new Map((prev[kind]||[]).map(item=>[item._key||item.name,item]));
    for(const entry of current[kind]||[])indexed.set(entry._key||entry.name,entry);
    merged[kind]=[...indexed.values()];
  }
  // Keep bounded observations from the last full import, not every poll.
  return r3Coverage(merged);
}
function r3AutoStoreSnapshot(snapshot,mode){
  const candidateName=r3String(snapshot?.name,120);
  if(snapshot?.schema!==3||candidateName.toLowerCase()!==R3_AUTO.name.toLowerCase())
    throw new Error('Sheet identity did not match the auto-sync character');
  if(!snapshot.stats||Object.keys(snapshot.stats).length===0)
    throw new Error('Sheet has not populated its character values yet');
  // A partial scan cannot erase the full inventory, spells and actions.
  const next=mode==='all'?snapshot:r3AutoCombine(R3_UI.snapshot,snapshot);
  if(r3AutoSignature(R3_UI.snapshot||{})!==r3AutoSignature(next)){
    R3_UI.snapshot=r3Coverage(next);r3Save(R3_UI.snapshot);
    r3UIRefresh();
  }
}
async function r3AutoTick(){
  if(!R3_AUTO.enabled||R3_AUTO.running||R3_UI.busy||!R3_AUTO.name)return;
  const now=Date.now();
  const candidate=r3AutoCandidate();
  if(!candidate){
    r3AutoOpenFromJournal(now);
    return;
  }
  r3AutoRemember(candidate);
  const background=r3AutoMoveOffscreen(candidate);
  // Only navigate sheet tabs when the script itself opened an offscreen
  // dialog. A player-opened visible sheet is read without changing tabs.
  const mode=background&&now-R3_AUTO.lastFull>300000?'all':'current';
  if(now-R3_AUTO.lastScan<(mode==='all'?10000:30000))return;
  R3_AUTO.running=true;
  const generation=R3_AUTO.generation;
  r3UIRefresh();
  try{
    const snapshot=await r3SendScan(candidate,mode);
    // A disabled auto-sync must never publish a late response.
    if(!R3_AUTO.enabled||R3_AUTO.generation!==generation)return;
    r3AutoStoreSnapshot(snapshot,mode);
    R3_AUTO.lastScan=Date.now();
    if(mode==='all')R3_AUTO.lastFull=R3_AUTO.lastScan;
    r3AutoDisplay((background?'Background':'Visible sheet')+' '+mode+
      ' import updated '+new Date(R3_AUTO.lastScan).toLocaleTimeString());
  }catch(e){
    R3_AUTO.lastScan=Date.now();
    if(R3_AUTO.enabled)r3AutoDisplay('Waiting: '+r3String(e?.message||e,170));
  }finally{R3_AUTO.running=false;r3UIRefresh();}
}

function r3AutoStoreHealth(snapshot){
  if(snapshot?.schema!==3||r3String(snapshot.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())
    return false;
  if(!Object.prototype.hasOwnProperty.call(snapshot.stats||{},'hp'))return false;
  const prior=R3_UI.snapshot;
  if(!prior||r3String(prior.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())return false;
  const keys=['hp','maxHp','tempHp'],nextStats={...prior.stats},nextSources={...prior.provenance};
  let changed=false;
  for(const key of keys){
    if(!Object.prototype.hasOwnProperty.call(snapshot.stats,key))continue;
    if(nextStats[key]!==snapshot.stats[key]){
      nextStats[key]=snapshot.stats[key];changed=true;
      nextSources['stats.'+key]=snapshot.provenance?.['stats.'+key];
    }
  }
  if(!changed)return false;
  R3_UI.snapshot=r3Coverage({...prior,stats:nextStats,provenance:nextSources,
    capturedAt:snapshot.capturedAt});
  r3Save(R3_UI.snapshot);r3UIRefresh();
  r3AutoDisplay('HP '+nextStats.hp+(nextStats.maxHp!==undefined?'/'+nextStats.maxHp:'')+
    ' updated '+new Date().toLocaleTimeString());
  return true;
}
async function r3AutoHealthTick(){
  if(!R3_AUTO.enabled||!R3_AUTO.name||R3_AUTO.healthRunning||R3_AUTO.running||R3_UI.busy)return;
  const candidate=r3AutoCandidate();
  if(!candidate)return;
  const generation=R3_AUTO.generation;
  R3_AUTO.healthRunning=true;
  try{
    const snapshot=await r3SendScan(candidate,'hp');
    if(R3_AUTO.enabled&&!R3_AUTO.running&&!R3_UI.busy&&R3_AUTO.generation===generation)
      r3AutoStoreHealth(snapshot);
  }catch{
    // A missing/unmounted HP input or unavailable iframe is not a fabricated
    // zero. The slower whole-sheet importer continues to report its status.
  }finally{
    R3_AUTO.lastHealth=Date.now();R3_AUTO.healthRunning=false;
  }
}

function r3ToggleAuto(){
  if(R3_AUTO.enabled){
    R3_AUTO.enabled=false;R3_AUTO.generation++;r3AutoSave();r3AutoRestoreDialog();
    r3AutoDisplay('');return;
  }
  const selected=r3Candidates().find(c=>c.key===R3_UI.selected);
  const name=r3String(R3_UI.snapshot?.name||selected?.name,120);
  if(!name||/^(?:2024 character sheet|unnamed sheet)/i.test(name)){
    r3UIStatus('Import a named character once before enabling auto-sync.');
    r3AutoDisplay();
    return;
  }
  R3_AUTO.enabled=true;R3_AUTO.generation++;R3_AUTO.name=name;
  if(selected&&selected.name.toLowerCase()===name.toLowerCase())r3AutoRemember(selected);
  r3AutoSave();r3AutoDisplay('Enabled for '+name+'; checking Roll20 session');
  r3AutoTick();
}
function r3StartAuto(){
  r3AutoLoad();
  r3AutoDisplay();
  if(R3_AUTO.timer===null)R3_AUTO.timer=setInterval(()=>{r3AutoTick();},8000);
  if(R3_AUTO.healthTimer===null)R3_AUTO.healthTimer=setInterval(()=>{r3AutoHealthTick();},1000);
  if(R3_AUTO.enabled)setTimeout(()=>{r3AutoTick();},1600);
}
