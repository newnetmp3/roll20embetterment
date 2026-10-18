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
  vm.runInContext(watch+'\\nglobalThis.readSelected=r3TokenSelected;',h.ctx);
  h.ctx.window.d20.engine.canvas.getActiveObjects=()=>[h.elf.object];
  assert.equal(h.ctx.readSelected().length,1);
  assert.equal(h.ctx.readSelected()[0],h.elf.object);
});
test('token watcher supports single Fabric active object and collection-like selection',()=>{
  const h=rig();
  const watch=readFileSync(join(root,'v3/23_token.js'),'utf8');
  vm.runInContext(watch+'\\nglobalThis.readSelected=r3TokenSelected;',h.ctx);
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
  vm.runInContext(watch+'\\nglobalThis.readSelected=r3TokenSelected;',h.ctx);
  assert.equal(h.ctx.readSelected().length,0);
});
