// v3 authenticated cross-origin reader and explicit, bounded tab traversal.
const R3_PENDING=new Map();
const R3_POPOUTS=new Map();
const R3_READER_ACTIVE=new Set(),R3_READER_CANCELLED=new Set();
const R3_SESSION=(crypto.randomUUID?.()||('session-'+Date.now()+'-'+Math.random())).slice(0,100);
let r3Counter=0,r3ListenerStarted=false,r3ReaderDirtyTimer=null;
function r3SheetContext(){return location.origin===R3_ORIGIN&&/\/dnd2024byroll20(?:\/|$)/.test(location.pathname);}
function r3EditorContext(){return location.origin===R3_EDITOR&&/^\/editor(?:\/|$)/.test(location.pathname);}
function r3ReaderPeer(){
  if(window.parent!==window)return window.parent;
  try{return window.opener&&!window.opener.closed?window.opener:null;}catch{return null;}
}
function r3Msg(type,extras={}){return {protocol:R3_PROTOCOL,type,...extras};}
function r3TabLabel(el){return r3String(el?.getAttribute?.('aria-label')||r3Text(el,80),80);}
function r3Tabs(){
  const all=Array.from(document.querySelectorAll('[role="tab"],.layout-tabbed-panel__tab-link[role="tab"]')).slice(0,150);
  return [...new Set(all)].filter(el=>r3Shown(el)&&!el.disabled&&r3TabLabel(el)&&r3TabLabel(el).length<65);
}
function r3Active(tab){return tab?.getAttribute?.('aria-selected')==='true'||tab?.getAttribute?.('data-state')==='active'||/\b(active|selected|current)\b/i.test(String(tab?.className||''));}
function r3Pause(ms){return new Promise(r=>setTimeout(r,ms));}
function r3TabKey(tab){
  const group=tab?.closest?.('[role="tablist"]');
  const groupName=r3Attr(group,'aria-label')||r3Attr(group,'id')||
    r3String(group?.className,80)||'tablist';
  return groupName+'|'+r3TabLabel(tab).toLowerCase();
}
function r3ResolveTab(key,label){
  const tabs=r3Tabs();
  return tabs.find(tab=>r3TabKey(tab)===key)||
    tabs.find(tab=>r3TabLabel(tab).toLowerCase()===label.toLowerCase())||null;
}
async function r3CollectAllTabs(progress,shouldCancel=()=>false){
  const check=()=>{
    if(shouldCancel())throw new Error('Private all-tab scan cancelled for manual sheet access');
  };
  // Vue can replace every tab element after clicking a tab. Store labels
  // and stable tablist identities, NOT stale element references.
  const descriptors=()=>r3Tabs().map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const original=r3Tabs().filter(r3Active).map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const acc=r3Empty(),seen=new Set(),planned=new Set();
  let visited=0;
  const plan=items=>{
    for(const item of items)if(item.key)planned.add(item.key);
    // Plan metadata is attached to the next real tab progress event.
    // Never emit a synthetic tab that confuses existing importer callers.
  };
  const primaryLabel=/^(combat|spells|inventory|features\s*(?:&|and)\s*traits|skills\s*(?:&|and)\s*tools|notes|about)$/i;
  const collect=label=>{
    check();
    r3Merge(acc,r3Capture(document.body,label));visited++;
    progress?.(label,r3Coverage(acc),{
      totalTabs:Math.min(32,Math.max(visited,planned.size)),
      completedTabs:visited});
  };
  const visit=async ({key,label})=>{
    check();
    if(visited>=32||seen.has(key))return false;
    const tab=r3ResolveTab(key,label);
    if(!tab||!r3Shown(tab)){
      acc.diagnostics.notes.push('Tab not available when visited: '+label);
      return false;
    }
    seen.add(key);
    if(!r3Active(tab)){
      tab.click();await r3Pause(290);check();
    }
    collect(label);
    return true;
  };
  try{
    check();
    collect(r3CurrentTabLabel());
    const initial=descriptors();
    plan(initial);
    // Put useful actionable data first. A 2024 sheet can have many nested
    // filter tabs; their repeated 290ms renders previously delayed *every*
    // resource and spell until the entire traversal completed.
    const priorities=['Combat','Features & Traits','Inventory','Spells',
      'Skills & Tools','Notes','About'];
    const rank=label=>{
      const i=priorities.findIndex(name=>name.toLowerCase()===label.toLowerCase());
      return i<0?priorities.length:i;
    };
    const main=initial.filter(x=>primaryLabel.test(x.label))
      .sort((a,b)=>rank(a.label)-rank(b.label));
    const deferred=[];
    for(const mainTab of main){
      if(visited>=32)break;
      if(!await visit(mainTab))continue;
      // Capture these same top-level tabs for the HUD before expensive
      // secondary filters. Deferred children are revisited below.
      const children=descriptors().filter(x=>!primaryLabel.test(x.label)&&!seen.has(x.key));
      plan(children);
      for(const child of children.slice(0,20))
        deferred.push({parent:mainTab,child});
    }
    // Follow each secondary view after the primary actions/resources have
    // already been reported. Re-acquire Vue elements on each switch.
    for(const {parent,child} of deferred){
      if(visited>=32)break;
      if(seen.has(child.key))continue;
      const parentTab=r3ResolveTab(parent.key,parent.label);
      if(!parentTab)continue;
      if(!r3Active(parentTab)){
        check();parentTab.click();await r3Pause(130);check();
      }
      await visit(child);
    }
    for(const extra of initial.filter(x=>!primaryLabel.test(x.label))){
      if(visited>=32)break;
      await visit(extra);
    }
  }finally{
    // A trusted manual-open cancelled this private traversal. Do not click
    // through the now player-owned sheet's tabs while restoring the reader.
    if(!shouldCancel())for(const prior of original){
      const tab=r3ResolveTab(prior.key,prior.label);
      if(tab&&!r3Active(tab)){tab.click();await r3Pause(130);}
    }
  }
  if(visited>=32)acc.diagnostics.limits.push('32 tab views maximum');
  const scanned=acc.diagnostics.tabs;
  if(!scanned.some(label=>/^inventory\b/i.test(label)))
    acc.diagnostics.notes.push('Inventory tab was not visited. Check whether its tab is exposed and visible.');
  else if(!acc.inventory.length)
    acc.diagnostics.notes.push('Inventory tab visited, but no identifiable item-name rows were rendered.');
  if(!acc.resources.length)
    acc.diagnostics.notes.push('No named resource trackers detected in rendered tabs; resource checkboxes may be nested or unmounted.');
  acc.diagnostics.notes.push('Only rendered DOM was read. Virtualized/offscreen rows are not guaranteed complete.');
  return r3Coverage(acc);
}
function r3CurrentTabLabel(){
  // An ordinary current-view scan must carry the real active primary tab:
  // generic 2024 inventory rows are deliberately imported only in Inventory.
  // Avoid guessing from a nested filter (e.g. "Weapons") or hidden tabs.
  const main=/^(?:combat|spells|inventory|features\s*(?:&|and)\s*traits|skills\s*(?:&|and)\s*tools|notes|about)$/i;
  const active=r3Tabs().filter(r3Active);
  return active.map(r3TabLabel).find(name=>main.test(name))||'Current view';
}
// Roll20's 2024 Vue iframe may announce ready before its character fields
// have mounted. Wait briefly for actual source-observed values, not simply
// a successful postMessage or an arbitrary page-ready event.
async function r3ReaderWaitHydrated(shouldCancel=()=>false){
  for(let i=0;i<24;i++){
    if(shouldCancel())throw new Error('Private reader cancelled while Vue loaded');
    const snapshot=r3Capture(document.body,r3CurrentTabLabel());
    const populated=typeof r3AutoHasRecognizedData==='function'?
      r3AutoHasRecognizedData(snapshot):
      Object.keys(snapshot.stats||{}).length>0;
    if(populated)return true;
    await r3Pause(250);
  }
  return false;
}
async function r3ReaderScan(mode,sendProgress,shouldCancel){
  if(mode==='all'){
    await r3ReaderWaitHydrated(shouldCancel);
    return r3CollectAllTabs(sendProgress,shouldCancel);
  }
  if(mode==='hp')return r3CaptureHealth(document.body);
  return r3Capture(document.body,r3CurrentTabLabel());
}
async function r3ReaderReceive(event){
  const peer=r3ReaderPeer();if(!peer||event.source!==peer||event.origin!==R3_EDITOR)return;
  const data=event.data;if(data?.protocol!==R3_PROTOCOL)return;
  if(data.type==='hello'){r3ReaderAnnounce();return;}
  if(data.type==='cancel-scan'){
    if(typeof data.id==='string'&&R3_READER_ACTIVE.has(data.id))
      R3_READER_CANCELLED.add(data.id);
    return;
  }
  if(data.type==='native-probe'||data.type==='native-invoke'){
    void r3NativeReaderHandle(peer,data).catch(error=>{
      try{peer.postMessage(r3Msg('native-result',{
        id:data.id,status:'blocked',session:R3_SESSION,
        message:'Official sheet could not inspect that attack: '+
          r3String(error?.message||error,145)}),R3_EDITOR);}catch{}
    });return;
  }
  if(data.type!=='scan'||typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  if(!['current','all','hp'].includes(data.mode))return;
  R3_READER_ACTIVE.add(data.id);
  try{
    const cancelled=()=>R3_READER_CANCELLED.has(data.id);
    const snap=await r3ReaderScan(data.mode,(tab,coverage,metadata)=>{
      if(!cancelled()){
        // Detailed snapshots for only the high-value panels. Sending large
        // inventory/control arrays for 20+ secondary filters on every visit
        // needlessly congests the main-thread postMessage channel.
        const priority=/^(?:Current view|Combat|Features\s*(?:&|and)\s*Traits|Inventory|Spells)$/i;
        const fast=priority.test(tab)&&coverage?.schema===3;
        peer.postMessage(r3Msg('progress',{
          id:data.id,tab,coverage:fast?coverage.coverage:undefined,
          snapshot:fast?coverage:undefined,
          totalTabs:metadata?.totalTabs,completedTabs:metadata?.completedTabs
        }),R3_EDITOR);
      }
    },cancelled);
    if(cancelled())throw new Error('Private scan cancelled for manual sheet access');
    peer.postMessage(r3Msg('result',{id:data.id,snapshot:snap,session:R3_SESSION}),R3_EDITOR);
  }catch(error){
    peer.postMessage(r3Msg('failure',{id:data.id,error:r3String(error?.message||error,250)}),R3_EDITOR);
  }finally{
    R3_READER_ACTIVE.delete(data.id);
    R3_READER_CANCELLED.delete(data.id);
  }
}
function r3ReaderAnnounce(){
  const peer=r3ReaderPeer();if(!peer)return;
  try{peer.postMessage(r3Msg('ready',{session:R3_SESSION,name:r3NameFromDocument(document),
    mode:window.parent===window?'popout':'iframe'}),R3_EDITOR);}catch{}
}
function r3ReaderChanged(event){
  const target=event?.target;
  if(!target||!r3Shown(target))return;
  if(event.type==='click'){
    // Support native checkbox/switch roles and inventory toggles even when
    // Roll20 renders them as non-input controls. Ordinary clicks, tab
    // navigation and attack rolls must not initiate an expensive scan.
    const control=target.closest?.('button,[role="checkbox"],[role="switch"],[aria-pressed]');
    if(!control)return;
    const hint=[r3Attr(control,'aria-label'),r3Attr(control,'title'),
      r3Attr(control,'data-testid'),r3String(control.className,140)].join(' ');
    const role=r3Attr(control,'role');
    const inventory=!!target.closest?.(
      '.item-row,.inventory-item,.equipment-item,[data-testid*="inventory-row"]');
    const stepperButton=inventory&&
      (r3InventoryStepperButton(control).minus||r3InventoryStepperButton(control).plus);
    if(!/(?:increment|decrement|stepper|counter|quantity|checkbox|charge|toggle-resource)/i.test(hint)&&
      !['checkbox','switch'].includes(role)&&!stepperButton&&
      !(inventory&&(/toggle/i.test(hint)||r3Attr(control,'aria-pressed'))))return;
  }else if(!['INPUT','TEXTAREA','SELECT'].includes(String(target.tagName||'').toUpperCase())
    &&!['spinbutton','checkbox','switch'].includes(r3Attr(target,'role')))return;
  if(r3ReaderDirtyTimer!==null)clearTimeout(r3ReaderDirtyTimer);
  // Debounce inside the actual official sheet so keystrokes send one small
  // authenticated hint instead of generating a cross-window message each.
  r3ReaderDirtyTimer=setTimeout(()=>{
    r3ReaderDirtyTimer=null;
    const peer=r3ReaderPeer();
    if(!peer)return;
    try{peer.postMessage(r3Msg('dirty',{session:R3_SESSION,
      name:r3NameFromDocument(document)}),R3_EDITOR);}catch{}
  },350);
}
function r3StartReader(){
  window.addEventListener('message',r3ReaderReceive);
  for(const type of ['input','change','click'])
    document.addEventListener(type,r3ReaderChanged,true);
  r3ReaderAnnounce();
  let attempts=0;
  // The private frame often mounts before Vue exposes its character name.
  // A quicker ready announcement removes a needless ~1.5s gap while the
  // authenticated editor waits for the exact selected character identity.
  const timer=setInterval(()=>{if(++attempts>=32)clearInterval(timer);else r3ReaderAnnounce();},500);
  window.addEventListener('focus',r3ReaderAnnounce);
}
function r3FrameList(){
  return Array.from(document.querySelectorAll('iframe')).slice(0,100)
    .filter(frame=>{
      try{
        const url=new URL(frame.src||frame.getAttribute('src'),location.href);
        return url.origin===R3_ORIGIN&&/\/dnd2024byroll20(?:\/|$)/.test(url.pathname);
      }catch{return false;}
    }).map((frame,i)=>{
      // DM-created sheets can retain a generic iframe title even after the
      // official reader has authenticated the live character name. Prefer an
      // observed name only for this exact frame/window, and refuse to merge
      // two contradictory non-generic identities.
      const title=r3String(frame.getAttribute('title')||'',90)
        .replace(/^Character sheet for\s+/i,'').trim();
      const header=r3String(frame.closest?.('.characterdialog')?.querySelector?.('.asv__header__name')?.textContent||'',90).trim();
      const reader=typeof R3_NATIVE==='object'?R3_NATIVE.readers.get(frame.contentWindow):null;
      const announced=r3String(reader?.name||'',90).trim();
      const generic=name=>!name||/^(?:2024 character sheet|unnamed sheet|official sheet popout)/i.test(name);
      const named=[title,header,announced].filter(name=>!generic(name));
      const conflict=new Set(named.map(name=>name.toLowerCase())).size>1;
      const name=conflict?'':(named[0]||'');
      return {key:'iframe-'+i,name:name||'2024 character sheet '+(i+1),frame,window:frame.contentWindow,
        visible:r3Shown(frame),type:'iframe'};
    });
}
function r3Candidates(){
  // Drop windows which were closed by the player. Don't retain dead popout
  // references or allow their stale names to block the next real sheet.
  for(const [session,candidate] of R3_POPOUTS){
    try{if(candidate.window.closed)R3_POPOUTS.delete(session);}
    catch{R3_POPOUTS.delete(session);}
  }
  return [...r3FrameList(),...R3_POPOUTS.values()];
}
function r3Listen(event){
  if(event.origin!==R3_ORIGIN||event.data?.protocol!==R3_PROTOCOL||!event.source)return;
  const data=event.data,candidate=r3Candidates().find(c=>c.window===event.source);
  if(data.type==='ready'){
    // Only a known frame or already registered popout can signal readiness.
    // A source name is checked again against the chosen HUD character.
    r3NativeReaderAnnounce(event,data,candidate);
    // Cross-origin official popouts announce their opener with the same
    // authenticated bridge as embedded official sheets. Roll20 often sends
    // an initial "ready" before Vue has populated the character's name.
    // Later announcements must refresh that session's identity.
    if(data.mode==='popout'&&/^[\w.:-]{6,100}$/.test(String(data.session||''))){
      const existing=R3_POPOUTS.get(data.session);
      if(existing&&existing.window!==event.source)return; // session collision
      if(!existing&&R3_POPOUTS.size>=16)return; // bounded registry
      const name=r3String(data.name,90);
      if(existing){
        // Vue can briefly unmount its name control during rerenders. Do not
        // replace a known identity with a generic loading-state title.
        if(name&&!/^(?:unnamed sheet|official sheet popout|2024 character sheet)/i.test(name))
          existing.name=name;
      }else{
        R3_POPOUTS.set(data.session,{key:'popout-'+data.session,
          name:name||'Official sheet popout',window:event.source,
          visible:true,type:'popout'});
      }
    }
    r3UIRefresh?.();
    return;
  }
  if(data.type==='dirty'){
    // Only a known official iframe or authenticated popup session may
    // request a re-read. A name match alone never authorizes an unknown
    // postMessage source or a different character.
    if(!candidate||typeof data.session!=='string'||!/^[\w.:-]{6,100}$/.test(data.session))return;
    if(candidate.type==='popout'&&candidate.key!=='popout-'+data.session)return;
    if(r3String(data.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())return;
    r3AutoQueueDirty(candidate);
    return;
  }
  if(data.type==='native-result'){
    if(!candidate)return;
    r3NativeResult(event,data);return;
  }
  const pending=R3_PENDING.get(data.id);
  if(!candidate||!pending||pending.window!==event.source)return;
  if(data.type==='progress'){
    r3UIStatus?.('Reading '+r3String(data.tab,65)+'…',data.coverage);
    // A partial result belongs only to the exact pending frame/scan ID,
    // already checked above. This is not an external or unverified sheet.
    if(pending.mode==='all'&&typeof pending.onProgress==='function')
      pending.onProgress(data.snapshot?.schema===3?data.snapshot:null,
        r3String(data.tab,65),{
          totalTabs:data.totalTabs,completedTabs:data.completedTabs
        });
    return;
  }
  if(!['result','failure'].includes(data.type))return;
  clearTimeout(pending.timeout);R3_PENDING.delete(data.id);
  if(data.type==='failure')pending.reject(new Error(r3String(data.error,250)));
  else if(!data.snapshot||data.snapshot.schema!==3)pending.reject(new Error('Malformed sheet snapshot'));
  else pending.resolve(data.snapshot);
}
// A newly opened Roll20 iframe can exist before the content-script reader
// has registered its message listener. Never fire a one-shot 'scan' into an
// unannounced window: that message is lost and causes a 40-second timeout.
async function r3WaitScanReader(candidate){
  const source=candidate?.window;
  if(!source)throw new Error('Official sheet has no active iframe window.');
  const initiallyOwned=typeof r3NativeIsOwned==='function'&&r3NativeIsOwned(candidate);
  for(let attempt=0;attempt<48;attempt++){
    if(initiallyOwned&&(
      (typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())||
      (typeof r3NativeIsOwned==='function'&&!r3NativeIsOwned(candidate))))
      throw new Error('Private reader was released for a manually opened Roll20 sheet.');
    const ready=R3_NATIVE.readers.get(source);
    if(ready?.session&&/^[\w.:-]{6,100}$/.test(ready.session)){
      // The sheet's authenticated reader may initially announce a generic
      // title before Vue mounts. Explicit conflicting names are not accepted.
      const name=r3String(ready.name,120);
      const expected=r3String(candidate.name,120);
      const generic=value=>!value||/^(?:unnamed sheet|official sheet popout|2024 character sheet)/i.test(value);
      if(!generic(name)&&!generic(expected)&&name.toLowerCase()!==expected.toLowerCase())
        throw new Error('Official sheet reader responded with a different character name.');
      return;
    }
    // The reader may finish booting after its initial ready broadcast.
    // A hello is idempotent and never starts a scan or modifies a sheet.
    try{source.postMessage(r3Msg('hello'),R3_ORIGIN);}catch{}
    await r3Pause(250);
  }
  throw new Error('Official sheet reader never initialized in this iframe. Check that the signed R20eb extension is enabled for advanced-sheets.production.roll20preflight.net, then reload the Roll20 editor and sheet.');
}
function r3SendScan(candidate,mode,onProgress=null,requireReady=false){
  if(!candidate?.window)return Promise.reject(new Error('No matching official 2024 iframe or popout'));
  if(!candidate.visible)return Promise.reject(new Error('Sheet iframe is hidden. Open the character sheet in Roll20 first.'));
  const start=()=>new Promise((resolve,reject)=>{
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-'+(++r3Counter);
    const timeout=setTimeout(()=>{R3_PENDING.delete(id);reject(new Error(
      'Official sheet reader initialized, but the '+mode+' scan did not finish. Inspect the Roll20 sheet tab and reader diagnostics.'));},
      mode==='all'?40000:mode==='hp'?2500:12000);
    R3_PENDING.set(id,{resolve,reject,window:candidate.window,timeout,mode,
      onProgress:typeof onProgress==='function'?onProgress:null});
    try{candidate.window.postMessage(r3Msg('scan',{id,mode}),R3_ORIGIN);}
    catch(e){R3_PENDING.delete(id);clearTimeout(timeout);reject(e);}
  });
  // Only script-owned Journal preloads need to await a fresh reader
  // handshake. Preserve the established immediate manual-sheet/UI read
  // semantics; never move or navigate a manually opened Roll20 dialog.
  return requireReady?r3WaitScanReader(candidate).then(start):start();
}
function r3CancelOwnedScans(){
  for(const [id,pending] of R3_PENDING){
    if(pending.mode!=='all')continue;
    const owned=r3Candidates().some(c=>c.window===pending.window&&r3NativeIsOwned(c));
    if(!owned)continue;
    try{pending.window.postMessage(r3Msg('cancel-scan',{id}),R3_ORIGIN);}catch{}
  }
}
function r3StartEditorBridge(){
  if(r3ListenerStarted)return;r3ListenerStarted=true;
  window.addEventListener('message',r3Listen);
}

