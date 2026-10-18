// Firefox-only: distance actually traversed by a controlled Roll20 token.
// No canvas movement, game-server API, Roll20 macro or GM permission required.
// Uses Backbone model 'change' for completed/waypoint moves, plus read-only poll
// to tolerate Roll20 versions that do not emit browser-side change notifications.
const R3_MOVE={tokenId:'',characterId:'',pageId:'',model:null,object:null,
  last:null,scale:null,lastMove:'',handler:null,source:''};
function r3MovePosition(model,object){
  const read=key=>{
    const a=r3TokenModelGet(model,key);
    return a??object?.[key];
  };
  const x=Number(read('left')),y=Number(read('top'));
  if(!Number.isFinite(x)||!Number.isFinite(y)||
     Math.abs(x)>10000000||Math.abs(y)>10000000)return null;
  return {x,y};
}
function r3MovePage(){
  const c=window.d20?.Campaign;
  if(!c)return null;
  try{
    const active=typeof c.activePage==='function'?c.activePage():c.activePage;
    if(active&&typeof active.get==='function')return active;
    const id=r3String(c.get?.('playerpageid')||c.attributes?.playerpageid,110);
    if(id)return c.pages?.get?.(id)||null;
  }catch{}
  return null;
}
function r3MoveScale(page){
  if(!page)return null;
  const scale=Number(r3TokenModelGet(page,'scale_number'));
  const rawIncrement=r3TokenModelGet(page,'snapping_increment');
  const increment=rawIncrement===undefined||rawIncrement===null?NaN:Number(rawIncrement);
  const units=r3String(r3TokenModelGet(page,'scale_units'),40).trim().toLowerCase();
  // The official Roll20 scale is a number of named units per grid square;
  // snapping_increment is the grid square's size in 70px tabletop units.
  // If measurement units are not feet, don't compare them with a 5e speed in ft.
  if(!['ft','feet','foot'].includes(units)||!Number.isFinite(scale)||
    scale<=0||scale>10000||!Number.isFinite(increment)||increment<0||
    increment>100)return null;
  const pxPerSquare=70*(increment||1);
  return {feetPerPixel:scale/pxPerSquare,
    signature:scale+'|'+increment+'|'+units};
}
function r3MovePageId(page){
  return r3String(page?.id||r3TokenModelGet(page,'_id'),110);
}
function r3MoveFind(){
  const active=R3_TOKEN.active;
  if(!active?.tokenId||!active.characterId)return null;
  const d=window.d20,engine=d?.engine;
  let object=null;
  // First check the selected, authorized token; then find the same exact
  // token on Roll20's current canvas when it has been deselected.
  try{
    const selection=r3TokenSelected();
    object=selection.find(o=>
      r3String((o?.model||o)?.id||r3TokenModelGet(o?.model||o,'_id'),110)===
      active.tokenId)||null;
    if(!object){
      const all=engine?.canvas?.getObjects?.();
      if(Array.isArray(all))object=all.find(o=>
        r3String((o?.model||o)?.id||r3TokenModelGet(o?.model||o,'_id'),110)===
        active.tokenId)||null;
    }
  }catch{}
  if(!object)return null;
  const model=object.model||object,page=r3MovePage();
  return {model,object,page,tokenId:active.tokenId,
    characterId:active.characterId,pageId:r3MovePageId(page)};
}
function r3MoveDisconnect(){
  const tracker=R3_MOVE;
  if(tracker.model&&tracker.handler&&typeof tracker.model.off==='function')
    try{tracker.model.off('change',tracker.handler);}catch{}
  tracker.model=null;tracker.object=null;tracker.handler=null;
}
function r3MoveRebase(){
  r3MoveDisconnect();
  Object.assign(R3_MOVE,{tokenId:'',characterId:'',pageId:'',
    last:null,scale:null,lastMove:'',source:''});
  // Immediately bind at turn start so the first model change is counted,
  // even if the player moves faster than the 400ms fallback polling cadence.
  r3MovePoll();
}
function r3MoveWaypointLength(start,end,model,units){
  const raw=r3TokenModelGet(model,'lastmove');
  if(typeof raw!=='string'||!raw||raw.length>1000||raw===R3_MOVE.lastMove)return null;
  const parts=raw.split(',');
  if(parts.length<2||parts.length>64||parts.length%2)return null;
  const points=[];
  for(let i=0;i<parts.length;i+=2){
    const x=Number(parts[i]),y=Number(parts[i+1]);
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    points.push({x,y});
  }
  // Only trust the traced path if it starts at our last sampled center.
  if(Math.hypot(points[0].x-start.x,points[0].y-start.y)>1)return null;
  const trail=[...points,end];
  let total=0,prev=start;
  for(const current of trail){
    total+=Math.hypot(current.x-prev.x,current.y-prev.y);
    prev=current;
  }
  return total*units;
}
function r3MoveMeasure(){
  const info=r3MoveFind(),tracker=R3_MOVE;
  if(!info){r3MoveDisconnect();tracker.last=null;return;}
  const sample=r3MovePosition(info.model,info.object);
  if(!sample)return;
  const currentScale=r3MoveScale(info.page);
  const pageId=info.pageId;
  const changedToken=tracker.tokenId!==info.tokenId||
    tracker.characterId!==info.characterId||
    tracker.pageId!==pageId||tracker.model!==info.model;
  if(changedToken){
    r3MoveDisconnect();
    tracker.tokenId=info.tokenId;tracker.characterId=info.characterId;
    tracker.pageId=pageId;tracker.model=info.model;tracker.object=info.object;
    tracker.last=sample;tracker.scale=currentScale?.signature||null;
    tracker.lastMove=r3TokenModelGet(info.model,'lastmove')||'';
    if(typeof info.model.on==='function'){
      tracker.handler=()=>r3MoveMeasure();
      try{info.model.on('change',tracker.handler);}catch{tracker.handler=null;}
    }
    return;
  }
  const previous=tracker.last,oldScale=tracker.scale,
    signature=currentScale?.signature||null;
  tracker.last=sample;tracker.scale=signature;
  const lastMove=r3TokenModelGet(info.model,'lastmove')||'';
  if(!previous||!signature||oldScale!==signature||
    R3_TURN.phase!=='active'){
    tracker.lastMove=lastMove;return;
  }
  const px=Math.hypot(sample.x-previous.x,sample.y-previous.y);
  if(px<0.05)return;
  // A camera pan changes neither model.left nor model.top, so it never
  // contributes. Sum successive observations, not the net displacement.
  const segment=r3MoveWaypointLength(previous,sample,info.model,
    currentScale.feetPerPixel)??px*currentScale.feetPerPixel;
  tracker.lastMove=lastMove;
  if(!Number.isFinite(segment)||segment<=0)return;
  const added=Math.min(30000-R3_TURN.movementUsed,segment);
  if(added<=0)return;
  R3_TURN.movementUsed=Math.min(30000,
    Math.round((R3_TURN.movementUsed+added)*100)/100);
  if(typeof r3TurnChange==='function')
    r3TurnChange('Token movement tracked: +'+r3TurnDistance(added)+
      ' ft. Total used: '+r3TurnDistance(R3_TURN.movementUsed)+' ft.','observed');
}
function r3MovePoll(){r3MoveMeasure();}
