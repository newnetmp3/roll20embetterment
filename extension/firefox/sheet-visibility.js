// Private readers are enabled by default and require no permission toggle.
// A trusted Journal open temporarily gives the manual sheet precedence; never
// hide, navigate or claim player-owned dialogs/popouts as extension-owned.
const R3_SHEET_VIS={installed:false,manualUntil:0};
function r3SheetVisibilityKey(){return r3StorageKey()+':manual-sheet-priority:v1';}
function r3SheetVisibilityLoad(){
  // Migrate the old sticky "Show Sheet" setting. The player's ability to
  // open/show the original sheet is still protected on every Journal event.
  try{localStorage.removeItem?.(r3SheetVisibilityKey());}catch{}
}
function r3SheetAllowsBackground(){
  // This transient grace protects Roll20's modal opener, not a user setting.
  // Independently owned private readers resume automatically after it.
  return Date.now()>=R3_SHEET_VIS.manualUntil;
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
  // Showing the original sheet never permanently disables private readers.
  // Release owned sessions before the player can interact with their sheet.
  R3_SHEET_VIS.manualUntil=Date.now()+3000;
  // Stop cross-origin full-tab traversal before showing a sheet. The reader
  // must not continue switching its tabs under a player's manual control.
  if(typeof r3CancelOwnedScans==='function')r3CancelOwnedScans();
  // Invalidate scans that could navigate the now player-owned sheet.
  // New private readers can start automatically after the brief grace period.
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;
    r3AutoRestoreDialog();
  }
  if(typeof r3NativeBgRestoreAll==='function')r3NativeBgRestoreAll();
  r3SheetRecoverMarkedDialogs();
  if(!quiet&&typeof r3NativeStatus==='function')
    r3NativeStatus('Original Roll20 sheets restored. Private reading resumes automatically without changing this sheet.');
  if(!quiet)r3HudRender();
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
  // An earlier R20eb build may have persisted a sticky disable or left
  // hidden-sheet markers after a crash. Recover those safely on startup.
  r3NativeBgRestoreAll();
  r3AutoRestoreDialog();
  r3SheetRecoverMarkedDialogs();
  document.addEventListener('pointerdown',r3SheetOnPlayerJournal,true);
  document.addEventListener('dblclick',r3SheetOnPlayerJournal,true);
  document.addEventListener('keydown',r3SheetOnPlayerJournal,true);
}
