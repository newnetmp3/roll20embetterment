// Automatic, player-owned sync for a verified controlled character. Importer
// settings and manual recovery remain optional. No character/sheet writes.
// Never fetch privileged data, synthesize character records, or scan other sheets.
const R3_AUTO={
  enabled:false,name:'',characterId:'',running:false,active:false,opened:false,openedAt:0,
  lastScan:0,lastFull:0,lastOpenAttempt:0,lastError:'',timer:null,healthTimer:null,
  healthRunning:false,lastHealth:0,generation:0,preOpenDialogs:null,dirtyTimer:null,
  opening:false,
  ownedDialog:null,ownedContainer:null,originalPosition:null,preOpenOverlays:null,
  ownedOverlay:null,originalOverlay:null,openObserver:null,
  explicitlyDisabled:false,origin:'manual'
};
function r3AutoKey(){return r3StorageKey()+':auto';}
function r3AutoLoad(){
  try{
    const stored=JSON.parse(localStorage.getItem(r3AutoKey())||'null');
    // An explicit Off is sticky across token changes and page reloads.
    // An unconfigured install has no saved Off, so selection can start sync.
    R3_AUTO.explicitlyDisabled=stored?.enabled===false;
    if(stored?.enabled===true&&typeof stored.name==='string'&&
       stored.name.length>0&&stored.name.length<120){
      R3_AUTO.enabled=true;R3_AUTO.name=stored.name;
      R3_AUTO.characterId=r3String(stored.characterId,100);
      R3_AUTO.origin=stored.origin==='token'?'token':'manual';
    }
  }catch{}
}
function r3AutoSave(){
  try{localStorage.setItem(r3AutoKey(),JSON.stringify({
    enabled:R3_AUTO.enabled,name:R3_AUTO.name,
    characterId:R3_AUTO.characterId,origin:R3_AUTO.origin
  }));}catch{}
}
// Called only AFTER r3TokenInspectLinked has verified the exact represented
// character and the current player's Controlled By permission. No name-only
// auto-adoption and no need to visit Debug or import a sheet first.
function r3AutoFollowToken(info){
  if(!info?.tokenId||!info?.characterId||!info?.name)return false;
  // Selected, player-controlled character sheets always synchronize without
  // setup. A legacy saved "Auto-sync Off" must not strand native attacks.
  R3_AUTO.explicitlyDisabled=false;
  const changed=R3_AUTO.characterId!==info.characterId||
    R3_AUTO.name!==info.name;
  if(!changed&&R3_AUTO.enabled){
    r3AutoSave(); // migrate any old sticky disabled preference
    return true;
  }
  // Invalidates requests from another character before a late iframe result
  // can write its data to this character's visible HUD.
  R3_AUTO.generation++;
  if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
  R3_AUTO.dirtyTimer=null;
  // Release an owned former-character dialog; never leave a previous PC's
  // character sheet hidden or reassign its DOM to a new PC.
  if(changed&&(R3_AUTO.ownedDialog||R3_AUTO.opened))
    r3AutoRestoreDialog();
  R3_AUTO.enabled=true;
  R3_AUTO.origin='token';
  R3_AUTO.name=info.name;R3_AUTO.characterId=info.characterId;
  R3_AUTO.lastScan=0;R3_AUTO.lastHealth=0;R3_AUTO.lastFull=0;
  R3_AUTO.lastOpenAttempt=0;
  r3AutoSave();
  r3AutoDisplay('Following selected character: '+info.name);
  // Boot starts the scheduler before token polling. Scan on the next turn
  // of the event loop, never during Roll20's selection callback.
  if(R3_AUTO.timer!==null){
    const generation=R3_AUTO.generation;
    setTimeout(()=>{
      if(R3_AUTO.generation===generation&&R3_AUTO.enabled)
        r3AutoTick();
    },0);
  }
  return true;
}
function r3AutoDisplay(message){
  // Routine UI refreshes must not erase a useful "journal not loaded" status.
  if(message!==undefined){
    if(typeof r3DebugLog==='function'&&message!==R3_AUTO.lastError)
      r3DebugLog('Importer','Auto-sync: '+message);
    R3_AUTO.lastError=message||'';
  }
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
  // The DM view owns its manual, read-only reader. Do not let a saved player
  // background session or an old same-name popout be selected in this mode.
  if(R3_AUTO.origin==='visible')return r3DmAutoCandidate();
  // A player-popped-out official sheet is a valid authenticated reader.
  // It has no parent dialog with a character ID, so require a unique exact
  // name. Prefer the popout when the same sheet also has an embedded frame.
  // Roll20 frequently assigns a generic iframe title until Vue finishes
  // mounting. Our private dialog has an authoritative character ID, and the
  // reader announces its actual name through the authenticated message
  // bridge. Never require a stale iframe title for a script-owned session.
  const owned=typeof r3NativeBgCandidate==='function'?r3NativeBgCandidate():null;
  if(owned&&R3_AUTO.characterId&&
    r3AutoId(owned)===R3_AUTO.characterId&&
    R3_NATIVE_BG.name?.toLowerCase()===R3_AUTO.name.toLowerCase()&&
    (typeof r3SheetAllowsBackground!=='function'||r3SheetAllowsBackground())){
    const announced=R3_NATIVE.readers.get(owned.window);
    if(!announced?.name||
       announced.name.toLowerCase()===R3_AUTO.name.toLowerCase()||
       /^(?:unnamed sheet|official sheet popout|2024 character sheet)/i.test(announced.name)){
      // Keep this candidate bound to the original frame/window, not a new
      // iframe clone or a nameless manually opened sheet.
      return {...owned,name:R3_AUTO.name,characterId:R3_AUTO.characterId};
    }
    return null; // Authenticated reader contradicts the owned character.
  }
  const choices=r3Candidates().filter(c=>c.visible&&c.window&&
    (c.type==='iframe'||c.type==='popout'));
  // Never allow an explicit, conflicting character ID to be rescued by a
  // coincidental display-name match.
  const eligible=choices.filter(c=>!R3_AUTO.characterId||!r3AutoId(c)||
    r3AutoId(c)===R3_AUTO.characterId);
  const named=eligible.filter(c=>r3String(c.name,120).toLowerCase()===
    R3_AUTO.name.toLowerCase());
  // Same-name characters may have different sheets. If Roll20 exposes
  // duplicates, an ID-less iframe/popout is not sufficient identity proof.
  const models=r3TokenCampaign?.()?.characters?.models;
  const duplicateName=Array.isArray(models)&&models.filter(model=>
    r3String(r3TokenModelGet(model,'name'),120).toLowerCase()===
      R3_AUTO.name.toLowerCase()).length>1;
  const safe=named.filter(c=>!duplicateName||r3AutoId(c)===R3_AUTO.characterId);
  // Prefer our own character-bound private reader even when a player also
  // has an official popout open. Never navigate that player's live tab.
  const namedOwned=safe.filter(c=>c.type==='iframe'&&r3NativeIsOwned(c));
  if(namedOwned.length===1&&
     (typeof r3SheetAllowsBackground!=='function'||r3SheetAllowsBackground()))
    return namedOwned[0];
  if(namedOwned.length>1)return null;
  const popouts=safe.filter(c=>c.type==='popout');
  if(popouts.length===1)return popouts[0];
  if(popouts.length>1)return null; // same-named popouts are ambiguous
  if(R3_AUTO.characterId){
    const exact=safe.filter(c=>c.type==='iframe'&&r3AutoId(c)===R3_AUTO.characterId);
    if(exact.length===1)return exact[0];
    if(exact.length>1)return null;
  }
  return safe.length===1?safe[0]:null;
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
  // An automatically selected character is pinned by a verified Roll20 ID.
  // Never double-click a name-only Journal row belonging to another PC.
  if(id&&R3_AUTO.origin==='token')return null;
  const matches=found.filter(el=>{
    const title=r3String(el.getAttribute?.('title')||
      el.getAttribute?.('aria-label')||el.querySelector?.('.name,.journalitem-name')?.textContent||
      el.textContent,120).toLowerCase();
    return title===name;
  });
  return matches.length===1?matches[0]:null;
}
function r3AutoOpenFromJournal(now){
  if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())return false;
  if(R3_AUTO.opened&&now-R3_AUTO.openedAt<30000)return false;
  if(R3_AUTO.opened){
    R3_AUTO.opened=false;
    R3_AUTO.openObserver?.disconnect();
    R3_AUTO.openObserver=null;
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
    R3_AUTO.preOpenOverlays=new Set(document.querySelectorAll('.ui-widget-overlay')||[]);
    R3_AUTO.openObserver?.disconnect();
    R3_AUTO.openObserver=typeof MutationObserver==='function'?
      new MutationObserver(r3AutoShieldNewDialog):null;
    R3_AUTO.openObserver?.observe(document.documentElement||document,{
      childList:true,subtree:true,attributes:true,attributeFilter:['data-characterid']
    });
    entry.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
    R3_AUTO.opened=true;R3_AUTO.openedAt=Date.now();
    r3AutoShieldNewDialog(); // synchronous Journal events may create the dialog
    r3AutoDisplay('Requested character sheet from the Roll20 journal; waiting for it to load');
    return true;
  }catch(e){
    R3_AUTO.openObserver?.disconnect();R3_AUTO.openObserver=null;
    r3AutoDisplay('Journal entry could not be opened automatically: '+r3String(e?.message||e,130));
    return false;
  }
}
function r3AutoShieldOverlay(){
  if(!R3_AUTO.ownedDialog||R3_AUTO.ownedOverlay)return;
  const added=Array.from(document.querySelectorAll('.ui-widget-overlay')||[])
    .filter(el=>!R3_AUTO.preOpenOverlays?.has(el));
  if(added.length!==1)return; // never affect existing player-owned overlays
  const overlay=added[0],style=overlay.style||{};
  R3_AUTO.ownedOverlay=overlay;
  R3_AUTO.originalOverlay={opacity:style.opacity,pointerEvents:style.pointerEvents};
  r3PrivateMark(overlay,'data-r3-private-overlay');
}
function r3AutoShieldNewDialog(){
  if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())return;
  if(!R3_AUTO.opened||!R3_AUTO.preOpenDialogs)return;
  if(!R3_AUTO.ownedDialog){
    const newlyCreated=Array.from(document.querySelectorAll('.characterdialog')||[])
      .filter(el=>!R3_AUTO.preOpenDialogs.has(el));
    const matching=newlyCreated.filter(dialog=>{
      const id=r3NativeBgDialogId(dialog);
      if(R3_AUTO.characterId)return id===R3_AUTO.characterId;
      // Without a pinned ID, require an exact visible official sheet name
      // from this uniquely chosen Journal entry (never a partial name).
      const name=r3String(dialog.querySelector?.(
        '[data-testid="character-name"],.asv__header__name')?.textContent,120);
      return !!name&&name.toLowerCase()===R3_AUTO.name.toLowerCase();
    });
    if(matching.length===1)r3AutoMoveDialogOffscreen(matching[0]);
  }
  r3AutoShieldOverlay();
}
function r3AutoMoveDialogOffscreen(dialog){
  if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())return false;
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
  const container=dialog.closest?.('.ui-dialog')||dialog;
  R3_AUTO.ownedDialog=dialog;R3_AUTO.ownedContainer=container;
  R3_AUTO.originalPosition={left:container.style.left,top:container.style.top,
    position:container.style.position,opacity:container.style.opacity,
    pointerEvents:container.style.pointerEvents};
  R3_AUTO.dialogOriginal=dialog!==container?{
    left:dialog.style?.left,top:dialog.style?.top,
    position:dialog.style?.position,opacity:dialog.style?.opacity}:null;
  r3PrivateMark(container,'data-r3-private-reader');
  if(dialog!==container)r3PrivateMark(dialog,'data-r3-private-reader');
  r3AutoShieldOverlay();
  return true;
}
function r3AutoMoveOffscreen(candidate){
  return r3AutoMoveDialogOffscreen(r3AutoDialogFor(candidate));
}
function r3AutoRestoreDialog(){
  R3_AUTO.openObserver?.disconnect();R3_AUTO.openObserver=null;
  if(R3_AUTO.ownedContainer?.style&&R3_AUTO.originalPosition){
    r3PrivateUnmark(R3_AUTO.ownedContainer,'data-r3-private-reader');
    if(R3_AUTO.ownedDialog!==R3_AUTO.ownedContainer)
      r3PrivateUnmark(R3_AUTO.ownedDialog,'data-r3-private-reader');
    const d=R3_AUTO.ownedContainer.style,p=R3_AUTO.originalPosition;
    d.left=p.left;d.top=p.top;d.position=p.position;d.opacity=p.opacity;
    d.pointerEvents=p.pointerEvents;
    if(R3_AUTO.ownedDialog!==R3_AUTO.ownedContainer&&R3_AUTO.ownedDialog?.style&&R3_AUTO.dialogOriginal)
      for(const key of ['left','top','position','opacity'])
        R3_AUTO.ownedDialog.style[key]=R3_AUTO.dialogOriginal[key];
  }
  if(R3_AUTO.ownedOverlay?.style&&R3_AUTO.originalOverlay){
    r3PrivateUnmark(R3_AUTO.ownedOverlay,'data-r3-private-overlay');
    R3_AUTO.ownedOverlay.style.opacity=R3_AUTO.originalOverlay.opacity;
    R3_AUTO.ownedOverlay.style.pointerEvents=R3_AUTO.originalOverlay.pointerEvents;
  }
  R3_AUTO.ownedDialog=null;R3_AUTO.ownedContainer=null;R3_AUTO.originalPosition=null;
  R3_AUTO.dialogOriginal=null;
  R3_AUTO.ownedOverlay=null;R3_AUTO.originalOverlay=null;
  R3_AUTO.opened=false;R3_AUTO.openedAt=0;
  R3_AUTO.preOpenDialogs=null;R3_AUTO.preOpenOverlays=null;
}
function r3AutoSignature(s){
  return JSON.stringify([s.name,s.stats,s.abilities,s.modifiers,s.saves,s.skills,s.slots,
    s.spells,s.attacks,s.inventory,s.features,s.resources,s.misc,s.controls]);
}
function r3AutoCombine(prev,current){
  if(!prev||r3String(prev.name).toLowerCase()!==r3String(current.name).toLowerCase())
    return r3InventoryPrune(current);
  // Current-view scans refresh only fields they genuinely observed; don't
  // erase saved inventory/spells/features because their tabs were not visited.
  const merged={...prev,capturedAt:current.capturedAt,stats:{...prev.stats,...current.stats},
    abilities:{...prev.abilities,...current.abilities},modifiers:{...prev.modifiers,...current.modifiers},
    saves:{...prev.saves,...current.saves},skills:{...prev.skills,...current.skills},
    slots:{...prev.slots,...current.slots},provenance:{...prev.provenance,...current.provenance}};
  // Spell slot rows expose current/remaining/max separately. A partial
  // current-tab refresh often sees only one property; preserve the others.
  for(const [level,values] of Object.entries(current.slots||{})){
    if(values&&typeof values==='object'&&!Array.isArray(values))
      merged.slots[level]={...(prev.slots?.[level]||{}),...values};
  }
  for(const kind of ['resources','attacks','spells','inventory','features','misc']){
    const indexed=new Map((prev[kind]||[]).map(item=>[item._key||item.name,item]));
    for(const entry of current[kind]||[]){
      const key=entry._key||entry.name;
      // A positively observed quantity of zero removes an item from the
      // saved inventory. Missing/off-tab/virtualized rows never do.
      if(kind==='inventory'&&r3InventoryZero(entry))indexed.delete(key);
      else indexed.set(key,entry);
    }
    merged[kind]=[...indexed.values()];
  }
  r3MergeControlInventory(merged,current);
  // Keep bounded observations from the last full import, not every poll.
  return r3Coverage(merged);
}
function r3AutoHasRecognizedData(snapshot){
  // HP/AC and other stats are not necessarily mounted outside Combat.
  // A named Inventory/Features/Spells/Skills tab is still a useful scan.
  // Treat an entirely empty/malformed result as not yet populated so it
  // cannot replace a previously successful full import.
  return ['stats','abilities','modifiers','saves','skills','slots'].some(kind=>
    snapshot[kind]&&typeof snapshot[kind]==='object'&&
    !Array.isArray(snapshot[kind])&&Object.keys(snapshot[kind]).length>0)||
    ['spells','attacks','inventory','features','resources'].some(kind=>
      Array.isArray(snapshot[kind])&&snapshot[kind].length>0);
}
function r3AutoStoreSnapshot(snapshot,mode){
  const candidateName=r3String(snapshot?.name,120);
  if(snapshot?.schema!==3||candidateName.toLowerCase()!==R3_AUTO.name.toLowerCase())
    throw new Error('Sheet identity did not match the auto-sync character');
  if(R3_TOKEN.active&&R3_TOKEN.active.name.toLowerCase()!==candidateName.toLowerCase())
    throw new Error('Scan character differs from the selected controllable token');
  if(R3_AUTO.origin==='visible'&&!r3DmAutoAllowed())
    throw new Error('Manual sheet selection has changed during this import');
  if(!r3AutoHasRecognizedData(snapshot))
    throw new Error('Sheet has not populated recognizable character values yet');
  // A partial scan cannot erase the full inventory, spells and actions.
  const next=mode==='all'?r3InventoryPrune(snapshot):r3AutoCombine(R3_UI.snapshot,snapshot);
  if(r3AutoSignature(R3_UI.snapshot||{})!==r3AutoSignature(next)){
    R3_UI.snapshot=r3Coverage(next);r3Save(R3_UI.snapshot);
    r3TokenRecordSnapshot(R3_UI.snapshot);
    r3UIRefresh();
  }
}
function r3AutoQueueDirty(candidate){
  if(!R3_AUTO.enabled||R3_UI.busy||!R3_AUTO.name)return;
  const current=r3AutoCandidate();
  if(!current||current.window!==candidate?.window)return;
  if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
  const generation=R3_AUTO.generation;
  // Normal edits start a scan after ~400ms. Limit full current-tab reads
  // to once every 2 seconds during rapid typing/slider movement.
  const ms=Math.max(180,650-(Date.now()-R3_AUTO.lastScan));
  R3_AUTO.dirtyTimer=setTimeout(()=>{
    R3_AUTO.dirtyTimer=null;
    if(!R3_AUTO.enabled||R3_AUTO.generation!==generation||R3_UI.busy)return;
    if(r3AutoCandidate()?.window!==candidate.window)return;
    r3AutoTick(true);
  },ms);
}
async function r3AutoTick(eventTriggered=false){
  if(!R3_AUTO.enabled||R3_AUTO.running||R3_AUTO.opening||
     R3_UI.busy||R3_NATIVE.busy||!R3_AUTO.name)return;
  // The automatic token and visible-sheet modes require verified
  // identity. Explicitly configured legacy manual sync remains supported
  // within its original per-campaign storage key.
  if(R3_AUTO.origin==='token'&&!r3PlayerAutoAllowed())return;
  if(R3_AUTO.origin==='visible'&&!r3DmAutoAllowed())return;
  const now=Date.now();
  let candidate=r3AutoCandidate();
  if(!candidate){
    // A DM inspecting a manually opened official sheet has not authorized
    // the extension to open or conceal any other sheet. Stop cleanly when
    // that visible reader is gone, rather than falling back to Journal.
    if(R3_AUTO.origin==='visible')return;
    // Use the same Roll20 character-scoped opener as native actions. This
    // works without opening the Journal sidebar or manually viewing a tab.
    // A verified Controlled By model and exact character ID are required.
    const identity=r3NativeBgResolve(R3_AUTO.name);
    if(identity.model&&(!R3_AUTO.characterId||
       identity.id===R3_AUTO.characterId)&&
       (typeof r3SheetAllowsBackground!=='function'||r3SheetAllowsBackground())){
      if(now-R3_AUTO.lastOpenAttempt<12000)return;
      R3_AUTO.lastOpenAttempt=now;
      const generation=R3_AUTO.generation;
      R3_AUTO.opening=true;
      try{
        const opened=await r3NativeBgEnsure(R3_AUTO.name);
        if(!R3_AUTO.enabled||generation!==R3_AUTO.generation)return;
        if(r3AutoId(opened)!==identity.id)
          throw new Error('Background reader did not match the controlled character ID');
        candidate=r3AutoCandidate();
        // A new private dialog may need one extra Vue render to expose its
        // official title. Don't impose the old 60-second retry backoff.
        if(!candidate)R3_AUTO.lastOpenAttempt=0;
        // Roll20's title may load after the frame. Never import before its
        // authenticated name is available; the next timer will retry it.
        if(!candidate)r3AutoDisplay('Waiting for the private character sheet to finish loading');
      }catch(e){
        if(R3_AUTO.enabled&&generation===R3_AUTO.generation){
          // A player-initiated reveal is a cancellation, not an opener fault:
          // don't impose the full one-minute failure backoff after they close.
          if(/Player opened the original sheet|original Roll20 sheet is being opened/i.test(
            String(e?.message||e)))R3_AUTO.lastOpenAttempt=0;
          r3AutoDisplay('Background reader: '+r3String(e?.message||e,170));
        }
      }finally{R3_AUTO.opening=false;}
    }else if(!identity.model){
      // Compatibility fallback for older editors lacking the model view:
      // this still requires an exact Journal identity and script ownership.
      r3AutoOpenFromJournal(now);
    }else{
      r3AutoDisplay('Background reader character identity disagrees with the selected token');
    }
    if(!candidate)return;
  }
  if(R3_AUTO.origin==='visible'&&!candidate.visible)return;
  r3AutoRemember(candidate);
  const background=R3_AUTO.origin!=='visible'&&
    (r3NativeIsOwned(candidate)||r3AutoMoveOffscreen(candidate));
  // Only navigate sheet tabs when the script itself opened an offscreen
  // dialog. A player-opened visible sheet is read without changing tabs.
  const mode=background&&now-R3_AUTO.lastFull>300000?'all':'current';
  // Event-triggered current-view checks bypass the periodic 12-second gate,
  // but retain a 2-second minimum between heavier DOM reads. Full-tab
  // traversal remains limited to the established background scheduler.
  if(now-R3_AUTO.lastScan<(mode==='all'?10000:eventTriggered?650:6000))return;
  R3_AUTO.running=true;
  const generation=R3_AUTO.generation;
  r3UIRefresh();
  try{
    // Populate confirmed actions/resources progressively rather than
    // withholding every mapped button until the final secondary tab finishes.
    // Only the exact reader for this character/generation may contribute.
    const quickTabs=/^(?:Current view|Combat|Features\s*(?:&|and)\s*Traits|Inventory|Spells)$/i;
    const published=new Set();
    const onProgress=mode==='all'&&background?(partial,tab)=>{
      if(!quickTabs.test(tab)||published.has(tab.toLowerCase()))return;
      if(!R3_AUTO.enabled||generation!==R3_AUTO.generation||
         R3_AUTO.characterId!==r3AutoId(candidate)||
         R3_AUTO.name.toLowerCase()!==r3String(partial?.name,120).toLowerCase()||
         R3_TOKEN.active?.characterId!==R3_AUTO.characterId||
         R3_UI.busy||!r3NativeIsOwned(candidate))return;
      try{
        r3AutoStoreSnapshot(partial,'current');
        published.add(tab.toLowerCase());
        r3AutoDisplay('Mapped '+tab+'; continuing remaining tabs');
      }catch{/* Unpopulated Vue panel: await next verified primary tab. */}
    }:null;
    const snapshot=await r3SendScan(candidate,mode,onProgress);
    // A disabled auto-sync must never publish a late response.
    if(!R3_AUTO.enabled||R3_AUTO.generation!==generation)return;
    r3AutoStoreSnapshot(snapshot,mode);
    R3_AUTO.lastScan=Date.now();
    if(mode==='all')R3_AUTO.lastFull=R3_AUTO.lastScan;
    r3AutoDisplay((candidate.type==='popout'?'Popout sheet':background?'Background':'Visible sheet')+' '+mode+
      ' import updated '+new Date(R3_AUTO.lastScan).toLocaleTimeString());
  }catch(e){
    R3_AUTO.lastScan=Date.now();
    if(R3_AUTO.enabled)r3AutoDisplay('Waiting: '+r3String(e?.message||e,170));
  }finally{R3_AUTO.running=false;r3UIRefresh();}
}

function r3AutoStoreHealth(snapshot){
  if(snapshot?.schema!==3||r3String(snapshot.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())
    return false;
  if(R3_AUTO.origin==='visible'&&!r3DmAutoAllowed())return false;
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
  r3Save(R3_UI.snapshot);r3TokenRecordSnapshot(R3_UI.snapshot);r3UIRefresh();
  r3AutoDisplay('HP '+nextStats.hp+(nextStats.maxHp!==undefined?'/'+nextStats.maxHp:'')+
    ' updated '+new Date().toLocaleTimeString());
  return true;
}
async function r3AutoHealthTick(){
  if(!R3_AUTO.enabled||!R3_AUTO.name||R3_AUTO.healthRunning||R3_AUTO.running||
     R3_NATIVE.busy||R3_UI.busy)return;
  const candidate=r3AutoCandidate();
  if(!candidate)return;
  const generation=R3_AUTO.generation;
  R3_AUTO.healthRunning=true;
  try{
    const snapshot=await r3SendScan(candidate,'hp');
    if(R3_AUTO.enabled&&!R3_AUTO.running&&!R3_UI.busy&&R3_AUTO.generation===generation)
      r3AutoStoreHealth(snapshot);
  }catch{
    // A missing/unmounted HP input or unavailable official iframe/popout
    // is not a fabricated zero. The slower importer reports its status.
  }finally{
    R3_AUTO.lastHealth=Date.now();R3_AUTO.healthRunning=false;
  }
}

function r3ToggleAuto(){
  // A verified selection uses the native sheet for the user's requested
  // Attacks/Features without a manual settings switch. Do not let an old
  // Debug "sync off" action suspend the selected token's private importer.
  const activeToken=R3_TOKEN.active;
  if(activeToken?.tokenId&&activeToken?.characterId&&activeToken?.name){
    r3AutoFollowToken(activeToken);
    r3AutoDisplay('Selected-token private sheet sync is automatic');
    return;
  }
  // DM sheet sync is scoped to this open dialog, not a persistent
  // name-only manual importer. Toggling it off/on must never reinterpret
  // the DM viewer as a Player Character private-reader session.
  if(R3_TOKEN.visibleSheetId&&!R3_TOKEN.active){
    const same=R3_AUTO.origin==='visible'&&
      R3_AUTO.characterId===R3_TOKEN.visibleSheetId;
    const enabled=same&&R3_AUTO.enabled;
    R3_AUTO.generation++;
    if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
    R3_AUTO.dirtyTimer=null;
    R3_AUTO.enabled=!enabled;R3_AUTO.origin='visible';
    R3_AUTO.characterId=R3_TOKEN.visibleSheetId;
    R3_AUTO.name=r3String(R3_UI.snapshot?.name,120);
    if(R3_AUTO.enabled){
      R3_AUTO.lastScan=0;
      r3AutoDisplay('Following current DM sheet: '+R3_AUTO.name);
      r3AutoTick();
    }else r3AutoDisplay('DM sheet sync paused for this open sheet');
    return;
  }
  if(R3_AUTO.enabled){
    R3_AUTO.enabled=false;R3_AUTO.explicitlyDisabled=true;
    R3_AUTO.generation++;
    if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
    R3_AUTO.dirtyTimer=null;
    r3AutoSave();r3AutoRestoreDialog();
    r3AutoDisplay('');return;
  }
  const selected=r3Candidates().find(c=>c.key===R3_UI.selected);
  const active=R3_TOKEN.active;
  const name=r3String(active?.name||R3_UI.snapshot?.name||selected?.name,120);
  if(!name||/^(?:2024 character sheet|unnamed sheet)/i.test(name)){
    r3UIStatus('Import a named character once before enabling auto-sync.');
    r3AutoDisplay();
    return;
  }
  // Auto-sync is bound to a character identity, not to the first sheet
  // ever imported in this campaign. Clear the old character's ID before
  // enabling a different character (the user selected this explicitly).
  if(R3_AUTO.name.toLowerCase()!==name.toLowerCase())R3_AUTO.characterId='';
  R3_AUTO.enabled=true;R3_AUTO.explicitlyDisabled=false;
  R3_AUTO.generation++;R3_AUTO.name=name;
  R3_AUTO.origin=active?'token':'manual';
  if(active)R3_AUTO.characterId=active.characterId;
  else if(selected&&selected.name.toLowerCase()===name.toLowerCase())
    r3AutoRemember(selected);
  r3AutoSave();r3AutoDisplay('Enabled for '+name+'; checking Roll20 session');
  r3AutoTick();
}
function r3StartAuto(){
  r3AutoLoad();
  r3AutoDisplay();
  if(R3_AUTO.timer===null)R3_AUTO.timer=setInterval(()=>{r3AutoTick();},3000);
  if(R3_AUTO.healthTimer===null)R3_AUTO.healthTimer=setInterval(()=>{r3AutoHealthTick();},500);
  if(R3_AUTO.enabled)setTimeout(()=>{r3AutoTick();},180);
}

