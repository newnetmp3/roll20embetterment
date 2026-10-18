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
function r3TokenSelected(){
  try{
    const selected=window.d20?.engine?.selected?.();
    return Array.isArray(selected)?selected.slice(0,80):[];
  }catch{return [];}
}
function r3TokenSafeArt(raw){
  try{
    const uri=new URL(r3String(raw,4096),location.origin);
    return uri.protocol==='https:'&&uri.href.length<=4096?uri.href:'';
  }catch{return '';}
}
function r3TokenLinkedInfo(object){
  const model=object?.model||object;
  const tokenId=r3String(model?.id||r3TokenModelGet(model,'_id'),110);
  const charId=r3String(r3TokenModelGet(model,'represents')||
    r3TokenModelGet(model,'_represents'),110);
  if(!tokenId||!charId)return null;
  const d=window.d20;
  const character=r3TokenCharacter(charId);
  if(!character)return null;
  const name=r3String(r3TokenModelGet(character,'name'),120);
  const playerId=r3TokenPlayerId();
  if(!name||!playerId)return null;
  // Character permissions override token permissions for linked graphics.
  // An empty list cannot prove access. GM selection alone is not permission.
  if(!r3TokenControls(character,playerId))return null;
  const tokenImage=r3TokenSafeArt(r3TokenModelGet(model,'imgsrc')||
    object?._element?.src);
  return {tokenId,characterId:charId,name,tokenImage};
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
    const model=item?.model||item;
    return r3String(model?.id||r3TokenModelGet(model,'_id'),110);
  }).filter(Boolean);
  const fresh=tokens.filter(id=>!R3_TOKEN.selectionIds.includes(id));
  R3_TOKEN.selectionIds=tokens;
  if(!fresh.length){if(typeof r3MovePoll==='function')r3MovePoll();return;}
  // For group selection, choose the last newly selected eligible linked
  // token. A later click on a token in the group becomes the current focus.
  for(const id of fresh.slice().reverse()){
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
