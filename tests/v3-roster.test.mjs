import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
function fixture(gm=false){
  const models=[
    {id:'npc-one',get(k){return {name:'Example NPC',npc:1,controlledby:''}[k];}},
    {id:'pc-two',get(k){return {name:'Example Player',npc:0,controlledby:'player-1'}[k];}},
    {id:'secret-three',get(k){return {name:'Not in Journal',npc:1,controlledby:''}[k];}}
  ];
  const modelId=id=>models.find(m=>m.id===id)||null;
  const rows=[['npc-one','Example NPC'],['pc-two','Example Player']].map(([id,name])=>({
    getAttribute(k){return k==='data-itemid'?id:null;},
    querySelector(k){return k==='.dd-content .name .namecontainer'?{textContent:name}:null;}
  }));
  const journal={querySelectorAll(sel){
    assert.equal(sel,'li.journalitem.character[data-itemid]');
    return rows;
  }};
  const nodes=new Map();
  const elements={
    'r3-loading-strip':{hidden:false},
    'r3-loading-label':{textContent:''},
    'r3-loading-percentage':{textContent:''},
    'r3-loading-meter':{value:0},
    'r3-loading-details':{querySelector(){return {textContent:''};}},
    'r3-loading-errors':{
      textContent:'',rows:[],appendChild(el){this.rows.push(el.textContent);}
    }
  };
  for(const [k,v] of Object.entries(elements))nodes.set(k,v);
  const rootNode={getElementById(id){return nodes.get(id)||null;}};
  const ctx={
    window:{is_gm:gm},
    document:{querySelector(sel){return sel==='#journalfolderroot'?journal:null;},
      createElement(){return {textContent:''};}},
    R3_UI:{root:rootNode,busy:false,campaignKey:'roll20-embetterment-v3:demo'},
    R3_TOKEN:{snapshots:new Map()},
    R3_AUTO:{enabled:false,running:false,opening:false,lastFull:0},
    R3_NATIVE:{busy:false},
    R3_NATIVE_BG:{opening:null,characterId:'',dialog:null},
    Date,Math,Map,Set,Array,JSON,Number,String,RegExp,Error,Promise,
    setInterval(){return 1;},clearInterval(){},setTimeout(){return 1;},clearTimeout(){},
    r3String(v,n=120){return String(v??'').slice(0,n);},
    r3TokenCharacter:modelId,
    r3TokenModelGet(model,key){return model?.get?.(key);},
    r3TokenControls(m){return m?.get('controlledby')==='player-1';},
    r3InventoryPrune:s=>s,
    r3TokenSaveCache(){ctx.saves=(ctx.saves||0)+1;},
    r3SheetAllowsBackground(){return true;},
    r3AutoHasRecognizedData(s){return s?.schema===3;},
    r3DebugRefresh(){},r3DebugLog(){},
    r3AutoCandidate(){return null;},
    r3NativeIsOwned(){return true;},
    r3AutoId(c){return c.id;}
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root,'v3/24_roster.js'),'utf8')+'\n'+
    readFileSync(join(root,'v3/24_progress.js'),'utf8'),ctx);
  return {ctx,rows,models,nodes,journal,api:{
    discover:()=>vm.runInContext('r3RosterDiscover()',ctx),
    prewarm:()=>vm.runInContext('r3RosterPrewarm()',ctx),
    state:()=>vm.runInContext('r3ProgressState()',ctx),
    refresh:()=>vm.runInContext('r3ProgressRefresh()',ctx),
    reset:()=>vm.runInContext('r3RosterReset()',ctx),
    roster:vm.runInContext('R3_ROSTER',ctx)
  }};
}
test('GM Journal registry includes all named exact-ID characters but not unrelated model records',()=>{
  const h=fixture(true);h.api.discover();
  assert.deepEqual([...h.api.roster.entries.keys()],['npc-one','pc-two']);
  assert.equal(h.api.roster.entries.get('npc-one').kind,'NPC');
  assert.equal(h.api.roster.entries.get('pc-two').kind,'PC');
  assert.equal(h.api.roster.source,'dm-journal');
});
test('Player registry cannot enumerate DM-only NPCs or hidden Journal-only character names',()=>{
  const h=fixture(false);h.api.discover();
  assert.deepEqual([...h.api.roster.entries.keys()],['pc-two']);
  assert.equal(h.api.roster.source,'controlled-journal');
  assert.equal(h.api.roster.entries.has('secret-three'),false);
  assert.equal(vm.runInContext('r3RosterIsGm()',h.ctx),false);
  h.ctx.window.is_gm='true';
  assert.equal(vm.runInContext('r3RosterIsGm()',h.ctx),false,
    'a truthy string is not verified GM role');
});
test('top progress represents real sheet and tab counts, auto-hides only at error-free 100%',()=>{
  const h=fixture(true);h.api.discover();
  const e=h.api.roster.entries.get('npc-one');
  h.api.roster.tabProgress.set('npc-one',{total:3,done:2});
  h.api.refresh();
  assert.equal(h.nodes.get('r3-loading-percentage').textContent,'33%');
  assert.equal(h.nodes.get('r3-loading-strip').hidden,false);
  e.complete=true;h.api.roster.tabProgress.set('npc-one',{total:3,done:3});
  h.api.roster.entries.get('pc-two').complete=true;
  h.api.refresh();
  assert.equal(h.nodes.get('r3-loading-percentage').textContent,'100%');
  assert.equal(h.nodes.get('r3-loading-strip').hidden,true);
  h.api.roster.errors.set('npc-one','Example NPC: reader not available');
  h.api.refresh();
  assert.equal(h.nodes.get('r3-loading-strip').hidden,false);
  assert.ok(h.nodes.get('r3-loading-errors').rows.some(x=>x.includes('reader not available')));
  h.api.roster.errors.clear();h.api.refresh();
  assert.equal(h.nodes.get('r3-loading-strip').hidden,true);
});
test('prewarm serially reads and caches only exact-ID authorized official sheet',async()=>{
  const h=fixture(true);h.api.discover();
  h.api.roster.active=true;
  const opened=[];
  h.ctx.r3NativeBgEnsure=async(name,request)=>{
    opened.push([name,request.id]);
    h.ctx.R3_NATIVE_BG.characterId=request.id;
    return {id:request.id,window:{},visible:true,type:'iframe'};
  };
  h.ctx.r3SendScan=async(candidate,mode,onProgress)=>{
    assert.equal(mode,'all');
    onProgress(null,'Planning',{totalTabs:3,completedTabs:0});
    onProgress(null,'Combat',{totalTabs:3,completedTabs:1});
    onProgress(null,'Inventory',{totalTabs:3,completedTabs:2});
    onProgress(null,'Spells',{totalTabs:3,completedTabs:3});
    return {schema:3,name:opened.at(-1)[0],stats:{hp:25}};
  };
  vm.runInContext('r3RosterCloseOwned=function(){R3_NATIVE_BG.characterId="";return true;}',h.ctx);
  assert.equal(await h.api.prewarm(),true);
  assert.equal(h.api.roster.entries.get('npc-one').complete,true);
  assert.equal(h.ctx.R3_TOKEN.snapshots.get('npc-one').snapshot.stats.hp,25);
  assert.equal(h.api.roster.tabProgress.get('npc-one').total,3);
  assert.equal(h.ctx.saves,1);
  assert.equal(opened.length,1);
});
test('failed prewarm keeps details and does not mark a sheet complete',async()=>{
  const h=fixture(true);h.api.discover();h.api.roster.active=true;
  h.ctx.r3NativeBgEnsure=async()=>{throw new Error('No verified Roll20 opener');};
  assert.equal(await h.api.prewarm(),false);
  assert.equal(h.api.roster.entries.get('npc-one').complete,false);
  assert.ok(h.api.roster.errors.get('npc-one').includes('No verified Roll20 opener'));
  assert.equal(h.api.state().complete,false);
  h.api.reset();
  assert.equal(h.api.roster.errors.size,0);
  assert.equal(h.api.roster.entries.size,0);
});
