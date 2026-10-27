import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const battlefield=readFileSync(join(root,'extension/firefox/battlefield-layout.js'),'utf8');
const drag=readFileSync(join(root,'extension/firefox/panel-drag.js'),'utf8');

function rig(){
  const storage=new Map(),calls=[];
  const ctx={console,Date,Math,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),
      removeItem:k=>storage.delete(k)},
    window:{innerWidth:1440,innerHeight:900},
    document:{querySelector:()=>null},
    R3_HUD:{collapsed:false,flyout:'',chooser:null,used:{action:false,bonus:false,reaction:false}},
    R3_UI:{shown:false,snapshot:null,root:null,host:null},
    R3_TURN:{extraActions:0,actionSpent:0,bonusSpent:false,reactionSpent:false,
      dashes:0,movementUsed:5,phase:'active',noteSource:'observed',concentration:null},
    R3_NATIVE:{status:''},
    r3TokenSettingsKey:()=> 'test-campaign',
    r3StorageKey:()=> 'test-campaign',
    r3HudRender:()=>calls.push('render'),
    r3String:(v,max=160)=>String(v??'').trim().slice(0,max),
    r3HudPortraitUrl:()=>null,r3HudHasValue:()=>false,
    r3HudValue:v=>v??'—',r3HudHp:()=>'<span>70 / 80 HP</span>',
    r3HudStat:(label,v)=>'<span>'+label+': '+(v??'—')+'</span>',
    r3HudPassive:()=>({label:'Passive',value:15,source:'test'}),
    r3HudResourceBar:()=>'<span>Second Wind</span>',
    r3HudIcon:name=>'<svg data-symbol="'+name+'"></svg>',
    r3HudFlyoutMarkup:()=>'<section class="hud-flyout">ATTACK</section>',
    r3TurnSpeed:()=>30,r3TurnDistance:value=>String(value),
    r3BattlefieldDraggableFlyout:markup=>markup,r3DebugMarkup:()=> '',
    r3NativeMarkup:()=>'',r3SheetRevealAll:()=>calls.push('player sheet'),
    r3TurnChange:()=>calls.push('local turn'),
    r3Escape:value=>String(value).replace(/[&<>"]/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    r3BattlefieldLayoutSave:()=>calls.push('save positions')
  };
  vm.createContext(ctx);
  vm.runInContext(battlefield+drag+
    '\nglobalThis.taskbarApi={R3_BF,R3_BF_DOCKS,R3_BF_VISIBILITY,R3_BF_DRAG,'+
    'r3BattlefieldLoad,r3BattlefieldSave,r3BattlefieldMarkup,r3BattlefieldClick,'+
    'r3BattlefieldContextEvent,r3BattlefieldContextOpen,r3BattlefieldContextClose,'+
    'r3BattlefieldDockOrientation,r3BattlefieldTogglePart,'+
    'r3BattlefieldTaskbarStyles,r3Win9xStyles,r3BattlefieldDragStart};',ctx);
  const api=ctx.taskbarApi;
  const character={name:'Nier',stats:{hp:70,maxHp:80,ac:17,speed:30}};
  return {api,ctx,storage,calls,character,html:()=>api.r3BattlefieldMarkup(character)};
}
function menuTarget(action,value,key){
  return {dataset:{bfAction:action,bfValue:value,bfItem:key}};
}
test('compact taskbar is the default and shows native character status without mutating Roll20',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  const html=h.html();
  assert.match(html,/data-bf-panel="taskbar" data-r3-orientation="bottom"/);
  assert.match(html,/class="r3-bf-taskbar-status"/);
  assert.match(html,/HP 70 \/ 80/);
  assert.match(html,/AC 17/);
  assert.match(html,/Your Turn/);
  assert.match(html,/data-hud-flyout="actions"/);
  assert.match(html,/data-hud-flyout="inventory"/);
  assert.match(html,/data-bf-action="taskbar-menu"/);
  assert.doesNotMatch(html,/class="r3-bf-context"/);
  assert.equal(h.calls.includes('player sheet'),false);
});
test('right-clicking just the dock opens an accessible orientation and visibility context menu',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  let prevented=0,stopped=0;
  const target={closest:selector=>selector==='[data-bf-panel="taskbar"]'?{}:null};
  assert.equal(h.api.r3BattlefieldContextEvent({
    target,clientX:190,clientY:280,
    preventDefault(){prevented++;},stopPropagation(){stopped++;}
  }),true);
  assert.equal(prevented,1);assert.equal(stopped,1);
  assert.equal(h.api.R3_BF.contextOpen,true);
  const menu=h.html();
  assert.match(menu,/role="menu" aria-label="R20eb taskbar options"/);
  for(const edge of ['bottom','top','left','right'])
    assert.match(menu,new RegExp('data-bf-value="'+edge+'"'));
  for(const key of Object.keys(h.api.R3_BF_VISIBILITY))
    assert.match(menu,new RegExp('data-bf-item="'+key+'"'));
  assert.match(menu,/aria-checked="true" data-bf-action="dock-toggle"/);
  assert.equal(h.api.r3BattlefieldContextEvent({target:{closest:()=>null}}),false,
    'native Roll20 context menus must not be intercepted');
  assert.equal(h.api.r3BattlefieldContextClose(),true);
  assert.doesNotMatch(h.html(),/class="r3-bf-context"/);
  h.api.r3BattlefieldContextOpen(1435,899);
  assert.ok(h.api.R3_BF.contextY<=435,
    'the settings menu must fit vertically when opened at the bottom edge');
  assert.ok(h.api.R3_BF.contextX<=1440-308-242,
    'the settings menu must avoid the Roll20 chat/sidebar');
});
test('orientation change persists without moving independently dragged character panels',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  h.api.R3_BF_DRAG.positions.taskbar={x:100,y:100};
  h.api.R3_BF_DRAG.positions.profile={x:300,y:120};
  for(const edge of ['top','left','right','bottom']){
    assert.equal(h.api.r3BattlefieldClick(menuTarget('dock-orientation',edge)),true);
    assert.equal(h.api.R3_BF.orientation,edge);
    assert.match(h.html(),new RegExp('data-r3-orientation="'+edge+'"'));
    assert.equal(h.api.R3_BF_DRAG.positions.taskbar,undefined,
      'old free-drag position must not defeat chosen docking edge');
    assert.equal(h.api.R3_BF_DRAG.positions.profile.x,300);
    assert.equal(JSON.parse(h.storage.get('test-campaign:battlefield')).orientation,edge);
  }
  const css=h.api.r3BattlefieldTaskbarStyles();
  for(const edge of ['top','left','right'])
    assert.ok(css.includes('data-r3-orientation='+edge));
  assert.match(css,/r3-bf-chat-inset/,'right docking avoids chat');
  assert.match(css,/r3-bf-taskbar-status/);
});
test('show/hide preferences persist across reload and menu never becomes inaccessible',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  for(const key of Object.keys(h.api.R3_BF_VISIBILITY)){
    assert.equal(h.api.r3BattlefieldClick(menuTarget('dock-toggle',undefined,key)),true);
    assert.equal(h.api.R3_BF.visible[key],false);
  }
  let html=h.html();
  assert.doesNotMatch(html,/class="r3-bf-actions"/);
  assert.doesNotMatch(html,/class="r3-bf-category-dock"/);
  assert.doesNotMatch(html,/class="r3-bf-taskbar-status"/);
  assert.doesNotMatch(html,/data-bf-panel="profile"/);
  assert.doesNotMatch(html,/data-bf-panel="turn"/);
  assert.doesNotMatch(html,/data-bf-panel="notes"/);
  assert.match(html,/data-bf-action="taskbar-menu"/);
  assert.match(html,/data-bf-panel="taskbar"/);
  h.api.r3BattlefieldLoad();
  for(const key of Object.keys(h.api.R3_BF_VISIBILITY))
    assert.equal(h.api.R3_BF.visible[key],false,'saved '+key);
  h.api.r3BattlefieldClick(menuTarget('dock-toggle',undefined,'actions'));
  assert.match(h.html(),/class="r3-bf-actions"/);
  assert.equal(h.api.r3BattlefieldTogglePart('injected-selector'),false);
  assert.equal(h.api.r3BattlefieldDockOrientation('diagonal'),false);
});
test('legacy battlefield settings migrate without changing notes or visibility defaults',()=>{
  const h=rig();
  h.storage.set('test-campaign:battlefield',JSON.stringify({
    schema:1,notes:'Concentrating',sidebar:false}));
  h.api.r3BattlefieldLoad();
  assert.equal(h.api.R3_BF.notes,'Concentrating');
  assert.equal(h.api.R3_BF.sidebar,false);
  assert.equal(h.api.R3_BF.orientation,'bottom');
  assert.equal(h.api.R3_BF.visible.categories,true);
  h.api.R3_BF.notes='Updated';
  h.api.r3BattlefieldSave();
  assert.equal(JSON.parse(h.storage.get('test-campaign:battlefield')).schema,2);
});
test('dragging a child action indicator moves the whole dock, not an independent ring',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  const dock={getAttribute:k=>k==='data-bf-panel'?'taskbar':null,
    getBoundingClientRect:()=>({left:10,top:800,width:700,height:65})};
  const target={closest:selector=>
    selector==='[data-bf-panel="taskbar"]'?dock:
    selector==='[data-bf-panel]'?{getAttribute:()=> 'actions'}:null};
  h.api.r3BattlefieldDragStart({target,pointerType:'mouse',button:0,
    clientX:150,clientY:820,pointerId:1});
  assert.equal(h.api.R3_BF_DRAG.active.name,'taskbar');
  assert.equal(h.api.R3_BF_DRAG.active.panel,dock);
});
test('preserve BG3, Tokyo Night palette variables and original Win9x bevels',()=>{
  const h=rig();h.api.r3BattlefieldLoad();
  const css=h.api.r3BattlefieldTaskbarStyles();
  assert.match(css,/var\(--r3-panel/);
  assert.match(css,/var\(--r3-text/);
  assert.match(css,/var\(--r3-border/);
  assert.match(h.api.r3Win9xStyles(),/\.r3-bf-taskbar,\.r3-bf-context/);
  assert.doesNotMatch(css,/document\.body|\.characterdialog|\.sheet-header/);
});
