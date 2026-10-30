// Production v3 entry point. v2 source is deliberately not bundled.
function r3Boot(){
  if(r3SheetContext()){r3StartReader();return;}
  if(r3EditorContext()){
    r3StartEditorBridge();r3StartUI();
    if(typeof r3ProgressMount==='function')r3ProgressMount();
    r3StartAuto();r3StartTokenWatch();
    if(typeof r3RosterStart==='function')r3RosterStart();
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r3Boot,{once:true});
else r3Boot();
