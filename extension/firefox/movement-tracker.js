// Firefox only: read-only distance sampling of the player's controlled token.
// Roll20 editor internals vary between deployments; validate every source and
// expose a precise reason in Debug rather than silently leaving movement at 0.
const R3_MOVE={tokenId:'',characterId:'',pageId:'',model:null,object:null,
  last:null,scale:null,lastMove:'',handler:null,objectHandler:null,
  status:'Waiting for a controlled token',source:'',details:''};
function r3MoveReport(status,details=''){
  if(R3_MOVE.status===status&&R3_MOVE.details===details)return;
  R3_MOVE.status=status;R3_MOVE.details=details;
  if(typeof r3DebugLog==='function')r3DebugLog('Movement',status+(details?' · '+details:''),status.includes('unavailable')?'warning':'info');
}
function r3MoveGet(model,key){
  try{return r3TokenModelGet(model,key)??model?.[key];}catch{return undefined;}
}
function r3MoveId(model){
  return r3String(model?.id||r3MoveGet(model,'_id')||r3MoveGet(model,'id')||'',110);
}
function r3MovePosition(model,object){
  // Fabric's live center can update before the Backbone graphic model. Use
  // Fabric position when available; otherwise use stored model coordinates.
  function pair(source){
    const rx=r3MoveGet(source,'left'),ry=r3MoveGet(source,'top');
    if(rx===null||rx===undefined||rx===''||
       ry===null||ry===undefined||ry==='')return null;
    const x=Number(rx),y=Number(ry);
    if(!Number.isFinite(x)||!Number.isFinite(y)||
      Math.abs(x)>10000000||Math.abs(y)>10000000)return null;
    return {x,y};
  }
  return pair(object)||pair(model);
}
function r3MoveCollection(collection){
  if(!collection)return [];
  if(Array.isArray(collection))return collection;
  if(Array.isArray(collection.models))return collection.models;
  if(typeof collection.toArray==='function')try{return collection.toArray();}catch{}
  if(typeof collection.values==='function')try{
    const result=[];
    for(const item of collection.values()){
      result.push(item);if(result.length>=2000)break;
    }
    return result;
  }catch{}
  return [];
}
function r3MovePage(candidate){
  const c=typeof r3TokenCampaign==='function'?
    r3TokenCampaign():(window.d20?.Campaign||window.Campaign);
  const d=window.d20,engine=d?.engine;
  if(!c)return null;
  const tokenPage=r3String(r3MoveGet(candidate,'_pageid')||
    r3MoveGet(candidate,'pageid')||r3MoveGet(candidate,'_page')||'',110);
  const keys=[tokenPage,c.get?.('playerpageid'),c.attributes?.playerpageid,
    engine?.currentPage?.id,engine?.page?.id,c.get?.('pageid')].filter(Boolean);
  const pages=c.pages;
  for(const key of keys){
    try{
      const page=pages?.get?.(key)||
        r3MoveCollection(pages).find(p=>r3MoveId(p)===String(key));
      if(page)return page;
    }catch{}
  }
  const active=typeof c.activePage==='function'?c.activePage():c.activePage;
  return (active&&typeof active==='object'?active:null)||
    (engine?.currentPage&&typeof engine.currentPage==='object'?engine.currentPage:null)||
    (engine?.page&&typeof engine.page==='object'?engine.page:null);
}
function r3MoveScale(page){
  if(!page)return null;
  const rawScale=r3MoveGet(page,'scale_number');
  const rawUnit=r3MoveGet(page,'scale_units');
  const incrementRaw=r3MoveGet(page,'snapping_increment');
  const scale=Number(rawScale);
  const increment=incrementRaw===undefined||incrementRaw===null||incrementRaw===''?
    1:Number(incrementRaw);
  const units=r3String(rawUnit,40).trim().toLowerCase();
  if(!['ft','feet','foot'].includes(units)||!Number.isFinite(scale)||
     scale<=0||scale>10000||!Number.isFinite(increment)||increment<0||
     increment>100)return null;
  const pxPerSquare=70*(increment||1);
  return {feetPerPixel:scale/pxPerSquare,
    signature:scale+'|'+increment+'|'+units};
}
function r3MovePageId(page){
  return r3MoveId(page)||r3String(r3MoveGet(page,'_pageid')||'',110);
}
function r3MoveGraphicSources(engine,page){
  const canvas=engine?.canvas;
  let observed=null;
  try{observed=typeof canvas?.getObjects==='function'?canvas.getObjects():null;}catch{}
  const groups=[
    ['selected',r3TokenSelected()],
    ['canvas.getObjects',observed],
    ['canvas._objects',canvas?._objects],
    ['canvas._activeObjects',canvas?._activeObjects],
    ['page.thegraphics',page?.thegraphics],
    ['page.graphics',page?.graphics],
    ['engine.thegraphics',engine?.thegraphics]
  ];
  return groups;
}
function r3MoveFind(){
  const active=R3_TOKEN.active;
  if(!active?.tokenId||!active.characterId)return null;
  const engine=window.d20?.engine;
  const page=r3MovePage();
  let candidate=null,source='';
  // Babylon exposes some selected graphics as IDs only. Once the shared
  // selection reader has verified that ID belongs to the controlled PC,
  // resolve its exact Backbone graphic before measuring coordinates.
  if(typeof r3TokenFindGraphic==='function'){
    try{
      candidate=r3TokenFindGraphic(active.tokenId);
      if(candidate)source='selected.graphicId';
    }catch{}
  }
  try{
    for(const [name,group] of r3MoveGraphicSources(engine,page)){
      if(candidate)break;
      for(const item of r3MoveCollection(group)){
        const model=item?.model||item;
        if(r3MoveId(model)===active.tokenId||r3MoveId(item)===active.tokenId){
          candidate=item;source=name;break;
        }
      }
      if(candidate)break;
    }
  }catch{/* One unsupported fabric collection must not affect combat UI. */}
  if(!candidate)return null;
  const model=candidate.model||candidate;
  const chosenPage=r3MovePage(model)||page;
  return {model,object:candidate,page:chosenPage,source,
    tokenId:active.tokenId,characterId:active.characterId,
    pageId:r3MovePageId(chosenPage)};
}
function r3MoveDisconnect(){
  const t=R3_MOVE;
  if(t.model&&t.handler&&typeof t.model.off==='function')
    try{t.model.off('change',t.handler);}catch{}
  if(t.object&&t.objectHandler&&t.object!==t.model&&typeof t.object.off==='function')
    try{t.object.off('moving',t.objectHandler);t.object.off('modified',t.objectHandler);}catch{}
  t.model=null;t.object=null;t.handler=null;t.objectHandler=null;
}
function r3MoveRebase(){
  r3MoveDisconnect();
  Object.assign(R3_MOVE,{tokenId:'',characterId:'',pageId:'',last:null,
    scale:null,lastMove:'',source:''});
  r3MovePoll();
}
function r3MoveWaypointLength(start,end,model,units){
  const raw=r3MoveGet(model,'lastmove');
  if(typeof raw!=='string'||!raw||raw.length>1000||raw===R3_MOVE.lastMove)return null;
  const parts=raw.split(',');
  if(parts.length<2||parts.length>64||parts.length%2)return null;
  const points=[];
  for(let i=0;i<parts.length;i+=2){
    const x=Number(parts[i]),y=Number(parts[i+1]);
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    points.push({x,y});
  }
  if(Math.hypot(points[0].x-start.x,points[0].y-start.y)>1)return null;
  let total=0,prev=start;
  for(const current of [...points,end]){
    total+=Math.hypot(current.x-prev.x,current.y-prev.y);
    prev=current;
  }
  return total*units;
}
function r3MoveMeasure(){
  const active=R3_TOKEN.active;
  if(!active?.tokenId||!active.characterId){
    r3MoveDisconnect();R3_MOVE.last=null;
    const selection=typeof r3TokenSelectionDiagnostics==='function'?
      r3TokenSelectionDiagnostics():null;
    r3MoveReport('Waiting for a controlled token',
      selection?.reason||'Select your character token on the map');
    return;
  }
  const info=r3MoveFind(),tracker=R3_MOVE;
  if(!info){
    r3MoveDisconnect();tracker.last=null;
    r3MoveReport('Token position unavailable',
      'Selected token ID is known but not in the exposed Roll20 graphics collections');
    return;
  }
  const sample=r3MovePosition(info.model,info.object);
  if(!sample){
    r3MoveReport('Token coordinates unavailable',info.source);
    return;
  }
  const scale=r3MoveScale(info.page);
  const pageId=info.pageId;
  const changedToken=tracker.tokenId!==info.tokenId||
    tracker.characterId!==info.characterId||tracker.pageId!==pageId||
    tracker.model!==info.model;
  if(changedToken){
    r3MoveDisconnect();
    Object.assign(tracker,{tokenId:info.tokenId,characterId:info.characterId,
      pageId,model:info.model,object:info.object,last:sample,
      scale:scale?.signature||null,lastMove:r3MoveGet(info.model,'lastmove')||'',
      source:info.source});
    if(typeof info.model.on==='function'){
      tracker.handler=()=>r3MoveMeasure();
      try{info.model.on('change',tracker.handler);}catch{tracker.handler=null;}
    }
    if(info.object!==info.model&&typeof info.object?.on==='function'){
      tracker.objectHandler=()=>r3MoveMeasure();
      try{info.object.on('moving',tracker.objectHandler);
        info.object.on('modified',tracker.objectHandler);
      }catch{tracker.objectHandler=null;}
    }
    r3MoveReport(scale?'Movement tracker connected':'Map scale unavailable',
      scale?'Using '+info.source+', '+scale.signature:
        'Roll20 page scale in feet is not exposed');
    return;
  }
  const previous=tracker.last,oldScale=tracker.scale,signature=scale?.signature||null;
  tracker.last=sample;tracker.scale=signature;
  const lastMove=r3MoveGet(info.model,'lastmove')||'';
  if(!scale){
    tracker.lastMove=lastMove;
    r3MoveReport('Map scale unavailable','Check Roll20 page units/scale in Debug');
    return;
  }
  if(oldScale!==signature||!previous){
    tracker.lastMove=lastMove;
    r3MoveReport('Map scale updated','Movement baseline refreshed');
    return;
  }
  if(R3_TURN.phase!=='active'){
    tracker.lastMove=lastMove;
    r3MoveReport('Waiting for your turn','Select Start Turn to count token movement');
    return;
  }
  const px=Math.hypot(sample.x-previous.x,sample.y-previous.y);
  if(px<0.05){
    r3MoveReport('Watching token position','No new token coordinates observed');
    return;
  }
  const segment=r3MoveWaypointLength(previous,sample,info.model,scale.feetPerPixel) ??
    px*scale.feetPerPixel;
  tracker.lastMove=lastMove;
  if(!Number.isFinite(segment)||segment<=0)return;
  const added=Math.min(30000-R3_TURN.movementUsed,segment);
  if(added<=0)return;
  R3_TURN.movementUsed=Math.round((R3_TURN.movementUsed+added)*100)/100;
  r3MoveReport('Movement tracking','+'+r3TurnDistance(added)+' ft using '+info.source);
  r3TurnChange('Token moved +'+r3TurnDistance(added)+' ft · '+
    r3TurnDistance(R3_TURN.movementUsed)+' ft total','observed');
}
function r3MovePoll(){r3MoveMeasure();}
function r3MoveDiagnostics(){
  const page=r3MovePage(),token=R3_TOKEN.active;
  const selection=typeof r3TokenSelectionDiagnostics==='function'?
    r3TokenSelectionDiagnostics():null;
  return {
    status:R3_MOVE.status,
    details:R3_MOVE.details,
    turn:typeof R3_TURN==='object'?R3_TURN.phase:'unknown',
    selectedToken:!!token?.tokenId,
    selectionRenderer:selection?.renderer||'unknown',
    editorBridge:selection?.editorBridge||'unavailable',
    campaignBridge:selection?.campaignBridge||'unavailable',
    nativeSelection:selection?.nativeState||'unavailable',
    nativeEngineKeys:selection?.nativeKeys||'none',
    nativeTabletopKeys:selection?.nativeTabletopKeys||'none',
    selectionSource:selection?.selectionSource||'unavailable',
    selectionCount:selection?.selectionCount??0,
    selectionReason:selection?.reason||'unavailable',
    selectionGetter:selection?.selectionGetter||'none',
    selectionReturnShape:selection?.selectionReturnShape||'none',
    selectionApiTypes:selection?.selectionTypes||'none',
    selectionCandidateKeys:selection?.selectionShape||'none',
    selectionEngineKeys:selection?.engineKeys||'none',
    positionSource:R3_MOVE.source||'unavailable',
    pageResolved:!!page,
    pageId:r3MovePageId(page)||'unavailable',
    pageScale:r3MoveGet(page,'scale_number')??'unavailable',
    pageUnit:r3MoveGet(page,'scale_units')??'unavailable',
    gridIncrement:r3MoveGet(page,'snapping_increment')??'unspecified',
    mapFeetPerPixel:r3MoveScale(page)?.feetPerPixel??'unavailable',
    tokenCoordinate:R3_MOVE.last?R3_MOVE.last.x+', '+R3_MOVE.last.y:'unavailable',
    movementUsed:typeof R3_TURN==='object'?R3_TURN.movementUsed:0
  };
}
