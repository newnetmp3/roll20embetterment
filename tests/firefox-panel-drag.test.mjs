import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const src=readFileSync(join(resolve(import.meta.dirname,'..'),'extension/firefox/panel-drag.js'),'utf8');
function harness(opts={}){
  const data=new Map(),panels=new Map(),width=opts.width??1280,height=opts.height??800,render={count:0};
  const make=(name,x,y,w=250,h=100)=>{
    const r={x,y,w,h},props=new Map();
    const el={style:{
      setProperty(k,v){props.set(k,v);if(k==='left')r.x=Number.parseInt(v);if(k==='top')r.y=Number.parseInt(v);},
      removeProperty(k){props.delete(k);},get(k){return props.get(k);}
    },getAttribute(k){return k==='data-bf-panel'?name:null;},
      getBoundingClientRect(){return {left:r.x,top:r.y,width:r.w,height:r.h,right:r.x+r.w,bottom:r.y+r.h};},
      setPointerCapture(){},setAttribute(k,v){props.set(k,v);}};
    panels.set(name,el);
  };
  make('actions',14,660,440);make('categories',510,672,440,88);
  make('profile',690,32,250,185);make('notes',690,435);make('flyout',510,200,470,320);
  const root={addEventListener(){},getElementById(){return null;},
    querySelector(q){if(q==='.r3-bf-shell')return {style:{setProperty(){}}};
      return panels.get(q.match(/^\[data-bf-panel="([^"]+)"\]$/)?.[1])||null;}};
  const host={style:{setProperty(k,v){host[k]=v;}}};
  const ctx={window:{innerWidth:width,innerHeight:height,addEventListener(){}},
    document:{querySelector(s){return s==='#rightsidebar'&&opts.chat!==false?
      {getBoundingClientRect(){return {left:width-300,right:width,width:300,height:650};}}:null;}},
    R3_UI:{root,host},R3_BF:{revision:0},r3StorageKey(){return 'game:shared';},
    r3Escape(s){return String(s);},r3HudRender(){render.count++;},
    localStorage:{getItem(k){return data.get(k)||null;},setItem(k,v){data.set(k,v);},
      removeItem(k){data.delete(k);}}};
  vm.createContext(ctx);
  vm.runInContext(src+'\nglobalThis.api={R3_BF_DRAG,r3BattlefieldGrip,r3BattlefieldChatInset,r3BattlefieldLayoutLoad,r3BattlefieldLayoutSave,r3BattlefieldPlacePanels,r3BattlefieldPanel,r3BattlefieldSetPosition,r3BattlefieldEnableDragging,r3BattlefieldDragStart,r3BattlefieldDragMove,r3BattlefieldDragEnd,r3BattlefieldPreventDragClick,r3BattlefieldDragKeyboard,r3BattlefieldResetPositions,r3BattlefieldDraggableFlyout,r3BattlefieldDragStyles};',ctx);
  const api=ctx.api;api.r3BattlefieldEnableDragging(root);
  const hit=(name,editor=false)=>({
    closest(q){
      if(editor&&q.includes('textarea'))return this;
      if(q==='[data-bf-panel]')return panels.get(name);
      return null;
    }
  });
  return {api,data,panels,root,host,render,hit};
}
test('all panels drag directly and no visible grab handles are generated',()=>{
  const h=harness();
  const css=h.api.r3BattlefieldDragStyles();
  assert.doesNotMatch(src,/data-bf-grip|r3-bf-drag-grip/);
  assert.doesNotMatch(css,/drag-grip/);
  assert.match(css,/cursor:grab/);
  h.api.r3BattlefieldPlacePanels();
  for(const panel of h.panels.values())assert.equal(panel.style.get('tabindex'),'0');
});
test('chat panel geometry is respected; sensible fallback exists',()=>{
  const h=harness({width:1200});
  assert.equal(h.api.r3BattlefieldChatInset(),308);
  h.api.r3BattlefieldPlacePanels();
  assert.equal(h.host['--r3-bf-chat-inset'],'308px');
  assert.equal(harness({width:1200,chat:false}).api.r3BattlefieldChatInset(),330);
  assert.equal(harness({width:750,chat:false}).api.r3BattlefieldChatInset(),0);
});
test('pointer move changes only dragged dock and saves per-game coordinates',()=>{
  const h=harness({width:1200}),target=h.hit('categories');
  h.api.r3BattlefieldDragStart({target,pointerType:'mouse',button:0,pointerId:4,
    clientX:520,clientY:684,preventDefault(){},stopPropagation(){}});
  assert.equal(h.api.R3_BF_DRAG.active.name,'categories');
  h.api.r3BattlefieldDragMove({pointerId:4,clientX:720,clientY:500,preventDefault(){}});
  h.api.r3BattlefieldDragEnd({pointerId:4,preventDefault(){}});
  assert.equal(h.panels.get('categories').getBoundingClientRect().left,710);
  assert.equal(h.panels.get('categories').getBoundingClientRect().top,488);
  assert.equal(h.panels.get('actions').getBoundingClientRect().left,14);
  const saved=JSON.parse(h.data.get('game:shared:firefox-panel-layout:v1'));
  assert.equal(saved.positions.categories.x,710);
  h.api.R3_BF_DRAG.positions={};h.api.R3_BF_DRAG.scope='';
  h.api.r3BattlefieldLayoutLoad();
  assert.equal(h.api.R3_BF_DRAG.positions.categories.y,488);
});
test('normal clicks do not drag; inputs are ignored, right click and stray pointers are safe',()=>{
  const h=harness(),target=h.hit('actions');
  h.api.r3BattlefieldDragStart({target,pointerId:1,button:0,pointerType:'mouse',
    clientX:20,clientY:670});
  h.api.r3BattlefieldDragMove({pointerId:1,clientX:25,clientY:673});
  assert.equal(h.panels.get('actions').getBoundingClientRect().left,14);
  h.api.r3BattlefieldDragEnd({pointerId:1});
  assert.equal(h.api.R3_BF_DRAG.suppressClick,null);
  assert.equal(h.data.has('game:shared:firefox-panel-layout:v1'),false);
  h.api.r3BattlefieldDragStart({target:h.hit('notes',true),pointerId:2,
    button:0,pointerType:'mouse',clientX:695,clientY:440});
  assert.equal(h.api.R3_BF_DRAG.active,null,'typing area must not be draggable');
  h.api.r3BattlefieldDragStart({target,pointerId:3,button:2,pointerType:'mouse',
    clientX:20,clientY:670});
  assert.equal(h.api.R3_BF_DRAG.active,null,'right-click cannot reposition');
  h.api.r3BattlefieldDragStart({target,pointerId:4,button:0,pointerType:'mouse',
    clientX:20,clientY:670});
  h.api.r3BattlefieldDragMove({pointerId:5,clientX:300,clientY:400});
  assert.equal(h.panels.get('actions').getBoundingClientRect().left,14);
  h.api.r3BattlefieldDragEnd({pointerId:5});
  assert.equal(h.api.R3_BF_DRAG.active.name,'actions');
  h.api.r3BattlefieldDragEnd({pointerId:4});
});
test('completed drag suppresses an accidental button click, never future keyboard clicks',()=>{
  const h=harness(),target=h.hit('categories');
  h.api.r3BattlefieldDragStart({target,pointerId:7,button:0,pointerType:'mouse',
    clientX:520,clientY:684});
  h.api.r3BattlefieldDragMove({pointerId:7,clientX:542,clientY:685,preventDefault(){}});
  h.api.r3BattlefieldDragEnd({pointerId:7,preventDefault(){}});
  let canceled=0;
  h.api.r3BattlefieldPreventDragClick({target,detail:1,
    preventDefault(){canceled++;},stopPropagation(){},stopImmediatePropagation(){}});
  assert.equal(canceled,1);
  h.api.r3BattlefieldPreventDragClick({target,detail:1,
    preventDefault(){canceled++;},stopPropagation(){},stopImmediatePropagation(){}});
  assert.equal(canceled,1,'a later button click must work');
  h.api.r3BattlefieldDragStart({target,pointerId:8,button:0,pointerType:'mouse',
    clientX:542,clientY:685});
  h.api.r3BattlefieldDragMove({pointerId:8,clientX:560,clientY:685,preventDefault(){}});
  h.api.r3BattlefieldDragEnd({pointerId:8,preventDefault(){}});
  h.api.r3BattlefieldPreventDragClick({target,detail:0,
    preventDefault(){canceled++;}});
  assert.equal(canceled,1,'keyboard click must not be swallowed');
});
test('layout is clamped into available window bounds',()=>{
  const h=harness({width:900,height:540,chat:false});
  h.api.r3BattlefieldSetPosition(h.panels.get('profile'),5000,-100);
  assert.equal(h.panels.get('profile').getBoundingClientRect().left,646);
  assert.equal(h.panels.get('profile').getBoundingClientRect().top,4);
  h.api.R3_BF_DRAG.positions.notes={x:4000,y:9999};
  h.api.r3BattlefieldPlacePanels();
  const r=h.panels.get('notes').getBoundingClientRect();
  assert.ok(r.left<=646&&r.left>=4&&r.top<=436&&r.top>=4);
});
test('arrow keys nudge selected grip and persist its position',()=>{
  const h=harness(),target=h.hit('profile');
  const ev={target,key:'ArrowLeft',shiftKey:false,altKey:true,preventDefault(){},stopPropagation(){}};
  h.api.r3BattlefieldDragKeyboard(ev);
  assert.equal(h.panels.get('profile').getBoundingClientRect().left,678);
  ev.key='ArrowDown';ev.shiftKey=true;h.api.r3BattlefieldDragKeyboard(ev);
  assert.equal(h.panels.get('profile').getBoundingClientRect().top,33);
  assert.ok(h.data.has('game:shared:firefox-panel-layout:v1'));
});
test('reset clears positions and returns panels to CSS layout',()=>{
  const h=harness();
  h.api.r3BattlefieldSetPosition(h.panels.get('actions'),300,200);
  h.api.R3_BF_DRAG.positions.actions={x:300,y:200};
  h.api.r3BattlefieldLayoutSave();
  h.api.r3BattlefieldResetPositions();
  assert.equal(h.data.has('game:shared:firefox-panel-layout:v1'),false);
  assert.equal(h.panels.get('actions').style.get('left'),undefined);
  assert.equal(h.render.count,1);
});
test('existing flyout and native card remain intact with movable grip',()=>{
  const h=harness(),html=h.api.r3BattlefieldDraggableFlyout(
    '<section class="hud-flyout" aria-label="Roll20 attack"><header>Attack</header></section>');
  assert.match(html,/data-bf-panel="flyout"/);
  assert.doesNotMatch(html,/data-bf-grip|r3-bf-drag-grip/);
  assert.match(html,/<header>Attack<\/header>/);
  assert.equal(h.api.r3BattlefieldDraggableFlyout(''),'');
});
test('invalid persisted keys and positions never enter selectors',()=>{
  const h=harness();
  h.data.set('game:shared:firefox-panel-layout:v1',JSON.stringify({schema:1,
    positions:{actions:{x:350,y:50},'evil][data-secret':{x:10,y:10},
      profile:{x:'100',y:20},notes:{x:-5,y:0}}}));
  h.api.R3_BF_DRAG.scope='';
  h.api.r3BattlefieldLayoutLoad();
  assert.deepEqual(Object.keys(h.api.R3_BF_DRAG.positions),['actions']);
  assert.equal(h.api.r3BattlefieldPanel(h.root,'evil][data-secret'),null);
});

test('keyboard arrows without Alt do not move, protecting normal UI shortcuts',()=>{
  const h=harness(),ev={target:h.hit('profile'),key:'ArrowUp',altKey:false,
    preventDefault(){throw Error('should not intercept');}};
  h.api.r3BattlefieldDragKeyboard(ev);
  assert.equal(h.panels.get('profile').getBoundingClientRect().top,32);
  ev.altKey=true;
  h.api.r3BattlefieldDragKeyboard(ev);
  assert.equal(h.panels.get('profile').getBoundingClientRect().top,20);
});
