import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const economy=readFileSync(join(root,'extension/firefox/turn-economy.js'),'utf8');
const tracker=readFileSync(join(root,'extension/firefox/movement-tracker.js'),'utf8');
function rig(options={}){
  const store=new Map(),renders={count:0},chars=new Map(),listeners=new Map();
  const pageAttrs={scale_number:options.scale??5,
    snapping_increment:options.grid??1,scale_units:options.units??'ft'};
  const page={id:'page-one',get(k){return pageAttrs[k];}};
  const campaign={activePage(){return page;},get(k){return k==='turnorder'?'[]':null;}};
  function make(id,characterId='char-elf',left=140,top=210){
    const attrs={left,top,represents:characterId,lastmove:''};
    const model={id,get(k){return attrs[k];},on(name,cb){listeners.set(id,cb);},
      off(name,cb){if(listeners.get(id)===cb)listeners.delete(id);}};
    const object={model};
    chars.set(id,{attrs,model,object});
    return {model,object,attrs,move(x,y,lastmove=null){
      attrs.left=x;attrs.top=y;
      if(lastmove!==null)attrs.lastmove=lastmove;
      listeners.get(id)?.();
    }};
  }
  const elf=make('token-elf');
  const ctx={
    window:{d20:{Campaign:campaign,engine:{canvas:{getObjects(){
      return [...chars.values()].map(x=>x.object);}}}}},
    R3_TOKEN:{active:{tokenId:'token-elf',characterId:'char-elf',name:'Elf'}},
    R3_HUD:{used:{}},
    R3_UI:{snapshot:{stats:{speed:30}}},
    r3TokenSettingsKey(){return 'game-123:'+ctx.R3_TOKEN.active.characterId;},
    r3TokenSelected(){return [];},
    r3TokenModelGet(model,key){return model?.get?.(key)??model?.attributes?.[key];},
    r3String(v,max){return String(v??'').slice(0,max);},
    r3Escape(v){return String(v);},
    r3HudRender(){renders.count++;},
    localStorage:{getItem(k){return store.get(k)||null;},
      setItem(k,v){store.set(k,v);}}
  };
  vm.createContext(ctx);
  vm.runInContext(economy+'\n'+tracker+'\nglobalThis.api={R3_MOVE,R3_TURN,r3MovePoll,r3MoveRebase,r3MoveScale,r3MoveWaypointLength,r3MoveFind,r3MoveDiagnostics,r3TurnLoad,r3TurnStart,r3TurnApply,r3TurnMarkup,r3TurnDistance};',ctx);
  const api=ctx.api;api.r3TurnLoad();
  return {api,ctx,elf,make,store,renders,pageAttrs,page,listeners};
}
test('movement sums successive distances, including backtracking, with actual page scale',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(210,210);h.elf.move(210,280);h.elf.move(140,280);
  assert.equal(t.movementUsed,15,'three 70px segments, not last displacement');
  assert.match(h.api.r3TurnMarkup(h.ctx.R3_UI.snapshot),/15 ft/);
  assert.ok(h.renders.count>=3);
});
test('remaining movement goes negative when a controlled token exceeds speed',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(700,210); // 40 ft at 5 ft per square
  assert.equal(t.movementUsed,40);
  let ui=h.api.r3TurnMarkup(h.ctx.R3_UI.snapshot);
  assert.match(ui,/-10 ft/);
  h.api.r3TurnApply('dash-action');
  ui=h.api.r3TurnMarkup(h.ctx.R3_UI.snapshot);
  assert.match(ui,/20 ft/,'Dash raises the allowance without discarding distance');
});
test('grid increment 2 and scale 10 calculate actual page distance',()=>{
  const h=rig({scale:10,grid:2});
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(280,210);
  assert.equal(h.api.R3_TURN.movementUsed,10);
});
test('unknown page units/scale pause automatic measurement but preserve manual correction',()=>{
  const h=rig({units:'meters'});
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.api.r3TurnApply('move-plus');
  assert.equal(h.api.R3_TURN.movementUsed,5);
  h.pageAttrs.scale_units='ft';
  h.elf.move(280,210); // rebaseline after page scale becomes readable
  assert.equal(h.api.R3_TURN.movementUsed,5);
  h.elf.move(350,210);
  assert.equal(h.api.R3_TURN.movementUsed,10);
});
test('token movement outside an active turn is ignored and new turn rebases',()=>{
  const h=rig();
  h.api.r3MovePoll();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.api.r3TurnStart();h.elf.move(280,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  h.api.r3TurnApply('end');
  h.elf.move(350,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  h.api.r3TurnStart();
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.elf.move(420,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
});
test('different selected controlled token never creates fictitious travel across map',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  const other=h.make('token-two','char-elf',1750,210);
  h.ctx.R3_TOKEN.active={tokenId:'token-two',characterId:'char-elf'};
  h.api.r3MovePoll(); // first point sets a baseline
  assert.equal(h.api.R3_TURN.movementUsed,0);
  other.move(1820,210);assert.equal(h.api.R3_TURN.movementUsed,5);
  h.elf.move(280,210); // stale listener detached, no additional distance
  assert.equal(h.api.R3_TURN.movementUsed,5);
});
test('other character cannot inflate the selected character movement',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  const other=h.make('enemy','enemy-char',500,500);
  other.move(2000,500);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
});
test('Roll20 lastmove waypoints, when anchored to prior token center, contribute path length',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(280,280,'140,210,210,210,210,280'); // 70px right, 70px down, 70px right
  assert.equal(h.api.R3_TURN.movementUsed,15);
});
test('no map token and scrolling/zooming alone never changes total distance',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  h.ctx.window.d20.engine.canvas.getObjects=()=>[];
  h.api.r3MovePoll(); // source is gone
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.ctx.window.d20.engine.canvas.getObjects=()=>[h.elf.object];
  h.api.r3MovePoll(); // first sample only
  assert.equal(h.api.R3_TURN.movementUsed,0);
});
test('sub-square token movements preserve fractional feet and load safely',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(147,210);
  assert.equal(h.api.R3_TURN.movementUsed,0.5);
  h.api.r3TurnLoad();
  assert.equal(h.api.R3_TURN.movementUsed,0.5);
});

test('fallback canvas._objects discovers token when getObjects is unavailable',()=>{
  const h=rig();
  h.ctx.window.d20.engine.canvas={_objects:[h.elf.object]};
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.R3_MOVE.source,'canvas._objects');
});
test('selected token is resolved when no canvas exposes a graphics collection',()=>{
  const h=rig();
  h.ctx.window.d20.engine.canvas={};
  h.ctx.r3TokenSelected=()=>[h.elf.object];
  h.api.r3TurnStart();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.R3_MOVE.source,'selected');
});
test('page lookup resolves playerpageid and missing optional snapping_increment',()=>{
  const h=rig();
  h.ctx.window.d20.Campaign.activePage=()=>null;
  h.ctx.window.d20.Campaign.pages={get(id){return id==='page-one'?h.page:null;}};
  h.ctx.window.d20.Campaign.get=key=>key==='playerpageid'?'page-one':'[]';
  delete h.pageAttrs.snapping_increment;
  h.api.r3TurnStart();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.r3MoveScale(h.page).feetPerPixel,5/70);
});
test('live Fabric object coordinates can update before stale model coordinates',()=>{
  const h=rig();
  h.elf.object.left=140;h.elf.object.top=210;
  h.api.r3TurnStart();
  h.elf.object.left=210;
  h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,5);
});
test('movement diagnostics report missing graphics and scale, rather than silently staying zero',()=>{
  const h=rig(),a=h.api;
  a.r3TurnStart();
  h.ctx.window.d20.engine.canvas={};
  a.r3MovePoll();
  assert.match(a.R3_MOVE.status,/Token position unavailable/);
  assert.match(a.r3MoveDiagnostics().details,/graphics collections/);
  h.ctx.window.d20.engine.canvas={getObjects(){return [h.elf.object];}};
  a.r3MovePoll();
  h.pageAttrs.scale_units='km';
  a.r3MovePoll();
  assert.match(a.R3_MOVE.status,/Map scale unavailable/);
  const snapshot=a.r3MoveDiagnostics();
  assert.equal(snapshot.pageUnit,'km');
  assert.equal(snapshot.turn,'active');
});
test('unrelated character data is never a movement fallback',()=>{
  const h=rig();
  h.ctx.window.d20.engine.canvas={_objects:[h.make('enemy','other',100,200).object]};
  h.api.r3TurnStart();
  assert.equal(h.api.R3_TURN.movementUsed,0);
  assert.match(h.api.R3_MOVE.status,/Token position unavailable/);
});

test('token watcher discovers a Fabric getActiveObjects selection when engine.selected is absent',()=>{
  const h=rig();
  const watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  // Evaluate the real reader implementation, not a test-only approximation.
  vm.runInContext(watch,h.ctx);h.ctx.readSelected=vm.runInContext('r3TokenSelected',h.ctx);
  h.ctx.window.d20.engine.canvas.getActiveObjects=()=>[h.elf.object];
  assert.equal(h.ctx.readSelected().length,1);
  assert.equal(h.ctx.readSelected()[0],h.elf.object);
});
test('token watcher supports single Fabric active object and collection-like selection',()=>{
  const h=rig();
  const watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  vm.runInContext(watch,h.ctx);h.ctx.readSelected=vm.runInContext('r3TokenSelected',h.ctx);
  const engine=h.ctx.window.d20.engine;
  engine.canvas.getActiveObjects=undefined;
  engine.canvas.getActiveObject=()=>h.elf.object;
  assert.equal(h.ctx.readSelected()[0],h.elf.object);
  engine.selected=()=>({models:[h.elf.object]});
  assert.equal(h.ctx.readSelected()[0],h.elf.object);
});
test('token watcher never mistakes an unselected map graphic for an active selection',()=>{
  const h=rig();
  const watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  vm.runInContext(watch,h.ctx);h.ctx.readSelected=vm.runInContext('r3TokenSelected',h.ctx);
  assert.equal(h.ctx.readSelected().length,0);
});

test('Babylon renderer probe finds Set selection and reports missing link reason',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.document={querySelector(sel){return sel.includes('babylonCanvas')?{}:null;}};
  vm.runInContext(watch,h.ctx);
  const selection=vm.runInContext('r3TokenSelectionProbe',h.ctx);
  const diagnose=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  h.ctx.window.d20.engine.selectedTokens=new Set([h.elf.object]);
  const result=selection(),details=diagnose(result);
  assert.equal(result.renderer,'Babylon.js');
  assert.equal(result.items.length,1);
  assert.match(details.selectionSource,/engine.selectedTokens/);
  assert.match(details.reason,/not loaded in Roll20/);
});
test('selected token is retried when linked character loads after initial selection',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20.engine.selectedTokens=new Set([h.elf.object]);
  h.ctx.window.currentPlayer={id:'player-elf'};
  let ready=false;
  h.ctx.window.d20.Campaign.characters={get(id){return ready&&id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  h.ctx.seenSwitches=[];
  vm.runInContext('r3TokenSwitch=function(info){globalThis.seenSwitches.push(info);R3_TOKEN.active=info;};',h.ctx);
  const poll=vm.runInContext('r3TokenPoll',h.ctx);
  poll();
  assert.equal(h.ctx.seenSwitches.length,0);
  ready=true;poll();
  assert.equal(h.ctx.seenSwitches.length,1);
  assert.equal(h.ctx.seenSwitches[0].characterId,'char-elf');
});
test('candidate token with wrong Controlled By permission is never accepted',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(){return {
    id:'char-elf',get(key){return {name:'Elf',controlledby:'somebody-else'}[key];}
  };}};
  vm.runInContext(watch,h.ctx);
  const check=vm.runInContext('r3TokenInspectLinked',h.ctx);
  const result=check(h.elf.object);
  assert.equal(result.info,undefined);
  assert.match(result.reason,/Controlled By/);
});
test('Babylon selected mesh resolves only explicit graphic metadata ID',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  h.page.thegraphics={get(id){return id==='token-elf'?h.elf.model:null;}};
  h.ctx.window.d20.engine.selectedTokens=[{metadata:{tokenId:'token-elf'}}];
  vm.runInContext(watch,h.ctx);
  const diagnose=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  assert.equal(diagnose().eligible,true);
  h.ctx.window.d20.engine.selectedTokens=[{metadata:{tokenId:'enemy'}}];
  assert.equal(diagnose().eligible,false);
});

test('Jumpgate tabletopSelected Set is preferred as explicit selection and linked via controlled character',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20.engine.tabletopSelected=new Set([h.elf.object]);
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx)();
  assert.equal(probe.items.length,1);
  assert.match(probe.sources,/engine.tabletopSelected/);
  assert.match(probe.selectionTypes,/engine.tabletopSelected:object/);
  const info=vm.runInContext('r3TokenLinkedInfo',h.ctx)(probe.items[0]);
  assert.equal(info.characterId,'char-elf');
});
test('Jumpgate selected graphic ID resolves only a matching page graphics model',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.page.thegraphics=new Map([['token-elf',h.elf.model]]);
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  h.ctx.window.d20.engine.tabletopSelected={selected:['token-elf']};
  vm.runInContext(watch,h.ctx);
  const read=vm.runInContext('r3TokenSelected',h.ctx);
  const inspect=vm.runInContext('r3TokenLinkedInfo',h.ctx);
  assert.equal(read()[0],'token-elf');
  assert.equal(inspect(read()[0]).characterId,'char-elf');
  h.ctx.window.d20.engine.tabletopSelected={selected:['fake']};
  assert.equal(inspect(read()[0]),null,'Unrelated graphic IDs must not resolve');
});
test('function-valued or boolean tabletopSelected is observed but not invoked or selected',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  let calls=0;
  h.ctx.window.d20.engine.tabletopSelected=()=>{calls++;return [h.elf.object];};
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx);
  assert.equal(probe().items.length,0);
  assert.match(probe().selectionTypes,/engine.tabletopSelected:function/);
  assert.equal(calls,0);
  h.ctx.window.d20.engine.tabletopSelected=true;
  assert.equal(probe().items.length,0);
  assert.match(probe().selectionTypes,/engine.tabletopSelected:boolean/);
});
test('Jumpgate model-only movement uses exact linked graphic rather than a canvas',()=>{
  const h=rig();
  h.ctx.window.d20.engine.canvas={};
  h.page.thegraphics=new Map([['token-elf',h.elf.model]]);
  h.ctx.r3TokenFindGraphic=id=>h.page.thegraphics.get(id)||null;
  h.api.r3TurnStart();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.R3_MOVE.source,'selected.graphicId');
});
test('missing graphic position never silently becomes (0,0)',()=>{
  const h=rig();
  h.ctx.window.d20.engine.canvas={getObjects(){return [h.elf.object];}};
  h.elf.attrs.left=null;h.elf.attrs.top=null;
  h.api.r3TurnStart();
  assert.match(h.api.R3_MOVE.status,/Token coordinates unavailable/);
});

test('verified Jumpgate tabletopSelected getter returns a controlled selected token',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const engine=h.ctx.window.d20.engine;
  h.ctx._BabylonConversion_VTTEngine__WEBPACK_IMPORTED_MODULE_17__={
    VTTEngine:{instance:{tabletop:{getSelection(){return [h.elf.object];}}}}
  };
  engine.tabletopSelected=vm.runInContext(
    '()=>_BabylonConversion_VTTEngine__WEBPACK_IMPORTED_MODULE_17__.VTTEngine.instance.tabletop.getSelection()',h.ctx);
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(k){return {name:'Elf',controlledby:'player-elf'}[k];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx)();
  assert.match(probe.sources,/engine.tabletopSelected \(1\)/);
  assert.equal(probe.selectionGetter,'confirmed getter read');
  assert.equal(probe.selectionReturnShape,'array 1');
  assert.equal(probe.items[0],h.elf.object);
  assert.equal(vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)().eligible,true);
});
test('verified Jumpgate getter resolves a selected ID against exact page graphics',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const engine=h.ctx.window.d20.engine;
  h.page.thegraphics=new Map([['token-elf',h.elf.model]]);
  h.ctx.VTTEngine={instance:{tabletop:{getSelection(){return new Set(['token-elf']);}}}};
  engine.tabletopSelected=vm.runInContext(
    '()=>VTTEngine.instance.tabletop.getSelection()',h.ctx);
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(k){return {name:'Elf',controlledby:'player-elf'}[k];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx)();
  assert.equal(probe.items[0],'token-elf');
  assert.match(probe.selectionReturnShape,/Set 1/);
  assert.equal(vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)().eligible,true);
  h.ctx.VTTEngine.instance.tabletop.getSelection=()=>new Set(['enemy-id']);
  assert.equal(vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)().eligible,false);
});
test('unverified zero-argument Jumpgate method is not invoked',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  let sideEffects=0;
  h.ctx.window.d20.engine.tabletopSelected=()=>{sideEffects++;return [h.elf.object];};
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx)();
  assert.equal(sideEffects,0);
  assert.equal(probe.items.length,0);
  assert.equal(probe.selectionGetter,'unverified function not invoked');
});
test('Jumpgate confirmed getter failure is captured without affecting game',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.VTTEngine={instance:{tabletop:{getSelection(){throw Error('not loaded');}}}};
  h.ctx.window.d20.engine.tabletopSelected=vm.runInContext(
    '()=>VTTEngine.instance.tabletop.getSelection()',h.ctx);
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionProbe',h.ctx)();
  assert.equal(probe.selectionGetter,'confirmed getter read failed');
  assert.equal(probe.items.length,0);
  assert.equal(h.api.R3_TURN.movementUsed,0);
});

test('Jumpgate without optional Roll20 editor bridge reports missing native d20 safely',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;
  h.ctx.document={querySelector(selector){
    return selector.includes('babylonCanvas')?{}:null;
  }};
  vm.runInContext(watch,h.ctx);
  const selection=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(selection.renderer,'Babylon.js');
  assert.equal(selection.editorBridge,'window.d20 unavailable');
  assert.equal(selection.campaignBridge,'unavailable');
  assert.match(selection.reason,/window.d20 unavailable/);
  assert.equal(selection.eligible,false);
  assert.equal(selection.selectionCount,0);
});
test('Jumpgate with d20 but no engine distinguishes missing editor bridge',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20={Campaign:null};
  h.ctx.document={querySelector(selector){
    return selector.includes('babylonCanvas')?{}:null;
  }};
  vm.runInContext(watch,h.ctx);
  const selection=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(selection.editorBridge,'window.d20.engine unavailable');
  assert.match(selection.reason,/native selection: Jumpgate webpack runtime not ready/);
});


test('native Jumpgate Campaign page resolves without d20 and engine mode is a string flag',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.Campaign=h.ctx.window.d20.Campaign;
  h.ctx.window.d20=undefined;
  h.ctx.window.vttEngine='jumpgate';
  h.ctx.window.d20_player_id='player-elf';
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.modeFlag,'string mode flag');
  assert.equal(diag.campaignBridge,'available');
  assert.equal(diag.eligible,false);
  assert.equal(diag.selectionCount,0);
  assert.match(diag.reason,/native selection: Jumpgate webpack runtime not ready/);
  assert.equal(h.api.r3MoveDiagnostics().pageScale,5);
  assert.equal(vm.runInContext('r3TokenPlayerId',h.ctx)(),'player-elf');
});
test('boxed String vttEngine is not mistaken for an exposed tabletop API',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.Campaign=h.ctx.window.d20.Campaign;
  h.ctx.window.d20=undefined;
  h.ctx.window.vttEngine=new String('jumpgate');
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.modeFlag,'boxed string mode flag');
  assert.equal(diag.nativeTabletopKeys,'not exposed');
  assert.equal(diag.eligible,false);
});
test('native Campaign character lookups and permission checks work without d20',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.d20.Campaign;
  campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  h.ctx.window.Campaign=campaign;
  h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  h.ctx.window.vttEngine='jumpgate';
  vm.runInContext(watch,h.ctx);
  const inspect=vm.runInContext('r3TokenInspectLinked',h.ctx);
  assert.equal(inspect(h.elf.object).info.characterId,'char-elf');
  campaign.characters.get=id=>id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'another-player'}[key];}
  }:null;
  assert.match(inspect(h.elf.object).reason,/Controlled By/);
});
test('engine-mode string does not interfere with real verified legacy selection getter',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.vttEngine='legacy';
  h.ctx.VTTEngine={instance:{tabletop:{getSelection(){return [h.elf.object];}}}};
  h.ctx.window.d20.engine.tabletopSelected=vm.runInContext(
    '()=>VTTEngine.instance.tabletop.getSelection()',h.ctx);
  h.ctx.window.currentPlayer={id:'player-elf'};
  h.ctx.window.d20.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.nativeState,'string mode flag');
  assert.equal(diag.eligible,true);
  assert.equal(diag.selectionGetter,'confirmed getter read');
});

test('pinned Jumpgate webpack runtime returns selected dataWrapper model, with d20 absent',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.d20.Campaign;
  campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  h.ctx.window.Campaign=campaign;h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  h.ctx.window.vttEngine='jumpgate';
  let registrations=0;
  const selected=[{id:'scene-node',dataWrapper:{model:h.elf.model}}];
  const table={getSelection(){return selected;}};
  const module={VTTEngine:class VTTEngine{}};
  module.VTTEngine.instance={tabletop:table};
  function fakeRequire(id){assert.equal(id,73210);return module;}
  fakeRequire.h=()=> '19490f9953b3c5b0e6c6';
  fakeRequire.m={73210(){}};
  const chunks=[];
  chunks.push=function(chunk){registrations++;return chunk[2](fakeRequire);};
  h.ctx.window.webpackChunkvtt=chunks;
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  const status=diag();
  assert.equal(registrations,1);
  assert.equal(status.eligible,true);
  assert.equal(status.nativeState,'verified Jumpgate selection read');
  assert.match(status.selectionSource,/jumpgate.tabletop.getSelection/);
  assert.equal(status.selectionCount,1);
  assert.equal(diag().eligible,true);
  assert.equal(registrations,1,'Do not re-register chunks on each 400ms poll');
  selected.length=0;
  assert.equal(diag().eligible,false);
  assert.match(diag().reason,/no linked controlled tokens/);
});
test('unrecognized Jumpgate webpack build is not accessed',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;h.ctx.window.vttEngine='jumpgate';
  let called=0;
  function fakeRequire(){called++;throw Error('Unknown build must not load modules');}
  fakeRequire.h=()=> 'a-changed-roll20-build';
  fakeRequire.m={73210(){}};
  const chunks=[];
  chunks.push=chunk=>chunk[2](fakeRequire);
  h.ctx.window.webpackChunkvtt=chunks;
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(called,0);
  assert.equal(diag.nativeState,'unsupported Jumpgate build');
  assert.equal(diag.eligible,false);
});
test('pinned Jumpgate selection obeys exact character ownership',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.d20.Campaign;
  campaign.characters={get(){return {
    id:'char-elf',get(k){return {name:'Elf',controlledby:'enemy-player'}[k];}
  };}};
  h.ctx.window.Campaign=campaign;h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  const scene=[{dataWrapper:{model:h.elf.model}}];
  class VTTEngine{}
  VTTEngine.instance={tabletop:{getSelection(){return scene;}}};
  function fakeRequire(id){return {VTTEngine};}
  fakeRequire.h=()=> '19490f9953b3c5b0e6c6';
  fakeRequire.m={73210(){}};
  const chunks=[];chunks.push=packet=>packet[2](fakeRequire);
  h.ctx.window.webpackChunkvtt=chunks;
  vm.runInContext(watch,h.ctx);
  const d=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(d.eligible,false);
  assert.match(d.reason,/Controlled By/);
});
test('Jumpgate runtime returns no candidates when bundle has not initialized',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;
  h.ctx.window.vttEngine='jumpgate';
  vm.runInContext(watch,h.ctx);
  const d=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(d.eligible,false);
  assert.match(d.nativeState,/not ready/);
});
