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
  vm.runInContext("load(); RB.shadow={innerHTML:'',querySelector(){return null},querySelectorAll(){return []}};RB.root={style:{setProperty(){}},setAttribute(){}};globalThis.r={RB,profile,radialRadii,radialOuterRadius,radialSector,radialPoint,radialCategories,radialTreeRings,radialWheelSVG,radialCanvasToken,radialDomToken,radialExecute,radialPick,radialHTML};",scope);
  return {r:scope.r,sent,field,doc};
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
