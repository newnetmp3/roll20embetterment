// Firefox-only developer diagnostics. Invisible until explicitly requested.
// No diagnostics overlay the battlefield and logs are never transmitted/stored.
const R3_DEBUG={open:false,entries:[],seen:new Set(),filter:'All'};
function r3DebugLog(category,message,level='info'){
  const label=r3String(category||'Activity',32);
  const detail=r3String(message||'',350);
  if(!detail)return;
  const key=label+'\0'+detail;
  if(R3_DEBUG.seen.has(key))return;
  R3_DEBUG.seen.add(key);
  if(R3_DEBUG.seen.size>450)R3_DEBUG.seen.clear();
  R3_DEBUG.entries.push({
    time:new Date().toLocaleTimeString(),category:label,
    text:detail,level:level==='warning'?'warning':level==='error'?'error':'info'
  });
  if(R3_DEBUG.entries.length>160)R3_DEBUG.entries.shift();
  r3DebugRefresh();
}
function r3DebugMovement(){
  return typeof r3MoveDiagnostics==='function'?r3MoveDiagnostics():{
    status:'Movement diagnostics unavailable',details:'Firefox module did not load'
  };
}
function r3DebugRows(){
  const filter=R3_DEBUG.filter;
  const visible=R3_DEBUG.entries.filter(x=>filter==='All'||x.category===filter);
  return (visible.length?visible.map(x=>
    '<div class="r3-debug-entry '+r3Escape(x.level)+'">'+
    '<time>'+r3Escape(x.time)+'</time>'+
    '<strong>'+r3Escape(x.category)+'</strong>'+
    '<span>'+r3Escape(x.text)+'</span></div>').join(''):
    '<div class="r3-debug-empty">No messages in this category yet.</div>');
}
function r3DebugMovementRows(){
  const state=r3DebugMovement();
  return [['Status',state.status],['Reason',state.details],
    ['Turn',state.turn],['Controlled token',state.selectedToken?'Linked':'Not linked'],
    ['Renderer',state.selectionRenderer],
    ['Roll20 editor bridge',state.editorBridge],
    ['Campaign data',state.campaignBridge],
    ['Native Jumpgate selection',state.nativeSelection],
    ['First-render observer',state.jumpgateFirstRender],
    ['First render observed',state.jumpgateRenderObserved],
    ['Webpack read attempts',state.jumpgateRuntimeAttempts],
    ['Jumpgate runtime hash',state.jumpgateBuild],
    ['Module verification',state.jumpgateModuleSignature],
    ['vttEngine fields',state.nativeEngineKeys],
    ['Native tabletop fields',state.nativeTabletopKeys],
    ['Selection source',state.selectionSource],
    ['Selected candidates',state.selectionCount],['Selection diagnosis',state.selectionReason],
    ['Jumpgate getter',state.selectionGetter],
    ['Selection result shape',state.selectionReturnShape],
    ['Selection API types',state.selectionApiTypes],
    ['Selected object fields',state.selectionCandidateKeys],
    ['Editor selection fields',state.selectionEngineKeys],
    ['Token source',state.positionSource],['Page identified',state.pageResolved?'Yes':'No'],
    ['Page ID',state.pageId],['Page scale',state.pageScale],
    ['Scale units',state.pageUnit],['Grid increment',state.gridIncrement],
    ['Feet per pixel (diagnostic)',state.mapFeetPerPixel],
    ['Native ruler sample',state.rulerSample],
    ['Measurement source',state.measurementSource],
    ['Grid diagonal rule',state.diagonalRule],
    ['Token position',state.tokenCoordinate],['Used this turn (ft)',state.movementUsed]]
    .map(([key,value])=>'<div><dt>'+r3Escape(key)+'</dt><dd>'+
      r3Escape(value??'—')+'</dd></div>').join('');
}
function r3DebugMarkup(){
  if(!R3_DEBUG.open)return '';
  return '<aside class="r3-debug-window" data-bf-panel="debug" role="complementary" '+
    'aria-label="R20eb developer Debug window">'+
    '<header class="r3-debug-header"><strong>R20eb Debug</strong>'+
    '<span>Tools & local diagnostics</span>'+
    '<button type="button" data-r3-debug="close" aria-label="Close Debug window">×</button></header>'+
    '<div class="r3-debug-body">'+
    '<details class="r3-debug-operations" open><summary>HUD & sheet controls</summary>'+
    '<p>Advanced controls live here. Normal combat actions remain in their own menus.</p>'+
    '<div class="r3-debug-ops">'+
    '<button type="button" data-r3-debug="sync">'+(typeof R3_AUTO==='object'&&R3_AUTO.enabled?'Turn sync off':'Turn sync on')+'</button>'+
    '<button type="button" data-r3-debug="show-sheet">Show original Roll20 sheet</button>'+
    '<button type="button" data-r3-debug="reset-layout">Reset HUD layout</button>'+
    '<button type="button" data-r3-debug="toggle-hud">'+(typeof R3_HUD==='object'&&R3_HUD.collapsed?'Restore HUD':'Hide HUD')+'</button>'+
    '</div><small>Private readers run automatically. Opening an original sheet always restores its visibility and pauses private access briefly. No action above modifies character statistics.</small></details>'+
    (typeof r3ThemeManagerMarkup==='function'?r3ThemeManagerMarkup():'')+
    '<details class="r3-debug-movement"><summary>Manual turn corrections</summary>'+
    (typeof r3TurnMarkup==='function'?r3TurnMarkup(R3_UI.snapshot):'<p>Turn tracker unavailable.</p>')+
    '</details>'+
    '<details class="r3-debug-movement"><summary>Movement tracking diagnostics</summary>'+
    '<dl id="r3-debug-movement-values">'+r3DebugMovementRows()+'</dl><small>Move your token while Your Turn is active. Roll20 ruler feet are used when an accessible display label is available; canvas-only measurements fall back to whole map squares and the configured diagonal rule. The measurement source is shown above. Live Jumpgate parity still needs verification.</small></details>'+
    '<div class="r3-debug-toolbar"><label for="r3-debug-filter">Messages</label>'+
    '<select id="r3-debug-filter" aria-label="Filter Debug messages">'+
      ['All','Movement','Native','Importer','Help','System'].map(k=>
        '<option value="'+k+'"'+(R3_DEBUG.filter===k?' selected':'')+'>'+k+'</option>').join('')+
    '</select>'+
    '<button type="button" data-r3-debug="copy">Copy log</button>'+
    '<button type="button" data-r3-debug="clear">Clear</button>'+
    '<button type="button" data-r3-debug="importer">Importer</button></div>'+
    '<div id="r3-debug-entries" class="r3-debug-entries" aria-label="Debug history">'+
    r3DebugRows()+'</div>'+
    '<div class="r3-debug-note" id="r3-debug-notice">Diagnostics remain in this browser tab. Copy only if you want to share them.</div>'+
    '</div></aside>';
}
function r3DebugRefresh(){
  if(!R3_DEBUG.open)return;
  const summary=R3_UI.root?.getElementById?.('r3-debug-movement-values');
  if(summary)summary.innerHTML=r3DebugMovementRows();
  const el=R3_UI.root?.getElementById?.('r3-debug-entries');
  if(!el)return;
  const stick=Math.abs(el.scrollHeight-el.scrollTop-el.clientHeight)<30;
  el.innerHTML=r3DebugRows();
  if(stick)el.scrollTop=el.scrollHeight;
}
function r3DebugToggle(){
  R3_DEBUG.open=!R3_DEBUG.open;
  if(R3_DEBUG.open){
    if(typeof R3_HUD==='object'){R3_HUD.flyout='';R3_HUD.chooser=null;}
    if(typeof R3_BF==='object'){
      R3_BF.menuPane='';R3_BF.contextOpen=false;R3_BF.revision++;
    }
  }
  r3HudRender();
}
function r3DebugCopyText(){
  const state=r3DebugMovement();
  return 'R20eb Debug (local; no automatic uploads)\n'+
    'Movement:\n'+Object.entries(state).map(([k,v])=>k+': '+String(v)).join('\n')+
    '\n\nMessages:\n'+R3_DEBUG.entries.map(x=>
      x.time+' ['+x.category+'] '+x.text).join('\n');
}
function r3DebugNotice(message){
  const el=R3_UI.root?.getElementById?.('r3-debug-notice');
  if(el)el.textContent=message;
}
function r3DebugAction(target){
  const name=target?.dataset?.r3Debug??
    target?.closest?.('[data-r3-debug]')?.dataset?.r3Debug;
  if(!name)return false;
  switch(name){
    case 'sync':
      if(typeof r3ToggleAuto==='function')r3ToggleAuto();
      r3HudRender();break;
    case 'show-sheet':
      if(typeof r3SheetRevealAll==='function')r3SheetRevealAll();
      else r3DebugNotice('Native sheet visibility controls unavailable.');
      break;
    case 'reset-layout':
      if(typeof r3BattlefieldResetPositions==='function')r3BattlefieldResetPositions();
      else r3DebugNotice('Layout controls unavailable.');
      break;
    case 'toggle-hud':
      R3_HUD.collapsed=!R3_HUD.collapsed;
      if(R3_HUD.collapsed){R3_HUD.flyout='';R3_HUD.chooser=null;}
      r3HudSave();r3HudRender();break;
    case 'close':r3DebugToggle();break;
    case 'clear':
      R3_DEBUG.entries=[];R3_DEBUG.seen.clear();r3DebugRefresh();break;
    case 'copy':
      if(typeof navigator?.clipboard?.writeText==='function')
        Promise.resolve(navigator.clipboard.writeText(r3DebugCopyText()))
          .then(()=>r3DebugNotice('Log copied to clipboard.'))
          .catch(()=>r3DebugNotice('Clipboard unavailable. Try the browser’s copy permissions.'));
      else r3DebugNotice('Clipboard access unavailable in this browser context.');
      break;
    case 'importer':
      R3_UI.shown=!R3_UI.shown;
      if(typeof R3_BF==='object'){
        R3_BF.menuPane=R3_UI.shown?'importer':'';
        R3_DEBUG.open=false;R3_BF.revision++;
      }
      r3UIRefresh();r3HudRender();break;
    default:return false;
  }
  return true;
}
function r3DebugInstall(root){
  root.addEventListener('pointerover',event=>{
    const item=event.target?.closest?.('[title]');
    if(!item)return;
    const title=item.getAttribute?.('title');
    if(title&&title.length<=350)r3DebugLog('Help',title);
  },true);
  root.addEventListener('focusin',event=>{
    const title=event.target?.getAttribute?.('title');
    if(title&&title.length<=350)r3DebugLog('Help',title);
  },true);
  root.addEventListener('toggle',event=>{
    if(typeof r3ThemeManagerInput==='function')r3ThemeManagerInput(event);
  },true);
  root.addEventListener('change',event=>{
    if(event.target?.id==='r3-debug-filter'){
      const v=event.target.value;
      if(['All','Movement','Native','Importer','Help','System'].includes(v)){
        R3_DEBUG.filter=v;r3DebugRefresh();
      }
    }
  });
}
function r3DebugStyles(){
  return [
    '.r3-debug-window{position:absolute;left:18px;top:70px;width:min(600px,calc(100vw - var(--r3-bf-chat-inset,0px) - 32px));max-height:min(83dvh,850px);overflow:hidden;pointer-events:auto;background:#111c2bef;border:1px solid #6181a1;border-radius:13px;box-shadow:0 20px 45px #000c;color:#e9f3fd;font:calc(12px * var(--r3-bf-scale,1))/1.4 system-ui,sans-serif}',
    '.r3-debug-operations{border:1px solid #3c5671;border-radius:8px;padding:10px;margin-bottom:10px;background:#15273b}',
    '.r3-debug-operations>summary{font-size:13px;font-weight:700;cursor:pointer;color:#e7c486}',
    '.r3-debug-operations p,.r3-debug-operations small{color:#b4c8d9;font-size:11px;line-height:1.35}',
    '.r3-debug-ops{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:9px 0}',
    '.r3-debug-ops button{min-height:36px;white-space:normal;text-align:left;background:#243c55!important;border:1px solid #4d6c88!important;border-radius:7px!important;color:#edf4fc!important;padding:7px 9px!important;font-weight:600}',
    '.r3-debug-ops button:hover,.r3-debug-ops button:focus-visible{border-color:#a2c7e6!important;background:#36577a!important}',
    '.r3-debug-window details+details{margin-top:8px}',
    '@media(max-width:680px){.r3-debug-ops{grid-template-columns:1fr}.r3-debug-window{max-height:75dvh}}',
    '.r3-debug-header{display:flex;gap:10px;align-items:center;padding:8px 11px;background:#243c55;border-bottom:1px solid #4d6580}',
    '.r3-debug-header strong{font-size:14px}.r3-debug-header span{flex:1;color:#b5cada}',
    '.r3-debug-header button{background:#2c4966!important;border:1px solid #7798b4!important;padding:2px 9px!important}',
    '.r3-debug-body{min-height:0;overflow:auto;padding:8px;overscroll-behavior:contain}',
    '.r3-debug-movement{background:#19283b;border:1px solid #3c5671;border-radius:6px;padding:7px}',
    '.r3-debug-movement summary{font-weight:700;cursor:pointer}',
    '.r3-debug-movement dl{display:grid;gap:3px;margin:6px 0}',
    '.r3-debug-movement dl>div{display:grid;grid-template-columns:minmax(100px,43%) 1fr;gap:8px;border-bottom:1px solid #334d64;padding:2px 0;min-width:0}',
    '.r3-debug-movement dt{color:#b7c9dc}.r3-debug-movement dd{margin:0;overflow-wrap:anywhere}',
    '.r3-debug-movement small{display:block;color:#a5bad0}',
    '.r3-debug-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:5px;margin:8px 0}',
    '.r3-debug-toolbar label{font-size:11px}.r3-debug-toolbar select{width:auto;min-width:100px;padding:4px!important}',
    '.r3-debug-toolbar button{padding:4px 6px!important;font-size:11px!important}',
    '.r3-debug-entries{max-height:22vh;min-height:60px;overflow:auto;border:1px solid #344b62;border-radius:5px;background:#0b1523}',
    '.r3-debug-entry{display:grid;grid-template-columns:70px 65px 1fr;gap:6px;padding:6px;border-bottom:1px solid #263a51;overflow-wrap:anywhere}',
    '.r3-debug-entry:nth-child(even){background:#15283b}.r3-debug-entry time{color:#91a8c4;font-size:10px}',
    '.r3-debug-entry strong{color:#b8dcff}.r3-debug-entry.warning span{color:#ffcc87}.r3-debug-entry.error span{color:#ff9a9a}',
    '.r3-debug-note,.r3-debug-empty{color:#aabed3;font-size:10px;padding:7px}',
    '@media(max-width:760px){.r3-debug-window{top:55px;max-height:52vh;width:min(350px,calc(100vw - 26px))}}'
  ].join('');
}
