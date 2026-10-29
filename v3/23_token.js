// Follow the most recently selected player-controllable token, not a fixed PC.
// Reads the in-page Roll20 editor's current Fabric/Backbone models, not the
// GM-only Mod API or undocumented remote endpoints. Fail closed when the
// selected token's represented character and its permissions are unavailable.
const R3_TOKEN={
  active:null,selectionIds:[],snapshots:new Map(),legacy:null,visibleSheetId:'',
  timer:null,started:false
};
function r3TokenCampaign(){
  // Jumpgate's editor owns the direct Campaign Backbone model. Do not
  // consult the obsolete d20.Campaign namespace for character identity.
  return window.Campaign||null;
}
function r3TokenEngineMode(){
  // Roll20's window.vttEngine is an engine-mode flag, not the VTTEngine
  // runtime class. It can be a primitive string or boxed String object.
  // Never treat it as a mutable tabletop or call methods on it.
  const mode=window.vttEngine;
  if(typeof mode==='string')return 'string mode flag';
  if(mode&&typeof mode==='object'){
    try{
      if(Object.prototype.toString.call(mode)==='[object String]')
        return 'boxed string mode flag';
    }catch{}
    return 'unknown object; not inspected';
  }
  return mode===undefined?'not present':'unexpected '+typeof mode;
}

// Verified against two independent user-supplied Jumpgate bundles. Roll20
// can renumber Webpack module IDs between deployments. First try the known
// module ID; if missing, perform one bounded read-only inspection of registered
// module FACTORY SOURCE (no execution). Only a unique source-verified engine
// selector may be imported; reject ambiguous or incompatible modules. Never
// guess a token or relax character ownership validation.
const R3_JUMPGATE_RUNTIME={
  moduleId:73210,tried:0,lastTry:0,engineClass:null,status:'not inspected',
  activeBuild:'unavailable',signature:'not checked'
};
function r3JumpgateFactoryProbe(factory){
  // Probe only the previously established VTTEngine Webpack module ID. Its
  // minifier output is not stable across Roll20 deployments; do not pin
  // variable names, an exact emitted getter, or export position.
  try{
    if(typeof factory!=='function')
      return {supported:false,reason:'expected module factory absent'};
    const source=Function.prototype.toString.call(factory);
    if(source.length<50000||source.length>2000000)
      return {supported:false,reason:'module size outside verified bounds'};
    if(!/VTTEngine:\s*\(\)\s*=>\s*[\w$]+/.test(source.slice(0,1024)))
      return {supported:false,reason:'VTTEngine export signature changed'};
    // Require both an engine selection delegate and an identifiable
    // multi-select reader, in addition to the exact scene-node model link.
    // Unknown methods remain fail-closed before require(moduleId) executes.
    if(!/getSelection\(\)\s*\{\s*return\s+this\.tabletop\.getSelection\(\)\s*;?\s*\}/.test(source))
      return {supported:false,reason:'VTTEngine selection delegate changed'};
    if(!/getSelection\(\)\s*\{[^}]{0,550}\.children[^}]{0,200}\}/.test(source))
      return {supported:false,reason:'tabletop selection children reader changed'};
    if(!source.includes('dataWrapper.model'))
      return {supported:false,reason:'scene-node token model bridge changed'};
    return {supported:true,reason:'selection factory capability matched'};
  }catch{return {supported:false,reason:'module factory inspection failed'};}
}
function r3JumpgateFactorySupported(factory){
  return r3JumpgateFactoryProbe(factory).supported;
}
// Roll20 renumbers module IDs between builds. Discover a relocated module
// by read-only inspection of the existing registry; NEVER invoke an unknown
// factory while probing. An ambiguous or oversized registry fails closed.
// The match must pass ALL of the same strict selection-specific checks as
// the original known ID, including the exact Roll20 scene-node model bridge.
function r3JumpgateResolveSelectionFactory(require,state){
  const registry=require?.m;
  if(!registry||typeof registry!=='object')
    return {id:null,reason:'Webpack module registry unavailable'};
  const known=registry[state.moduleId];
  const knownCheck=r3JumpgateFactoryProbe(known);
  if(knownCheck.supported)
    return {id:state.moduleId,reason:'known selection module verified'};
  let ids;
  try{ids=Object.keys(registry);}catch{
    return {id:null,reason:'Webpack module registry unreadable'};
  }
  if(ids.length>16000)
    return {id:null,reason:'Webpack module registry exceeds read-only inspection limit'};
  const matches=[];
  let sourceBytes=0;
  for(const id of ids){
    if(!/^(?:0|[1-9]\d{0,9})$/.test(id)||String(id)===String(state.moduleId))
      continue;
    const factory=registry[id];
    if(typeof factory!=='function')continue;
    let source;
    try{source=Function.prototype.toString.call(factory);}catch{continue;}
    sourceBytes+=source.length;
    if(sourceBytes>64000000)
      return {id:null,reason:'Webpack source inspection byte limit reached'};
    if(source.length<50000||source.length>2000000||
      !source.slice(0,1024).includes('VTTEngine')||
      !source.includes('dataWrapper.model')||
      !source.includes('getSelection'))continue;
    if(!r3JumpgateFactoryProbe(factory).supported)continue;
    matches.push(Number(id));
    if(matches.length>1)
      return {id:null,reason:'multiple verified selection module candidates'};
  }
  if(matches.length===1)
    return {id:matches[0],reason:'relocated selection module verified'};
  return {id:null,reason:'no verified selection factory registered; known ID: '+
    knownCheck.reason};
}
function r3JumpgateGetterSupported(getter){
  try{
    if(typeof getter!=='function'||getter.length!==0)return false;
    const source=Function.prototype.toString.call(getter);
    // Read-only zero-argument getter, returning the selection holder's
    // children or an empty array. Require no assignment or invocation in
    // the method body, except the syntax of permitted optional chaining.
    return source.length<=600&&
      /^getSelection\(\)\s*\{/.test(source)&&
      /\breturn\b/.test(source)&&/\.children\b/.test(source)&&
      source.endsWith('}')&&
      !/(?:\+\+|--|\b(?:delete|new|await|throw|yield)\b|\.\s*(?:add|set|push|splice|remove|clear|delete)\s*\()/.test(source);
  }catch{return false;}
}
// Install the observer during MAIN-world document_start, well before
// DOMContentLoaded or the native game engine finishes initializing.
// The two inspected Roll20 bundles call performance.mark('jumpgate-render-end')
// and then immediately performance.clearMarks('jumpgate-render-end') in the
// same synchronous page-change handler. Polling getEntriesByName *after*
// startup will ALWAYS miss that transient mark. PerformanceObserver retains
// records queued for its callback even after Roll20 clears the timeline.
const R3_JUMPGATE_RENDER={complete:false,observer:null,tracking:'not started'};
function r3JumpgateRememberFirstRender(entries){
  if(R3_JUMPGATE_RENDER.complete||!entries)return;
  try{
    for(const entry of entries){
      if(entry?.name!=='jumpgate-render-end'||entry.entryType!=='mark')
        continue;
      R3_JUMPGATE_RENDER.complete=true;
      R3_JUMPGATE_RENDER.tracking='first render observed';
      try{R3_JUMPGATE_RENDER.observer?.disconnect?.();}catch{}
      R3_JUMPGATE_RENDER.observer=null;
      break;
    }
  }catch{/* No engine access on malformed performance entries. */}
}
function r3JumpgateObserveFirstRender(){
  // A mark can already exist in the performance timeline during a late
  // attachment. Only passive browser Performance APIs are inspected.
  try{
    r3JumpgateRememberFirstRender(window.performance?.getEntriesByName?.(
      'jumpgate-render-end','mark'));
  }catch{}
  if(R3_JUMPGATE_RENDER.complete)return;
  try{
    const Observer=window.PerformanceObserver;
    if(typeof Observer!=='function'){
      R3_JUMPGATE_RENDER.tracking='PerformanceObserver unavailable';
      return;
    }
    const observer=new Observer(list=>{
      try{r3JumpgateRememberFirstRender(list.getEntries());}catch{}
    });
    R3_JUMPGATE_RENDER.observer=observer;
    // buffered:true also covers a briefly retained mark if the extension
    // started just after its creation. Future marks are always observed.
    observer.observe({type:'mark',buffered:true});
    R3_JUMPGATE_RENDER.tracking='watching first render';
  }catch{
    R3_JUMPGATE_RENDER.tracking='PerformanceObserver failed';
    try{R3_JUMPGATE_RENDER.observer?.disconnect?.();}catch{}
    R3_JUMPGATE_RENDER.observer=null;
  }
}
r3JumpgateObserveFirstRender();
function r3JumpgateFirstRenderComplete(){
  return R3_JUMPGATE_RENDER.complete;
}
function r3JumpgateSelection(){
  const state=R3_JUMPGATE_RUNTIME;
  // Critical safety barrier: don't register a Webpack callback, import its
  // VTTEngine module, or access the lazy .instance singleton until Roll20
  // finishes the first page render. Missing observer evidence fails closed.
  if(!r3JumpgateFirstRenderComplete()){
    state.status='waiting for Jumpgate first page render';
    return {items:[],state:state.status};
  }
  if(!state.engineClass&&state.tried<3&&
     (!state.lastTry||Date.now()-state.lastTry>3000)){
    state.tried++;state.lastTry=Date.now();
    const chunks=window.webpackChunkvtt;
    if(!Array.isArray(chunks)||typeof chunks.push!=='function'){
      state.status='Jumpgate webpack runtime not ready';
    }else{
      let invoked=false;
      try{
        chunks.push([['r20eb-selection-read-'+state.tried],{},
          require=>{
            invoked=true;
            let hash='';
            try{hash=typeof require?.h==='function'?
              String(require.h()).slice(0,64):'';}catch{}
            state.activeBuild=hash||'unavailable';
            // The former fixed ID can disappear when Jumpgate renumbers its
            // Webpack modules. Inspect source only and import a single proven
            // VTTEngine factory; never execute unknown candidates.
            const match=r3JumpgateResolveSelectionFactory(require,state);
            if(match.id===null){
              state.signature='selection interfaces differ: '+match.reason;
              state.status='unsupported Jumpgate selection interface';
              // If Roll20 hasn't registered the engine factory yet, retry
              // on the next normal poll. Ambiguity is terminal, not a guess.
              if(!match.reason.startsWith('no verified selection factory registered'))
                state.tried=3;
              return;
            }
            state.moduleId=match.id;
            try{
              const exported=require(match.id)?.VTTEngine;
              if(typeof exported!=='function'){
                state.status='VTTEngine export unavailable';state.tried=3;return;
              }
              // A source-matched module can load before the Babylon
              // tabletop is initialized. Retain it and retry the getter
              // check during normal polling; do not fail permanently.
              state.engineClass=exported;
              state.signature=match.reason+' (module '+match.id+')';
              state.status='waiting for Jumpgate tabletop';
            }catch{
              state.status='VTTEngine module activation failed';
              state.tried=3;
            }
          }]);
        if(!invoked)state.status='Jumpgate runtime callback unavailable';
      }catch{state.status='Jumpgate runtime access failed';}
    }
  }
  if(!state.engineClass)return {items:[],state:state.status};
  try{
    const tabletop=state.engineClass.instance?.tabletop;
    if(!tabletop||typeof tabletop.getSelection!=='function')
      return {items:[],state:'Jumpgate tabletop not ready'};
    if(!r3JumpgateGetterSupported(tabletop.getSelection)){
      state.signature='runtime getter differs';
      state.status='unsupported Jumpgate selection getter';
      state.engineClass=null;state.tried=3;
      return {items:[],state:state.status};
    }
    state.signature='verified selection capability';
    const selected=tabletop.getSelection();
    if(!Array.isArray(selected))
      return {items:[],state:'Jumpgate selection returned unsupported shape'};
    return {items:selected.slice(0,80),state:'verified Jumpgate selection read'};
  }catch{return {items:[],state:'Jumpgate selection read failed'};}
}
function r3TokenModelGet(model,key){
  try{return model?.get?.(key)??model?.attributes?.[key];}catch{return undefined;}
}
function r3TokenPlayerId(){
  // Roll20's actual browser editor exposes the current account as
  // window.currentPlayer (Backbone model). d20.player is optional in
  // several client versions; relying on it alone blocks valid PCs.
  const d=window.d20;
  const sources=[window.currentPlayer,d?.player];
  for(const model of sources){
    const id=r3String(model?.id||r3TokenModelGet(model,'_id')||
      r3TokenModelGet(model,'id'),100);
    if(id)return id;
  }
  return r3String(window.d20_player_id||window.player_id||
    window.playerid||d?.player_id,100);
}
function r3TokenControls(character,playerId=r3TokenPlayerId()){
  if(!character||!playerId)return false;
  const raw=r3TokenModelGet(character,'controlledby');
  const ids=(Array.isArray(raw)?raw:
    r3String(raw,1200).split(',')).map(x=>r3String(x,110).trim()).filter(Boolean);
  return ids.includes('all')||ids.includes(playerId);
}
function r3TokenCharacter(charId){
  const characters=r3TokenCampaign()?.characters;
  if(!characters||!charId)return null;
  try{
    const exact=characters.get?.(charId);
    if(exact)return exact;
  }catch{}
  return Array.isArray(characters.models)?
    characters.models.find(c=>r3String(c?.id||r3TokenModelGet(c,'_id'),110)===charId)||null:
    null;
}
// The new Jumpgate/Babylon map is not necessarily a Fabric canvas.
// Never derive a selected character from every visible graphic; inspect
// explicitly selected candidates and report why each was rejected.
function r3TokenSelectionArray(value,depth=0){
  if(value===null||value===undefined||depth>3)return [];
  if(typeof value==='string'&&value.length>0&&value.length<=110)return [value];
  if(Array.isArray(value))return value.slice(0,80);
  if(typeof value!=='object')return [];
  if(Array.isArray(value.models))return value.models.slice(0,80);
  if(typeof value.toArray==='function'){
    try{const items=value.toArray();if(Array.isArray(items))return items.slice(0,80);}catch{}
  }
  if(typeof value.values==='function'){
    try{
      const result=[];
      for(const item of value.values()){
        result.push(item);if(result.length>=80)break;
      }
      if(result.length)return result;
    }catch{}
  }
  // Jumpgate selection state can be a collection wrapper. Read only known
  // explicit selection member names; do not scan arbitrary scene objects.
  for(const key of ['selected','selectedTokens','selectedObjects','tokens','graphics','objects','ids']){
    if(!Object.prototype.hasOwnProperty.call(value,key)||value[key]===value)continue;
    const nested=r3TokenSelectionArray(value[key],depth+1);
    if(nested.length)return nested;
  }
  if(value.model||value.get||value.attributes||value.id||value.metadata||
     value.tokenId||value.graphicId)return [value];
  return [];
}
function r3TokenSelectionProbe(){
  const engine=window.d20?.engine,canvas=engine?.canvas;
  // The global vttEngine remains a string mode flag. The verified internal
  // Webpack module is a different source and is version-pinned.
  const runtime=r3JumpgateSelection(),nativeState=runtime.state;
  const actualBuild=R3_JUMPGATE_RUNTIME.activeBuild;
  const moduleSignature=R3_JUMPGATE_RUNTIME.signature;
  const modeFlag=r3TokenEngineMode();
  // A verified Jumpgate build exposes tabletopSelected as a getter wrapper.
  // Verified against a real Jumpgate session (2026-10-18):
  // () => VTTEngine.instance.tabletop.getSelection()
  // Only invoke this proven zero-argument *getter*. Unknown functions must
  // never be called because they may be selection/event mutators.
  let tabletop=engine?.tabletopSelected,getterState='not present';
  if(typeof tabletop==='function'){
    try{
      const source=Function.prototype.toString.call(tabletop);
      if(tabletop.length===0&&/\.tabletop\.getSelection\s*\(/.test(source)){
        tabletop=tabletop.call(engine);getterState='confirmed getter read';
      }else getterState='unverified function not invoked';
    }catch{
      tabletop=null;getterState='confirmed getter read failed';
    }
  }else if(tabletop!==undefined)getterState='selection property';
  const sources=[
    ['jumpgate.tabletop.getSelection',()=>runtime.items],
    ['engine.tabletopSelected',()=>tabletop],
    ['engine.selected',()=>typeof engine?.selected==='function'?engine.selected():engine?.selected],
    ['engine.selectedTokens',()=>typeof engine?.selectedTokens==='function'?engine.selectedTokens():engine?.selectedTokens],
    ['engine.selectedObjects',()=>typeof engine?.selectedObjects==='function'?engine.selectedObjects():engine?.selectedObjects],
    ['engine.selection',()=>engine?.selection],
    ['canvas.getActiveObjects',()=>canvas?.getActiveObjects?.()],
    ['canvas.getActiveObject',()=>canvas?.getActiveObject?.()],
    ['canvas._activeObjects',()=>canvas?._activeObjects],
    ['canvas._activeObject',()=>canvas?._activeObject]
  ];
  const items=[],names=[],types=[],seen=new Set();
  let getterShape='none';
  const shapeOf=value=>{
    if(value===undefined||value===null)return 'none';
    if(Array.isArray(value))return 'array '+value.length;
    if(typeof value==='object'){
      const className=r3String(value?.constructor?.name||'object',50);
      const count=Number(value?.size??value?.length);
      return className+(Number.isInteger(count)&&count>=0?' '+count:'');
    }
    return typeof value;
  };
  for(const [name,read] of sources){
    try{
      const value=read(),batch=r3TokenSelectionArray(value);
      if(name==='jumpgate.tabletop.getSelection'&&
         nativeState==='verified Jumpgate selection read')getterShape=shapeOf(value);
      if(name==='engine.tabletopSelected'&&getterShape==='none')getterShape=shapeOf(value);
      if(value!==undefined&&value!==null)
        types.push(name+':'+(Array.isArray(value)?'array':typeof value));
      if(!batch.length)continue;
      names.push(name+' ('+batch.length+')');
      for(const item of batch){
        if(item===null||item===undefined||seen.has(item)||items.length>=80)continue;
        seen.add(item);items.push(item);
      }
    }catch{/* An unavailable Roll20 API must not interrupt the game. */}
  }
  let renderer='unknown';
  try{
    renderer=document?.querySelector?.('canvas[data-engine^="Babylon.js"],#babylonCanvas')?
      'Babylon.js':document?.querySelector?.('canvas.lower-canvas')?'Fabric':'unknown';
  }catch{}
  const shape=(item)=>item&&typeof item==='object'?
    Object.keys(item).slice(0,16).join(', ')||'(no enumerable keys)':typeof item;
  const keys=(source)=>source&&typeof source==='object'?
    Object.keys(source).filter(k=>/select|token|graphic|scene/i.test(k)).slice(0,20).join(', '):'';
  // A visible Babylon canvas does not mean the optional legacy d20 bridge
  // is exposed. Keep this distinct from a getter returning zero tokens.
  const editorBridge=engine?'legacy editor engine available':
    runtime.state==='verified Jumpgate selection read'?
    'native Jumpgate selection available':
    !window.d20?'window.d20 unavailable':'window.d20.engine unavailable';
  const campaignBridge=r3TokenCampaign()?'available':'unavailable';
  const nativeKeys='not an object API',nativeTabletopKeys='not exposed';
  return {items,sources:names.join(', ')||'none',renderer,
    editorBridge,campaignBridge,nativeState,nativeKeys,nativeTabletopKeys,
    modeFlag,actualBuild,moduleSignature,
    selectionTypes:types.join(', ')||'none',
    selectionGetter:getterState,selectionReturnShape:getterShape,
    selectionShape:items.length?shape(items[0]):'none',
    engineKeys:keys(engine)||'none'};
}
function r3TokenSelected(){
  return r3TokenSelectionProbe().items;
}
function r3TokenGraphicId(value){
  if(typeof value==='string')return r3String(value,110);
  return r3String(value?.metadata?.tokenId||value?.metadata?.token_id||
    value?.metadata?.graphicId||value?.metadata?.graphic_id||
    value?.tokenId||value?.graphicId||value?.token?.id||
    value?.graphic?.id||value?.id||'',110);
}
function r3TokenFindGraphic(id){
  if(!id)return null;
  const c=r3TokenCampaign(),engine=window.d20?.engine;
  let page=null;
  try{page=typeof c?.activePage==='function'?c.activePage():c?.activePage;}catch{}
  // Exact graphic ID lookup only; arbitrary displayed tokens never become
  // eligible merely because their image/name matches the current profile.
  for(const source of [page?.thegraphics,page?.graphics,engine?.thegraphics]){
    if(!source)continue;
    try{
      const direct=source?.get?.(id);
      if(direct)return direct;
      const collection=Array.isArray(source)?source:
        Array.isArray(source?.models)?source.models:null;
      if(collection){
        const model=collection.find(v=>
          r3String(v?.id||r3TokenModelGet(v,'_id'),110)===id);
        if(model)return model;
      }
      if(typeof source.values==='function'){
        let count=0;
        for(const item of source.values()){
          if(++count>2000)break;
          if(r3String(item?.id||r3TokenModelGet(item,'_id'),110)===id)
            return item;
        }
      }
    }catch{}
  }
  return null;
}
function r3TokenCandidateModel(item){
  const variants=[item?.dataWrapper?.model,item?.model,
    item?.graphic?.dataWrapper?.model,item?.graphic?.model,item?.graphic,
    item?.token?.model,item?.token,item?.metadata?.model,
    item?.metadata?.graphic?.model,item?.metadata?.graphic,
    item?.metadata?.token?.model,item?.metadata?.token,item];
  const direct=variants.find(v=>v&&r3TokenModelGet(v,'represents'));
  if(direct)return direct;
  const id=r3TokenGraphicId(item);
  return r3TokenFindGraphic(id)||variants.find(v=>v&&typeof v==='object')||null;
}
function r3TokenInspectLinked(item){
  const model=r3TokenCandidateModel(item);
  const tokenId=r3String(model?.id||r3TokenModelGet(model,'_id'),110);
  if(!tokenId)return {reason:'Selected graphic has no readable token ID'};
  const charId=r3String(r3TokenModelGet(model,'represents')||
    r3TokenModelGet(model,'_represents'),110);
  if(!charId)return {reason:'Selected graphic has no readable character link (represents)'};
  const character=r3TokenCharacter(charId);
  if(!character)return {reason:'Character linked to selected token is not loaded in Roll20'};
  const name=r3String(r3TokenModelGet(character,'name'),120);
  if(!name)return {reason:'Linked character name unavailable'};
  const playerId=r3TokenPlayerId();
  if(!playerId)return {reason:'Roll20 current player ID unavailable'};
  if(!r3TokenControls(character,playerId))
    return {reason:'Selected character Controlled By does not confirm this player'};
  const tokenImage=r3TokenSafeArt(r3TokenModelGet(model,'imgsrc')||
    item?._element?.src);
  return {reason:'Selected token and character control verified',
    info:{tokenId,characterId:charId,name,tokenImage}};
}
function r3TokenSelectionDiagnostics(probe=r3TokenSelectionProbe()){
  const reasons=[];
  const common={
    renderer:probe.renderer,selectionSource:probe.sources,
    selectionCount:probe.items.length,selectionTypes:probe.selectionTypes,
    selectionShape:probe.selectionShape,engineKeys:probe.engineKeys,
    editorBridge:probe.editorBridge,campaignBridge:probe.campaignBridge,
    nativeState:probe.nativeState,modeFlag:probe.modeFlag,
    actualBuild:probe.actualBuild,moduleSignature:probe.moduleSignature,
    nativeKeys:probe.nativeKeys,
    nativeTabletopKeys:probe.nativeTabletopKeys,
    selectionGetter:probe.selectionGetter,
    selectionReturnShape:probe.selectionReturnShape
  };
  for(const item of probe.items){
    const result=r3TokenInspectLinked(item);
    if(result.info)return {...common,reason:result.reason,eligible:true};
    if(!reasons.includes(result.reason))reasons.push(result.reason);
  }
  let reason=reasons.join(' | ');
  if(!reason){
    if(probe.nativeState==='unsupported Jumpgate selection interface'||
       probe.nativeState==='unsupported Jumpgate selection getter')
      reason='Jumpgate selection interface changed; bridge disabled';
    else if(probe.nativeState==='verified Jumpgate selection read')
      reason='Jumpgate selection returned no linked controlled tokens';
    else if(probe.selectionGetter==='confirmed getter read failed')
      reason='Legacy Jumpgate selection getter failed';
    else if(probe.selectionGetter==='confirmed getter read')
      reason='Legacy Jumpgate getter returned no supported selected tokens ('+
        probe.selectionReturnShape+')';
    else if(probe.editorBridge==='window.d20 unavailable'||
            probe.editorBridge==='window.d20.engine unavailable')
      reason=probe.editorBridge+
        '; native selection: '+probe.nativeState;
    else reason='Roll20 selection not exposed by inspected editor APIs';
  }
  return {...common,eligible:false,reason};
}
function r3TokenSafeArt(raw){
  try{
    const uri=new URL(r3String(raw,4096),location.origin);
    return uri.protocol==='https:'&&uri.href.length<=4096?uri.href:'';
  }catch{return '';}
}
function r3TokenLinkedInfo(object){
  return r3TokenInspectLinked(object).info||null;
}
function r3TokenUnambiguousName(name){
  const collection=r3TokenCampaign()?.characters;
  const all=Array.isArray(collection?.models)?collection.models:null;
  if(!all)return true; // No exposed full collection; require linked token below.
  return all.filter(model=>r3String(r3TokenModelGet(model,'name'),120).toLowerCase()===
    r3String(name,120).toLowerCase()).length<=1;
}
function r3TokenCacheKey(){return r3StorageKey()+':character-snapshots';}
function r3TokenSettingsKey(){
  return r3StorageKey()+':hud'+(R3_TOKEN.active?
    ':character:'+encodeURIComponent(R3_TOKEN.active.characterId):'');
}
function r3TokenLoad(){
  R3_TOKEN.legacy=R3_UI.restoredSnapshot||R3_UI.snapshot;
  try{
    const stored=JSON.parse(localStorage.getItem(r3TokenCacheKey())||'null');
    if(stored?.schema!==1||!Array.isArray(stored.profiles))return;
    for(const entry of stored.profiles.slice(0,16)){
      if(typeof entry.id!=='string'||entry.id.length>110||
         typeof entry.name!=='string'||!entry.name||entry.name.length>120||
         entry.snapshot?.schema!==3||
         r3String(entry.snapshot.name,120).toLowerCase()!==entry.name.toLowerCase())
        continue;
      R3_TOKEN.snapshots.set(entry.id,{name:entry.name,
        snapshot:r3InventoryPrune(entry.snapshot)});
    }
  }catch{/* Corrupted cache cannot stop HUD startup. */}
}
function r3TokenSaveCache(){
  const profiles=[...R3_TOKEN.snapshots.entries()].slice(-12)
    .map(([id,data])=>({id,name:data.name,snapshot:data.snapshot}));
  try{
    const payload=JSON.stringify({schema:1,profiles});
    if(payload.length<3400000)
      localStorage.setItem(r3TokenCacheKey(),payload);
  }catch{/* Keep in-memory snapshots even when browser storage is full. */}
}
function r3TokenRecordSnapshot(snapshot){
  if(snapshot?.schema!==3||!snapshot.name)return;
  R3_TOKEN.legacy=snapshot;
  const active=R3_TOKEN.active;
  // Do not associate a new character's snapshot with an unrelated selected
  // token, even when it arrived after a manual import or stale async scan.
  if(!active||active.name.toLowerCase()!==snapshot.name.toLowerCase()||
     !r3TokenUnambiguousName(snapshot.name))return;
  R3_TOKEN.snapshots.set(active.characterId,{name:active.name,
    snapshot:r3InventoryPrune(snapshot)});
  r3TokenSaveCache();
}
function r3TokenSnapshotFor(info){
  const saved=R3_TOKEN.snapshots.get(info.characterId);
  if(saved&&saved.name.toLowerCase()===info.name.toLowerCase())
    return r3InventoryPrune(saved.snapshot);
  // Migrate only a legacy snapshot explicitly naming the selected sheet.
  const legacy=R3_TOKEN.legacy;
  if(legacy?.schema===3&&r3TokenUnambiguousName(info.name)&&
     r3String(legacy.name,120).toLowerCase()===info.name.toLowerCase()){
    R3_TOKEN.snapshots.set(info.characterId,{name:info.name,snapshot:legacy});
    r3TokenSaveCache();
    return r3InventoryPrune(legacy);
  }
  // Never show a previous PC's HP, spells or attacks while a new sheet loads.
  const blank=r3Empty();blank.name=info.name;
  blank.diagnostics.notes.push('Loading the selected token private Roll20 sheet and importing available tabs automatically.');
  return r3Coverage(blank);
}
function r3TokenSwitch(info){
  const previous=R3_TOKEN.active;
  const same=previous?.characterId===info.characterId;
  if(same){
    if(previous.tokenId!==info.tokenId||previous.tokenImage!==info.tokenImage){
      R3_TOKEN.active=info;
      R3_HUD.renderedPortrait=null;r3HudRender();
    }
    return;
  }
  if(previous)r3HudSave();
  R3_TOKEN.active=info;R3_TOKEN.visibleSheetId='';
  R3_UI.snapshot=r3TokenSnapshotFor(info);
  R3_UI.view='summary';
  R3_UI.renderedSnapshot=null;
  R3_HUD.portraitName='';R3_HUD.portraitUrl='';R3_HUD.portraitChecked=0;
  R3_HUD.flyout='';R3_HUD.chooser=null;
  R3_NATIVE.preview=null;
  R3_NATIVE.status='';
  R3_NATIVE.revision++;
  r3HudLoad();
  if(typeof r3MoveRebase==='function')r3MoveRebase();
  // The user has already selected an authorized Roll20 character; a
  // second Auto-sync toggle or explicit first import is unnecessary.
  if(typeof r3AutoFollowToken==='function')r3AutoFollowToken(info);
  r3UIStatus('Selected '+info.name+'. '+(R3_UI.snapshot.coverage?.attacks?
    'Using this character’s saved sheet.':
    'Synchronizing from Roll20 when its official sheet is available.'));
  r3UIRefresh();
}
// A DM can create/open a 2024 PC sheet before placing a controllable token.
// Follow ONLY one visibly opened official sheet that resolves to a unique
// current-campaign character model (or an exact character ID). This is a
// read-only display/import mode, not a claim of token ownership; never use it
// to issue token-bound native actions or open a private sheet automatically.
function r3TokenFollowVisibleSheet(){
  if(R3_TOKEN.active||typeof r3Candidates!=='function')return false;
  const collection=r3TokenCampaign()?.characters;
  if(!collection)return false;
  const candidates=r3Candidates().filter(c=>c?.visible&&c.window&&
    (c.type==='iframe'||c.type==='popout')&&
    typeof c.name==='string'&&c.name.length>0&&c.name.length<=120&&
    !/^(?:2024 character sheet|unnamed sheet|official sheet popout)/i.test(c.name)&&
    !(typeof r3NativeIsOwned==='function'&&r3NativeIsOwned(c)));
  const resolved=[];
  for(const candidate of candidates.slice(0,20)){
    const exactId=typeof r3AutoId==='function'?r3AutoId(candidate):'';
    let model=null;
    if(exactId)model=r3TokenCharacter(exactId);
    else if(Array.isArray(collection.models)){
      const matches=collection.models.filter(m=>
        r3String(r3TokenModelGet(m,'name'),120).toLowerCase()===candidate.name.toLowerCase());
      if(matches.length===1)model=matches[0];
    }
    if(!model||r3String(r3TokenModelGet(model,'name'),120).toLowerCase()!==
       candidate.name.toLowerCase())continue;
    const id=r3String(model.id||r3TokenModelGet(model,'_id'),110);
    if(id)resolved.push({candidate,model,id,name:r3String(r3TokenModelGet(model,'name'),120)});
  }
  if(resolved.length!==1)return false;
  const {candidate,id,name}=resolved[0];
  if(R3_TOKEN.visibleSheetId===id)return false;
  // A sheet opened by the player is an explicit selection even without a
  // map token, but it cannot confer ownership on any map graphic.
  R3_TOKEN.visibleSheetId=id;
  const snap=r3Empty();snap.name=name;
  snap.diagnostics.notes.push('Viewing an official character sheet in this campaign. Token-bound actions require selecting a controlled token.');
  R3_UI.snapshot=r3Coverage(snap);
  R3_UI.view='summary';R3_UI.selected=candidate.key;
  R3_UI.renderedSnapshot=null;R3_HUD.flyout='';R3_HUD.chooser=null;
  if(typeof r3HudLoad==='function')r3HudLoad();
  // Read the currently visible tab only. Never switch a manually opened
  // Roll20 sheet's tabs or open an arbitrary character's Journal entry.
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;
    R3_AUTO.enabled=true;R3_AUTO.origin='visible';
    R3_AUTO.name=name;R3_AUTO.characterId=id;
    R3_AUTO.lastScan=0;R3_AUTO.lastFull=0;R3_AUTO.lastOpenAttempt=0;
  }
  if(typeof r3UIStatus==='function')
    r3UIStatus('Showing '+name+' from the current campaign’s official sheet; reading its visible tab.');
  if(typeof r3UIRefresh==='function')r3UIRefresh();
  if(typeof r3AutoTick==='function')r3AutoTick();
  return true;
}
// A single-page Roll20 navigation may reuse the extension host while changing
// the editor game. Do not keep the old game’s token, imported character,
// auto-reader, cached sheet identities or character-specific UI in that case.
function r3TokenCheckCampaign(){
  if(typeof r3StorageKey!=='function'||typeof R3_UI!=='object')return false;
  const current=r3StorageKey();
  if(!R3_UI.campaignKey){R3_UI.campaignKey=current;return false;}
  if(R3_UI.campaignKey===current)return false;
  if(typeof r3AutoRestoreDialog==='function')r3AutoRestoreDialog();
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;R3_AUTO.enabled=false;R3_AUTO.name='';
    R3_AUTO.characterId='';R3_AUTO.origin='manual';
    R3_AUTO.lastScan=0;R3_AUTO.lastFull=0;
    if(R3_AUTO.dirtyTimer!==null&&typeof clearTimeout==='function')
      clearTimeout(R3_AUTO.dirtyTimer);
    R3_AUTO.dirtyTimer=null;
  }
  R3_TOKEN.active=null;R3_TOKEN.selectionIds=[];R3_TOKEN.visibleSheetId='';
  R3_TOKEN.snapshots.clear();R3_TOKEN.legacy=null;
  R3_UI.campaignKey=current;R3_UI.snapshot=null;
  R3_UI.restoredSnapshot=null;R3_UI.selected='';R3_UI.view='summary';
  R3_UI.renderedSnapshot=null;R3_UI.renderedView=null;
  if(typeof R3_NATIVE==='object'){
    R3_NATIVE.preview=null;R3_NATIVE.status='';R3_NATIVE.revision++;
  }
  r3Load();r3TokenLoad();
  if(typeof r3HudLoad==='function')r3HudLoad();
  if(typeof r3AutoLoad==='function')r3AutoLoad();
  if(typeof r3MoveRebase==='function')r3MoveRebase();
  if(typeof r3UIStatus==='function')
    r3UIStatus('Campaign changed. Waiting for a selected token or visible official character sheet.');
  if(typeof r3UIRefresh==='function')r3UIRefresh();
  return true;
}
function r3TokenPoll(){
  if(r3TokenCheckCampaign())return;
  if(typeof r3TurnObserveInitiative==='function')r3TurnObserveInitiative();
  const picked=r3TokenSelected();
  const tokens=picked.map(item=>{
    const model=r3TokenCandidateModel(item);
    return r3String(model?.id||r3TokenModelGet(model,'_id')||
      r3TokenGraphicId(item),110);
  }).filter(Boolean);
  const fresh=tokens.filter(id=>!R3_TOKEN.selectionIds.includes(id));
  R3_TOKEN.selectionIds=tokens;
  // A selection can arrive before Roll20 loads the represented character,
  // its name, or permissions. Retry unresolved selections on the next poll
  // instead of permanently discarding the token ID until user deselects it.
  // Successful selections retain the old newest-token behavior.
  const candidates=fresh.length?fresh:(!R3_TOKEN.active?tokens:[]);
  if(!candidates.length){
    if(!R3_TOKEN.active)r3TokenFollowVisibleSheet();
    if(typeof r3MovePoll==='function')r3MovePoll();
    return;
  }
  for(const id of candidates.slice().reverse()){
    const index=tokens.lastIndexOf(id);
    const info=r3TokenLinkedInfo(picked[index]);
    if(info){r3TokenSwitch(info);break;}
  }
  if(typeof r3MovePoll==='function')r3MovePoll();
}
function r3StartTokenWatch(){
  if(R3_TOKEN.started)return;
  R3_TOKEN.started=true;r3TokenPoll();
  // Roll20's editor doesn't expose a documented browser-side selection event;
  // cheap read-only polling works for clicks, lasso selection and keyboard ops.
  R3_TOKEN.timer=setInterval(r3TokenPoll,400);
}
