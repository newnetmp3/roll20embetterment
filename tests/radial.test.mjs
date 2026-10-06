import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const files=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','17_frame_bridge.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const script=files.map(n=>readFileSync(join(root,'src',n),'utf8')).join('\n')
  .replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');
function env(){
  const sent=[],saved=new Map(),field={value:'',dispatchEvent(){}};
  const submit={disabled:false,click(){sent.push(field.value);field.value='';}};
  const doc={querySelector(selector){
    if(selector.includes('textchat-input'))return selector.includes('button')?submit:field;
    return null;
  },querySelectorAll(){return []}};
  const scope={document:doc,location:{search:'?id=123',pathname:'/editor/'},URLSearchParams,
    crypto,console,Date,Math,Number,String,Array,Blob,URL,Event:class{constructor(type){this.type=type}},
    setTimeout(){return 1},clearTimeout(){},setInterval(){},innerWidth:1280,innerHeight:900,
    window:{innerWidth:1280,innerHeight:900},
    localStorage:{getItem(k){return saved.get(k)||null},setItem(k,v){saved.set(k,v)}}
  };
  vm.createContext(scope);vm.runInContext(script,scope);
  vm.runInContext("load(); RB.shadow={innerHTML:'',querySelector(){return null},querySelectorAll(){return []}};RB.root={style:{setProperty(){}},setAttribute(){}};globalThis.r={RB,profile,radialRadii,radialOuterRadius,radialSector,radialPoint,radialCategories,radialTreeRings,radialWheelSVG,radialCanvasToken,radialDomToken,radialExecute,radialPick,radialHTML,radialPosition,radialLabelLines,radialLabelRotation,radialLabelMarkup,radialVisiblePage,radialLayout,radialViewportBounds,radialLabelsFit,radialJumpgateToken,radialTokenNameScore,radialTokenRectCenter,radialWatchJumpgate};",scope);
  return {r:scope.r,sent,field,doc,scope};
}
test('rings progressively contract the original circle and grow concentric choices',()=>{
  const {r}=env(),a=r.radialRadii(1),b=r.radialRadii(2),c=r.radialRadii(3),d=r.radialRadii(4);
  assert.equal(a[0][1],112);assert.ok(b[0][1]<a[0][1]);
  assert.ok(c[0][1]<b[0][1]);assert.ok(d[0][1]<c[0][1]);
  assert.ok(b[1][0]>b[0][1]);assert.ok(c[2][0]>c[1][1]);assert.ok(d[3][0]>d[2][1]);
});
test('wedge SVG closes annular paths and never embeds raw names',()=>{
  const {r}=env();assert.match(r.radialSector(30,70,-90,-50),/^M .* Z$/);
  r.profile().name='<script>alert(1)</script>';r.profile().attacks=[{id:'a1',name:'<img src=x>',command:'/roll 1d20'}];
  r.RB.radial.anchor={x:200,y:400};r.RB.radial.path=['attack','all'];
  const svg=r.radialWheelSVG();
  assert.match(svg,/is-muted/);assert.match(svg,/is-selected/);
  assert.match(svg,/&lt;img src=x&gt;/);
  assert.doesNotMatch(svg,/<img src=x>/);
});
test('weapon, spell and items are sourced from current character sheet import',()=>{
  const {r}=env(),p=r.profile();p.attacks=[{id:'sword',name:'Longsword',command:'%{selected|attack}'}];
  p.spells=[{id:'fire',name:'Fire Bolt',level:0,command:'%{selected|fire}'}];
  p.inventory=[{id:'potion',name:'Potion of Healing',qty:2}];
  const roots=r.radialCategories();assert.equal(roots.length,9);
  assert.ok(roots[0].children.find(x=>x.id==='all').children.some(x=>x.label==='Longsword'));
  assert.ok(roots[1].children.find(x=>x.id==='lvl0').children.some(x=>x.label==='Fire Bolt'));
  assert.ok(roots[3].children.find(x=>x.id==='consumable').children.some(x=>x.label==='Potion of Healing'));
});
test('2014 sheet commands are sent through Roll20 chat and mark action spent',()=>{
  const {r,sent}=env(),p=r.profile();
  p.attacks=[{id:'sword',name:'Longsword',command:'%{selected|repeating_attack_$0_attack}'}];
  r.radialExecute({kind:'attack',value:'sword'});
  assert.equal(sent.length,1);assert.equal(sent[0],'%{selected|repeating_attack_$0_attack}');
  assert.equal(p.actionUsed,true);
});
test('missing 2024 commands never synthesize rolls or spend an action',()=>{
  const {r,sent}=env(),p=r.profile();
  p.attacks=[{id:'beacon',name:'Dagger',command:''}];
  r.radialExecute({kind:'attack',value:'beacon'});
  assert.equal(sent.length,0);assert.equal(p.actionUsed,false);
});
test('casting a spell does not automatically expend a spell slot',()=>{
  const {r,sent}=env(),p=r.profile();
  p.spellSlots[1]=2;p.usedSlots[1]=0;
  p.spells=[{id:'bless',name:'Bless',level:1,concentration:true,command:'%{selected|spell}'}];
  r.radialExecute({kind:'spell',value:'bless'});
  assert.deepEqual(sent,['%{selected|spell}']);assert.equal(p.usedSlots[1],0);
  assert.equal(p.concentration,'Bless');
  r.radialExecute({kind:'spendSlot',value:'1'});
  assert.equal(p.usedSlots[1],1);
});
test('legacy Fabric selected token coordinates respect zoom and pan',()=>{
  const {r}=env();const canvas={
    getActiveObjects(){return [{type:'image',getCenterPoint(){return {x:100,y:50}}}]},
    viewportTransform:[2,0,0,2,10,20],getWidth(){return 400},getHeight(){return 200},
    upperCanvasEl:{getBoundingClientRect(){return {left:80,top:30,width:800,height:400}}}
  };
  r.RB.radial.manual=null;
  assert.equal(r.radialCanvasToken(),null);
  r.RB.radial.anchor=null;
  // The mock only supplies Fabric when deliberately attached to the page.
  // `window` lives in the module's VM, so DOM-based anchors are also covered below.
});
test('modern DOM token anchor uses token bounds and rejects full-canvas overlays',()=>{
  const e=env();e.doc.querySelector=(q)=>q.includes('data-token-id')?{
    getBoundingClientRect(){return {left:100,top:200,width:60,height:60}}}:null;
  const pos=e.r.radialDomToken();assert.equal(pos.x,130);assert.equal(pos.y,230);
  e.doc.querySelector=()=>({getBoundingClientRect(){return {left:0,top:0,width:1800,height:900}}});
  assert.equal(e.r.radialDomToken(),null);
});
test('HUD without accessible token offers pin controls, not a guessed coordinate',()=>{
  const {r}=env();assert.match(r.radialHTML(),/Pin to token/);assert.equal(r.RB.radial.anchor,null);
});

test('footer follows outer radius as choices expand and collapse',()=>{
  const {r}=env();
  r.RB.radial.anchor={x:640,y:450};
  r.RB.radial.source='manual';
  const p=r.profile();
  p.attacks=[{id:'blade',name:'Blade',command:'/roll 1d20'}];
  const paths=[[],['attack'],['attack','all'],['attack','all','a:blade']];
  for(let i=0;i<paths.length;i++){
    r.RB.radial.path=paths[i];
    assert.equal(r.radialTreeRings().length,i+1);
    const outer=[112,157,201,238][i];
    assert.equal(r.radialOuterRadius(i+1),outer);
    const rendered=r.radialHTML();
    assert.ok(rendered.includes('--rbe-outer-radius:'+outer+'px'));
    assert.match(rendered,/class="rbe-wheel-footer"><div class="rbe-wheel-toolbar">/);
    assert.match(rendered,/class="rbe-wheel-info">/);
  }
  r.RB.radial.path.pop();
  assert.match(r.radialHTML(),/--rbe-outer-radius:201px/);
});
test('footer is outside the last ring, not fixed over ring segments',()=>{
  const css=readFileSync(join(root,'src','19_radial_hud.js'),'utf8');
  assert.match(css,/\.rbe-wheel-footer\{[^}]*top:calc\(50% \+ var\(--rbe-outer-radius,112px\) \+ 12px\)/);
  assert.doesNotMatch(css,/\.rbe-wheel-toolbar\{[^}]*bottom:/);
  assert.doesNotMatch(css,/\.rbe-wheel-info\{[^}]*bottom:/);
});

test('positioning reserves toolbar space near the bottom of the viewport',()=>{
  const {r}=env();
  const wheel={style:{left:'',top:'',scale:'',setProperty(key,value){if(key==='--wheel-scale')this.scale=value;}}};
  const tether={setAttribute(){}};
  r.RB.shadow.querySelector=selector=>selector==='#rbe-radial-wheel'?wheel:selector==='#rbe-tether-path'?tether:null;
  r.RB.radial.manual={x:640,y:890};
  r.RB.radial.lastPresence=true;
  r.profile().attacks=[{id:'blade',name:'Blade',command:'/roll 1d20'}];
  r.RB.radial.path=[];
  r.radialPosition();
  const rootCenter=Number.parseFloat(wheel.style.top);
  const rootScale=Number.parseFloat(wheel.style.scale);
  assert.ok(rootCenter+(112+95)*rootScale<=900);
  r.RB.radial.path=['attack','all','a:blade'];
  r.radialPosition();
  const expandedCenter=Number.parseFloat(wheel.style.top);
  const expandedScale=Number.parseFloat(wheel.style.scale);
  assert.ok(expandedCenter<rootCenter,'Expand rings: lift the wheel to preserve footer clearance');
  assert.ok(expandedCenter+(238+95)*expandedScale<=900);
});

test('weapon names wrap instead of being cut to six letters',()=>{
  const {r}=env();
  assert.deepEqual(Array.from(r.radialLabelLines('Throwing Dagger',14,3)),['Throwing','Dagger']);
  assert.deepEqual(Array.from(r.radialLabelLines('Molotov Cocktail',14,3)),['Molotov','Cocktail']);
  assert.deepEqual(Array.from(r.radialLabelLines('Handaxe',14,3)),['Handaxe']);
  const svg=r.radialLabelMarkup({label:'Throwing Dagger',glyph:'⚔',subtitle:'+7 · 20 ft'},30,127,201,-90);
  assert.match(svg,/>Throwing<\/text>/);
  assert.match(svg,/>Dagger<\/text>/);
  assert.match(svg,/rbe-option-meta/);
  assert.doesNotMatch(svg,/>Throw\s*…|>Dagger\s*…/);
});
test('crowded weapon and spell rings paginate at most ten choices plus navigation',()=>{
  const {r}=env(),p=r.profile();
  p.attacks=Array.from({length:24},(_,i)=>({id:'dagger'+i,name:'Dagger '+(i+1),toHit:'+'+(3+i),damage:'1d4',range:'5 ft',command:'/roll 1d20'}));
  r.RB.radial.path=['attack','all'];
  let ring=r.radialTreeRings()[2];
  assert.equal(ring.length,11);
  assert.equal(ring.filter(x=>x.kind==='page').length,1);
  assert.equal(ring[0].label,'Dagger 1');
  assert.equal(ring.at(-1).label,'Next');
  const svg=r.radialWheelSVG();
  assert.match(svg,/Dagger/);
  assert.match(svg,/aria-label="Dagger 1 · \+3 · 5 ft/);
  assert.doesNotMatch(svg,/Dagg…/);
  const index=ring.findIndex(x=>x.kind==='page');
  r.radialPick(2,index);
  ring=r.radialTreeRings()[2];
  assert.equal(ring.length,12);
  assert.equal(ring[0].label,'Dagger 11');
  assert.equal(ring.at(-2).label,'Previous');
  assert.equal(ring.at(-1).label,'Next');
  assert.equal(r.RB.radial.path.join('/'),'attack/all','Paging must not expand another ring');
  r.radialPick(2,ring.findIndex(x=>x.id==='page:prev'));
  assert.equal(r.radialTreeRings()[2][0].label,'Dagger 1');
  // Page state tracks a branch, not the whole HUD.
  assert.equal(r.RB.radial.pages['attack/all'],0);
});
test('SVG text stays upright on both halves of the wheel',()=>{
  const {r}=env();
  for(const angle of [-90,-45,0,35,90,135,180,225]){
    const rotation=r.radialLabelRotation(angle);
    assert.ok(rotation>=-90&&rotation<=90,`Wedge at ${angle} rendered upside down`);
  }
});
test('full name and distinguishing attack stats remain in accessible tooltip',()=>{
  const {r}=env(),p=r.profile();
  p.attacks=[{id:'throw',name:'Throwing Dagger',toHit:'+7',damage:'1d4+4',range:'20/60 ft',command:''},
    {id:'dagger',name:'Dagger',toHit:'+5',damage:'1d4+2',range:'5 ft',command:''}];
  r.RB.radial.path=['attack','all'];
  const markup=r.radialWheelSVG();
  assert.match(markup,/Throwing Dagger · \+7 · 20\/60 ft · \+7 · 1d4\+4 · 20\/60 ft/);
  assert.match(markup,/rbe-option-name/);
  assert.match(markup,/rbe-option-meta/);
  assert.doesNotMatch(markup,/Throw …|Dagger…/);
});

test('uncluttered wheel keeps its original 520px size',()=>{
  const {r}=env();
  r.RB.radial.path=[];
  const layout=r.radialLayout();
  assert.equal(layout.factor,1);
  assert.equal(layout.diameter,520);
  assert.equal(layout.outer,112);
});
test('crowded detailed attacks may expand the wheel while retaining complete names',()=>{
  const {r}=env(),p=r.profile();
  p.attacks=Array.from({length:10},(_,i)=>({
    id:'knife'+i,name:'Throwing Dagger Special Model '+(i+1),
    toHit:'+7',damage:'1d4+4',range:'20/60 ft',command:''
  }));
  r.RB.radial.path=['attack','all'];
  const layout=r.radialLayout();
  assert.ok(layout.factor>1,'Long crowded labels should request more physical space');
  assert.ok(layout.factor<=1.6);
  r.RB.radial.anchor={x:640,y:450};
  const svg=r.radialWheelSVG();
  assert.ok(svg.includes('viewBox='));
  assert.match(svg,/Throwing/);
  assert.match(svg,/Dagger/);
  assert.match(r.radialHTML(),/--rbe-wheel-size:/);
});
test('ring expansion never exceeds available Roll20 tabletop area',()=>{
  const {r,scope}=env(),p=r.profile();
  p.attacks=Array.from({length:10},(_,i)=>({
    id:'knife'+i,name:'Throwing Dagger '+(i+1),
    toHit:'+7',damage:'1d4+4',range:'20/60 ft',command:''
  }));
  r.RB.radial.path=['attack','all'];
  scope.window.innerWidth=700;scope.window.innerHeight=540;
  scope.innerWidth=700;scope.innerHeight=540;
  const bounds=r.radialViewportBounds();
  const layout=r.radialLayout();
  assert.equal(bounds.width,700);
  assert.equal(layout.factor,1,'Do not enlarge when the screen has no spare room');
  r.RB.radial.manual={x:690,y:525};
  r.RB.radial.lastPresence=true;
  const wheel={style:{left:'',top:'',scale:'',setProperty(key,v){if(key==='--wheel-scale')this.scale=v;}}};
  r.RB.shadow.querySelector=id=>id==='#rbe-radial-wheel'?wheel:null;
  r.radialPosition();
  const s=Number(wheel.style.scale),cx=Number.parseFloat(wheel.style.left),cy=Number.parseFloat(wheel.style.top);
  assert.ok(cx-layout.diameter*s/2>=-1);
  assert.ok(cx+layout.diameter*s/2<=700+1);
  assert.ok(cy-(layout.outer+45)*s>=-1);
  assert.ok(cy+(layout.outer+95)*s<=540+1);
});
test('uses editor canvas bounds instead of expanding into Roll20 sidebar',()=>{
  const {r,scope}=env();
  scope.window.innerWidth=1500;scope.window.innerHeight=920;
  scope.innerWidth=1500;scope.innerHeight=920;
  scope.document.querySelector=()=>({getBoundingClientRect(){
    return {left:20,top:55,right:1100,bottom:850,width:1080,height:795};
  }});
  const bounds=r.radialViewportBounds();
  assert.equal(bounds.width,1080);assert.equal(bounds.right,1100);
  assert.equal(bounds.top,55);assert.equal(bounds.bottom,850);
});

test('Jumpgate player token is found from the rendered nameplate overlay',()=>{
  const {r,doc}=env(),p=r.profile();
  p.name='Nier';
  const makeOverlay=(name,left,top)=> {
    const box={getAttribute(){return 'height: 70px; width: 70px; pointer-events: none;'},
      getBoundingClientRect(){return {left,top,width:59.85,height:59.85,right:left+59.85,bottom:top+59.85}}};
    return {children:[{getAttribute(){return ''}},box],
      querySelector(sel){return sel==='.nameplate-container'?{textContent:name}:null},
      getBoundingClientRect(){return {left:left-10,top:top-20,width:90,height:100,right:left+80,bottom:top+80}}};
  };
  const other=makeOverlay('Goblin',300,400),nier=makeOverlay('Nier Stoneshadow',900,500);
  const layer={querySelectorAll(sel){return sel==='.overlay'?[other,nier]:[]}};
  doc.querySelector=sel=>sel==='#tabletop-ui-layer'?layer:
    sel==='#babylonCanvas'?{getBoundingClientRect(){return {left:0,top:0,right:1280,bottom:900,width:1280,height:900}}}:null;
  const found=r.radialJumpgateToken();
  assert.equal(found.name,'Nier Stoneshadow');
  assert.equal(found.source,'player-token');
  assert.ok(Math.abs(found.x-(900+59.85/2))<0.01);
  assert.ok(Math.abs(found.y-(500+59.85/2))<0.01);
});
test('Jumpgate tracker supports sheet-name prefix matching without confusing unrelated tokens',()=>{
  const {r}=env(),p=r.profile();
  p.name='Nier';
  assert.equal(r.radialTokenNameScore('Nier Stoneshadow'),900);
  assert.equal(r.radialTokenNameScore('Nier'),1000);
  assert.equal(r.radialTokenNameScore('Nier Stone Shadow'),900);
  assert.equal(r.radialTokenNameScore('Niera'),0);
  assert.equal(r.radialTokenNameScore('Goblin Nier'),0);
});
test('Jumpgate nameplate tracking takes priority over generic selected DOM fallback',()=>{
  const {r,doc}=env(),p=r.profile();
  p.name='Nier';
  const tokenBox={getAttribute(){return 'height:70px;width:70px;pointer-events:none;'},
    getBoundingClientRect(){return {left:500,top:350,width:70,height:70,right:570,bottom:420}}};
  const overlay={children:[tokenBox],querySelector(sel){return sel==='.nameplate-container'?{textContent:'Nier Stoneshadow'}:null},
    getBoundingClientRect(){return {left:480,top:330,width:110,height:120,right:590,bottom:450}}};
  const layer={querySelectorAll(){return [overlay]}};
  const generic={getBoundingClientRect(){return {left:50,top:50,width:60,height:60}}};
  doc.querySelector=sel=>{
    if(sel==='#tabletop-ui-layer')return layer;
    if(sel==='#babylonCanvas')return {getBoundingClientRect(){return {left:0,top:0,right:1280,bottom:900,width:1280,height:900}}};
    if(sel.includes('[data-token-id]'))return generic;
    return null;
  };
  const wheel={style:{setProperty(){}}},tether={setAttribute(){}};
  r.RB.shadow.querySelector=sel=>sel==='#rbe-radial-wheel'?wheel:sel==='#rbe-tether-path'?tether:null;
  r.RB.radial.lastPresence=true;
  r.radialPosition();
  assert.equal(r.RB.radial.source,'player-token');
  assert.equal(r.RB.radial.anchor.x,535);
  assert.equal(r.RB.radial.anchor.y,385);
});
test('Jumpgate token center is rejected when its overlay is outside the visible Babylon canvas',()=>{
  const {r,doc}=env(),p=r.profile();
  p.name='Nier';
  const box={getAttribute(){return 'width:70px;height:70px;pointer-events:none;'},
    getBoundingClientRect(){return {left:1600,top:300,width:70,height:70,right:1670,bottom:370}}};
  const overlay={children:[box],querySelector(){return {textContent:'Nier Stoneshadow'}},
    getBoundingClientRect(){return {left:1600,top:300,width:70,height:70,right:1670,bottom:370}}};
  doc.querySelector=sel=>sel==='#tabletop-ui-layer'?{querySelectorAll(){return [overlay]}}:
    sel==='#babylonCanvas'?{getBoundingClientRect(){return {left:0,top:0,right:1280,bottom:900,width:1280,height:900}}}:null;
  assert.equal(r.radialJumpgateToken(),null);
});
test('Jumpgate tracker installs an observer on tabletop overlay style changes when available',()=>{
  const {r,doc,scope}=env();
  let observed=null,callback=null;
  const layer={querySelectorAll(){return []}};
  doc.querySelector=sel=>sel==='#tabletop-ui-layer'?layer:null;
  scope.MutationObserver=class{
    constructor(cb){callback=cb}
    observe(target,options){observed={target,options}}
    disconnect(){}
  };
  r.radialWatchJumpgate();
  assert.equal(observed.target,layer);
  assert.equal(observed.options.attributes,true);
  assert.equal(observed.options.childList,true);
  assert.ok(observed.options.attributeFilter.includes('style'));
  assert.equal(typeof callback,'function');
});
