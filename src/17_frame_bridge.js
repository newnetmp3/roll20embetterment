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
