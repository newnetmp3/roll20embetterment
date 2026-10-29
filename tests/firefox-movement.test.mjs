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
    snapping_increment:options.grid??1,scale_units:options.units??'ft',
    diagonaltype:options.diagonal??'foure'};
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
    window:{Campaign:campaign,d20:{engine:{canvas:{getObjects(){
      return [...chars.values()].map(x=>x.object);}}}},
      performance:{getEntriesByName(name,kind){
        return name==='jumpgate-render-end'&&kind==='mark'?
          [{name:'jumpgate-render-end',entryType:'mark'}]:[];
      }}},
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
  vm.runInContext(economy+'\n'+tracker+'\nglobalThis.api={R3_MOVE,R3_TURN,r3MovePoll,r3MoveMeasure,r3MoveRebase,r3MoveScale,r3MoveWaypointLength,r3MoveFind,r3MoveReadNative,r3MoveGridDistance,r3MoveDiagnostics,r3TurnLoad,r3TurnStart,r3TurnApply,r3TurnMarkup,r3TurnDistance};',ctx);
  const api=ctx.api;api.r3TurnLoad();
  return {api,ctx,elf,make,store,renders,pageAttrs,page,listeners};
}
test('Jumpgate coordinate-only movement settles after two unchanged polls without an event',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.attrs.left=210;
  h.api.r3MovePoll(); // position changed without a model change event
  assert.equal(h.api.R3_TURN.movementUsed,0,'do not spend movement on an in-progress drag');
  h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,0,'first settled poll still waits');
  h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,5,'second stable poll completes the move');
  h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,5,'no repeated counting after settlement');
  h.elf.attrs.left=280;
  h.api.r3MovePoll();
  h.elf.attrs.left=350;h.api.r3MovePoll(); // a moving token resets quiet polls
  h.api.r3MovePoll();h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,15,'continuous movement is one path, not a series of jitter moves');
});
test('same-token scene model replacement preserves movement baseline and rebinds listener',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  const replacement={id:'token-elf',get(k){return h.elf.attrs[k];},
    on(name,cb){h.listeners.set('replacement',cb);},
    off(name,cb){if(h.listeners.get('replacement')===cb)h.listeners.delete('replacement');}};
  h.elf.object.model=replacement;
  h.api.r3MovePoll(); // same character and same graphic ID, new model reference
  assert.equal(h.api.R3_MOVE.model,replacement);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.elf.attrs.left=210;
  h.listeners.get('replacement')();
  assert.equal(h.api.R3_TURN.movementUsed,5,'listener follows the refreshed model');
  assert.equal(h.listeners.has('token-elf'),false,'old listener detached');
});

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
test('sub-square coordinate jitter no longer spends fractional feet',()=>{
  const h=rig();h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.move(147,210);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  h.api.r3TurnLoad();
  assert.equal(h.api.R3_TURN.movementUsed,5);
});


test('5E, Manhattan and alternating 3.5E Roll20 diagonal rules replace Euclidean pixel distance',()=>{
  for(const [rule,expected] of [['foure',5],['manhattan',10],
    ['threefive',5],['pythagorean',Math.round(Math.SQRT2*5*100)/100]]){
    const h=rig({diagonal:rule});h.api.r3TurnStart();
    h.elf.move(210,280);
    assert.equal(h.api.R3_TURN.movementUsed,expected,rule);
    assert.equal(h.api.R3_MOVE.measurementSource,'Roll20 grid-rule estimate');
  }
  const h=rig({diagonal:'threefive'});h.api.r3TurnStart();
  h.elf.move(280,350,'140,210,210,280');
  assert.equal(h.api.R3_TURN.movementUsed,15,'two 3.5E diagonals cost 5 + 10');
});
test('native Roll20 ruler readout has priority over grid estimate',()=>{
  const h=rig();h.api.r3TurnStart();let value='20 ft';
  h.ctx.document={querySelectorAll(selector){
    assert.match(selector,/ruler-distance/);
    return [{textContent:value,getClientRects:()=>[{}],getAttribute:()=>null}];
  }};
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,20,'exact on-screen readout, not 5ft coordinate estimate');
  assert.equal(h.api.R3_MOVE.measurementSource,'Roll20 ruler');
  value='15 feet';h.elf.move(280,210);
  assert.equal(h.api.R3_TURN.movementUsed,35,'each committed move counted once');
});
test('native distance readout rejects hidden, unrelated, ambiguous and non-foot labels',()=>{
  const h=rig();h.api.r3TurnStart();
  const label=(value,hidden=false)=>({textContent:value,hidden,
    getClientRects:()=>[{}],getAttribute:()=>null});
  let labels=[label('Range: 60 feet')];
  h.ctx.document={querySelectorAll(){return labels;}};
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  labels=[label('30 ft'),label('20 ft')];
  h.elf.move(280,210);
  assert.equal(h.api.R3_TURN.movementUsed,10,'ambiguous ruler labels do not override grid');
  labels=[label('90 ft',true)];
  h.elf.move(350,210);
  assert.equal(h.api.R3_TURN.movementUsed,15,'hidden labels not used');
});
test('native ruler is sampled while dragging and committed only on drop, not each frame',()=>{
  const h=rig(),events={};
  h.elf.object.on=(type,fn)=>{events[type]=fn;};
  h.elf.object.off=(type)=>{delete events[type];};
  const readout={textContent:'15 ft',getClientRects:()=>[{}],getAttribute:()=>null};
  h.ctx.document={querySelectorAll(){return [readout];}};
  h.api.r3TurnStart();h.api.r3MovePoll();
  h.elf.object.left=210;h.elf.object.top=210;
  events.moving();
  readout.textContent='25 ft';
  h.elf.object.left=280;events.moving();
  assert.equal(h.api.R3_TURN.movementUsed,0,'do not count preview frames');
  h.elf.move(280,210);
  assert.equal(h.api.R3_TURN.movementUsed,0,'model changes during Fabric drag do not finalize');
  events.modified();
  assert.equal(h.api.R3_TURN.movementUsed,25);
  events.modified();
  assert.equal(h.api.R3_TURN.movementUsed,25,'second modified event does not replay the same move');
});
test('missing readable ruler on a gridless page reports unsupported rather than invented feet',()=>{
  const h=rig({grid:0});h.api.r3TurnStart();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,0);
  assert.equal(h.api.R3_MOVE.measurementSource,'unavailable');
  assert.match(h.api.R3_MOVE.status,/measurement unavailable/i);
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
  h.ctx.window.Campaign.activePage=()=>null;
  h.ctx.window.Campaign.pages={get(id){return id==='page-one'?h.page:null;}};
  h.ctx.window.Campaign.get=key=>key==='playerpageid'?'page-one':'[]';
  delete h.pageAttrs.snapping_increment;
  h.api.r3TurnStart();
  h.elf.move(210,210);
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.r3MoveScale(h.page).feetPerPixel,5/70);
});
test('live Fabric coordinates may preview movement but only commit on drop',()=>{
  const h=rig();
  h.elf.object.left=140;h.elf.object.top=210;
  h.api.r3TurnStart();
  h.elf.object.left=210;
  h.api.r3MovePoll();
  assert.equal(h.api.R3_TURN.movementUsed,0,'no premature accounting while Fabric is dragging');
  h.api.r3MoveMeasure('modified');
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
  h.ctx.window.Campaign.characters={get(id){return ready&&id==='char-elf'?{
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
  h.ctx.window.Campaign.characters={get(){return {
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
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
  assert.equal(selection.campaignBridge,'available', 'direct Jumpgate Campaign remains available without d20');
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
  const campaign=h.ctx.window.Campaign;
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
  h.ctx.window.Campaign.characters={get(id){return id==='char-elf'?{
    id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
  }:null;}};
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.modeFlag,'string mode flag');
  assert.equal(diag.eligible,true);
  assert.equal(diag.selectionGetter,'confirmed getter read');
});

// The factory fixture models only the documented selection-specific slices
// of the 2026-10-19 and 2026-10-20 uploaded Roll20 bundles. The proprietary
// bundle itself is NOT included. Both real modules were independently checked
// against this same matcher in source analysis.
function jumpgateSelectionFactory(ctx,padding=51000,selectionGetter=true){
  const source='(y,c,n)=>{"use strict";n.d(c,{VTTEngine:()=>wy});'+
    '/*'+'X'.repeat(padding)+'*/'+
    'class Tabletop {getSelection(){var U,se;return(se=(U=this.state)==null?void 0:U.children)!=null?se:[]}}'+
    'class Engine {getSelection(){return this.tabletop.getSelection()}}'+
    '/*dataWrapper.model*/}';
  const factory=vm.runInContext(source,ctx);
  assert.ok(Function.prototype.toString.call(factory).length>50000);
  return factory;
}
function jumpgateSelectionTable(items=[]){
  return {state:{children:items},
    getSelection(){var U,se;return(se=(U=this.state)==null?void 0:U.children)!=null?se:[]}};
}
function jumpgateSelectionRequire(factory,tabletop,build='355ac54d7a30c962e0a5'){
  class VTTEngine{}
  VTTEngine.instance={tabletop};
  let calls=0;
  function requireModule(id){
    calls++;assert.equal(id,73210);
    return {VTTEngine};
  }
  requireModule.h=()=>build;
  requireModule.m={73210:factory};
  requireModule.getCalls=()=>calls;
  return requireModule;
}
function jumpgateSelectionInstall(h,requireModule){
  const chunks=[];let registrations=0;
  chunks.push=packet=>{registrations++;return packet[2](requireModule);};
  h.ctx.window.webpackChunkvtt=chunks;
  return ()=>registrations;
}
test('both different Jumpgate build hashes accept the same proven selection interface',()=>{
  for(const [build,padding] of [
    ['19490f9953b3c5b0e6c6',51000],
    ['355ac54d7a30c962e0a5',51250]
  ]){
    const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
    const campaign=h.ctx.window.Campaign;
    campaign.characters={get(id){return id==='char-elf'?{
      id,get(key){return {name:'Elf',controlledby:'player-elf'}[key];}
    }:null;}};
    h.ctx.window.Campaign=campaign;
    h.ctx.window.d20=undefined;
    h.ctx.window.d20_player_id='player-elf';
    h.ctx.window.vttEngine='jumpgate';
    const selected=[{id:'scene-node',dataWrapper:{model:h.elf.model}}];
    const factory=jumpgateSelectionFactory(h.ctx,padding);
    const requireModule=jumpgateSelectionRequire(
      factory,jumpgateSelectionTable(selected),build);
    const registrations=jumpgateSelectionInstall(h,requireModule);
    vm.runInContext(watch,h.ctx);
    const diagnose=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
    const result=diagnose();
    assert.equal(result.eligible,true);
    assert.equal(result.nativeState,'verified Jumpgate selection read');
    assert.equal(result.moduleSignature,'verified selection capability');
    assert.equal(result.actualBuild,build);
    assert.equal(result.selectionCount,1);
    assert.equal(registrations(),1);
    assert.equal(requireModule.getCalls(),1);
    assert.equal(diagnose().eligible,true);
    selected.length=0;
    assert.equal(diagnose().eligible,false);
  }
});
test('changed Jumpgate minifier formatting still passes a verified read-only selector',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.Campaign;
  campaign.characters={get(id){return id==='char-elf'?{
    id,get(k){return {name:'Elf',controlledby:'player-elf'}[k];}
  }:null;}};
  h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  const selected=[{id:'scene-node',dataWrapper:{model:h.elf.model}}];
  const old=jumpgateSelectionFactory(h.ctx);
  const varied=Function.prototype.toString.call(old)
    .replace('getSelection(){return this.tabletop.getSelection()}',
      'getSelection() { return this.tabletop.getSelection(); }')
    .replace('getSelection(){var U,se;return(se=(U=this.state)==null?void 0:U.children)!=null?se:[]}',
      'getSelection() { const state=this.state; return state && state.children || []; }');
  assert.notEqual(varied,Function.prototype.toString.call(old));
  const factory=vm.runInContext(varied,h.ctx);
  const requireModule=jumpgateSelectionRequire(factory,jumpgateSelectionTable(selected),
    '775403f71ba36dde7775');
  jumpgateSelectionInstall(h,requireModule);
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.eligible,true,'existing proven getter can survive factory formatting changes');
  assert.equal(diag.selectionCount,1);
  assert.equal(requireModule.getCalls(),1);
});
test('unknown source signature cannot execute a Jumpgate module',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;h.ctx.window.vttEngine='jumpgate';
  let called=0;
  function unknownFactory(){}
  function unknownRequire(){called++;throw Error('unsafe module executed');}
  unknownRequire.h=()=> 'yet-another-build';
  unknownRequire.m={73210:unknownFactory};
  jumpgateSelectionInstall(h,unknownRequire);
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(called,0);
  assert.equal(diag.nativeState,'unsupported Jumpgate selection interface');
  assert.match(diag.moduleSignature,/selection interfaces differ: module size outside verified bounds/);
  assert.equal(diag.eligible,false);
});
test('source-compatible module with changed getter fails closed',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;
  const factory=jumpgateSelectionFactory(h.ctx);
  const unsafeTable={getSelection(){return [{id:'fake'}];}};
  const required=jumpgateSelectionRequire(factory,unsafeTable);
  jumpgateSelectionInstall(h,required);
  vm.runInContext(watch,h.ctx);
  const diag=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(diag.eligible,false);
  assert.equal(diag.nativeState,'unsupported Jumpgate selection getter');
  assert.equal(diag.moduleSignature,'runtime getter differs');
  assert.equal(required.getCalls(),1);
});
test('capability-matched Jumpgate selection still denies characters controlled by others',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.Campaign;
  campaign.characters={get(){return {
    id:'char-elf',get(k){return {name:'Elf',controlledby:'enemy-player'}[k];}
  };}};
  h.ctx.window.Campaign=campaign;h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  const selected=[{dataWrapper:{model:h.elf.model}}];
  const factory=jumpgateSelectionFactory(h.ctx);
  const requireModule=jumpgateSelectionRequire(factory,jumpgateSelectionTable(selected));
  jumpgateSelectionInstall(h,requireModule);
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
test('Jumpgate selected scene node measures using dataWrapper.model without Fabric or d20',()=>{
  const h=rig();
  const campaign=h.ctx.window.Campaign;
  h.ctx.window.Campaign=campaign;
  h.ctx.window.d20=undefined;
  const selected=[{id:'babylon-scene-node',dataWrapper:{model:h.elf.model}}];
  h.ctx.r3TokenSelected=()=>selected;
  // Force fallback to the explicitly selected model, not a page-wide scan.
  h.ctx.r3TokenFindGraphic=()=>null;
  h.api.r3TurnStart();
  assert.equal(h.api.R3_MOVE.source,'selected');
  assert.equal(h.api.R3_MOVE.tokenId,'token-elf');
  h.elf.move(210,210);
  h.elf.move(140,210);
  assert.equal(h.api.R3_TURN.movementUsed,10,
    'Jumpgate movement sums both forward and back segments');
  assert.equal(h.api.r3MoveDiagnostics().pageScale,5);
});
test('Jumpgate selected scene node cannot track a different token ID',()=>{
  const h=rig();
  
  h.ctx.window.d20=undefined;
  const other=h.make('enemy','another-character',700,700);
  h.ctx.r3TokenSelected=()=>[{dataWrapper:{model:other.model}}];
  h.ctx.r3TokenFindGraphic=()=>null;
  h.api.r3TurnStart();
  assert.equal(h.api.R3_TURN.movementUsed,0);
  assert.match(h.api.R3_MOVE.status,/Token position unavailable/);
});

test('compatible Jumpgate module waits safely for late tabletop startup',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.Campaign;
  campaign.characters={get(id){return id==='char-elf'?{
    id,get(k){return {name:'Elf',controlledby:'player-elf'}[k];}
  }:null;}};
  h.ctx.window.Campaign=campaign;h.ctx.window.d20=undefined;
  h.ctx.window.d20_player_id='player-elf';
  const factory=jumpgateSelectionFactory(h.ctx);
  const tabletop=jumpgateSelectionTable([{dataWrapper:{model:h.elf.model}}]);
  const requireModule=jumpgateSelectionRequire(factory,undefined);
  const registrations=jumpgateSelectionInstall(h,requireModule);
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  const waiting=probe();
  assert.equal(waiting.nativeState,'Jumpgate tabletop not ready');
  assert.equal(waiting.eligible,false);
  assert.equal(waiting.moduleSignature,'selection module compatible');
  requireModule(73210).VTTEngine.instance.tabletop=tabletop;
  const active=probe();
  assert.equal(active.nativeState,'verified Jumpgate selection read');
  assert.equal(active.eligible,true);
  assert.equal(active.moduleSignature,'verified selection capability');
  assert.equal(registrations(),1,'No need to register a new webpack chunk after startup');
});

test('R20eb does not touch webpack or lazy VTTEngine instance before first Jumpgate page render',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.d20=undefined;
  h.ctx.window.vttEngine='jumpgate';
  const factory=jumpgateSelectionFactory(h.ctx);
  let engineConstructors=0,moduleLoads=0,registrations=0;
  const Engine=class VTTEngine {
    static get instance(){engineConstructors++;throw Error('premature lazy singleton created');}
  };
  function requireModule(id){moduleLoads++;return {VTTEngine:Engine};}
  requireModule.h=()=> '355ac54d7a30c962e0a5';
  requireModule.m={73210:factory};
  const chunks=[];chunks.push=packet=>{registrations++;packet[2](requireModule);};
  h.ctx.window.webpackChunkvtt=chunks;
  h.ctx.window.performance.getEntriesByName=()=>[];
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  for(let i=0;i<4;i++){
    const d=probe();
    assert.equal(d.eligible,false);
    assert.equal(d.nativeState,'waiting for Jumpgate first page render');
  }
  assert.equal(registrations,0,'No new Webpack chunks before Roll20 finishes initialization');
  assert.equal(moduleLoads,0,'Cannot execute Roll20 modules prematurely');
  assert.equal(engineConstructors,0,'Must not invoke static VTTEngine.instance');
  const state=vm.runInContext('R3_JUMPGATE_RUNTIME',h.ctx);
  assert.equal(state.tried,0,'Readiness retries must not exhaust connection attempts');
});
test('after Roll20 first-render marker, compatible Jumpgate selection initializes once',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  const campaign=h.ctx.window.Campaign;
  campaign.characters={get(id){return id==='char-elf'?{
    id,get(k){return {name:'Elf',controlledby:'player-elf'}[k];}
  }:null;}};
  h.ctx.window.Campaign=campaign;
  h.ctx.window.d20=undefined;h.ctx.window.d20_player_id='player-elf';
  // Roll20 clears the mark in the same call stack that creates it, so
  // a later getEntriesByName poll always returns [].
  h.ctx.window.performance.getEntriesByName=()=>[];
  let emitMark=null,disconnected=0,observerOptions;
  h.ctx.window.PerformanceObserver=class {
    constructor(callback){emitMark=entries=>
      callback({getEntries(){return entries;}});}
    observe(options){observerOptions=options;}
    disconnect(){disconnected++;}
  };
  const factory=jumpgateSelectionFactory(h.ctx);
  const selected=[{dataWrapper:{model:h.elf.model}}];
  const module=jumpgateSelectionRequire(factory,jumpgateSelectionTable(selected));
  const registrations=jumpgateSelectionInstall(h,module);
  vm.runInContext(watch,h.ctx);
  const probe=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx);
  assert.equal(probe().nativeState,'waiting for Jumpgate first page render');
  assert.equal(module.getCalls(),0);
  assert.equal(observerOptions.type,'mark');
  assert.equal(observerOptions.buffered,true);
  emitMark([{name:'unrelated',entryType:'mark'}]);
  assert.equal(probe().nativeState,'waiting for Jumpgate first page render');
  assert.equal(module.getCalls(),0);
  // Deliver the observation after Roll20's synchronous clearMarks call.
  // The performance timeline is empty, but the observer still owns a record.
  emitMark([{name:'jumpgate-render-end',entryType:'mark'}]);
  assert.equal(disconnected,1,'Detach observer after first completed render');
  assert.equal(h.ctx.window.performance.getEntriesByName().length,0);
  const result=probe();
  assert.equal(result.eligible,true);
  assert.equal(result.nativeState,'verified Jumpgate selection read');
  assert.equal(result.moduleSignature,'verified selection capability');
  assert.equal(module.getCalls(),1);
  assert.equal(registrations(),1);
});
test('first-render observer diagnostics are passive and show the actual readiness transition',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  // No Roll20 completion mark remains after its synchronous clearMarks().
  h.ctx.window.performance.getEntriesByName=()=>[];
  let deliver,registrations=0;
  h.ctx.window.PerformanceObserver=class {
    constructor(callback){deliver=entries=>callback({getEntries:()=>entries});}
    observe(){}
    disconnect(){}
  };
  const chunks=[];
  chunks.push=()=>{registrations++;};
  h.ctx.window.webpackChunkvtt=chunks;
  const before=h.api.r3MoveDiagnostics();
  assert.equal(before.jumpgateFirstRender,'unavailable');
  assert.equal(before.jumpgateRenderObserved,'unavailable');
  vm.runInContext(watch,h.ctx);
  const waiting=h.api.r3MoveDiagnostics();
  assert.equal(waiting.jumpgateFirstRender,'watching first render');
  assert.equal(waiting.jumpgateRenderObserved,'No');
  assert.equal(waiting.jumpgateRuntimeAttempts,0);
  assert.equal(registrations,0,'Debug must not bypass first-render barrier');
  deliver([{name:'jumpgate-render-end',entryType:'mark'}]);
  // Avoid a live selection probe here: inspect only the passive flags.
  const observed=h.api.r3MoveDiagnostics();
  assert.equal(observed.jumpgateFirstRender,'first render observed');
  assert.equal(observed.jumpgateRenderObserved,'Yes');
  assert.equal(observed.jumpgateRuntimeAttempts,1,
    'Module read can begin only after first-render observation');
});

test('missing Performance marks fail closed without initializing Roll20 engine',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  h.ctx.window.performance=undefined;
  let registered=0;
  const chunks=[];chunks.push=()=>{registered++;};
  h.ctx.window.webpackChunkvtt=chunks;
  vm.runInContext(watch,h.ctx);
  const result=vm.runInContext('r3TokenSelectionDiagnostics',h.ctx)();
  assert.equal(result.eligible,false);
  assert.equal(result.nativeState,'waiting for Jumpgate first page render');
  assert.equal(registered,0);
});

test('observed first-render completion remains latched after Roll20 clears timeline',()=>{
  const h=rig(),watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  let deliver,disconnectCount=0;
  h.ctx.window.performance.getEntriesByName=()=>[];
  h.ctx.window.PerformanceObserver=class {
    constructor(callback){deliver=entry=>callback({getEntries:()=>[entry]});}
    observe(){}
    disconnect(){disconnectCount++;}
  };
  vm.runInContext(watch,h.ctx);
  assert.equal(vm.runInContext('r3JumpgateFirstRenderComplete()',h.ctx),false);
  deliver({name:'jumpgate-render-end',entryType:'measure'});
  assert.equal(vm.runInContext('r3JumpgateFirstRenderComplete()',h.ctx),false);
  deliver({name:'jumpgate-render-end',entryType:'mark'});
  assert.equal(vm.runInContext('r3JumpgateFirstRenderComplete()',h.ctx),true);
  assert.equal(vm.runInContext('r3JumpgateFirstRenderComplete()',h.ctx),true);
  assert.equal(disconnectCount,1,'Observer stops processing other performance marks');
});
test('browser PerformanceObserver keeps mark record after its timeline is cleared',async()=>{
  // Browser PerformanceObserver and Node perf_hooks have the same
  // buffered-entry delivery semantics under clearMarks().
  const perf=await import('node:perf_hooks');
  const seen=await new Promise((resolve,reject)=>{
    const observer=new perf.PerformanceObserver(list=>{
      observer.disconnect();
      resolve(list.getEntries().map(entry=>entry.name));
    });
    observer.observe({type:'mark'});
    perf.performance.mark('jumpgate-render-end');
    perf.performance.clearMarks('jumpgate-render-end');
    assert.equal(perf.performance.getEntriesByName('jumpgate-render-end').length,0);
    setTimeout(()=>{observer.disconnect();reject(Error('mark not delivered'));},250);
  });
  assert.ok(seen.includes('jumpgate-render-end'));
});
