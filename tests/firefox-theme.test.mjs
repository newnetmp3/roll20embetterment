import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const file=join(resolve(import.meta.dirname,'..'),'extension/firefox/theme-manager.js');
const source=readFileSync(file,'utf8');
function harness(){
  const storage=new Map(),buttons=[],sheet={textContent:''},label={textContent:''};
  let nativeActions=0,renders=0;
  const root={
    getElementById(id){return id==='r3-theme-style'?sheet:
      id==='r3-theme-active'?label:null;},
    querySelectorAll(selector){return selector==='[data-r3-theme]'?buttons:[];}
  };
  const host={dataset:{}};
  const ctx={
    R3_UI:{root,host},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    r3Escape:v=>String(v).replace(/[&<>"']/g,c=>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    r3Win9xStyles:()=>'.r3-bf-actions{background:#c0c0c0!important}',
    r3HudRender:()=>{renders++;},
    r3NativeInvoke:()=>{nativeActions++;},
    Date
  };
  vm.createContext(ctx);
  vm.runInContext(source+
    '\nglobalThis.themeApi={R3_THEME,R3_THEME_OPTIONS,r3ThemeKey,'+
    'r3ThemeOption,r3ThemeLoad,r3ThemeSave,r3ThemeStyles,r3ThemeApply,'+
    'r3ThemeSet,r3ThemeAction,r3ThemeManagerMarkup,r3ThemeManagerInput,r3ThemeManagerStyles};',ctx);
  return {ctx,api:ctx.themeApi,root,host,sheet,label,storage,buttons,
    nativeActions:()=>nativeActions,renders:()=>renders};
}
test('BG3 restores as the default; Tokyo Night matches official Oh My Posh palette',()=>{
  const h=harness();
  assert.equal(h.api.r3ThemeLoad(),'bg3');
  assert.match(h.api.r3ThemeStyles(),/--r3-accent:#d5b779/);
  const tokyo=h.api.R3_THEME_OPTIONS.find(t=>t.id==='tokyonight');
  assert.equal(tokyo.bg,'#1a1b26');
  assert.equal(tokyo.panel,'#24283b');
  assert.equal(tokyo.accent,'#7aa2f7');
  assert.equal(tokyo.positive,'#9ece6a');
  assert.equal(tokyo.danger,'#f7768e');
  assert.match(tokyo.source,/Oh My Posh/);
  assert.equal(h.api.R3_THEME_OPTIONS.length,7);
});
test('save/restore, invalid theme rejection and deprecated storage never become CSS injection',()=>{
  const h=harness();
  assert.equal(h.api.r3ThemeSet('tokyonight'),true);
  assert.equal(h.storage.get('r20eb:ui-theme:v1'),'tokyonight');
  h.api.R3_THEME.current='bg3';
  assert.equal(h.api.r3ThemeLoad(),'tokyonight');
  const before=h.sheet.textContent;
  assert.equal(h.api.r3ThemeSet('body{display:none}'),false);
  assert.equal(h.sheet.textContent,before);
  h.storage.set('r20eb:ui-theme:v1','");color:red;');
  assert.equal(h.api.r3ThemeLoad(),'bg3');
  h.api.r3ThemeApply();
  assert.doesNotMatch(h.sheet.textContent,/color:red;/);
});
test('Tokyo Night changes isolated shadow stylesheet, not HUD, character actions or layout',()=>{
  const h=harness();
  const chosen=[];
  for(const id of ['bg3','tokyonight','win9x']){
    const b={dataset:{r3Theme:id},setAttribute(k,v){this[k]=v;},
      classList:{toggle(key,on){if(on)chosen.push(id);}}};
    h.buttons.push(b);
  }
  assert.equal(h.api.r3ThemeApply(),true);
  assert.equal(h.api.r3ThemeAction({dataset:{r3Theme:'tokyonight'}}),true);
  assert.equal(h.host.dataset.r3Theme,'tokyonight');
  assert.match(h.sheet.textContent,/--r3-accent:#7aa2f7/);
  assert.match(h.sheet.textContent,/\.hud-flyout>header/);
  assert.match(h.sheet.textContent,/#r3-wrap/);
  assert.match(h.sheet.textContent,/\.r3-debug-window/);
  assert.match(h.sheet.textContent,/\.r3-bf-category/);
  assert.equal(h.label.textContent,'Active: Tokyo Night Storm');
  assert.equal(h.buttons[1]['aria-pressed'],'true');
  assert.equal(h.buttons[0]['aria-pressed'],'false');
  assert.equal(h.nativeActions(),0);
  assert.equal(h.renders(),0);
  assert.equal(h.api.r3ThemeSet('win9x'),true);
  assert.match(h.sheet.textContent,/#c0c0c0/);
  assert.equal(h.host.dataset.r3Theme,'win9x');
  assert.equal(h.api.r3ThemeSet('bg3'),true);
  assert.match(h.sheet.textContent,/#d5b779/);
});
test('gallery renders accessible choices with literal fixed swatches, not remote resources',()=>{
  const h=harness();
  h.api.R3_THEME.current='tokyonight';
  const markup=h.api.r3ThemeManagerMarkup();
  assert.match(markup,/Theme Manager/);
  for(const theme of h.api.R3_THEME_OPTIONS)
    assert.match(markup,new RegExp('data-r3-theme="'+theme.id+'"'));
  assert.match(markup,/aria-pressed="true"/);
  assert.match(markup,/Tokyo Night Storm/);
  assert.match(markup,/Baldur&#39;s Gate 3/);
  assert.doesNotMatch(markup,/<script|onload=|https?:\/\//i);
  assert.match(h.api.r3ThemeManagerStyles(),/r3-theme-grid/);
  h.api.r3ThemeManagerInput({target:{classList:{contains:v=>v==='r3-theme-manager'},open:true}});
  assert.equal(h.api.R3_THEME.managerOpen,true);
  assert.match(h.api.r3ThemeManagerMarkup(),/<details class="r3-theme-manager" open>/);
});
test('every theme has a complete static, valid and internally distinct accessible palette',()=>{
  const h=harness();
  const keys=['bg','panel','surface','inset','header','button','text','muted',
    'accent','border','positive','danger','selected','shadow'];
  for(const theme of h.api.R3_THEME_OPTIONS){
    assert.match(theme.id,/^[a-z0-9]+$/);
    assert.ok(theme.swatches.length>=3);
    if(theme.id==='win9x')continue;
    for(const key of keys)assert.match(theme[key],/^#[0-9a-f]{6}$/i,theme.id+' '+key);
    const css=(()=>{h.api.R3_THEME.current=theme.id;return h.api.r3ThemeStyles();})();
    assert.match(css,/\.hud-card-body/);
    assert.match(css,/\.hud-hp-label/);
    assert.match(css,/\.r3-theme-choice\.is-current/);
    assert.doesNotMatch(css,/url\(|@import|document\.body/);
  }
});
