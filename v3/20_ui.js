// v3 minimal companion: explicit imports, provenance, completeness, JSON export.
const R3_UI={host:null,root:null,shown:false,busy:false,status:'Open your official Roll20 2024 character sheet, then select it below.',
  snapshot:null,selected:'',view:'summary',storageWarning:'',renderedSnapshot:null,renderedView:null,
  renderedChoices:null,scrollByView:Object.create(null),openByView:Object.create(null)};
function r3Escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function r3StorageKey(){
  return 'roll20-embetterment-v3:'+(new URLSearchParams(location.search).get('id')||location.pathname.match(/\/editor\/(\d+)/)?.[1]||'editor');
}
function r3Load(){
  try{
    const s=JSON.parse(localStorage.getItem(r3StorageKey())||'null');
    if(s?.schema===3&&s.snapshot?.schema===3&&JSON.stringify(s).length<4000000)
      R3_UI.snapshot=r3InventoryPrune(s.snapshot);
  }catch{/* Corrupted storage should never prevent scanning. */}
}
function r3Save(snapshot){
  try{
    localStorage.setItem(r3StorageKey(),JSON.stringify({schema:3,snapshot}));
    R3_UI.storageWarning='';
  }catch{
    R3_UI.storageWarning='Browser storage limit reached. Snapshot remains available until reload; export JSON now.';
  }
}
function r3ReportCounts(snapshot){
  return Object.entries(snapshot?.coverage||{}).map(([key,value])=>
    '<div class="metric"><b>'+r3Escape(value)+'</b><span>'+r3Escape(key)+'</span></div>').join('');
}
function r3InfoRow(label,value,source){
  return '<div class="kv"><span>'+r3Escape(label)+'</span><strong>'+r3Escape(value)+'</strong>'+
    (source?'<small>'+r3Escape(source.kind||'')+'</small>':'')+'</div>';
}
function r3ObjectRows(obj,lookup,prefix){
  return Object.entries(obj||{}).map(([key,value])=>
    r3InfoRow(key,typeof value==='object'?JSON.stringify(value):value,lookup?.[prefix+'.'+key])).join('')||
    '<p class="muted">No identifiable fields in the rendered sheet.</p>';
}
function r3CardsView(kind){
  const snap=R3_UI.snapshot;
  // Defend against old v3.1.5 local caches and manually seeded snapshots.
  // Explicitly zeroed items do not belong in the active Inventory list.
  const items=kind==='inventory'?(snap?.inventory||[]).filter(item=>!r3InventoryZero(item)):
    (snap?.[kind]||[]);
  if(!items.length)return '<p class="muted">No '+r3Escape(kind)+' found in the scanned, rendered sheet tabs.</p>';
  return items.slice(0,400).map(item=>
    '<details class="entry" data-entry-key="'+r3Escape(kind+':'+item.tab+':'+item.name)+'"><summary>'+r3Escape(item.name)+' <small>'+r3Escape(item.tab)+'</small></summary>'+
    '<div class="entrybody">'+r3Escape(item.visible||'')+'</div>'+
    (kind==='inventory'&&Object.prototype.hasOwnProperty.call(item,'quantity')?
      '<div class="kv"><span>Observed quantity</span><strong>'+r3Escape(item.quantity)+'</strong></div>':
      kind==='inventory'&&item.controls?.length?
        '<div class="muted">Quantity not detected from this item row; zero removal needs a readable counter.</div>':'')+
    (kind==='inventory'&&item.controls?.length?item.controls.map(control=>
      '<div class="kv"><span>'+r3Escape(control.label||control.kind)+'</span><strong>'+
      r3Escape(control.value===true?'On':control.value===false?'Off':control.value)+'</strong>'+
      '<small>'+r3Escape(control.source||'observed')+'</small></div>').join(''):'')+
    (item.checkboxes?'<div class="muted">Visible checkboxes: '+r3Escape(item.checkboxes.checked)+' of '+r3Escape(item.checkboxes.total)+' checked (sheet-specific meaning)</div>':'')+
    (item.actions?.length?'<div class="chips">'+item.actions.map(b=>'<span>'+r3Escape(b.label)+'</span>').join('')+'</div>':'')+
    '</details>').join('');
}
function r3Results(){
  const snap=R3_UI.snapshot;
  if(!snap)return '<p class="muted">No import yet. Only the official sheet reader supplies data; nothing is filled from default or token values.</p>';
  const menu=['summary','spells','attacks','inventory','features','resources','misc','skills','fields','diagnostics'];
  const nav='<nav class="views">'+menu.map(v=>
    '<button data-view="'+v+'"'+(R3_UI.view===v?' class="selected"':'')+'>'+r3Escape(v)+'</button>').join('')+'</nav>';
  let content='';
  if(R3_UI.view==='summary'){
    content='<h3>Combat statistics</h3>'+r3ObjectRows(snap.stats,snap.provenance,'stats')+
      '<h3>Abilities</h3>'+r3ObjectRows(snap.abilities,snap.provenance,'abilities')+
      '<h3>Modifiers and saving throws</h3>'+r3ObjectRows(snap.modifiers,snap.provenance,'modifiers')+
      '<h3>Saving throws</h3>'+r3ObjectRows(snap.saves,snap.provenance,'saves')+
      '<h3>Spell slots</h3>'+r3ObjectRows(snap.slots);
  }else if(['spells','attacks','inventory','features','resources','misc','skills'].includes(R3_UI.view)){
    content=R3_UI.view==='skills'?r3ObjectRows(snap.skills,snap.provenance,'skills'):r3CardsView(R3_UI.view);
  }else if(R3_UI.view==='fields'){
    content='<p class="muted">Raw labeled controls actually present in the rendered DOM; no guessed values.</p>'+
      (snap.observations||[]).slice(0,750).map(o=>r3InfoRow(o.label,o.value)).join('');
  }else{
    const d=snap.diagnostics;
    content='<p><b>Captured:</b> '+r3Escape(snap.capturedAt)+'</p>'+
      '<p><b>Visited tabs:</b> '+r3Escape(d.tabs.join(', ')||'none')+'</p>'+
      '<p><b>Rejected hidden/invalid:</b> '+r3Escape(d.rejected)+'</p>'+
      '<p><b>Unclassified controls:</b> '+r3Escape(d.unclassified)+'</p>'+
      '<p><b>Collection limits:</b> '+r3Escape(d.limits.join('; ')||'None reached')+'</p>'+
      '<p><b>Notes:</b> '+r3Escape(d.notes.join('; ')||'Current rendered DOM only')+'</p>'+
      '<h3>Interactive control inventory</h3><p class="muted">Read-only evidence from rendered views; no control listed here is enabled for execution.</p>'+
      (snap.controls||[]).slice(0,1500).map(c=>r3InfoRow(
        c.tab+' · '+c.category+' · '+c.kind+' · '+(c.label||'Unlabeled control'),
        JSON.stringify({identity:c.identity,status:c.status,reason:c.reason,nativeActionRef:c.nativeActionRef}))).join('');
  }
  return '<p class="stamp">Imported from: <strong>'+r3Escape(snap.name)+'</strong> · '+r3Escape(snap.capturedAt)+'</p>'+
    '<div class="metrics">'+r3ReportCounts(snap)+'</div>'+nav+'<div class="results">'+content+'</div>';
}
function r3UIStatus(message,coverage){
  if(typeof r3DebugLog==='function'&&message!==R3_UI.status)
    r3DebugLog('Importer',message);
  R3_UI.status=message;
  const el=R3_UI.root?.getElementById('r3-status');
  if(el)el.textContent=message+(coverage?' · '+Object.entries(coverage).filter(([k])=>['spells','attacks','inventory','features','resources'].includes(k)).map(([k,v])=>k+' '+v).join(', '):'');
}
// Avoid replacing the scrollable results DOM whenever Roll20 restores window focus.
function r3RenderResults(){
  const results=R3_UI.root.getElementById('r3-results');
  if(R3_UI.renderedSnapshot===R3_UI.snapshot&&R3_UI.renderedView===R3_UI.view)return;
  const priorView=R3_UI.renderedView;
  const previous=results.querySelector?.('.results');
  if(previous&&priorView){
    R3_UI.scrollByView[priorView]=previous.scrollTop;
    R3_UI.openByView[priorView]=[...previous.querySelectorAll('details.entry[open]')]
      .map(entry=>entry.getAttribute('data-entry-key')).filter(Boolean);
  }
  const content=R3_UI.root.getElementById('r3-content');
  const outerScroll=content.scrollTop;
  results.innerHTML=r3Results();
  R3_UI.renderedSnapshot=R3_UI.snapshot;
  R3_UI.renderedView=R3_UI.view;
  const current=results.querySelector?.('.results');
  if(current){
    current.scrollTop=R3_UI.scrollByView[R3_UI.view]??0;
    const expanded=new Set(R3_UI.openByView[R3_UI.view]||[]);
    for(const entry of current.querySelectorAll('details.entry')){
      if(expanded.has(entry.getAttribute('data-entry-key')))entry.open=true;
    }
  }
  content.scrollTop=outerScroll;
}
function r3UIRefresh(){
  if(!R3_UI.root)return;
  const frames=r3Candidates();
  if(!frames.some(c=>c.key===R3_UI.selected))R3_UI.selected=frames.find(c=>c.visible)?.key||'';
  const selector=frames.map(c=>'<option value="'+r3Escape(c.key)+'"'+(c.key===R3_UI.selected?' selected':'')+'>'+
    r3Escape(c.name)+' ('+c.type+(c.visible?'':' — HIDDEN')+')</option>').join('')||
    '<option value="">No official sheet detected</option>';
  const choice=R3_UI.root.getElementById('r3-choices');
  if(R3_UI.renderedChoices!==selector){choice.innerHTML=selector;R3_UI.renderedChoices=selector;}
  if(choice.value!==R3_UI.selected)choice.value=R3_UI.selected;
  r3RenderResults();
  r3HudRender();
  R3_UI.root.getElementById('r3-wrap').style.display=R3_UI.shown?'block':'none';
  R3_UI.root.getElementById('r3-content').style.display=R3_UI.shown?'block':'none';
  // The actual toggle is r3-toggle. A stale reference to r3-title used to
  // throw here and stop every button handler before it could launch a scan.
  R3_UI.root.getElementById('r3-toggle').textContent=R3_UI.shown?'Hide importer':'Show importer';
  const scan=R3_UI.root.getElementById('r3-scan'),all=R3_UI.root.getElementById('r3-all');
  scan.disabled=R3_UI.busy||R3_AUTO.running||!R3_UI.selected;
  all.disabled=R3_UI.busy||R3_AUTO.running||!R3_UI.selected;
  R3_UI.root.getElementById('r3-export').disabled=!R3_UI.snapshot;
  r3UIStatus(R3_UI.status);
  r3AutoDisplay();
}
async function r3StartImport(mode){
  if(R3_AUTO.running){r3UIStatus('Auto-sync is reading the sheet; wait for it to finish.');return;}
  const candidate=r3Candidates().find(x=>x.key===R3_UI.selected);
  if(!candidate){r3UIStatus('Open an official Roll20 2024 sheet and refresh the list.');return;}
  R3_UI.busy=true;r3UIRefresh();r3UIStatus(mode==='all'?'Reading all available sheet tabs…':'Reading current sheet tab…');
  try{
    const snapshot=await r3SendScan(candidate,mode);
    if(!snapshot||snapshot.schema!==3)throw new Error('Unexpected sheet format');
    // Replace the previous profile only on an explicit successful import.
    // A partially rendered sheet remains explicit in its diagnostics.
    const imported=r3InventoryPrune(snapshot);
    r3Save(imported);
    r3TokenRecordSnapshot(imported);
    if(!R3_TOKEN.active||R3_TOKEN.active.name.toLowerCase()===imported.name.toLowerCase())
      R3_UI.snapshot=imported;
    // Do not show another imported PC over the current selected token.
    R3_UI.view='summary';
    R3_UI.status='Imported '+snapshot.name+
      (R3_TOKEN.active&&R3_TOKEN.active.name.toLowerCase()!==snapshot.name.toLowerCase()?
        '. Select its token to view that character.':
        '. Review each category and Diagnostics for coverage.');
  }catch(err){
    R3_UI.status='Import failed: '+r3String(err?.message||err,320);
  }finally{R3_UI.busy=false;r3UIRefresh();}
}
function r3Export(){
  if(!R3_UI.snapshot)return;
  const blob=new Blob([JSON.stringify(R3_UI.snapshot,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  const name=r3String(R3_UI.snapshot.name,60).replace(/[^a-z0-9-]+/gi,'-')||'character';
  anchor.href=url;anchor.download='r20eb-v3-'+name+'.json';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function r3UIEvent(event){
  const target=event.target;
  // Clicking a glyph/count inside a category button must behave like
  // clicking the button itself; no handlers are assigned to inner markup.
  const field=(key,selector)=>target?.dataset?.[key]??
    target?.closest?.(selector)?.dataset?.[key];
  const hudCategory=field('hudCategory','[data-hud-category]');
  const flyout=field('hudFlyout','[data-hud-flyout]');
  const slot=field('hudSlot','[data-hud-slot]');
  const weaponSet=field('hudSet','[data-hud-set]');
  const assignment=field('hudAssign','[data-hud-assign]');
  const spellLevel=field('hudSpellLevel','[data-hud-spell-level]');
  const spent=field('hudUsed','[data-hud-used]');
  const attackMode=field('hudAttackMode','[data-hud-attack-mode]');
  const attackWeapon=field('hudWeapon','[data-hud-weapon]');
  const nativeKind=field('hudNativeKind','[data-hud-native-kind]');
  const nativeKey=field('hudNativeKey','[data-hud-native-key]');
  const nativeAttack=field('hudAttackKey','[data-hud-attack-key]');
  const diceAttack=field('hudDiceKey','[data-hud-dice-key]');
  const nativeProbe=field('hudProbeKey','[data-hud-probe-key]')??
    field('hudProbe','[data-hud-probe]');
  if(typeof r3ThemeAction==='function'&&r3ThemeAction(target))return;
  if(typeof r3DebugAction==='function'&&r3DebugAction(target))return;
  if(typeof r3BattlefieldClick==='function'&&r3BattlefieldClick(target))return;
  if(typeof r3TurnClick==='function'&&r3TurnClick(target))return;
  if(target?.id==='r3-toggle'){
    R3_UI.shown=!R3_UI.shown;
    if(typeof R3_BF==='object'){
      R3_BF.menuPane=R3_UI.shown?'importer':'';
      R3_BF.revision++;
    }
    r3UIRefresh();r3HudRender();
  }
  else if(target?.id==='r3-refresh')r3UIRefresh();
  else if(target?.id==='r3-scan')return r3StartImport('current');
  else if(target?.id==='r3-all')return r3StartImport('all');
  else if(target?.id==='r3-export')r3Export();
  else if(target?.id==='r3-auto'){r3ToggleAuto();r3HudRender();}
  else if(target?.id==='r3-hud-debug'){
    if(typeof r3DebugToggle==='function')r3DebugToggle();
    else{R3_UI.shown=!R3_UI.shown;r3UIRefresh();}
  }
  else if(target?.id==='r3-hud-collapse'){
    R3_HUD.collapsed=!R3_HUD.collapsed;
    if(R3_HUD.collapsed){
      R3_HUD.flyout='';R3_HUD.chooser=null;
      if(typeof R3_BF==='object'){R3_BF.menuPane='';R3_BF.contextOpen=false;}
    }else if(typeof r3TurnLoad!=='function')R3_HUD.used={action:false,bonus:false,reaction:false};
    r3HudSave();r3HudRender();
  }
  else if(target?.id==='r3-hud-auto'){r3ToggleAuto();r3HudRender();}
  else if(target?.id==='r3-hud-native-confirm')return r3NativeConfirm();
  else if(target?.id==='r3-hud-native-cancel')return r3NativeCancel();
  else if(target?.id==='r3-hud-native-reveal')return r3NativeBgReveal();
  else if(typeof attackMode==='string'&&['melee','ranged','other'].includes(attackMode)){
    const catalog=r3HudAttackCatalog(R3_UI.snapshot);
    if(!catalog.modes[attackMode].length)return;
    R3_HUD.attackMode=attackMode;R3_HUD.attackGroup='';
    r3HudRender();
  }
  else if(typeof attackWeapon==='string'&&attackWeapon.length>0&&attackWeapon.length<=180){
    return r3HudWeaponToggle(attackWeapon);
  }
  else if(typeof nativeKind==='string'&&R3_NATIVE_CATEGORIES[nativeKind]&&
    typeof nativeKey==='string'&&nativeKey.length>0&&nativeKey.length<=240){
    return r3NativeInvoke(nativeKind,nativeKey);
  }
  else if(typeof nativeAttack==='string'&&nativeAttack.length>0&&nativeAttack.length<=240){
    // Official source-verified Roll20 ability; no sheet window or guess.
    return r3NativeMappedAttack(nativeAttack);
  }
  else if(typeof diceAttack==='string'&&diceAttack.length>0&&diceAttack.length<=240){
    // Explicitly labeled non-native dice fallback only; no silent downgrade.
    return r3NativeChatAttack(diceAttack);
  }
  else if(typeof nativeProbe==='string'&&nativeProbe.length<=240){
    return r3NativeProbe(nativeProbe);
  }
  else if(target?.id==='r3-hud-reset-turn'){
    if(typeof r3TurnStart==='function')r3TurnStart('manual');
    else{R3_HUD.used={action:false,bonus:false,reaction:false};r3HudRender();}
  }
  else if(target?.id==='r3-hud-drawer-close'||target?.id==='r3-hud-flyout-close'){
    R3_HUD.drawerOpen=false;R3_HUD.flyout='';R3_HUD.chooser=null;
    R3_HUD.attackGroup='';
    r3HudSave();r3HudRender();
  }
  else if(slot!==undefined&&/^[0-5]$/.test(String(slot))){
    R3_HUD.chooser=Number(slot);R3_HUD.flyout='';r3HudRender();
  }
  else if(assignment!==undefined&&R3_HUD.chooser!==null){
    const chosen=assignment==='clear'?null:r3HudWeaponCandidates(R3_UI.snapshot)[Number(assignment)];
    if(assignment==='clear'||chosen){
      R3_HUD.weaponSets[R3_HUD.chooser]=chosen?{kind:chosen.kind,key:chosen.key}:null;
      R3_HUD.chooser=null;r3HudSave();r3HudRender();
    }
  }
  else if(weaponSet!==undefined&&/^[0-2]$/.test(String(weaponSet))){
    R3_HUD.weaponSet=Number(weaponSet);r3HudSave();r3HudRender();
  }
  else if(spellLevel!==undefined&&/^(?:[0-9]|other)$/.test(String(spellLevel))){
    R3_HUD.spellLevel=String(spellLevel);r3HudRender();
  }
  else if(spent&&['action','bonus','reaction'].includes(spent)){
    if(typeof r3TurnLegacyToggle==='function')r3TurnLegacyToggle(spent);
    else{R3_HUD.used[spent]=!R3_HUD.used[spent];r3HudRender();}
  }
  else if(flyout&&['spells','skills','actions','bonus','reactions','inventory',
    'features','resources','misc'].includes(flyout)){
    R3_HUD.chooser=null;
    if(typeof R3_BF==='object'){
      R3_BF.menuPane='';R3_BF.contextOpen=false;R3_BF.revision++;
    }
    if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
    R3_HUD.flyout=R3_HUD.flyout===flyout?'':flyout;
    R3_HUD.attackGroup='';R3_HUD.openKeys=[];R3_HUD.scrollTop=0;r3HudRender();
  }
  else if(hudCategory&&R3_HUD_TABS.some(tab=>tab.key===hudCategory)){
    R3_HUD.category=hudCategory;R3_HUD.flyout=hudCategory;
    if(typeof R3_BF==='object'){
      R3_BF.menuPane='';R3_BF.contextOpen=false;R3_BF.revision++;
    }
    if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
    R3_HUD.chooser=null;R3_HUD.openKeys=[];R3_HUD.scrollTop=0;
    r3HudSave();r3HudRender();
  }
  else if(target?.dataset?.view){R3_UI.view=target.dataset.view;r3UIRefresh();}
}
function r3StartUI(){
  if(document.getElementById('r20eb-v3-root'))return;
  r3Load();r3TokenLoad();r3HudLoad();
  if(typeof r3ThemeLoad==='function')r3ThemeLoad();
  const host=document.createElement('div');host.id='r20eb-v3-root';
  host.style.cssText='position:fixed;inset:0;z-index:2147483000;pointer-events:none';
  const root=host.attachShadow({mode:'open'});R3_UI.host=host;R3_UI.root=root;
  const style=[
    ':host{all:initial;color-scheme:dark;font:13px/1.5 system-ui,sans-serif}',
    '*{box-sizing:border-box}button,select{font:inherit}',
    '#r3-wrap{position:absolute;top:14px;right:14px;width:min(520px,calc(100vw - 28px));max-height:calc(100vh - 28px);pointer-events:auto;border:1px solid #77829c;border-radius:12px;background:#161b28;color:#eef0f7;box-shadow:0 10px 40px #000b;overflow:hidden}',
    '#r3-toggle{width:100%;background:#303d58;color:#fff;border:0;padding:11px 14px;text-align:left;font-weight:700;cursor:pointer}',
    '#r3-content{padding:12px;max-height:calc(100vh - 90px);overflow:auto}',
    'button{background:#34465f;color:#f7f8fd;border:1px solid #66748e;border-radius:6px;padding:7px 10px;cursor:pointer}',
    'button:disabled{opacity:.4;cursor:not-allowed}button:hover:not(:disabled){background:#49698c}',
    'select{background:#222e43;color:#fff;border:1px solid #65748d;border-radius:5px;min-width:0;width:100%;padding:7px}',
    '.actions{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.actions>*{flex:1}',
    '.muted,.stamp{color:#b6c3d9}.muted{font-size:12px}.stamp{font-size:11px}',
    '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:12px 0}',
    '.metric{border:1px solid #4a5871;border-radius:6px;padding:5px;text-align:center;min-width:0}.metric b{display:block;font-size:16px}.metric span{font-size:10px;overflow-wrap:anywhere}',
    '.views{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0}.views button{font-size:11px;text-transform:capitalize;padding:5px 8px}.views button.selected{background:#9c7642;color:white}',
    '.results{max-height:39vh;overflow:auto;padding:4px 0}.results h3{margin:12px 0 5px;color:#e6c28e}',
    '.kv{display:flex;gap:8px;align-items:center;border-bottom:1px solid #384357;padding:6px 2px;overflow-wrap:anywhere}.kv span{flex:1}.kv strong{color:#e6c28e}.kv small{font-size:10px;color:#93a3c0}',
    '.entry{border-bottom:1px solid #384357;padding:6px 0}.entry summary{cursor:pointer}.entry small{color:#9daecb;margin-left:6px}',
    '.entrybody{padding:9px;white-space:pre-wrap;overflow-wrap:anywhere;color:#bac7da}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips span{border:1px solid #4e617c;border-radius:8px;padding:2px 6px}',
    '#r3-status{font-size:12px;color:#f1d39d;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}',
    '.notice{font-size:11px;color:#b8c5d8;line-height:1.4}label{font-weight:650}'
  ].join('')+r3HudStyles();
  root.innerHTML='<style>'+style+'</style><style id="r3-theme-style"></style><div id="r3-hud"></div><div id="r3-wrap"><button id="r3-toggle">Hide importer</button>'+
    '<div id="r3-content"><label for="r3-choices">Official character sheet</label>'+
    '<select id="r3-choices"></select><div class="actions"><button id="r3-refresh">Refresh list</button>'+
    '<button id="r3-scan">Read current tab</button><button id="r3-all">Import all tabs</button>'+
    '<button id="r3-export" disabled>Export JSON</button></div>'+
    '<div class="actions"><button id="r3-auto" title="Automatically import the selected character. When available, Roll20 journal entry is opened offscreen.">Auto-sync: Off</button></div>'+
    '<div id="r3-auto-status" class="notice" role="status" aria-live="polite">Auto-sync is off</div>'+
    '<div class="notice">New independent v3 importer · no old HUD/profile code · read-only for character data. '+
    'Auto-sync is optional and remembered per game. It uses the official Roll20 journal to open the chosen character in the background when available; if not, open the Journal sidebar once or use a visible sheet. Full background import visits tabs and restores the original selection. Visible player-opened sheets are read without switching tabs.</div>'+
    '<div id="r3-status" role="status" aria-live="polite"></div>'+
    '<div id="r3-results"></div></div></div>';
  if(typeof r3ThemeApply==='function')r3ThemeApply();
  // Surface handler errors in the panel instead of leaving apparently inert buttons.
  root.addEventListener('click',event=>{
    try{
      const action=r3UIEvent(event);
      if(action&&typeof action.catch==='function')action.catch(err=>r3UIStatus('Action failed: '+r3String(err?.message||err,250)));
    }catch(err){
      r3UIStatus('Action failed: '+r3String(err?.message||err,250));
      console.error('[roll20 Embetterment] Importer control',err);
    }
  });
  // Windows-style context menu for each weapon; the normal left-click
  // Options control provides the same keyboard/touch-accessible path.
  root.addEventListener('contextmenu',event=>{
    if(typeof r3BattlefieldContextEvent==='function'&&
       r3BattlefieldContextEvent(event))return;
    const row=event.target?.closest?.('[data-hud-weapon-row]');
    const key=row?.dataset?.hudWeaponRow;
    if(!key||!r3HudWeaponToggle(key))return;
    event.preventDefault?.();event.stopPropagation?.();
  });
  // A click outside R20eb closes only R20eb menus; native Roll20 controls
  // receive their own pointer event without interception.
  document.addEventListener?.('pointerdown',event=>{
    if(typeof R3_BF!=='object')return;
    if(!(R3_BF.contextOpen||R3_BF.menuPane||R3_HUD.flyout||
      R3_HUD.chooser!==null||R3_DEBUG.open))return;
    const path=event.composedPath?.()||[];
    if(!path.includes(R3_UI.host))
      r3BattlefieldClick({dataset:{bfAction:'cascade-close'}});
  },true);
  // Section navigation is click-only. Pointer hover may apply CSS focus
  // styling, but must never activate a category or replace the current
  // branch while the player moves between menu entries.
  root.addEventListener('pointerdown',event=>{
    if(typeof R3_BF!=='object')return;
    if(!(R3_BF.contextOpen||R3_BF.menuPane||R3_HUD.flyout||
      R3_HUD.chooser!==null||R3_DEBUG.open))return;
    if(event.target?.closest?.('.r3-bf-cascade,[data-bf-panel="taskbar"],.r3-bf-turnstrip,.r3-bf-show-profile-wrap,#r3-wrap'))return;
    r3BattlefieldClick({dataset:{bfAction:'cascade-close'}});
  },true);
  root.getElementById('r3-choices').addEventListener('change',event=>{R3_UI.selected=event.target.value;r3UIRefresh();});
  if(typeof r3BattlefieldEnableDragging==='function')r3BattlefieldEnableDragging(root);
  if(typeof r3SheetVisibilityInstall==='function')r3SheetVisibilityInstall();
  if(typeof r3DebugInstall==='function')r3DebugInstall(root);
  root.addEventListener('input',event=>{
    if(typeof r3BattlefieldInput==='function')r3BattlefieldInput(event.target);
  });
  root.addEventListener('keydown',event=>{
    // Escape closes the entire R20eb menu stack, not the native Roll20 sheet.
    // ArrowRight activates a focused cascade entry; ArrowLeft returns to the
    // parent menu. Standard Tab and Enter/Space remain native button behavior.
    if(event.key==='Escape'&&typeof r3BattlefieldClick==='function'&&
      (R3_HUD.flyout||R3_HUD.chooser!==null||R3_BF?.menuPane||
       R3_BF?.contextOpen||R3_DEBUG?.open)){
      r3BattlefieldClick({dataset:{bfAction:'cascade-close'}});
      event.preventDefault?.();
    }else if(['ArrowDown','ArrowUp'].includes(event.key)&&
      event.target?.closest?.('.r3-cascade-rail')){
      const buttons=[...(R3_UI.root?.querySelectorAll?.('.r3-cascade-rail button')||[])];
      const index=buttons.indexOf(event.target);
      if(index>=0&&buttons.length){
        buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]
          .focus?.({preventScroll:true});
        event.preventDefault?.();
      }
    }else if(event.key==='ArrowRight'&&
      event.target?.closest?.('.r3-cascade-rail')&&
      event.target?.matches?.('button[aria-haspopup="true"]')){
      event.target.click?.();
      event.preventDefault?.();
    }else if(event.key==='ArrowLeft'&&
      event.target?.closest?.('.r3-cascade-branch')&&
      !event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){
      // Explorer-style Left returns to the active parent in the first menu
      // column. It must never close Roll20's sheet or steal caret movement
      // from notes, search inputs, selects or other editable controls.
      const cascade=event.target.closest('.r3-bf-cascade');
      const parent=cascade?.querySelector?.('.r3-cascade-rail button[aria-expanded="true"]');
      if(parent){parent.focus?.({preventScroll:true});event.preventDefault?.();}
    }
    event.stopPropagation();
  },true);
  root.addEventListener('keyup',event=>event.stopPropagation(),true);
  root.addEventListener('keypress',event=>event.stopPropagation(),true);
  document.body.appendChild(host);
  r3UIRefresh();
  // Wiki-compatible Shift+A toggle, scoped away from text entry and common
  // modified shortcuts. Keeping this in the editor avoids touching Roll20's
  // official sheet keyboard behavior.
  window.addEventListener('keydown',event=>{
    if(event.key?.toLowerCase()!=='a'||!event.shiftKey||event.ctrlKey||
      event.altKey||event.metaKey||event.repeat)return;
    const target=event.target;
    if(target?.isContentEditable||/^(?:input|textarea|select)$/i.test(target?.tagName||''))return;
    event.preventDefault?.();event.stopPropagation?.();
    R3_HUD.collapsed=!R3_HUD.collapsed;
    if(R3_HUD.collapsed){R3_HUD.flyout='';R3_HUD.chooser=null;}
    else if(typeof r3TurnLoad!=='function')R3_HUD.used={action:false,bonus:false,reaction:false};
    r3HudSave();r3HudRender();
  },true);
  window.addEventListener('focus',()=>{if(!R3_UI.busy)r3UIRefresh();});
}

