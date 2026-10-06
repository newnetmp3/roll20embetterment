// Communication between the Roll20 editor and the official D&D 2024 sheet.
// Supports both the embedded iframe and Roll20's official top-level popout.
// Only player-opened documents from the exact Roll20 advanced-sheet origin
// are allowed to exchange read-only snapshots with the editor.
const RBE_BEACON_ORIGIN='https://advanced-sheets.production.roll20preflight.net';
const RBE_EDITOR_ORIGIN='https://app.roll20.net';
const RBE_BRIDGE_MARKER='roll20-embetterment:beacon-sheet:v1';
const rbeFramePending=new Map();
const rbePopoutSheets=new Map();
let rbeFrameCounter=0;
let rbeReaderAck=false,rbeReaderAnnounceTimer=null,rbeReaderAnnounceCount=0;
const rbeReaderSession=(crypto.randomUUID?.()||('sheet-'+Date.now()+'-'+Math.random().toString(36).slice(2))).slice(0,100);

function isBeaconSheetDocument(){
  return location.hostname==='advanced-sheets.production.roll20preflight.net' &&
    /\/dnd2024byroll20(?:\/|$)/.test(location.pathname);
}
function isBeaconFrame(){
  return isBeaconSheetDocument() && window.parent!==window;
}
function isBeaconPopout(){
  return isBeaconSheetDocument() && window.parent===window;
}
function isRoll20Editor(){
  return location.hostname==='app.roll20.net'&&/^\/editor(?:\/|$)/.test(location.pathname);
}
function beaconRemoteCandidate(candidate){
  return !!(candidate?.frame?.contentWindow||candidate?.popoutWindow);
}
function beaconReaderName(){
  const title=String(document.title||'').trim();
  if(sheetMeaningfulName(title))return sheetText(title,100);
  const selectors=['[data-testid="character-name"]','.profile__name','.profile__name input','.character-name'];
  for(const selector of selectors){
    const el=document.querySelector?.(selector);
    const value=String(el?.value||el?.textContent||'').replace(/\s+/g,' ').trim();
    if(sheetMeaningfulName(value))return sheetText(value,100);
  }
  return 'Open character sheet';
}
function beaconReaderPeer(){
  if(isBeaconFrame())return window.parent;
  if(isBeaconPopout()){
    try{if(window.opener&&!window.opener.closed)return window.opener;}catch{}
  }
  return null;
}
function beaconFrameUrlOkay(frame){
  if(!frame)return false;
  try{
    const src=new URL(frame.src||frame.getAttribute?.('src'),location.href);
    return src.origin===RBE_BEACON_ORIGIN&&/\/dnd2024byroll20(?:\/|$)/.test(src.pathname);
  }catch{return false;}
}
function beaconPopoutCandidates(){
  const live=[];
  for(const [session,candidate] of rbePopoutSheets){
    let closed=false;
    try{closed=!!candidate.popoutWindow?.closed;}catch{}
    if(closed){rbePopoutSheets.delete(session);continue;}
    live.push(candidate);
  }
  return live.sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0));
}
function beaconRegisterPopout(event,message){
  if(event.origin!==RBE_BEACON_ORIGIN||!event.source)return null;
  const session=String(message.session||'').slice(0,100);
  if(!/^[A-Za-z0-9_.:-]{6,100}$/.test(session))return null;
  const rawName=sheetText(message.name,100);
  const name=sheetMeaningfulName(rawName)?rawName:'Open character sheet';
  let candidate=rbePopoutSheets.get(session);
  if(!candidate){
    candidate={id:'popout:'+session,name,root:null,frame:null,popoutWindow:event.source,
      popoutSession:session,origin:RBE_BEACON_ORIGIN,readableFields:0,visibleFields:0,
      kind:'D&D 2024 official sheet popout',score:3000,lastSeen:Date.now()};
    rbePopoutSheets.set(session,candidate);
  }else{
    candidate.name=name;candidate.popoutWindow=event.source;candidate.lastSeen=Date.now();
  }
  const existing=(RB.openSheets||[]).filter(x=>x.id!==candidate.id);
  RB.openSheets=[...existing,candidate].sort((a,b)=>(b.score||0)-(a.score||0));
  if(RB.visible&&RB.tab==='Sheet'&&!RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
  return candidate;
}
function beaconCandidateForMessage(event){
  if(event.origin!==RBE_BEACON_ORIGIN||!event.source)return null;
  const candidates=[...(RB.openSheets||[]),...beaconPopoutCandidates()];
  for(const candidate of candidates){
    if(candidate.frame?.contentWindow===event.source&&beaconFrameUrlOkay(candidate.frame))return candidate;
    if(candidate.popoutWindow===event.source&&candidate.origin===RBE_BEACON_ORIGIN)return candidate;
  }
  return null;
}
function onBeaconFrameMessage(event){
  const message=event.data;
  if(!message||message.bridge!==RBE_BRIDGE_MARKER)return;
  if(message.type==='ready'&&message.mode==='popout'){
    const candidate=beaconRegisterPopout(event,message);
    if(!candidate)return;
    try{event.source.postMessage({bridge:RBE_BRIDGE_MARKER,type:'ack',session:message.session},RBE_BEACON_ORIGIN);}catch{}
    sheetPrefetchAttributes(candidate);
    return;
  }
  const candidate=beaconCandidateForMessage(event);
  if(!candidate)return;
  if(message.type==='ready'){
    candidate.frameReady=true;
    try{event.source.postMessage({bridge:RBE_BRIDGE_MARKER,type:'ack',session:message.session||''},RBE_BEACON_ORIGIN);}catch{}
    sheetPrefetchAttributes(candidate);
    return;
  }
  if(message.type!=='snapshot'||typeof message.id!=='string')return;
  const pending=rbeFramePending.get(message.id);
  if(!pending||pending.target!==event.source)return;
  rbeFramePending.delete(message.id);clearTimeout(pending.timeout);
  candidate.lastSeen=Date.now();
  if(message.error)return pending.reject(new Error(String(message.error).slice(0,160)));
  const fields=sheetAttributes(message.fields);
  if(Object.keys(fields).length>6000)return pending.reject(new Error('Character sheet returned too many fields'));
  const visible=message.visible&&typeof message.visible==='object'?message.visible:
    beaconImportVisible({innerText:''},candidate.name);
  pending.resolve({fields,visible,full:!!message.full,expected:Math.max(0,int(message.expected)),
    scannedPages:Math.max(1,int(message.scannedPages)),
    tabs:Array.isArray(message.tabs)?message.tabs.slice(0,48).map(x=>String(x).slice(0,100)):[],at:Date.now()});
}
function requestBeaconFrame(candidate,deep=false,options={}){
  return new Promise((resolve,reject)=>{
    const target=candidate?.frame?.contentWindow||candidate?.popoutWindow;
    if(!target)return reject(new Error('Official character sheet reader is no longer available'));
    if(candidate.frame&&!beaconFrameUrlOkay(candidate.frame))
      return reject(new Error('Unrecognized character sheet iframe origin'));
    if(candidate.popoutWindow&&candidate.origin!==RBE_BEACON_ORIGIN)
      return reject(new Error('Unrecognized character sheet popout origin'));
    const id='rbe'+(++rbeFrameCounter);
    const timeout=setTimeout(()=>{
      rbeFramePending.delete(id);
      reject(new Error('No reply from the official 2024 sheet reader. Reload the sheet and allow R20eb/Tampermonkey on advanced-sheets.production.roll20preflight.net.'));
    },options.tour?90000:18000);
    rbeFramePending.set(id,{target,candidateId:candidate.id,resolve,reject,timeout});
    try{
      target.postMessage({bridge:RBE_BRIDGE_MARKER,type:'scan',id,deep:!!deep,tour:!!options.tour},RBE_BEACON_ORIGIN);
    }catch(err){rbeFramePending.delete(id);clearTimeout(timeout);reject(err);}
  });
}
function beaconFrameSnapshot(candidate,scan,{quiet=false}={}){
  if(!scan||!beaconRemoteCandidate(candidate))return false;
  const visual=scan.visible&&typeof scan.visible==='object'?scan.visible:
    beaconImportVisible({innerText:''},candidate.name);
  const data=mergeBeaconSnapshot(snapshotSheet(scan.fields,candidate.name),visual);
  if(!data.coverage.attributes&&!data.coverage.visibleFields)return false;
  data.name=candidate.name;
  if(!applySheetSnapshot(profile(),data))return false;
  candidate.readableFields=data.coverage.attributes;
  candidate.visibleFields=data.coverage.visibleFields;
  candidate.lastSeen=Date.now();
  profile().sheetLink.source=candidate.id;
  RB.sheetSignature=JSON.stringify(scan.fields)+'|'+(visual.signature||'');
  save();
  if(!quiet)render();
  else if(RB.visible&&RB.tab==='Sheet'&&!RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
  return true;
}
async function beaconFrameReadRequest(event){
  const peer=beaconReaderPeer();
  if(event.origin!==RBE_EDITOR_ORIGIN||!peer||event.source!==peer)return;
  const message=event.data;
  if(!message||message.bridge!==RBE_BRIDGE_MARKER||message.type!=='scan'||
    typeof message.id!=='string'||message.id.length>100)return;
  try{
    const scope=document.body;
    const scan=message.tour?await sheetTourFrameScan():(message.deep?await sheetHarvestBeaconRows(scope):{
      fields:readSheetFields(scope),full:false,expected:sheetExpectedAttributeCount(scope),scannedPages:1
    });
    const visible=message.tour?scan.visible:beaconImportVisible(scope,beaconReaderName());
    const fields=Object.fromEntries(Object.entries(scan.fields).slice(0,6000));
    peer.postMessage({bridge:RBE_BRIDGE_MARKER,type:'snapshot',id:message.id,
      fields,visible,full:scan.full,expected:scan.expected,scannedPages:scan.scannedPages,tabs:scan.tabs||[]},RBE_EDITOR_ORIGIN);
  }catch(err){
    try{peer.postMessage({bridge:RBE_BRIDGE_MARKER,type:'snapshot',id:message.id,
      error:String(err.message||err).slice(0,160)},RBE_EDITOR_ORIGIN);}catch{}
  }
}
function beaconReaderAnnounce(){
  const peer=beaconReaderPeer();
  if(!peer)return false;
  try{
    peer.postMessage({bridge:RBE_BRIDGE_MARKER,type:'ready',
      mode:isBeaconPopout()?'popout':'iframe',session:rbeReaderSession,name:beaconReaderName()},RBE_EDITOR_ORIGIN);
    return true;
  }catch{return false;}
}
function beaconReaderMessage(event){
  const message=event.data;
  if(message?.bridge===RBE_BRIDGE_MARKER&&message.type==='ack'&&
     event.origin===RBE_EDITOR_ORIGIN&&event.source===beaconReaderPeer()){
    rbeReaderAck=true;
    if(rbeReaderAnnounceTimer)clearInterval(rbeReaderAnnounceTimer);
    rbeReaderAnnounceTimer=null;
    return;
  }
  beaconFrameReadRequest(event);
}
function startBeaconFrameReader(){
  window.addEventListener('message',beaconReaderMessage);
  beaconReaderAnnounce();
  rbeReaderAnnounceTimer=setInterval(()=>{
    if(rbeReaderAck||++rbeReaderAnnounceCount>40){
      clearInterval(rbeReaderAnnounceTimer);rbeReaderAnnounceTimer=null;return;
    }
    beaconReaderAnnounce();
  },1500);
  window.addEventListener?.('focus',beaconReaderAnnounce);
  document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')beaconReaderAnnounce();});
}
function startBeaconParentBridge(){
  window.addEventListener('message',onBeaconFrameMessage);
}
