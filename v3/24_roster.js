// Journal-backed local character registry and bounded background prewarm.
// Journal rows are discovery clues, not authority to read hidden sheets.
// The GM path requires an explicit Roll20 GM flag; the player path requires
// the exact character model's Controlled By permission. Never scrape chat,
// send network requests, or synthesize unsupported Roll20 sheet actions.
const R3_ROSTER={
  entries:new Map(),queue:[],attempted:new Map(),running:false,
  active:false,timer:null,observer:null,observerTimer:null,
  lastDiscovery:0,done:0,failed:0,scans:0,source:'none',generation:0,
  maxCandidates:160,maxDeep:160,maxAttempts:2,lastError:'',
  currentId:'',tabProgress:new Map(),errors:new Map(),idleAt:0
};
function r3RosterIsGm(){
  return window.is_gm===true;
}
function r3RosterId(value){
  const id=r3String(value,110);
  return /^[\w-]{5,110}$/.test(id)?id:'';
}
function r3RosterJournal(){
  const root=document.querySelector?.('#journalfolderroot');
  if(!root)return [];
  return Array.from(root.querySelectorAll?.('li.journalitem.character[data-itemid]')||[])
    .slice(0,R3_ROSTER.maxCandidates).map(row=>{
      const id=r3RosterId(row.getAttribute?.('data-itemid'));
      // Avoid guessing based on the folder name or color dots.
      const name=r3String(row.querySelector?.('.dd-content .name .namecontainer')?.textContent,120);
      return id&&name?{id,name}:null;
    }).filter(Boolean);
}
function r3RosterAuthorized(id,name){
  const model=r3TokenCharacter(id);
  if(!model||r3String(r3TokenModelGet(model,'name'),120).toLowerCase()!==
    name.toLowerCase())return null;
  if(!r3RosterIsGm()&&!r3TokenControls(model))return null;
  return {model,id,name};
}
function r3RosterDiscover(){
  const before=R3_ROSTER.entries;
  const rows=r3RosterJournal(),next=new Map(),gm=r3RosterIsGm();
  for(const row of rows){
    const identity=r3RosterAuthorized(row.id,row.name);
    if(!identity)continue;
    const prior=before.get(row.id);
    const saved=R3_TOKEN.snapshots.get(row.id);
    const warm=!!saved&&saved.name.toLowerCase()===row.name.toLowerCase()&&
      saved.snapshot?.schema===3;
    const npcFlag=r3TokenModelGet(identity.model,'npc');
    const classification=npcFlag===true||npcFlag==='1'||npcFlag===1?'NPC':
      npcFlag===false||npcFlag==='0'||npcFlag===0?'PC':'Character';
    next.set(row.id,{id:row.id,name:row.name,kind:classification,
      source:gm?'dm-journal':'controlled-journal',
      warmed:warm,complete:prior?.complete===true&&prior.name===row.name,
      snapshot:warm?saved.snapshot:null});
  }
  const changed=next.size!==before.size||[...next].some(([id,x])=>
    before.get(id)?.name!==x.name||before.get(id)?.warmed!==x.warmed);
  R3_ROSTER.entries=next;
  // Invalidate pending results for a character that disappears or changes
  // identity in the Journal. Never preserve progress for an old name.
  for(const id of [...R3_ROSTER.attempted.keys()])
    if(!next.has(id)||next.get(id).name!==before.get(id)?.name){
      R3_ROSTER.attempted.delete(id);R3_ROSTER.errors.delete(id);
      R3_ROSTER.tabProgress.delete(id);
    }
  R3_ROSTER.source=gm?'dm-journal':'controlled-journal';
  R3_ROSTER.lastDiscovery=Date.now();
  if(changed){
    R3_ROSTER.queue=[...next.values()].filter(e=>!e.complete&&
      R3_ROSTER.attempted.get(e.id)?.status!=='done')
      .map(e=>e.id);
    if(typeof r3DebugLog==='function')
      r3DebugLog('Importer','Journal registry: '+next.size+
        ' authorized characters ('+R3_ROSTER.source+'); '+R3_ROSTER.queue.length+' queued');
  }
  return next;
}
function r3RosterSnapshot(id){
  const entry=R3_ROSTER.entries.get(id);
  if(!entry)return null;
  const cached=R3_TOKEN.snapshots.get(id);
  return cached?.name.toLowerCase()===entry.name.toLowerCase()?
    r3InventoryPrune(cached.snapshot):null;
}
function r3RosterIdentityForPreload(id,name){
  const entry=R3_ROSTER.entries.get(id);
  if(!entry||entry.name!==name)return null;
  // Only the current local journal entry can authorize a GM preview.
  if(!r3RosterJournal().some(x=>x.id===id&&x.name===name))return null;
  const identity=r3RosterAuthorized(id,name);
  return identity&&r3RosterIsGm()?identity:null;
}
function r3RosterCloseOwned(id){
  const bg=R3_NATIVE_BG;
  if(bg.characterId!==id||!bg.dialog)return false;
  const wrapper=bg.dialog.closest?.('.ui-dialog');
  const button=wrapper?.querySelector?.('.ui-dialog-titlebar-close');
  const ours=bg.dialog.hasAttribute?.('data-r3-private-reader')||
    wrapper?.hasAttribute?.('data-r3-private-reader');
  // We only click a close control inside a specifically marked, script
  // owned dialog. Do not close a manually opened Roll20 sheet.
  if(!ours||!button||typeof button.click!=='function')return false;
  try{
    button.click();
    r3NativeBgRestore();
    return true;
  }catch{return false;}
}
async function r3RosterPrewarm(){
  if(R3_ROSTER.running||!R3_ROSTER.active||R3_AUTO.running||R3_AUTO.opening||
     R3_UI.busy||R3_NATIVE.busy||R3_NATIVE_BG.opening)return false;
  if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())return false;
  // Active character scans and manual sessions always take priority.
  if(R3_AUTO.enabled&&R3_AUTO.name&&r3AutoCandidate())return false;
  const now=Date.now();
  if(now-R3_ROSTER.lastDiscovery>8000)r3RosterDiscover();
  const entry=R3_ROSTER.queue.map(id=>R3_ROSTER.entries.get(id)).find(x=>
    x&&!x.complete&&R3_ROSTER.attempted.get(x.id)?.status!=='done'&&
    (R3_ROSTER.attempted.get(x.id)?.attempts||0)<R3_ROSTER.maxAttempts&&
    now-(R3_ROSTER.attempted.get(x.id)?.at||0)>20000);
  if(!entry)return false;
  const identity=r3RosterAuthorized(entry.id,entry.name);
  if(!identity)return false;
  if(R3_ROSTER.scans>=R3_ROSTER.maxDeep)return false;
  const generation=R3_ROSTER.generation,game=R3_UI.campaignKey;
  R3_ROSTER.running=true;
  const prior=R3_ROSTER.attempted.get(entry.id)||{attempts:0,at:0};
  R3_ROSTER.attempted.set(entry.id,{attempts:prior.attempts+1,at:now,status:'reading'});
  R3_ROSTER.currentId=entry.id;
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
  let candidate=null;
  try{
    // A preload never adopts a user's visible official sheet. The shared
    // opener itself requires an exact, newly claimed script-owned dialog.
    const open=typeof r3NativeBgEnsure==='function'?
      r3NativeBgEnsure(entry.name,{id:entry.id,name:entry.name,mode:
        r3RosterIsGm()?'dm-roster':'player-roster'}):null;
    if(!open)return false;
    candidate=await open;
    if(!R3_ROSTER.active||generation!==R3_ROSTER.generation||
       game!==R3_UI.campaignKey||!r3NativeIsOwned(candidate)||
       r3AutoId(candidate)!==entry.id)return false;
    const tabs=new Set();
    const snap=await r3SendScan(candidate,'all',(_part,tab,meta)=>{
      if(!R3_ROSTER.active||generation!==R3_ROSTER.generation)return;
      if(tab&&tab!=='Planning')tabs.add(tab);
      const prior=R3_ROSTER.tabProgress.get(entry.id)||{done:0,total:1};
      const total=Math.min(32,Math.max(prior.total,Number(meta?.totalTabs)||1,tabs.size));
      const done=Math.min(total,Math.max(prior.done,Number(meta?.completedTabs)||tabs.size));
      R3_ROSTER.tabProgress.set(entry.id,{done,total});
      if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
    });
    if(!R3_ROSTER.active||generation!==R3_ROSTER.generation||
       game!==R3_UI.campaignKey||!r3NativeIsOwned(candidate)||
       r3AutoId(candidate)!==entry.id||
       r3String(snap?.name,120).toLowerCase()!==entry.name.toLowerCase()||
       !r3AutoHasRecognizedData(snap))return false;
    R3_TOKEN.snapshots.set(entry.id,{name:entry.name,snapshot:r3InventoryPrune(snap)});
    r3TokenSaveCache();
    const current=R3_ROSTER.entries.get(entry.id);
    if(current){current.warmed=true;current.complete=true;current.snapshot=snap;}
    R3_ROSTER.attempted.set(entry.id,{status:'done',at:Date.now(),
      attempts:prior.attempts+1});
    R3_ROSTER.errors.delete(entry.id);
    const progress=R3_ROSTER.tabProgress.get(entry.id)||{total:1};
    R3_ROSTER.tabProgress.set(entry.id,{total:progress.total,done:progress.total});
    R3_ROSTER.done++;R3_ROSTER.scans++;
    return true;
  }catch(e){
    R3_ROSTER.failed++;R3_ROSTER.lastError=r3String(e?.message||e,150);
    R3_ROSTER.errors.set(entry.id,entry.name+': '+R3_ROSTER.lastError);
    R3_ROSTER.attempted.set(entry.id,{status:'error',at:Date.now(),
      attempts:prior.attempts+1});
    return false;
  }finally{
    if(candidate&&r3NativeIsOwned(candidate)&&!r3RosterCloseOwned(entry.id)){
      // A browser may not expose its own dialog close button. Do not
      // risk closing a manual dialog; the existing bounded session cap
      // prevents unbounded hidden frames.
      R3_ROSTER.lastError='Owned reader cannot be closed safely; bounded session retained';
    }
    R3_ROSTER.running=false;R3_ROSTER.currentId='';
    if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
    if(typeof r3DebugRefresh==='function')r3DebugRefresh();
  }
}
function r3RosterReset(){
  R3_ROSTER.generation++;
  R3_ROSTER.entries.clear();R3_ROSTER.queue=[];
  R3_ROSTER.attempted.clear();R3_ROSTER.errors.clear();
  R3_ROSTER.tabProgress.clear();R3_ROSTER.currentId='';
  R3_ROSTER.running=false;R3_ROSTER.done=0;R3_ROSTER.failed=0;
  R3_ROSTER.scans=0;R3_ROSTER.lastDiscovery=0;
}
function r3RosterStart(){
  if(R3_ROSTER.active)return;
  R3_ROSTER.active=true;
  r3RosterDiscover();
  // Periodic discovery is cheap; full official sheet scans are serialized,
  // capped and suspend while active character or manual sheet is in use.
  if(R3_ROSTER.timer===null)R3_ROSTER.timer=setInterval(()=>{
    r3RosterDiscover();void r3RosterPrewarm();
    if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
  },1400);
  const root=document.querySelector?.('#journalfolderroot');
  if(root&&typeof MutationObserver==='function'){
    R3_ROSTER.observer=new MutationObserver(()=>{
      if(R3_ROSTER.observerTimer!==null)clearTimeout(R3_ROSTER.observerTimer);
      R3_ROSTER.observerTimer=setTimeout(()=>{R3_ROSTER.observerTimer=null;
        r3RosterDiscover();},180);
    });
    R3_ROSTER.observer.observe(root,{subtree:true,childList:true,attributes:true,
      attributeFilter:['data-itemid','class']});
  }
}
