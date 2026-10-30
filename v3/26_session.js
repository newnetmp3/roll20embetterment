// Shared mode coordinator. This is the only module that arbitrates a
// newly selected player-controlled map token versus an explicitly opened DM
// character sheet. Both modes use the same bounded sheet reader and HUD.
function r3SessionMode(){
  if(R3_TOKEN.active?.characterId)return 'player-character';
  if(R3_TOKEN.visibleSheetId)return 'dm-sheet';
  if(R3_TOKEN.rosterPreviewId)return r3RosterIsGm()?'dm-journal':'player-journal';
  return 'unbound';
}
function r3SessionLabel(){
  const mode=r3SessionMode();
  return mode==='dm-sheet'?'DM Sheet · Read-only':
    mode==='player-character'?'Player Character':
    mode==='dm-journal'?'DM Journal · Preloaded':
    mode==='player-journal'?'Player Journal · Preloaded':'No character linked';
}
// A single-page Roll20 navigation may reuse the extension host while changing
// the editor game. Do not keep the old game’s token, imported character,
// auto-reader, cached sheet identities or character-specific UI in that case.
function r3TokenCheckCampaign(){
  if(typeof r3StorageKey!=='function'||typeof R3_UI!=='object')return false;
  const current=r3StorageKey();
  if(!R3_UI.campaignKey){R3_UI.campaignKey=current;return false;}
  if(R3_UI.campaignKey===current)return false;
  if(typeof r3RosterReset==='function')r3RosterReset();
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
  R3_TOKEN.visibleSheetSeen='';R3_TOKEN.visibleSheetMissing=0;
  R3_TOKEN.rosterPreviewId='';
  R3_TOKEN.snapshots.clear();R3_TOKEN.legacy=null;
  R3_UI.campaignKey=current;R3_UI.snapshot=null;
  R3_UI.restoredSnapshot=null;R3_UI.selected='';R3_UI.view='summary';
  R3_UI.renderedSnapshot=null;R3_UI.renderedView=null;
  if(typeof R3_NATIVE==='object'){
    R3_NATIVE.preview=null;R3_NATIVE.status='';R3_NATIVE.revision++;
    R3_NATIVE.readers?.clear?.();
  }
  // A same-document game switch must not reuse authenticated popout windows
  // or old sheet-dialog handles from the previous campaign.
  if(typeof R3_POPOUTS==='object')R3_POPOUTS.clear();
  if(typeof R3_NATIVE_BG==='object'){
    R3_NATIVE_BG.sessions?.clear?.();
    R3_NATIVE_BG.characterId='';R3_NATIVE_BG.name='';
  }
  r3Load();r3TokenLoad();
  if(typeof r3HudLoad==='function')r3HudLoad();
  if(typeof r3AutoLoad==='function')r3AutoLoad();
  if(typeof r3TurnLoad==='function')r3TurnLoad();
  if(typeof r3BattlefieldLoad==='function')r3BattlefieldLoad();
  if(typeof r3MoveRebase==='function')r3MoveRebase();
  if(typeof r3UIStatus==='function')
    r3UIStatus('Campaign changed. Waiting for a selected token or visible official character sheet.');
  if(typeof r3UIRefresh==='function')r3UIRefresh();
  if(typeof r3RosterDiscover==='function')r3RosterDiscover();
  if(typeof r3ProgressRefresh==='function')r3ProgressRefresh();
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
  // Roll20 can leave a previous map token selected while the DM opens a
  // different PC sheet. A newly opened, explicitly named dialog takes
  // display priority unless a *new* verified token selection just occurred.
  if(!fresh.length)r3TokenFollowVisibleSheet();
  const candidates=fresh.length?fresh:
    (!R3_TOKEN.active&&!R3_TOKEN.visibleSheetId&&!R3_TOKEN.rosterPreviewId?tokens:[]);
  if(!candidates.length){
    if(typeof r3MovePoll==='function')r3MovePoll();
    return;
  }
  const switched=r3PlayerFollowSelection(picked,tokens,candidates);
  // The GM may select a map token not owned by a player and explicitly open
  // its sheet. Keep token-only mapping blocked, but show that visible sheet.
  if(!switched&&fresh.length)r3TokenFollowVisibleSheet();
  if(typeof r3MovePoll==='function')r3MovePoll();
}
function r3StartTokenWatch(){
  if(R3_TOKEN.started)return;
  R3_TOKEN.started=true;r3TokenPoll();
  // Roll20's editor doesn't expose a documented browser-side selection event;
  // cheap read-only polling works for clicks, lasso selection and keyboard ops.
  R3_TOKEN.timer=setInterval(r3TokenPoll,400);
}
