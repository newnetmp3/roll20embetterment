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
  const selectors=['[data-testid="character-name"]','.profile__name','.profile__name input','.character-name',
    '[class*="profile__name"]','[class*="character-name"]'];
  for(const selector of selectors){
    const el=document.querySelector?.(selector);
    const value=String(el?.value||el?.textContent||'').replace(/\s+/g,' ').trim();
    if(sheetMeaningfulName(value))return sheetText(value,100);
  }
  // Official popout titles can include the campaign name after the
  // character name (for example "Character — Campaign"). Strip that
  // decoration rather than treating the whole browser title as identity.
  const title=String(document.title||'').replace(/\s+[—–]\s+.*$/,'').trim();
  return sheetMeaningfulName(title)?sheetText(title,100):'Open character sheet';
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
  if(!['snapshot','invokeResult'].includes(message.type)||typeof message.id!=='string')return;
  const pending=rbeFramePending.get(message.id);
  if(!pending||pending.target!==event.source)return;
  rbeFramePending.delete(message.id);clearTimeout(pending.timeout);
  candidate.lastSeen=Date.now();
  if(message.error)return pending.reject(new Error(String(message.error).slice(0,160)));
  if(message.type==='invokeResult')return pending.resolve(!!message.ok);
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
function requestBeaconAction(candidate,ref){
  return new Promise((resolve,reject)=>{
    const target=candidate?.frame?.contentWindow||candidate?.popoutWindow;
    if(!target)return reject(new Error('Official character sheet reader is not available'));
    if(candidate.frame&&!beaconFrameUrlOkay(candidate.frame))
      return reject(new Error('Unrecognized character sheet iframe origin'));
    if(candidate.popoutWindow&&candidate.origin!==RBE_BEACON_ORIGIN)
      return reject(new Error('Unrecognized character sheet popout origin'));
    const id='rbea'+(++rbeFrameCounter),timeout=setTimeout(()=>{
      rbeFramePending.delete(id);reject(new Error('Official sheet roll action timed out.'));
    },12000);
    rbeFramePending.set(id,{target,candidateId:candidate.id,resolve,reject,timeout});
    try{target.postMessage({bridge:RBE_BRIDGE_MARKER,type:'invoke',id,ref},RBE_BEACON_ORIGIN);}
    catch(err){rbeFramePending.delete(id);clearTimeout(timeout);reject(err);}
  });
}
function beaconRollRefOkay(ref){
  return !!ref&&typeof ref==='object'&&
    ['attack','spell','skill','ability','save','initiative','action'].includes(String(ref.kind||''))&&
    ['attack','damage','skill','ability','save','initiative','healing'].includes(String(ref.action||''))&&
    typeof ref.name==='string'&&ref.name.length>0&&ref.name.length<=120;
}
function beaconFindRollButton(ref){
  if(!beaconRollRefOkay(ref))return null;
  const same=(a,b)=>String(a||'').replace(/\s+/g,' ').trim().toLocaleLowerCase()===
    String(b||'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
  const namedCard=(selector,name,nameSelectors)=>{
    for(const card of Array.from(document.querySelectorAll?.(selector)||[]).slice(0,220)){
      const cardName=nameSelectors.map(sel=>beaconRollText(card.querySelector?.(sel))).find(Boolean);
      if(same(cardName,name))return card;
    }
    return null;
  };
  if(ref.kind==='attack'){
    const card=namedCard('.attack-item',ref.name,['.span--item-row-title','.attack-item__title-chat','.attack-item__title-col']);
    return card?.querySelector?.(ref.action==='damage'?'.poly-button--damage button':'.poly-button--hit-dc button')||null;
  }
  if(ref.kind==='spell'){
    const card=namedCard('.spell-item',ref.name,['.spell-item__name.span--item-row-title','.spell-item__name','.spell-item__name--wrapper']);
    return card?.querySelector?.(ref.action==='damage'?'.poly-button--damage button':'.poly-button--hit-dc button')||null;
  }
  if(ref.kind==='skill'){
    return Array.from(document.querySelectorAll?.('.skill button.skill__name')||[]).find(b=>same(beaconRollText(b),ref.name))||null;
  }
  if(ref.kind==='ability'||ref.kind==='save'){
    for(const row of Array.from(document.querySelectorAll?.('.inline-ability')||[]).slice(0,20)){
      if(new RegExp('(?:^|\\s)'+String(ref.name).replace(/[^A-Za-z]/g,'')+'(?:\\s|$)','i').test(beaconRollText(row)))
        return row.querySelector?.(ref.kind==='save'?'.poly-button--compact-saving-throw button':'.poly-button--ability button')||null;
    }
    return null;
  }
  if(ref.kind==='initiative')return document.querySelector?.('.initiative-btn button')||null;
  if(ref.kind==='action'){
    const card=namedCard('.action-item',ref.name,['.action-item__name','.span--item-row-title','.name-chat']);
    const selector=ref.action==='healing'?'.poly-button--healing button':
      ref.action==='damage'?'.poly-button--damage button':'.poly-button--hit-dc button';
    return card?.querySelector?.(selector)||null;
  }
  return null;
}
async function beaconInvokeRollRef(ref){
  if(!beaconRollRefOkay(ref))return false;
  let button=beaconFindRollButton(ref);
  let original=null;
  if(!button&&ref.tab){
    const tabs=sheetTourTabs(document,RBE_SHEET_TOUR_INNER,
      '.layout-tabbed-panel__tab-link[role="tab"],[role="tab"],nav a,[class*="tabs"] a,button');
    original=tabs.find(sheetTourActive)||null;
    const target=tabs.find(x=>sheetTourLabel(x).toLocaleLowerCase()===String(ref.tab).toLocaleLowerCase());
    if(target&&!sheetTourActive(target)){target.click?.();await sheetTourDelay(180);}
    button=beaconFindRollButton(ref);
  }
  if(!button||button.disabled)return false;
  button.click();
  if(original&&original.isConnected!==false&&!sheetTourActive(original)){
    await sheetTourDelay(150);original.click?.();
  }
  return true;
}
async function executeOfficialSheetRoll(ref,targetProfile=profile()){
  if(!beaconRollRefOkay(ref))return false;
  const charId=targetProfile.roll20CharacterId||targetProfile.sheetLink?.characterId||'';
  let candidate=sheetCandidates(document).find(x=>x.id===targetProfile.sheetLink?.source)||
    sheetCandidates(document).find(x=>charId&&String(x.characterId||x.id||'')===String(charId));
  let opened=null;
  if(!candidate&&charId&&typeof autoEnsureSheetCandidate==='function'){
    const character=autoCharacterById(charId);
    opened=await autoEnsureSheetCandidate({characterId:charId,characterName:targetProfile.name,
      tokenName:targetProfile.name,character});
    candidate=opened?.candidate||null;
  }
  if(!candidate||!beaconRemoteCandidate(candidate))return false;
  try{return await requestBeaconAction(candidate,ref);}
  finally{if(opened?.opened)autoCloseSheetDialog({character:opened.candidate?.character||autoCharacterById(charId)},opened.hidden);}
}
function beaconFrameSnapshot(candidate,scan,{quiet=false,targetProfile=null,characterId=''}={}){
  if(!scan||!beaconRemoteCandidate(candidate))return false;
  const visual=scan.visible&&typeof scan.visible==='object'?scan.visible:
    beaconImportVisible({innerText:''},candidate.name);
  const data=mergeBeaconSnapshot(snapshotSheet(scan.fields,candidate.name),visual);
  if(!data.coverage.attributes&&!data.coverage.visibleFields)return false;
  data.name=candidate.name;
  const target=targetProfile||profile();
  if(!applySheetSnapshot(target,data))return false;
  candidate.readableFields=data.coverage.attributes;
  candidate.visibleFields=data.coverage.visibleFields;
  candidate.lastSeen=Date.now();
  target.sheetLink.source=candidate.id;
  if(characterId){
    target.roll20CharacterId=String(characterId).slice(0,120);
    target.sheetLink.characterId=target.roll20CharacterId;
  }
  RB.sheetSignature=JSON.stringify(scan.fields)+'|'+(visual.signature||'');
  save();
  if(!quiet)render();
  else if(target===profile()&&RB.visible&&RB.tab==='Sheet'&&!RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
  return true;
}
async function beaconFrameReadRequest(event){
  const peer=beaconReaderPeer();
  if(event.origin!==RBE_EDITOR_ORIGIN||!peer||event.source!==peer)return;
  const message=event.data;
  if(!message||message.bridge!==RBE_BRIDGE_MARKER||typeof message.id!=='string'||message.id.length>100)return;
  if(message.type==='invoke'){
    try{
      const ok=await beaconInvokeRollRef(message.ref);
      peer.postMessage({bridge:RBE_BRIDGE_MARKER,type:'invokeResult',id:message.id,ok},RBE_EDITOR_ORIGIN);
    }catch(err){
      peer.postMessage({bridge:RBE_BRIDGE_MARKER,type:'invokeResult',id:message.id,error:String(err.message||err).slice(0,160)},RBE_EDITOR_ORIGIN);
    }
    return;
  }
  if(message.type!=='scan')return;
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
