// Follow the most recently selected player-controllable token, not a fixed PC.
// Reads the in-page Roll20 editor's current Fabric/Backbone models, not the
// GM-only Mod API or undocumented remote endpoints. Fail closed when the
// selected token's represented character and its permissions are unavailable.
const R3_TOKEN={
  active:null,selectionIds:[],snapshots:new Map(),legacy:null,
  timer:null,started:false
};
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
  return r3String(window.player_id||window.playerid||d?.player_id,100);
}
function r3TokenControls(character,playerId=r3TokenPlayerId()){
  if(!character||!playerId)return false;
  const raw=r3TokenModelGet(character,'controlledby');
  const ids=(Array.isArray(raw)?raw:
    r3String(raw,1200).split(',')).map(x=>r3String(x,110).trim()).filter(Boolean);
  return ids.includes('all')||ids.includes(playerId);
}
function r3TokenCharacter(charId){
  const characters=window.d20?.Campaign?.characters;
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
      if(name==='engine.tabletopSelected')getterShape=shapeOf(value);
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
  const editorBridge=!window.d20?'window.d20 unavailable':
    !engine?'window.d20.engine unavailable':
    'editor engine available';
  const campaignBridge=window.d20?.Campaign?'available':'unavailable';
  return {items,sources:names.join(', ')||'none',renderer,
    editorBridge,campaignBridge,
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
  const c=window.d20?.Campaign,engine=window.d20?.engine;
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
  const variants=[item?.model,item?.graphic?.model,item?.graphic,
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
  for(const item of probe.items){
    const result=r3TokenInspectLinked(item);
    if(result.info)return {renderer:probe.renderer,selectionSource:probe.sources,
      selectionCount:probe.items.length,selectionTypes:probe.selectionTypes,
      selectionShape:probe.selectionShape,engineKeys:probe.engineKeys,
      editorBridge:probe.editorBridge,campaignBridge:probe.campaignBridge,
      selectionGetter:probe.selectionGetter,selectionReturnShape:probe.selectionReturnShape,
      reason:result.reason,eligible:true};
    if(!reasons.includes(result.reason))reasons.push(result.reason);
  }
  return {renderer:probe.renderer,selectionSource:probe.sources,
    selectionCount:probe.items.length,selectionTypes:probe.selectionTypes,
    selectionShape:probe.selectionShape,engineKeys:probe.engineKeys,
    editorBridge:probe.editorBridge,campaignBridge:probe.campaignBridge,
    selectionGetter:probe.selectionGetter,selectionReturnShape:probe.selectionReturnShape,
    eligible:false,
    reason:reasons.join(' | ')||
      (probe.editorBridge!=='editor engine available'?
        probe.editorBridge+'; no Roll20 selection API accessible':
        probe.selectionGetter==='confirmed getter read failed'?
        'Jumpgate selection getter failed':
        probe.selectionGetter==='confirmed getter read'?
          'Jumpgate getter returned no supported selected tokens ('+
          probe.selectionReturnShape+')':
          probe.renderer==='Babylon.js'?
            'Babylon selection not exposed by inspected editor APIs':
            'Roll20 selection not exposed by inspected editor APIs')};
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
  const collection=window.d20?.Campaign?.characters;
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
  R3_TOKEN.legacy=R3_UI.snapshot;
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
  blank.diagnostics.notes.push('This character has not been imported. Open its official sheet and import through Debug.');
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
  R3_TOKEN.active=info;
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
  if(R3_AUTO.enabled){
    // Old in-flight reads cannot overwrite the newly selected character.
    R3_AUTO.generation++;
    if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
    R3_AUTO.dirtyTimer=null;
    R3_AUTO.name=info.name;
    R3_AUTO.characterId=info.characterId;
    R3_AUTO.lastScan=0;R3_AUTO.lastHealth=0;
    r3AutoSave();
    r3AutoDisplay('Following selected token: '+info.name);
  }
  r3UIStatus('Selected '+info.name+'. '+(R3_UI.snapshot.coverage?.attacks?
    'Using this character’s saved sheet.':
    'Import its official sheet through Debug if no data appears.'));
  r3UIRefresh();
}
function r3TokenPoll(){
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
  if(!candidates.length){if(typeof r3MovePoll==='function')r3MovePoll();return;}
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
