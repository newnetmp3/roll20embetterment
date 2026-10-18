import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const economy=readFileSync(join(root,'extension/firefox/turn-economy.js'),'utf8');
const battlefield=readFileSync(join(root,'extension/firefox/battlefield-layout.js'),'utf8');
const drag=readFileSync(join(root,'extension/firefox/panel-drag.js'),'utf8');

function harness(){
  const store=new Map(),rendered={count:0};
  const ui={
    snapshot:{name:'Elowen',stats:{speed:30,hp:25,maxHp:30,ac:16,initiative:4,level:5},
      slots:{'1':{current:3,max:4}},resources:[{name:'Ki'}],features:[],attacks:[]},
    shown:false
  };
  const ctx={
    window:{d20:{Campaign:{get(){return '[]';}}}},
    R3_UI:ui,
    R3_TOKEN:{active:{tokenId:'elf-token',characterId:'elf-id',name:'Elowen'}},
    R3_HUD:{used:{action:false,bonus:false,reaction:false},
      collapsed:false,flyout:'',chooser:null},
    R3_NATIVE:{status:'',preview:null},
    R3_AUTO:{enabled:false},
    r3TokenSettingsKey(){return 'roll20:game:character:'+ctx.R3_TOKEN.active.characterId;},
    r3HudRender(){rendered.count++;},
    r3String(value,max=160){return String(value??'').trim().slice(0,max);},
    r3Escape(value){return String(value??'').replace(/[&<>"']/g,
      c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    r3HudHasValue(value){return value!==undefined&&value!==null&&value!=='';},
    r3HudValue(value,suffix=''){return value===null||value===undefined?'—':String(value)+suffix;},
    r3HudIcon(icon){return '<svg data-icon="'+icon+'"></svg>';},
    r3HudHp(snapshot){return '<div data-hp="observed">'+snapshot.stats.hp+'/'+snapshot.stats.maxHp+'</div>';},
    r3HudPassive(){return {label:'Passive',value:15,source:'Observed from sheet'};},
    r3HudStat(label,value,suffix=''){return '<div class="hud-stat">'+label+':'+String(value??'—')+suffix+'</div>';},
    r3HudResourceBar(){return '<div class="hud-resources"><span>Slots 3/4</span></div>';},
    r3HudPortraitUrl(){return 'https://example.net/character.webp';},
    r3HudFlyoutMarkup(){return '<section class="hud-flyout">Existing real flyout</section>';},
    r3NativeMarkup(){return '<section class="hud-native-status">Native status</section>';},
    localStorage:{getItem(k){return store.get(k)||null;},
      setItem(k,v){store.set(k,v);}}
  };
  vm.createContext(ctx);
  vm.runInContext(economy+'\n'+battlefield+'\n'+drag+'\n'+
    'globalThis.api={R3_TURN,R3_BF,r3TurnStart,r3TurnApply,r3TurnLoad,'+
    'r3BattlefieldMarkup,r3BattlefieldStyles,r3BattlefieldLoad,'+
    'r3BattlefieldClick,r3BattlefieldInput};',ctx);
  ctx.api.r3TurnLoad();ctx.api.r3BattlefieldLoad();
  return {ctx,ui,api:ctx.api,store,rendered};
}

test('reference: two short corner docks with pass-through map and compact top-right character overview',()=>{
  const h=harness();
  const html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  const css=h.api.r3BattlefieldStyles();
  assert.match(html,/class="r3-bf-actions"/);
  assert.match(html,/class="r3-bf-category-dock"/);
  assert.match(html,/class="r3-bf-sidebar"/);
  assert.match(html,/class="r3-bf-turnstrip"/);
  assert.match(css,/#r3-hud\{position:absolute!important;inset:0!important;/);
  assert.match(css,/pointer-events:none!important/,'HUD root must not intercept map clicks');
  assert.match(css,/\.r3-bf-actions\{position:absolute;bottom:12px;left:14px;width:min\(530px/);
  assert.match(css,/\.r3-bf-category-dock\{position:absolute;right:14px;bottom:12px;width:min\(470px/);
  assert.match(css,/\.r3-bf-sidebar\{position:absolute;right:14px;top:32px;width:258px/);
  assert.match(css,/\.r3-bf-shell>\.hud-flyout\{position:absolute!important;right:14px!important;left:auto!important;bottom:107px/);
  assert.match(css,/@media\(max-width:760px\)/,'narrow viewport responsive behavior');
  assert.doesNotMatch(html,/hud-reference-bar|hud-main-segments|hud-portrait-panel/);
});
test('reference: four available economy rings and five existing category flyouts',()=>{
  const h=harness();
  const html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  for(const type of ['action','bonus','reaction','move'])
    assert.match(html,new RegExp('r3-bf-ring r3-bf-'+type));
  for(const kind of ['actions','features','spells','inventory','skills'])
    assert.match(html,new RegExp('data-hud-flyout="'+kind+'"'));
  assert.match(html,/data-turn-action="dash-action"/);
  assert.match(html,/data-bf-action="disengage"/);
  assert.match(html,/data-bf-action="hide"/);
  assert.match(html,/data-turn-action="focus"/);
  assert.match(html,/data-turn-action="start"/);
  assert.match(html,/data-turn-action="end"/);
});
test('turn/action indicators update and do not invoke native Roll20 controls',()=>{
  const h=harness(),state=h.api.R3_TURN;
  h.api.r3TurnStart();
  h.api.r3BattlefieldClick({dataset:{bfAction:'disengage'}});
  assert.equal(state.actionSpent,1);
  assert.match(h.api.r3BattlefieldMarkup(h.ui.snapshot),/Action<\/span><strong>Spent/);
  assert.match(state.note,/Nothing was sent to Roll20/);
  h.api.r3BattlefieldClick({dataset:{bfAction:'hide'}});
  assert.equal(state.actionSpent,2);
  h.api.r3TurnApply('action');
  assert.equal(state.actionSpent,0,'main action correction still works');
  assert.equal(h.api.r3BattlefieldClick({dataset:{bfAction:'unrecognized'}}),false);
});
test('Flyout is on demand, preserves native attack browsing and does not cover map when closed',()=>{
  const h=harness();
  let html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.doesNotMatch(html,/Existing real flyout/);
  h.ctx.R3_HUD.flyout='actions';
  html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/Existing real flyout/);
  assert.match(html,/data-hud-flyout="actions" aria-pressed="true"/);
});
test('user notes persist per selected character and do not rerender on input',()=>{
  const h=harness(),notes={id:'r3-bf-notes',value:'Flank left; avoid fire.'};
  assert.equal(h.api.r3BattlefieldInput(notes),true);
  assert.equal(h.rendered.count,0,'typing must not reset selection or caret');
  assert.match(h.api.r3BattlefieldMarkup(h.ui.snapshot),/Flank left; avoid fire/);
  h.ctx.R3_TOKEN.active={tokenId:'other',characterId:'brom-id',name:'Brom'};
  h.api.r3BattlefieldLoad();
  assert.equal(h.api.R3_BF.notes,'');
  h.ctx.R3_TOKEN.active={tokenId:'elf-token',characterId:'elf-id',name:'Elowen'};
  h.api.r3BattlefieldLoad();
  assert.equal(h.api.R3_BF.notes,'Flank left; avoid fire.');
  h.api.r3BattlefieldInput({id:'r3-bf-notes',value:'<script>alert(1)</script>'});
  assert.doesNotMatch(h.api.r3BattlefieldMarkup(h.ui.snapshot),/<script>/);
  assert.match(h.api.r3BattlefieldMarkup(h.ui.snapshot),/&lt;script&gt;/);
  assert.equal(h.api.r3BattlefieldInput({id:'not-ours',value:'x'}),false);
});
test('side-panel toggle saves local preference without hiding the central battlefield',()=>{
  const h=harness();
  h.api.r3BattlefieldClick({dataset:{bfAction:'sidebar'}});
  assert.equal(h.api.R3_BF.sidebar,false);
  const compact=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.doesNotMatch(compact,/class="r3-bf-sidebar"/);
  assert.match(compact,/data-bf-action="sidebar"/);
  assert.match(compact,/class="r3-bf-actions"/);
  h.api.r3BattlefieldClick({dataset:{bfAction:'sidebar'}});
  assert.equal(h.api.R3_BF.sidebar,true);
  h.api.r3BattlefieldLoad();
  assert.equal(h.api.R3_BF.sidebar,true);
});
test('advanced economy controls are inline and only expand when requested',()=>{
  const h=harness();
  let html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.doesNotMatch(html,/hud-turn-flow/);
  h.api.r3BattlefieldClick({dataset:{bfAction:'options'}});
  html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/class="hud-turn-flow"/);
  assert.match(html,/r3-bf-advanced/);
  assert.doesNotMatch(economy+battlefield,/\b(?:alert|confirm|prompt)\s*\(/);
});
test('sourced resource and HP values shown, no invented class or initiative round',()=>{
  const h=harness();
  const html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/Elowen/);
  assert.match(html,/25\/30/);
  assert.match(html,/Slots 3\/4/);
  assert.match(html,/Level 5/);
  assert.match(html,/Local markers/);
  assert.doesNotMatch(html,/Round [0-9]/);
  assert.doesNotMatch(html,/Elf Rogue|Thief/);
  assert.match(html,/https:\/\/example.net\/character.webp/);
});
test('fully collapsed mode leaves only a small restore control',()=>{
  const h=harness();
  h.ctx.R3_HUD.collapsed=true;
  const html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/Show R20eb HUD/);
  assert.doesNotMatch(html,/class="r3-bf-actions"/);
  assert.doesNotMatch(html,/class="r3-bf-sidebar"/);
});

test('routine native/debug messages have no HUD overlays while roll confirmation stays visible',()=>{
  const h=harness();
  h.ctx.R3_NATIVE.status='Original Roll20 sheets restored.';
  let html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.doesNotMatch(html,/class="r3-bf-native"/);
  assert.doesNotMatch(html,/ⓘ Status/);
  assert.match(html,/data-bf-panel="categories"/);
  h.ctx.R3_NATIVE.preview={status:'ready'};
  html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/class="r3-bf-native"/,'actionable native roll controls remain visible');
});
test('battlefield ring shows negative remaining movement instead of clipping at zero',()=>{
  const h=harness();
  h.api.r3TurnStart();
  h.api.R3_TURN.movementUsed=45;
  const html=h.api.r3BattlefieldMarkup(h.ui.snapshot);
  assert.match(html,/-15 \/ 30 ft/);
  assert.match(html,/Used 45 ft/);
  h.api.r3TurnApply('dash-action');
  assert.match(h.api.r3BattlefieldMarkup(h.ui.snapshot),/15 \/ 60 ft/);
});
