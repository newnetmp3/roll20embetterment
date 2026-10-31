/* Main Roll20 editor coordinator. No private API calls or generated rolls. */
(()=>{
if(location.origin!==R4.editor||!/^\/editor(?:\/|$)/.test(location.pathname)||
   window.top!==window)return;
const state={
  game:'',mode:'unbound',id:'',name:'',token:null,snapshot:null,
  roster:new Map(),cache:new Map(),errors:new Map(),progress:new Map(),
  activeReader:null,owned:null,busy:false,scanKey:'',lastScan:0,
  pending:new Map(),ready:new Map(),selectionStatus:'Waiting for Jumpgate',
  actionUsed:{action:false,bonus:false,reaction:false},
  distance:0,lastXY:null,tab:'attacks',theme:'bg3',dock:'bottom',
  displayName:'',status:'Loading Roll20',logs:[],revision:0
};
const repaint=()=>state.repaint?.();
const log=(group,detail)=>{
  state.logs.push(new Date().toLocaleTimeString()+' '+group+': '+R4.text(detail,250));
  if(state.logs.length>80)state.logs.shift();
  repaint();
};
const isGM=()=>window.is_gm===true||window.is_gm===1;
function gameId(){
  const raw=window.Campaign?.id||R4.model(window.Campaign,'_id')||
    location.pathname.split('/').filter(Boolean)[1];
  return R4.id(raw);
}
function playerId(){
  return R4.id(window.currentPlayer?.id||R4.model(window.currentPlayer,'_id')||
    window.playerid||'');
}
function character(id){
  return window.Campaign?.characters?.get?.(id)||
    (window.Campaign?.characters?.models||[]).find(x=>x.id===id)||null;
}
function authorized(id){
  const m=character(id);
  return !!m&&R4.authorized(m,playerId());
}
function journal(){
  const root=document.querySelector('#journalfolderroot');
  if(!root)return [];
  const result=[];
  for(const el of [...root.querySelectorAll('li.journalitem.character[data-itemid]')].slice(0,180)){
    const id=R4.id(el.getAttribute('data-itemid'));
    const name=R4.text(el.querySelector('.dd-content .name .namecontainer')?.textContent,120);
    if(!id||!name)continue;
    const m=character(id);
    if(m&&!R4.same(name,R4.model(m,'name')))continue;
    if(!isGM()&&!authorized(id))continue;
    result.push({id,name,element:el});
  }
  return result;
}
function refreshRoster(){
  const before=state.roster;
  const records=journal();
  if(!document.querySelector('#journalfolderroot'))return;
  const next=new Map(records.map(({id,name,element})=>[id,{id,name,element}]));
  for(const [id,item] of before)if(!next.has(id)||next.get(id).name!==item.name){
    state.cache.delete(id);state.progress.delete(id);state.errors.delete(id);
    if(state.mode==='preview'&&state.id===id)resetActive('Journal authorization changed');
  }
  state.roster=next;
}
function editorSelection(){
  const getter=window.jumpgate?.tabletop?.getSelection;
  if(typeof getter!=='function'){
    state.selectionStatus='Native Jumpgate selection API not exposed';
    return null;
  }
  let selected;
  try{selected=getter.call(window.jumpgate.tabletop);}
  catch{state.selectionStatus='Jumpgate selection getter failed';return null;}
  if(!Array.isArray(selected)){state.selectionStatus='Unexpected Jumpgate selection shape';return null;}
  if(!selected.length){state.selectionStatus='No token selected';return null;}
  for(const node of selected.slice().reverse()){
    const m=node?.dataWrapper?.model||node?.model;
    if(!m||typeof m.get!=='function')continue;
    const id=R4.id(R4.model(m,'represents'));
    if(!id||!authorized(id))continue;
    const c=character(id);
    const name=R4.text(R4.model(c,'name'),120);
    if(name){state.selectionStatus='Verified controlled token';return {id,name,model:m};}
  }
  state.selectionStatus='Selection contains no verified controlled character';
  return null;
}
function resetActive(reason){
  if(state.owned)releaseOwned();
  state.mode='unbound';state.id='';state.name='';state.snapshot=null;
  state.activeReader=null;state.token=null;state.lastXY=null;state.distance=0;
  state.actionUsed={action:false,bonus:false,reaction:false};
  state.status=reason;repaint();
}
function activate(mode,id,name,token=null){
  if(state.owned&&state.id!==id)releaseOwned();
  if(state.mode===mode&&state.id===id&&R4.same(state.name,name))return;
  state.mode=mode;state.id=id;state.name=name;state.token=token;
  state.snapshot=state.cache.get(id)?.name===name?state.cache.get(id).snapshot:null;
  state.activeReader=null;state.actionUsed={action:false,bonus:false,reaction:false};
  state.distance=0;state.lastXY=null;state.status='Reading '+name;
  repaint();
}
function manualIdentity(dialog){
  const m=character(dialog.id);
  const modelName=R4.text(R4.model(m,'name'),120);
  const title=R4.text(dialog.el.closest('.ui-dialog')?.querySelector('.ui-dialog-title')?.textContent||
    dialog.el.getAttribute('aria-label'),160);
  const match=title.match(/^Character sheet for (.{2,120})$/i);
  const titleName=R4.text(match?.[1],120);
  if(modelName&&titleName&&!R4.same(modelName,titleName))return null;
  if(!isGM()&&!authorized(dialog.id))return null;
  const name=modelName||titleName;
  return name?{id:dialog.id,name,element:null}:null;
}
function dialogs(){
  const list=[];
  for(const el of document.querySelectorAll('.characterdialog[data-characterid]')){
    const id=R4.id(el.getAttribute('data-characterid'));
    const iframe=el.querySelector('iframe[src*="advanced-sheets.production.roll20preflight.net"]');
    if(!id||!iframe?.contentWindow||!iframe.src.includes('/dnd2024byroll20'))continue;
    list.push({id,el,iframe,window:iframe.contentWindow,
      owned:el.getAttribute('data-r4-owned')==='1'});
  }
  return list;
}
function request(frame,type,params={},timeout=76000){
  return new Promise((resolve,reject)=>{
    const id='r4-'+Math.random().toString(36).slice(2)+Date.now();
    const timer=setTimeout(()=>{
      state.pending.delete(id);reject(Error('Official Roll20 sheet reader timed out'));
    },timeout);
    state.pending.set(id,{source:frame.window,resolve,reject,timer,onProgress:params.onProgress});
    const {onProgress,...payload}=params;
    try{frame.window.postMessage({protocol:R4.protocol,type,request:id,...payload},R4.sheet);}
    catch(e){clearTimeout(timer);state.pending.delete(id);reject(e);}
  });
}
function receive(event){
  if(event.origin!==R4.sheet||!event.data||event.data.protocol!==R4.protocol)return;
  const frame=dialogs().find(d=>d.window===event.source);
  if(!frame)return; // never trust a settings iframe, unrelated popout, or stale window
  const data=event.data;
  if(data.type==='ready'){
    state.ready.set(event.source,{session:data.session,name:R4.text(data.name)});
    return;
  }
  const pending=state.pending.get(data.request);
  if(!pending||pending.source!==event.source)return;
  if(data.type==='progress'){
    pending.onProgress?.(data);return;
  }
  if(!['result','error','invoked'].includes(data.type))return;
  clearTimeout(pending.timer);state.pending.delete(data.request);
  if(data.type==='error')pending.reject(Error(R4.text(data.error,250)));
  else pending.resolve(data);
}
window.addEventListener('message',receive);
async function waitReader(frame,expected,generation){
  for(let attempt=0;attempt<100;attempt++){
    if(state.game!==generation||!frame.el.isConnected)throw Error('Reader identity changed');
    const ready=state.ready.get(frame.window);
    if(ready?.name&& !R4.same(ready.name,expected))
      throw Error('Official reader character mismatch');
    if(ready?.session&&ready.name&&R4.same(ready.name,expected))return;
    frame.window.postMessage({protocol:R4.protocol,type:'hello'},R4.sheet);
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Official reader did not initialize. Check browser site access for advanced-sheets.production.roll20preflight.net');
}
function ownedStyle(){
  if(document.getElementById('r4-owned-style'))return;
  const s=document.createElement('style');s.id='r4-owned-style';
  s.textContent='[data-r4-owned="1"],[data-r4-wrapper="1"]{position:fixed!important;left:-20000px!important;top:-20000px!important;opacity:0!important}'+
    '[data-r4-overlay="1"]{opacity:0!important;pointer-events:none!important}';
  document.head.append(s);
}
function releaseOwned(){
  const own=state.owned;
  if(!own)return;
  state.owned=null;
  for(const [el,attr] of own.marked)el.removeAttribute(attr);
  const frame=own.frame;
  if(!frame.el.isConnected)return;
  const close=own.wrapper?.querySelector('.ui-dialog-titlebar-close');
  if(close&&typeof close.click==='function'){
    close.click();return;
  }
  // Never leave an invisible, unclosable official sheet.
  log('Reader','Owned sheet has no verified close button; restored visibly for manual closing');
}
async function openOwned(entry){
  if(state.owned)throw Error('Another owned reader is active');
  if(dialogs().length)throw Error('A manual Roll20 sheet is open; background preload deferred');
  const target=state.roster.get(entry.id);
  if(!target||target.name!==entry.name||
    (!isGM()&&!authorized(entry.id)))throw Error('Journal access changed');
  const before=new Set([...document.querySelectorAll('.characterdialog')]);
  const overlays=new Set([...document.querySelectorAll('.ui-widget-overlay')]);
  const m=character(entry.id);
  let frame=null;
  const claim=()=>{
    const newFrames=dialogs().filter(d=>!before.has(d.el)&&d.id===entry.id);
    if(newFrames.length!==1)return;
    frame=newFrames[0];
    const wrapper=frame.el.closest('.ui-dialog')||frame.el;
    const marked=[[frame.el,'data-r4-owned'],[wrapper,'data-r4-wrapper']];
    ownedStyle();
    for(const [el,attr] of marked)el.setAttribute(attr,'1');
    const extra=[...document.querySelectorAll('.ui-widget-overlay')].filter(x=>!overlays.has(x));
    if(extra.length===1){extra[0].setAttribute('data-r4-overlay','1');marked.push([extra[0],'data-r4-overlay']);}
    state.owned={frame,wrapper,marked};
  };
  const watcher=new MutationObserver(()=>{if(!frame)claim();});
  watcher.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-characterid']});
  try{
    if(typeof m?.view?.showDialog==='function')m.view.showDialog();
    else if(!target.element)throw Error('No official Journal row opener for the verified character');
    else target.element.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
    for(let i=0;i<36&&!frame;i++){
      claim();
      if(!frame)await new Promise(r=>setTimeout(r,150));
    }
    if(!frame)throw Error('Roll20 did not create a new, exact-ID private sheet');
    return frame;
  }finally{watcher.disconnect();}
}
async function importEntry(entry,{owned=true}={}){
  if(state.busy)return;
  const generation=state.game;
  state.busy=true;state.progress.set(entry.id,{done:0,total:1});
  state.status='Waiting for Roll20 resources';repaint();
  let frame=null;
  try{
    frame=owned?await openOwned(entry):dialogs().find(x=>x.id===entry.id&&!x.owned);
    if(!frame)throw Error('Verified official sheet is unavailable');
    await waitReader(frame,entry.name,generation);
    const result=await request(frame,'scan',{
      expectedName:entry.name,all:owned,
      onProgress:info=>{
        state.progress.set(entry.id,{done:info.completed,total:info.total});
        state.status=info.phase==='reading'?'Importing official tabs':'Waiting for Roll20 resources';
        repaint();
      }
    });
    if(state.game!==generation||state.roster.get(entry.id)?.name!==entry.name||
       (!isGM()&&!authorized(entry.id)))throw Error('Journal permission changed during import');
    if(!R4.same(result.snapshot?.name,entry.name)||!R4.hasData(result.snapshot))
      throw Error('Reader result failed name/data verification');
    state.cache.set(entry.id,{name:entry.name,snapshot:result.snapshot});
    state.errors.delete(entry.id);
    state.progress.set(entry.id,{done:1,total:1,complete:true});
    if(state.id===entry.id){
      state.snapshot=result.snapshot;
      if(state.mode==='player')state.activeReader=owned?frame:null;
    }
    state.status='Imported '+entry.name;repaint();
  }catch(e){
    state.errors.set(entry.id,R4.text(e?.message||e,200));
    state.status='Import failed: '+entry.name;
    log('Import',entry.name+': '+(e?.message||e));
  }finally{
    // DM preview actions never use private sessions. Retaining player-owned
    // readers is intentional: real buttons can be invoked later.
    if(owned&&!(state.mode==='player'&&state.activeReader===frame))releaseOwned();
    state.busy=false;repaint();
  }
}
function percent(){
  const all=[...state.roster.keys()];
  const completed=all.filter(id=>state.progress.get(id)?.complete).length;
  const current=[...state.progress.entries()].find(([id,p])=>!p.complete&&p.done);
  return R4.progress(completed,all.length,current?.[1].done||0,
    current?.[1].total||1,state.errors.size);
}
function activeSnapshot(){
  return state.snapshot||state.cache.get(state.id)?.snapshot||null;
}
async function invoke(action){
  if(state.mode!=='player'||!state.id||!authorized(state.id)||
     !state.token||!state.activeReader||!action?.actionId){
    log('Action','Blocked: only a verified controlled token with a live native sheet button can act');
    return;
  }
  if(!state.activeReader.el.isConnected){log('Action','Native sheet was closed');return;}
  try{
    const result=await request(state.activeReader,'invoke',{
      expectedName:state.name,actionId:action.actionId,actionName:action.name},8000);
    if(result.type!=='invoked')throw Error('Native Roll20 action not confirmed');
    state.status='Native action sent: '+action.name;repaint();
  }catch(e){log('Action',e.message);}
}
function measure(){
  const token=state.token;if(state.mode!=='player'||!token)return;
  const x=Number(R4.model(token,'left')),y=Number(R4.model(token,'top'));
  if(!Number.isFinite(x)||!Number.isFinite(y))return;
  if(state.lastXY){
    const page=window.Campaign?.activePage?.()||window.Campaign?.pages?.get?.(R4.model(window.Campaign,'playerpageid'));
    const scale=Number(R4.model(page,'scale_number'))||5;
    const grid=Number(R4.model(page,'snapping_increment'))||1;
    const ftPerPixel=scale/(70*grid);
    if(ftPerPixel>0&&ftPerPixel<10){
      const delta=Math.hypot(x-state.lastXY.x,y-state.lastXY.y)*ftPerPixel;
      if(delta>0&&delta<10000)state.distance+=delta;
    }
  }
  state.lastXY={x,y};
}
function sync(){
  const current=gameId();
  if(!current)return;
  if(state.game!==current){
    releaseOwned();state.game=current;state.roster.clear();state.cache.clear();
    state.errors.clear();state.progress.clear();resetActive('New campaign');
  }
  refreshRoster();
  const selected=editorSelection();
  if(selected){
    if(!state.roster.has(selected.id)){
      const m=character(selected.id);
      if(m&&authorized(selected.id))state.roster.set(selected.id,
        {id:selected.id,name:selected.name,element:null});
    }
    if(state.mode!=='player'||state.id!==selected.id||state.token!==selected.model)
      activate('player',selected.id,selected.name,selected.model);
    measure();
  }else if(state.mode==='player'){
    resetActive('Waiting for a controlled token');
  }
  if(!selected&&state.mode==='unbound'){
    const visible=dialogs().filter(x=>!x.owned&&x.el.getClientRects().length);
    if(visible.length===1){
      const d=visible[0],entry=state.roster.get(d.id)||manualIdentity(d);
      if(entry){
        if(!state.roster.has(d.id))state.roster.set(d.id,entry);
        activate('dm-sheet',d.id,entry.name);
      }
    }
  }
  if(state.mode==='dm-sheet'&&!dialogs().some(d=>d.id===state.id&&!d.owned))
    resetActive('Manual sheet closed');
  if(!state.busy){
    const active=state.roster.get(state.id);
    const next=(state.mode==='player'&&active&&!state.activeReader&&
      !state.errors.has(active.id)?active:null)||
      [...state.roster.values()].find(x=>!state.progress.get(x.id)?.complete&&
      !state.errors.has(x.id)&&!state.cache.has(x.id));
    if(next&&!state.owned&&!dialogs().some(x=>!x.owned)){
      void importEntry(next,{owned:true});
    }else if(state.mode==='dm-sheet'&&active&&!state.cache.has(state.id)){
      void importEntry(active,{owned:false});
    }
  }
  repaint();
}
function retry(){state.errors.clear();for(const [id,p] of state.progress)
  if(!p.complete)state.progress.delete(id);state.status='Retrying official reads';repaint();}
function preview(id){
  const e=state.roster.get(id);if(!e)return;
  activate('preview',e.id,e.name);
  state.status='Read-only Journal preview';repaint();
}
window.addEventListener('beforeunload',()=>releaseOwned());
window.addEventListener('pagehide',()=>releaseOwned());
const api={state,log,refreshRoster,preview,retry,invoke,activeSnapshot,percent,resetActive,sync,releaseOwned};
R4UI(api);
setInterval(sync,700);
sync();
})();
