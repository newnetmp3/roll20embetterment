// Firefox-only: original Roll20 sheets always win over invisible HUD readers.
// A player request restores *all* reader sessions, including Auto-sync-owned
// wrappers; active private-reader requests then stop before claiming new DOM.
const R3_SHEET_VIS={installed:false,manualPriority:false,manualUntil:0};
function r3SheetVisibilityKey(){return r3StorageKey()+':manual-sheet-priority:v1';}
function r3SheetVisibilityLoad(){
  try{R3_SHEET_VIS.manualPriority=
    localStorage.getItem(r3SheetVisibilityKey())==='true';}catch{}
}
function r3SheetAllowsBackground(){
  // A trusted player Journal action gets a short automatic-open grace period,
  // not a permanent opt-out. Explicit Debug 'restore' remains sticky.
  return !R3_SHEET_VIS.manualPriority&&Date.now()>=R3_SHEET_VIS.manualUntil;
}
function r3SheetVisibilitySave(){
  try{localStorage.setItem(r3SheetVisibilityKey(),
    R3_SHEET_VIS.manualPriority?'true':'false');}catch{}
}
function r3SheetRecoverMarkedDialogs(){
  // These markers are exclusively R20eb's, and might outlive an obsolete
  // session record after a Roll20 reparent/remount. Rescue rather than leave
  // the player unable to see or close their original sheet.
  for(const el of Array.from(document.querySelectorAll?.(
    '[data-r3-private-reader],[data-r3-private-overlay]')||[])){
    const overlay=el.hasAttribute?.('data-r3-private-overlay');
    el.removeAttribute?.('data-r3-private-reader');
    el.removeAttribute?.('data-r3-private-overlay');
    if(!el.style)continue;
    if(overlay){
      // Untracked overlays are released; don't synthesize a modal.
      if(el.style.opacity==='0')el.style.opacity='';
      if(el.style.pointerEvents==='none')el.style.pointerEvents='';
    }else{
      if(el.style.left==='-20000px')el.style.left='max(12px, calc(50vw - 300px))';
      if(el.style.top==='-20000px')el.style.top='55px';
      if(el.style.opacity==='0')el.style.opacity='1';
    }
  }
}
function r3SheetRevealAll(quiet=false){
  if(quiet)R3_SHEET_VIS.manualUntil=Date.now()+3000;
  else{
    R3_SHEET_VIS.manualPriority=true;
    r3SheetVisibilitySave();
  }
  // Stop cross-origin full-tab traversal before showing a sheet. The reader
  // must not continue switching its tabs under a player's manual control.
  if(typeof r3CancelOwnedScans==='function')r3CancelOwnedScans();
  // Invalidate any pending auto scan; no new background opener is allowed
  // until the player explicitly re-enables it.
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;
    r3AutoRestoreDialog();
  }
  if(typeof r3NativeBgRestoreAll==='function')r3NativeBgRestoreAll();
  r3SheetRecoverMarkedDialogs();
  if(!quiet&&typeof r3NativeStatus==='function')
    r3NativeStatus('Original Roll20 sheets restored. R20eb will use visible sheets or popouts and will not hide them. You can re-enable background readers from the HUD.');
  if(!quiet)r3HudRender();
}
function r3SheetAllowPrivateReaders(){
  R3_SHEET_VIS.manualPriority=false;
  R3_SHEET_VIS.manualUntil=0;
  r3SheetVisibilitySave();
  r3NativeStatus('Private readers allowed again on your next Find/Auto-sync. Your currently visible Roll20 sheet will not be moved.');
  r3HudRender();
}
function r3SheetIsJournalIntent(target){
  if(typeof target?.closest!=='function')return false;
  return !!target.closest(
    '#journal [data-characterid],#journal [data-itemid],'+
    '#journal [data-id],#journal .journalitem,'+
    '#journal .character,.journalitem[data-characterid],'+
    '.journalitem[data-itemid]');
}
function r3SheetOnPlayerJournal(event){
  if(event?.isTrusted!==true)return;
  if(!r3SheetIsJournalIntent(event.target))return;
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
  // Pointerdown runs before Roll20's dblclick handler, even if it simply
  // focuses an existing singleton dialog. False positives only expose the
  // official sheet; they never trigger a Roll20 action.
  r3SheetRevealAll(true);
}
function r3SheetVisibilityInstall(){
  if(R3_SHEET_VIS.installed)return;
  R3_SHEET_VIS.installed=true;
  r3SheetVisibilityLoad();
  // On a prior user choice, rescue any orphaned marks immediately.
  if(R3_SHEET_VIS.manualPriority){
    r3NativeBgRestoreAll();
    r3AutoRestoreDialog();
    r3SheetRecoverMarkedDialogs();
  }
  document.addEventListener('pointerdown',r3SheetOnPlayerJournal,true);
  document.addEventListener('dblclick',r3SheetOnPlayerJournal,true);
  document.addEventListener('keydown',r3SheetOnPlayerJournal,true);
}
