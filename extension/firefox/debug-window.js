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
    ['Renderer',state.selectionRenderer],['Selection source',state.selectionSource],
    ['Selected candidates',state.selectionCount],['Selection diagnosis',state.selectionReason],
    ['Token source',state.positionSource],['Page identified',state.pageResolved?'Yes':'No'],
    ['Page ID',state.pageId],['Page scale',state.pageScale],
    ['Scale units',state.pageUnit],['Grid increment',state.gridIncrement],
    ['Feet per pixel',state.mapFeetPerPixel],
    ['Token position',state.tokenCoordinate],['Used this turn (ft)',state.movementUsed]]
    .map(([key,value])=>'<div><dt>'+r3Escape(key)+'</dt><dd>'+
      r3Escape(value??'—')+'</dd></div>').join('');
}
function r3DebugMarkup(){
  if(!R3_DEBUG.open)return '';
  return '<aside class="r3-debug-window" data-bf-panel="debug" role="complementary" '+
    'aria-label="R20eb developer Debug window">'+
    '<header class="r3-debug-header"><strong>R20eb Debug</strong>'+
    '<span>Local diagnostics</span>'+
    '<button type="button" data-r3-debug="close" aria-label="Close Debug window">×</button></header>'+
    '<div class="r3-debug-body">'+
    '<details class="r3-debug-movement" open><summary>Movement tracking diagnostics</summary>'+
    '<dl id="r3-debug-movement-values">'+r3DebugMovementRows()+'</dl><small>Move your token while Your Turn is active. If the source, scale or position is unavailable, its reason appears above.</small></details>'+
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
      R3_UI.shown=!R3_UI.shown;r3UIRefresh();break;
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
    '.r3-debug-window{position:absolute;left:18px;top:76px;width:min(410px,calc(100vw - 36px));max-height:min(65vh,680px);overflow:hidden;pointer-events:auto;background:#111c2beF;border:1px solid #6181a1;border-radius:11px;box-shadow:0 12px 35px #000a;color:#f2f4f8;display:flex;flex-direction:column;font:12px/1.45 system-ui,sans-serif;z-index:12}',
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
