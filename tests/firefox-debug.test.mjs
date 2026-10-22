import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const source=readFileSync(join(resolve(import.meta.dirname,'..'),
  'extension/firefox/debug-window.js'),'utf8');
function harness(){
  const renders={n:0},controls=new Map(),listeners=new Map();
  const root={getElementById(id){return controls.get(id)||null;},
    addEventListener(type,fn){listeners.set(type,fn);}};
  const ctx={
    R3_UI:{root,shown:false},R3_MOVE:{},
    r3String(s,max=200){return String(s??'').slice(0,max);},
    r3Escape(s){return String(s??'').replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    r3MoveDiagnostics(){return {
      status:'Map scale unavailable',details:'Roll20 page scale not exposed',
      jumpgateFirstRender:'watching first render',
      jumpgateRenderObserved:'No',jumpgateRuntimeAttempts:0,
      turn:'active',selectedToken:true,positionSource:'canvas._objects',
      pageResolved:true,pageId:'safe-page-id',pageScale:'unavailable',
      pageUnit:'unavailable',gridIncrement:'unspecified',
      mapFeetPerPixel:'unavailable',tokenCoordinate:'70, 140',
      movementUsed:0};},
    r3HudRender(){renders.n++;},
    r3UIRefresh(){renders.n++;},
    navigator:{clipboard:{writeText:async()=>{}}},
    Date
  };
  vm.createContext(ctx);
  vm.runInContext(source+
    '\nglobalThis.api={R3_DEBUG,r3DebugLog,r3DebugRows,r3DebugMarkup,'+
    'r3DebugToggle,r3DebugAction,r3DebugCopyText,r3DebugInstall,r3DebugStyles};',ctx);
  return {ctx,api:ctx.api,renders,controls,listeners};
}
test('Debug window is closed by default and opens only through its control',()=>{
  const h=harness();
  assert.equal(h.api.r3DebugMarkup(),'');
  h.api.r3DebugToggle();
  assert.equal(h.renders.n,1);
  const html=h.api.r3DebugMarkup();
  assert.match(html,/data-bf-panel="debug"/);
  assert.match(html,/Movement tracking diagnostics/);
  assert.match(html,/Map scale unavailable/);
  assert.match(html,/Copy log/);
  assert.match(html,/First-render observer/);
  assert.match(html,/watching first render/);
  assert.match(html,/First render observed/);
  assert.match(html,/Webpack read attempts/);
  assert.match(h.api.r3DebugCopyText(),/jumpgateFirstRender: watching first render/);
  assert.match(html,/Importer/);
  h.api.r3DebugAction({dataset:{r3Debug:'close'}});
  assert.equal(h.api.r3DebugMarkup(),'');
  assert.equal(h.renders.n,2);
});
test('movement, native, importer and tooltip messages are collected with local timestamps',()=>{
  const h=harness();
  for(const category of ['Movement','Native','Importer','Help'])
    h.api.r3DebugLog(category,'Example message');
  h.api.r3DebugToggle();
  const html=h.api.r3DebugMarkup();
  for(const category of ['Movement','Native','Importer','Help'])
    assert.match(html,new RegExp('>'+category+'<'));
  assert.match(h.api.r3DebugCopyText(),/Movement:/);
  assert.match(h.api.r3DebugCopyText(),/Example message/);
  assert.match(html,/<time>/);
  assert.doesNotMatch(html,/http:\/\/external-server/);
});
test('entry contents are escaped, bounded and never sent anywhere',()=>{
  const h=harness();
  h.api.r3DebugLog('Movement','<script>danger</script>');
  h.api.r3DebugLog('Help','A'.repeat(10000));
  assert.equal(h.api.R3_DEBUG.entries[1].text.length,350);
  h.api.r3DebugToggle();
  const html=h.api.r3DebugMarkup();
  assert.match(html,/&lt;script&gt;danger&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  for(let i=0;i<170;i++)h.api.r3DebugLog('Native','message-'+i);
  assert.equal(h.api.R3_DEBUG.entries.length,160);
  h.api.r3DebugAction({dataset:{r3Debug:'clear'}});
  assert.equal(h.api.R3_DEBUG.entries.length,0);
});
test('messages deduplicate repeated polling and tooltip visits',()=>{
  const h=harness();
  for(let i=0;i<30;i++)h.api.r3DebugLog('Movement','Watching token position');
  assert.equal(h.api.R3_DEBUG.entries.length,1);
  h.api.r3DebugInstall(h.ctx.R3_UI.root);
  const hover=h.listeners.get('pointerover');
  const tooltip={getAttribute(){return 'Click to view attack details';}};
  hover({target:{closest(){return tooltip;}}});
  hover({target:{closest(){return tooltip;}}});
  assert.equal(h.api.R3_DEBUG.entries.length,2);
  h.api.r3DebugToggle();
  const list=h.api.r3DebugCopyText();
  assert.match(list,/Click to view attack details/);
});
test('filtering never changes game state or hides real HUD buttons',()=>{
  const h=harness();
  h.api.r3DebugLog('Movement','movement ready');
  h.api.r3DebugLog('Native','native status');
  h.api.R3_DEBUG.filter='Movement';
  const filtered=h.api.r3DebugRows();
  assert.match(filtered,/movement ready/);
  assert.doesNotMatch(filtered,/native status/);
  assert.equal(h.api.r3DebugAction({dataset:{r3Debug:'unknown'}}),false);
  h.api.r3DebugAction({dataset:{r3Debug:'importer'}});
  assert.equal(h.ctx.R3_UI.shown,true);
});
test('Debug window CSS is a compact self-contained movable panel',()=>{
  const h=harness(),style=h.api.r3DebugStyles();
  assert.match(style,/\.r3-debug-window\{position:absolute/);
  assert.match(style,/pointer-events:auto/);
  assert.match(style,/max-height:min\(83dvh/);
  assert.match(style,/r3-debug-operations/);
  assert.doesNotMatch(style,/position:fixed!important;inset:0/);
});


test('one Debug window owns former toolbar operations without changing character state',()=>{
  const h=harness(),operations=[];
  h.ctx.R3_AUTO={enabled:false};
  h.ctx.R3_HUD={collapsed:false,flyout:'actions',chooser:null};
  h.ctx.R3_SHEET_VIS={manualPriority:true};
  h.ctx.r3ToggleAuto=()=>{h.ctx.R3_AUTO.enabled=!h.ctx.R3_AUTO.enabled;operations.push('sync');};
  h.ctx.r3SheetRevealAll=()=>operations.push('show-sheet');
  h.ctx.r3SheetAllowPrivateReaders=()=>operations.push('allow-private');
  h.ctx.r3BattlefieldResetPositions=()=>operations.push('reset-layout');
  h.ctx.r3HudSave=()=>operations.push('save');
  h.api.r3DebugToggle();
  const html=h.api.r3DebugMarkup();
  for(const key of ['sync','show-sheet','allow-private','reset-layout','toggle-hud'])
    assert.match(html,new RegExp('data-r3-debug="'+key+'"'));
  for(const action of ['sync','show-sheet','allow-private','reset-layout','toggle-hud'])
    assert.equal(h.api.r3DebugAction({dataset:{r3Debug:action}}),true);
  assert.equal(h.ctx.R3_AUTO.enabled,true);
  assert.equal(h.ctx.R3_HUD.collapsed,true);
  assert.deepEqual(operations,['sync','show-sheet','allow-private','reset-layout','save']);
});
