// Firefox only: read-only distance sampling of the player's controlled token.
// Roll20 editor internals vary between deployments; validate every source and
// expose a precise reason in Debug rather than silently leaving movement at 0.
const R3_MOVE={tokenId:'',characterId:'',pageId:'',model:null,object:null,
  last:null,scale:null,lastMove:'',handler:null,objectHandler:null,
  objectModifiedHandler:null,dragging:false,
  pending:null,nativeReadout:null,measurementSource:'none',
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
    r3TokenCampaign():window.Campaign;
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
        // Jumpgate's selected scene nodes carry the real Roll20 graphic
        // Backbone model via dataWrapper.model; not Fabric's item.model.
        // Compare only the verified active token ID, never names/artwork.
        const model=item?.dataWrapper?.model||item?.model||item;
        if(r3MoveId(model)===active.tokenId||r3MoveId(item)===active.tokenId){
          candidate=item;source=name;break;
        }
      }
      if(candidate)break;
    }
  }catch{/* One unsupported fabric collection must not affect combat UI. */}
  if(!candidate)return null;
  const model=candidate?.dataWrapper?.model||candidate?.model||candidate;
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
    try{t.object.off('moving',t.objectHandler);
      t.object.off('modified',t.objectModifiedHandler);}catch{}
  t.model=null;t.object=null;t.handler=null;t.objectHandler=null;
  t.objectModifiedHandler=null;t.dragging=false;
}
function r3MoveRebase(){
  r3MoveDisconnect();
  Object.assign(R3_MOVE,{tokenId:'',characterId:'',pageId:'',last:null,
    scale:null,lastMove:'',source:'',pending:null,nativeReadout:null,
    dragging:false,
    measurementSource:'none'});
  r3MovePoll();
}
// Roll20's optional "Always measure token movement" indicator uses the page
// grid/diagonal rules, not the straight-line sum of the token's pixel deltas.
// If Roll20 publishes an accessible distance label, capture the exact value.
// Jumpgate may paint it *inside the canvas*: canvas pixels are NOT readable
// as DOM text, and broad page text (spell ranges etc.) is never accepted.
function r3MoveReadNative(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return null;
  const selector=[
    '[data-testid*="movement-distance"]','[data-testid*="measure-distance"]',
    '[data-testid*="ruler-distance"]','[class*="movement-distance"]',
    '[class*="measurement-distance"]','[class*="measure-distance"]',
    '[class*="ruler-distance"]','[class*="measurement-label"]',
    '[class*="ruler-label"]'
  ].join(',');
  let nodes;
  try{nodes=document.querySelectorAll(selector);}catch{return null;}
  if(!nodes||nodes.length>120)return null;
  const hits=[];
  for(const node of nodes){
    if(node.hidden||node.getAttribute?.('aria-hidden')==='true'||
      node.closest?.('[hidden],[inert],[aria-hidden="true"],#r3-host'))continue;
    const rects=node.getClientRects?.();
    if(rects&&rects.length===0)continue;
    const text=String(node.textContent??node.innerText??'').trim();
    const match=text.match(/^(\d{1,4}(?:\.\d{1,2})?)\s*(?:ft\.?|feet|foot)$/i);
    if(!match)continue;
    const feet=Number(match[1]);
    if(!Number.isFinite(feet)||feet<0||feet>3000)continue;
    hits.push({feet,label:text});
  }
  // Two distinct ruler labels might describe different players or paths.
  // Never guess which one belongs to the selected token.
  return hits.length===1?hits[0]:null;
}
function r3MovePathPoints(start,end,model){
  const raw=r3MoveGet(model,'lastmove');
  if(typeof raw!=='string'||!raw||raw.length>1000||
    raw===R3_MOVE.lastMove)return [start,end];
  const parts=raw.split(',');
  if(parts.length<2||parts.length>64||parts.length%2)return [start,end];
  const points=[];
  for(let i=0;i<parts.length;i+=2){
    const x=Number(parts[i]),y=Number(parts[i+1]);
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e7||Math.abs(y)>1e7)
      return [start,end];
    points.push({x,y});
  }
  // Only trust a lastmove route anchored at THIS token's previous location.
  if(Math.hypot(points[0].x-start.x,points[0].y-start.y)>1)
    return [start,end];
  return [start,...points.slice(1),end];
}
function r3MovePageRule(page){
  const rule=String(r3MoveGet(page,'diagonaltype')??'').toLowerCase();
  // Four-way/5E is Roll20's default on a square 5E map. When the setting
  // is unavailable label this a grid fallback, NOT a native ruler reading.
  return ['foure','threefive','manhattan','pythagorean'].includes(rule)?rule:'foure';
}
function r3MoveGridDistance(start,end,model,page,scale){
  const rawIncrement=r3MoveGet(page,'snapping_increment');
  const increment=Number(rawIncrement??1);
  if(!scale||!Number.isFinite(increment)||increment<=0)return null;
  const cell=70*increment,feet=scale.feetPerPixel*cell;
  if(!Number.isFinite(feet)||feet<=0)return null;
  const path=r3MovePathPoints(start,end,model);
  const rule=r3MovePageRule(page);
  let squares=0,diagonals=0;
  for(let i=1;i<path.length;i++){
    // Whole map cells, instead of 0.07ft pixel jitter, match how a
    // grid-snapped Roll20 token is normally moved.
    const dx=Math.round(Math.abs(path[i].x-path[i-1].x)/cell);
    const dy=Math.round(Math.abs(path[i].y-path[i-1].y)/cell);
    const d=Math.min(dx,dy),straight=Math.max(dx,dy)-d;
    if(rule==='manhattan')squares+=dx+dy;
    else if(rule==='pythagorean')squares+=Math.hypot(dx,dy);
    else if(rule==='threefive'){
      // Alternate short/long diagonals over the *whole* waypoint path.
      squares+=straight+d+Math.floor((diagonals+d)/2)-Math.floor(diagonals/2);
      diagonals+=d;
    }else squares+=Math.max(dx,dy);
  }
  const result=squares*feet;
  return Number.isFinite(result)?Math.round(result*100)/100:null;
}
// Retain this helper for existing diagnostic/test callers, but it is no
// longer the source of automatic movement accounting.
function r3MoveWaypointLength(start,end,model,units){
  if(!Number.isFinite(units))return null;
  const points=r3MovePathPoints(start,end,model);
  if(points.length===2)return null;
  let px=0;
  for(let i=1;i<points.length;i++)
    px+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  return px*units;
}
function r3MoveMeasure(signal='poll'){
  const active=R3_TOKEN.active;
  if(!active?.tokenId||!active.characterId){
    r3MoveDisconnect();R3_MOVE.last=null;R3_MOVE.pending=null;
    R3_MOVE.nativeReadout=null;
    const selection=typeof r3TokenSelectionDiagnostics==='function'?
      r3TokenSelectionDiagnostics():null;
    r3MoveReport('Waiting for a controlled token',
      selection?.reason||'Select your character token on the map');
    return;
  }
  const info=r3MoveFind(),tracker=R3_MOVE;
  if(!info){
    r3MoveDisconnect();tracker.last=null;tracker.pending=null;
    tracker.nativeReadout=null;
    r3MoveReport('Token position unavailable',
      'Selected token ID is known but not in the exposed Roll20 graphics collections');
    return;
  }
  const sample=r3MovePosition(info.model,info.object);
  if(!sample){
    r3MoveReport('Token coordinates unavailable',info.source);
    return;
  }
  const scale=r3MoveScale(info.page),signature=scale?.signature||null;
  const changedToken=tracker.tokenId!==info.tokenId||
    tracker.characterId!==info.characterId||tracker.pageId!==info.pageId||
    tracker.model!==info.model;
  if(changedToken){
    r3MoveDisconnect();
    Object.assign(tracker,{tokenId:info.tokenId,characterId:info.characterId,
      pageId:info.pageId,model:info.model,object:info.object,last:sample,
      scale:signature,lastMove:r3MoveGet(info.model,'lastmove')||'',
      source:info.source,pending:null,nativeReadout:null,measurementSource:'none',dragging:false});
    if(typeof info.model.on==='function'){
      tracker.handler=()=>r3MoveMeasure('change');
      try{info.model.on('change',tracker.handler);}catch{tracker.handler=null;}
    }
    if(info.object!==info.model&&typeof info.object?.on==='function'){
      tracker.objectHandler=()=>r3MoveMeasure('moving');
      tracker.objectModifiedHandler=()=>r3MoveMeasure('modified');
      try{info.object.on('moving',tracker.objectHandler);
        info.object.on('modified',tracker.objectModifiedHandler);
      }catch{tracker.objectHandler=null;}
    }
    r3MoveReport('Movement tracker connected',
      'Watching Roll20 ruler; page '+(signature||'scale unavailable'));
    return;
  }
  const previous=tracker.last,oldScale=tracker.scale;
  tracker.scale=signature;
  const lastMove=r3MoveGet(info.model,'lastmove')||'';
  if(oldScale!==signature||!previous){
    tracker.last=sample;tracker.lastMove=lastMove;
    tracker.pending=null;tracker.nativeReadout=null;tracker.dragging=false;
    r3MoveReport(scale?'Map scale updated':'Map scale unavailable',
      scale?'Movement baseline refreshed':'Roll20 page scale in feet is not exposed');
    return;
  }
  if(R3_TURN.phase!=='active'){
    tracker.last=sample;tracker.lastMove=lastMove;
    tracker.pending=null;tracker.nativeReadout=null;tracker.dragging=false;
    r3MoveReport('Waiting for your turn','Select Start Turn to count token movement');
    return;
  }
  if(!tracker.pending&&Math.hypot(sample.x-previous.x,sample.y-previous.y)>=0.05)
    tracker.pending={start:previous,end:sample};
  else if(tracker.pending)tracker.pending.end=sample;
  // Capture the *latest* displayed total, never sum intermediate frames.
  // A moving/visual poll does not spend movement until the model commits,
  // or a Fabric modified event confirms token drop.
  if(signal==='moving')tracker.dragging=true;
  const readout=r3MoveReadNative();
  if(readout&&tracker.pending)tracker.nativeReadout=readout;
  // Backbone change events may fire DURING a Fabric drag. Count only the
  // matching modified/drop notification once that dragging was observed.
  if((signal!=='change'&&signal!=='modified')||
    (tracker.dragging&&signal!=='modified')){
    if(tracker.pending)r3MoveReport('Watching Roll20 movement',
      tracker.nativeReadout?'Native ruler currently '+tracker.nativeReadout.label:
        'Waiting for token drop; no readable ruler label yet');
    return;
  }
  if(!tracker.pending){
    tracker.lastMove=lastMove;
    return;
  }
  const {start,end}=tracker.pending;
  tracker.pending=null;
  tracker.dragging=false;
  tracker.last=sample;
  const changed=Math.hypot(start.x-end.x,start.y-end.y)>=0.05;
  if(!changed){tracker.nativeReadout=null;tracker.lastMove=lastMove;return;}
  const native=tracker.nativeReadout;
  tracker.nativeReadout=null;
  const added=native?native.feet:r3MoveGridDistance(start,end,info.model,info.page,scale);
  tracker.lastMove=lastMove;
  if(!Number.isFinite(added)){
    tracker.measurementSource='unavailable';
    r3MoveReport('Movement measurement unavailable',
      'Roll20 ruler label not exposed as DOM and no supported map grid distance');
    return;
  }
  tracker.measurementSource=native?'Roll20 ruler':'Roll20 grid-rule estimate';
  if(added<=0){
    r3MoveReport('No movement counted',
      native?'Roll20 ruler reads zero':'Token did not cross a complete grid step');
    return;
  }
  const increment=Math.min(30000-R3_TURN.movementUsed,added);
  if(increment<=0)return;
  R3_TURN.movementUsed=Math.round((R3_TURN.movementUsed+increment)*100)/100;
  r3MoveReport('Movement tracking','+'+r3TurnDistance(increment)+' ft · '+
    tracker.measurementSource);
  r3TurnChange('Token moved +'+r3TurnDistance(increment)+' ft ('+
    tracker.measurementSource+') · '+r3TurnDistance(R3_TURN.movementUsed)+
    ' ft total','observed');
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
    // Passive diagnostics only. Never probe the Webpack runtime or touch
    // the lazy VTTEngine.instance getter to determine startup readiness.
    jumpgateFirstRender:typeof R3_JUMPGATE_RENDER==='object'?
      R3_JUMPGATE_RENDER.tracking:'unavailable',
    jumpgateRenderObserved:typeof R3_JUMPGATE_RENDER==='object'?
      (R3_JUMPGATE_RENDER.complete?'Yes':'No'):'unavailable',
    jumpgateRuntimeAttempts:typeof R3_JUMPGATE_RUNTIME==='object'?
      R3_JUMPGATE_RUNTIME.tried:'unavailable',
    jumpgateBuild:selection?.actualBuild||'unavailable',
    jumpgateModuleSignature:selection?.moduleSignature||'not checked',
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
    measurementSource:R3_MOVE.measurementSource,
    rulerSample:R3_MOVE.nativeReadout?.label||'not exposed',
    diagonalRule:r3MovePageRule(page),
    movementUsed:typeof R3_TURN==='object'?R3_TURN.movementUsed:0
  };
}
