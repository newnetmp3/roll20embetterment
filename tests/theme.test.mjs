import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const modules=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','17_frame_bridge.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const program=modules.map(x=>readFileSync(join(root,'src',x),'utf8')).join('\n')
  .replace(/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',boot,\{once:true\}\);else boot\(\);\s*$/,'');

function environment(saved){
  const values=new Map();
  if(saved)values.set('roll20-embetterment:123',JSON.stringify(saved));
  const scope={
    location:{search:'?id=123',pathname:'/editor/'},URLSearchParams,crypto:{randomUUID},
    Date,Math,Number,String,Array,console,setInterval(){},setTimeout(){return 1},clearTimeout(){},
    window:{innerWidth:1280,innerHeight:900},
    document:{querySelector(){return null},querySelectorAll(){return []}},
    localStorage:{getItem(k){return values.get(k)||null},setItem(k,v){values.set(k,v)}}
  };
  vm.createContext(scope);
  vm.runInContext(program+'\nload(); RB.visible=true; RB.shadow={innerHTML:"",querySelector(){return null}}; RB.root={style:{setProperty(){}},setAttribute(){}}; globalThis.spec={RB,render,homeUI,barUI,hudUI,settingsUI,themeHeading,BG3_STYLE,save};',scope);
  return {spec:scope.spec,values};
}
test('new campaigns use BG3 dark fantasy as default',()=>{
  const {spec}=environment();
  assert.equal(spec.RB.state.settings.theme,'bg3');
  assert.equal(spec.RB.version,'2.1.1');
  assert.match(spec.settingsUI(),/Baldurian • Dark Fantasy \(default\)/);
  assert.equal(spec.RB.state.settings.showBar,false);
  assert.equal(spec.RB.state.settings.showHud,false);
});
test('existing default Midnight migrates once without overwriting preferences',()=>{
  const base={schema:1,settings:{theme:'midnight'},profiles:[],ui:{},macros:[]};
  const {spec}=environment(base);
  assert.equal(spec.RB.state.settings.theme,'bg3');
  assert.equal(spec.RB.state.settings.visualMigration,1);
  const chosen=environment({...base,settings:{theme:'violet'}}).spec;
  assert.equal(chosen.RB.state.settings.theme,'violet');
  const legacy=environment({...base,settings:{theme:'midnight',visualMigration:1}}).spec;
  assert.equal(legacy.RB.state.settings.theme,'midnight');
});
test('render includes decorated navigation and the Sheet importer',()=>{
  const {spec}=environment();
  spec.render();
  const markup=spec.RB.shadow.innerHTML;
  assert.match(markup,/rbe-header-crest/);
  assert.match(markup,/rbe-section-heading/);
  assert.match(markup,/rbe-nav-glyph/);
  assert.match(markup,/data-action="tab" data-value="Sheet"/);
  assert.match(markup,/rbe-hero-seal/);
  assert.match(markup,/Import character sheet/);
});
test('hotbar remains eight actionable accessible slots',()=>{
  const {spec}=environment();
  spec.RB.state.settings.showBar=true;
  const markup=spec.barUI();
  assert.equal((markup.match(/class="barslot /g)||[]).length,8);
  assert.match(markup,/data-index="0"/);
  assert.match(markup,/data-index="7"/);
  assert.match(markup,/aria-label="Quick slot 1:/);
  assert.match(markup,/rbe-slot-glyph/);
});
test('HUD displays tracked HP and concentration in decorated theme',()=>{
  const {spec}=environment();
  spec.RB.state.settings.showHud=true;
  assert.match(spec.hudUI(),/rbe-hud-name/);
  assert.match(spec.hudUI(),/10\/10 HP/);
});
test('all ten player tabs have themed readable headings',()=>{
  const {spec}=environment();
  for(const tab of ['Home','Sheet','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings']){
    const heading=spec.themeHeading(tab);
    assert.match(heading,/rbe-section-heading/);
    assert.match(heading,/<h2>[^<]+<\/h2>/);
  }
});
test('BG3 theme uses only original local styling, responsive and accessible',()=>{
  const css=environment().spec.BG3_STYLE;
  assert.match(css,/#rbe-panel/);
  assert.match(css,/#rbe-tabs/);
  assert.match(css,/#rbe-bar/);
  assert.match(css,/#rbe-hud/);
  assert.match(css,/#rbe-palette/);
  assert.match(css,/@media\(max-width:680px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/:focus-visible/);
  assert.doesNotMatch(css,/@import|url\(/i);
});
test('changing back to a classic theme removes decorated markup',()=>{
  const {spec}=environment();
  spec.RB.state.settings.theme='midnight';
  spec.render();
  const markup=spec.RB.shadow.innerHTML;
  assert.doesNotMatch(markup,/class="rbe-nav-glyph"/);
  assert.doesNotMatch(markup,/class="rbe-hero-seal"/);
  assert.match(spec.settingsUI(),/value="midnight" selected/);
});
