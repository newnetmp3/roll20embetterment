// Player-character mode: only source-verified controlled-token selection
// may activate token movement, private source readers and native actions.
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
  // A sheet may be closed and reopened while a map token is selected.
  // Clear the former dialog identity so the new explicit opening is recognized.
  R3_TOKEN.visibleSheetSeen='';R3_TOKEN.visibleSheetMissing=0;
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
