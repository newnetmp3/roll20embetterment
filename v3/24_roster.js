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
  currentId:'',tabProgress:new Map(),errors:new Map(),idleAt:0,
  modelCollection:null,lastChanged:new Map(),runId:0,journalRoot:null
};
function r3RosterIsGm(){
  return window.is_gm===true||window.is_gm===1;
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
  const model=r3TokenCharacter(id),gm=r3RosterIsGm();
  // A DM's rendered Journal row is enough to *request opening* that exact
  // Roll20 sheet even while Campaign.characters is still unhydrated. The
  // private opener then verifies a newly created dialog with the same ID.
  // A player NEVER receives this Journal-only fallback.
  if(!model&&!gm)return null;
  if(model&&r3String(r3TokenModelGet(model,'name'),120).toLowerCase()!==
    name.toLowerCase())return null;
  if(!gm&&!r3TokenControls(model))return null;
  return {model:model||null,id,name};
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
  // Revoked, removed or renamed Journal entries cannot leave a readable
  // cached sheet behind, including an already selected read-only preview.
  let purged=false;
  for(const [id,old] of before){
    if(next.get(id)?.name===old.name)continue;
    if(R3_TOKEN.snapshots.delete(id))purged=true;
  }
  if(purged&&typeof r3TokenSaveCache==='function')r3TokenSaveCache();
  const previewId=R3_TOKEN.rosterPreviewId;
  if(previewId&&(!next.has(previewId)||
      before.get(previewId)?.name!==next.get(previewId)?.name)){
    R3_TOKEN.rosterPreviewId='';
    if(!R3_TOKEN.active&&!R3_TOKEN.visibleSheetId){
      R3_UI.snapshot=null;R3_UI.renderedSnapshot=null;R3_UI.selected='';
      if(typeof R3_NATIVE==='object'){
        R3_NATIVE.preview=null;R3_NATIVE.revision++;
      }
      if(typeof r3UIStatus==='function')
        r3UIStatus('Journal character is no longer available or authorized.');
      if(typeof r3UIRefresh==='function')r3UIRefresh();
    }
  }
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
  // The authorization helper already requires Controlled By for players
  // and an exact matching current-campaign model for GMs.
  return identity||null;
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
  if(R3_AUTO.enabled&&R3_AUTO.name&&
     (r3AutoCandidate()||!R3_AUTO.lastFull))return false;
  const now=Date.now();
  if(now-R3_ROSTER.lastDiscovery>8000)r3RosterDiscover();
  const entry=R3_ROSTER.queue.map(id=>R3_ROSTER.entries.get(id)).find(x=>
    x&&!x.complete&&R3_ROSTER.attempted.get(x.id)?.status!=='done'&&
    (R3_ROSTER.attempted.get(x.id)?.attempts||0)<R3_ROSTER.maxAttempts&&
    now-(R3_ROSTER.attempted.get(x.id)?.at||0)>20000);
  if(!entry)return false;
  const identity=r3RosterIdentityForPreload(entry.id,entry.name);
  if(!identity)return false;
  if(R3_ROSTER.scans>=R3_ROSTER.maxDeep)return false;
  const generation=R3_ROSTER.generation,game=R3_UI.campaignKey;
  const runId=++R3_ROSTER.runId;
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
    if(!open)throw new Error('No verified script-owned Roll20 sheet opener is available');
    candidate=await open;
    if(!R3_ROSTER.active||generation!==R3_ROSTER.generation||
       game!==R3_UI.campaignKey||!r3NativeIsOwned(candidate)||
       r3AutoId(candidate)!==entry.id)
      throw new Error('Journal preload identity changed while opening an owned reader');
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
       !r3RosterIdentityForPreload(entry.id,entry.name)||
       !r3AutoHasRecognizedData(snap))
      throw new Error('Preload result did not verify source ID, name and actual sheet data');
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
    // A deliberately selected Journal preview becomes useful immediately
    // when its background sheet finishes, without a second user click.
    if(R3_TOKEN.rosterPreviewId===entry.id&&!R3_TOKEN.active&&
       !R3_TOKEN.visibleSheetId){
      R3_UI.snapshot=r3InventoryPrune(snap);
      R3_UI.renderedSnapshot=null;
      if(typeof r3UIRefresh==='function')r3UIRefresh();
    }else if(typeof R3_BF==='object'&&R3_BF.menuPane==='profile'){
      R3_BF.revision++;
      if(typeof r3HudRender==='function')r3HudRender();
    }
    return true;
  }catch(e){
    // Delayed responses must not touch a new campaign's attempt ledger.
    if(R3_ROSTER.active&&generation===R3_ROSTER.generation&&
       runId===R3_ROSTER.runId&&game===R3_UI.campaignKey&&
       R3_ROSTER.entries.get(entry.id)?.name===entry.name){
      R3_ROSTER.failed++;R3_ROSTER.lastError=r3String(e?.message||e,150);
      R3_ROSTER.errors.set(entry.id,entry.name+': '+R3_ROSTER.lastError);
      R3_ROSTER.attempted.set(entry.id,{status:'error',at:Date.now(),
        attempts:prior.attempts+1});
    }
    return false;
  }finally{
    // Another import may already be running after a reset, even for the
    // same character ID. Never close its reader or unlock its queue.
    if(generation===R3_ROSTER.generation&&runId===R3_ROSTER.runId&&
       game===R3_UI.campaignKey){
      if(R3_NATIVE_BG.characterId===entry.id&&
          !r3RosterCloseOwned(entry.id)){
        R3_ROSTER.lastError='Owned reader cannot be closed safely; bounded session retained';
        R3_ROSTER.errors.set(entry.id,entry.name+': '+R3_ROSTER.lastError);
      }
      R3_ROSTER.running=false;R3_ROSTER.currentId='';
      if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
      if(typeof r3DebugRefresh==='function')r3DebugRefresh();
    }
  }
}
function r3RosterReset(){
  R3_ROSTER.observer?.disconnect?.();R3_ROSTER.observer=null;
  R3_ROSTER.journalRoot=null;
  if(R3_ROSTER.observerTimer!==null)clearTimeout(R3_ROSTER.observerTimer);
  R3_ROSTER.observerTimer=null;
  R3_ROSTER.modelCollection?.off?.('change',r3RosterModelChanged);
  R3_ROSTER.modelCollection?.off?.('add remove',r3RosterCollectionChanged);
  R3_ROSTER.modelCollection=null;R3_ROSTER.lastChanged.clear();
  R3_ROSTER.generation++;R3_ROSTER.runId++;
  R3_ROSTER.entries.clear();R3_ROSTER.queue=[];
  R3_ROSTER.attempted.clear();R3_ROSTER.errors.clear();
  R3_ROSTER.tabProgress.clear();R3_ROSTER.currentId='';
  R3_ROSTER.running=false;R3_ROSTER.done=0;R3_ROSTER.failed=0;
  R3_ROSTER.scans=0;R3_ROSTER.lastDiscovery=0;
}
// Backbone collection events are local, cheap change hints. A changed
// NPC/PC is requeued for source verification; we do not use untrusted raw
// model attributes to overwrite imported official 2024 sheet values.
function r3RosterModelChanged(model){
  const id=r3RosterId(model?.id||r3TokenModelGet(model,'_id'));
  const entry=R3_ROSTER.entries.get(id);
  if(!entry||R3_ROSTER.currentId===id)return;
  const now=Date.now();
  if(now-(R3_ROSTER.lastChanged.get(id)||0)<1500)return;
  R3_ROSTER.lastChanged.set(id,now);
  entry.complete=false;R3_ROSTER.attempted.delete(id);
  R3_ROSTER.errors.delete(id);R3_ROSTER.tabProgress.delete(id);
  if(!R3_ROSTER.queue.includes(id))R3_ROSTER.queue.push(id);
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
}
function r3RosterCollectionChanged(){
  R3_ROSTER.lastDiscovery=0;
  r3RosterDiscover();
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
}
function r3RosterListenModels(){
  const current=r3TokenCampaign()?.characters;
  if(current===R3_ROSTER.modelCollection)return;
  R3_ROSTER.modelCollection?.off?.('change',r3RosterModelChanged);
  R3_ROSTER.modelCollection?.off?.('add remove',r3RosterCollectionChanged);
  R3_ROSTER.modelCollection=null;
  if(typeof current?.on!=='function')return;
  current.on('change',r3RosterModelChanged);
  current.on('add remove',r3RosterCollectionChanged);
  R3_ROSTER.modelCollection=current;
}
function r3RosterObserveJournal(){
  const root=document.querySelector?.('#journalfolderroot')||null;
  if(root===R3_ROSTER.journalRoot)return;
  R3_ROSTER.observer?.disconnect?.();R3_ROSTER.observer=null;
  if(R3_ROSTER.observerTimer!==null)clearTimeout(R3_ROSTER.observerTimer);
  R3_ROSTER.observerTimer=null;R3_ROSTER.journalRoot=root;
  // Roll20 can mount the Journal after boot, or replace the root entirely.
  if(!root||typeof MutationObserver!=='function')return;
  R3_ROSTER.observer=new MutationObserver(()=>{
    if(R3_ROSTER.observerTimer!==null)clearTimeout(R3_ROSTER.observerTimer);
    R3_ROSTER.observerTimer=setTimeout(()=>{R3_ROSTER.observerTimer=null;
      r3RosterDiscover();},180);
  });
  R3_ROSTER.observer.observe(root,{subtree:true,childList:true,attributes:true,
    attributeFilter:['data-itemid','class']});
}
function r3RosterStart(){
  if(R3_ROSTER.active)return;
  R3_ROSTER.active=true;
  r3RosterDiscover();r3RosterListenModels();r3RosterObserveJournal();
  // Periodic discovery is cheap; full official sheet scans are serialized,
  // capped and suspend while active character or manual sheet is in use.
  if(R3_ROSTER.timer===null)R3_ROSTER.timer=setInterval(()=>{
    r3RosterListenModels();r3RosterObserveJournal();
    r3RosterDiscover();void r3RosterPrewarm();
    if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
  },1400);
}

// An already selected Player Character's native full import counts toward
// the same Journal preload; don't scan that sheet a second time just to
// advance the bulk progress indicator.
function r3RosterTabProgress(id,tab,metadata){
  const entry=R3_ROSTER.entries.get(id);
  if(!entry||!metadata||tab==='Planning')return;
  const prev=R3_ROSTER.tabProgress.get(id)||{done:0,total:0};
  const total=Math.min(32,Math.max(prev.total,
    Number(metadata.totalTabs)||0,1));
  const done=Math.min(total,Math.max(prev.done,Number(metadata.completedTabs)||0));
  R3_ROSTER.tabProgress.set(id,{total,done});
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
}
function r3RosterComplete(id,snapshot){
  const entry=R3_ROSTER.entries.get(id);
  if(!entry||snapshot?.schema!==3||
     entry.name.toLowerCase()!==r3String(snapshot.name,120).toLowerCase()||
     !r3RosterAuthorized(id,entry.name))return false;
  entry.complete=true;entry.warmed=true;
  R3_ROSTER.attempted.set(id,{status:'done',at:Date.now(),attempts:1});
  R3_ROSTER.errors.delete(id);
  const prev=R3_ROSTER.tabProgress.get(id)||{total:1,done:1};
  R3_ROSTER.tabProgress.set(id,{total:Math.max(1,prev.total),
    done:Math.max(1,prev.total)});
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
  return true;
}
// A deliberate UI selection presents only previously verified Journal data.
// It never turns a GM's NPC preview into a controlled token or sends a roll.
function r3RosterChoose(id){
  const entry=R3_ROSTER.entries.get(r3RosterId(id));
  if(!entry||!r3RosterAuthorized(entry.id,entry.name))return false;
  if(typeof r3AutoRestoreDialog==='function')r3AutoRestoreDialog();
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;
    R3_AUTO.enabled=false;R3_AUTO.characterId='';
    R3_AUTO.name='';R3_AUTO.origin='manual';
  }
  R3_TOKEN.active=null;R3_TOKEN.visibleSheetId='';
  R3_TOKEN.visibleSheetSeen='';
  R3_TOKEN.rosterPreviewId=entry.id;
  const saved=r3RosterSnapshot(entry.id);
  const blank=r3Empty();blank.name=entry.name;
  blank.diagnostics.notes.push('Journal preview is read-only. Map-token and native action permissions are not inferred.');
  R3_UI.snapshot=saved||r3Coverage(blank);
  R3_UI.view='summary';R3_UI.renderedSnapshot=null;
  R3_HUD.flyout='';R3_HUD.chooser=null;
  R3_NATIVE.preview=null;R3_NATIVE.revision++;
  if(typeof r3HudLoad==='function')r3HudLoad();
  if(typeof r3UIStatus==='function')r3UIStatus('Journal preview: '+entry.name+
    (saved?' (preloaded)':' (waiting for silent preload)'));
  if(typeof r3UIRefresh==='function')r3UIRefresh();
  return true;
}
function r3RosterOptions(){
  return [...R3_ROSTER.entries.values()].map(entry=>({
    id:entry.id,name:entry.name,kind:entry.kind,
    ready:entry.complete||entry.warmed
  }));
}
