import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const modules=['00_core.js','10_roll20_bridge.js','14_beacon_dom.js','15_sheet_link.js','16_beacon_visible.js','17_frame_bridge.js','19_radial_hud.js','20_ui.js','25_bg3_theme.js','30_events.js'];
const script=modules.map(name=>readFileSync(join(root,'src',name),'utf8')).join('\n');
function harness(){
  const storage=new Map(),events={};
  const window={parent:{},addEventListener(type,fn){events[type]=fn}};
  const document={querySelectorAll(){return []}};
  const context={window,document,location:{hostname:'other.example',pathname:'/test',href:'https://other.example/test',search:''},
    URL,URLSearchParams,crypto,console,Date,Math,setTimeout(){return 1},clearTimeout(){},setInterval(){},
    localStorage:{getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,v)}}
  };
  vm.createContext(context);
  vm.runInContext(script+'\nload(); globalThis.h={RB,findSheetForms,requestBeaconFrame,onBeaconFrameMessage,beaconFrameSnapshot,beaconFrameReadRequest,isBeaconFrame,isRoll20Editor};',context);
  return {h:context.h,events,context};
}
function sheetFixture(){
  const sent=[];
  const frame={src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/?padrino_env=production',
    contentWindow:{postMessage(data,origin){sent.push({data,origin})}},
    getAttribute(k){return k==='title'?'Character sheet for Nier':k==='name'?'iframe_abc':null}
  };
  const dialog={querySelector(q){
    if(q.startsWith('iframe#advanced-charsheet'))return frame;
    if(q==='.asv__header__name')return {textContent:'Nier'};
    if(q==='#advanced-printsheet')return {getAttribute(){return 'char-id'}};
    return null;
  },querySelectorAll(){return []},closest(){return null},contains(){return false},isConnected:true};
  const doc={querySelectorAll(q){
    if(q==='.characterdialog')return [dialog];
    if(q.includes('form.charsheet'))return [dialog];
    return [];
  }};
  return {frame,dialog,doc,sent};
}
test('real Jumpgate dialog uses its .asv__header__name, not its pencil icon',()=>{
  const {h}=harness(),f=sheetFixture();
  const candidates=h.findSheetForms(f.doc);
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].name,'Nier');
  assert.equal(candidates[0].id,'char-id');
  assert.equal(candidates[0].frame,f.frame);
});
test('same-origin page has no permission to impersonate an open iframe',async()=>{
  const {h}=harness(),f=sheetFixture();
  h.RB.openSheets=h.findSheetForms(f.doc);
  const candidate=h.RB.openSheets[0];
  const promise=h.requestBeaconFrame(candidate,true);
  assert.equal(f.sent.length,1);
  assert.equal(f.sent[0].origin,'https://advanced-sheets.production.roll20preflight.net');
  assert.equal(f.sent[0].data.deep,true);
  const request=f.sent[0].data;
  h.onBeaconFrameMessage({origin:'https://evil.example',source:f.frame.contentWindow,
    data:{bridge:request.bridge,type:'snapshot',id:request.id,fields:{hp:'999'}}});
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',source:{},
    data:{bridge:request.bridge,type:'snapshot',id:request.id,fields:{hp:'999'}}});
  let done=false;promise.then(()=>done=true);
  await Promise.resolve();assert.equal(done,false);
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',
    source:f.frame.contentWindow,data:{bridge:request.bridge,type:'snapshot',id:request.id,
      fields:{hp:{current:'84',max:'84'},wisdom:'15',wisdom_mod:'2'},
      visible:{name:'NIER',stats:{hp:84,maxHp:84},abilityScores:{wis:15},abilityMods:{wis:2},
        saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},details:{},
        attacks:[],resources:[],coverage:{visibleFields:2,sections:['Combat'],names:['HP','WIS']}}}});
  const scan=await promise;
  assert.equal(scan.fields.hp.current,'84');
  assert.equal(h.beaconFrameSnapshot(candidate,scan),true);
  const profile=h.RB.state.profiles.find(p=>p.id===h.RB.state.current);
  assert.equal(profile.name,'Nier');
  assert.equal(profile.stats.hp,84);
  assert.equal(profile.stats.maxHp,84);
  assert.equal(profile.abilityScores.wis,15);
});
test('bridge rejects foreign iframe origins before posting messages',async()=>{
  const {h}=harness(),f=sheetFixture();
  f.frame.src='https://evil.example/dnd2024byroll20/';
  await assert.rejects(h.requestBeaconFrame({frame:f.frame}),/Unrecognized sheet origin/);
  assert.equal(f.sent.length,0);
});
test('child reader ignores cross-origin messages not sent by app.roll20.net',async()=>{
  const {h,context}=harness();
  const parent={};
  context.window.parent=parent;
  await h.beaconFrameReadRequest({origin:'https://evil.example',source:parent,
    data:{bridge:'roll20-embetterment:beacon-sheet:v1',type:'scan',id:'req',deep:false}});
});
test('erroneously imported pencil name is corrected using actual character window name',()=>{
  const {h}=harness(),f=sheetFixture();
  h.RB.openSheets=h.findSheetForms(f.doc);
  const profile=h.RB.state.profiles.find(p=>p.id===h.RB.state.current);
  profile.name='pencil';
  const scan={fields:{hp:{current:'84',max:'84'}},
    visible:{name:'NIER',stats:{hp:84,maxHp:84},abilityScores:{},abilityMods:{},
      saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},details:{},
      attacks:[],resources:[],coverage:{visibleFields:1,sections:['Combat'],names:['HP']}}};
  assert.equal(h.beaconFrameSnapshot(h.RB.openSheets[0],scan),true);
  assert.equal(profile.name,'Nier');
});
