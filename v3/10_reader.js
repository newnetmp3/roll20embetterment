// v3 authenticated cross-origin reader and explicit, bounded tab traversal.
const R3_PENDING=new Map();
const R3_POPOUTS=new Map();
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
async function r3CollectAllTabs(progress){
  // Vue can replace every tab element after clicking a tab. Store labels
  // and stable tablist identities, NOT stale element references.
  const descriptors=()=>r3Tabs().map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const original=r3Tabs().filter(r3Active).map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const acc=r3Empty(),seen=new Set();
  let visited=0;
  const primaryLabel=/^(combat|spells|inventory|features\s*(?:&|and)\s*traits|skills\s*(?:&|and)\s*tools|notes|about)$/i;
  const collect=label=>{
    r3Merge(acc,r3Capture(document.body,label));visited++;
    progress?.(label,r3Coverage(acc));
  };
  const visit=async ({key,label})=>{
    if(visited>=32||seen.has(key))return false;
    const tab=r3ResolveTab(key,label);
    if(!tab||!r3Shown(tab)){
      acc.diagnostics.notes.push('Tab not available when visited: '+label);
      return false;
    }
    seen.add(key);
    if(!r3Active(tab)){
      tab.click();await r3Pause(290);
    }
    collect(label);
    return true;
  };
  try{
    collect('Current view');
    const initial=descriptors();
    // The six main 2024 sheet panels must not be pushed out of the first
    // 14 tabs by nested filter tabs (a previous source of false zeroes).
    const main=initial.filter(x=>primaryLabel.test(x.label));
    for(const mainTab of main){
      if(visited>=32)break;
      if(!await visit(mainTab))continue;
      const children=descriptors().filter(x=>!primaryLabel.test(x.label)&&!seen.has(x.key)).slice(0,20);
      for(const child of children){
        if(visited>=32)break;
        await visit(child);
      }
    }
    // Visit any other initially visible tabs missed by the priority pass.
    for(const extra of initial.filter(x=>!primaryLabel.test(x.label))){
      if(visited>=32)break;
      await visit(extra);
    }
  }finally{
    // Restore by identity rather than trying to click detached old nodes.
    for(const prior of original){
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
async function r3ReaderScan(mode,sendProgress){
  if(mode==='all')return r3CollectAllTabs(sendProgress);
  if(mode==='hp')return r3CaptureHealth(document.body);
  return r3Capture(document.body,r3CurrentTabLabel());
}
async function r3ReaderReceive(event){
  const peer=r3ReaderPeer();if(!peer||event.source!==peer||event.origin!==R3_EDITOR)return;
  const data=event.data;if(data?.protocol!==R3_PROTOCOL)return;
  if(data.type==='hello'){r3ReaderAnnounce();return;}
  if(data.type==='native-probe'||data.type==='native-invoke'){
    r3NativeReaderHandle(peer,data);return;
  }
  if(data.type!=='scan'||typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  if(!['current','all','hp'].includes(data.mode))return;
  try{
    const snap=await r3ReaderScan(data.mode,(tab,coverage)=>{
      peer.postMessage(r3Msg('progress',{id:data.id,tab,coverage}),R3_EDITOR);
    });
    peer.postMessage(r3Msg('result',{id:data.id,snapshot:snap,session:R3_SESSION}),R3_EDITOR);
  }catch(error){
    peer.postMessage(r3Msg('failure',{id:data.id,error:r3String(error?.message||error,250)}),R3_EDITOR);
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
  const timer=setInterval(()=>{if(++attempts>=24)clearInterval(timer);else r3ReaderAnnounce();},1500);
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
      const name=r3String(frame.getAttribute('title')||frame.closest('.characterdialog')?.querySelector('.asv__header__name')?.textContent||'',90)
        .replace(/^Character sheet for\s+/i,'');
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
    return;
  }
  if(!['result','failure'].includes(data.type))return;
  clearTimeout(pending.timeout);R3_PENDING.delete(data.id);
  if(data.type==='failure')pending.reject(new Error(r3String(data.error,250)));
  else if(!data.snapshot||data.snapshot.schema!==3)pending.reject(new Error('Malformed sheet snapshot'));
  else pending.resolve(data.snapshot);
}
function r3SendScan(candidate,mode){
  if(!candidate?.window)return Promise.reject(new Error('No matching official 2024 iframe or popout'));
  if(!candidate.visible)return Promise.reject(new Error('Sheet iframe is hidden. Open the character sheet in Roll20 first.'));
  return new Promise((resolve,reject)=>{
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-'+(++r3Counter);
    const timeout=setTimeout(()=>{R3_PENDING.delete(id);reject(new Error(
      'Official sheet reader did not answer. Ensure the new userscript is active on the advanced-sheets.production.roll20preflight.net domain and reload the character sheet.'));},
      mode==='all'?40000:mode==='hp'?2500:12000);
    R3_PENDING.set(id,{resolve,reject,window:candidate.window,timeout});
    try{candidate.window.postMessage(r3Msg('scan',{id,mode}),R3_ORIGIN);}
    catch(e){R3_PENDING.delete(id);clearTimeout(timeout);reject(e);}
  });
}
function r3StartEditorBridge(){
  if(r3ListenerStarted)return;r3ListenerStarted=true;
  window.addEventListener('message',r3Listen);
}
