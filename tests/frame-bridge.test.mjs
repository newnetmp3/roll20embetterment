import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {fullRuntimeSource} from './_runtime.mjs';
const script=fullRuntimeSource();
function harness(){
  const storage=new Map(),events={};
  const window={parent:{},addEventListener(type,fn){events[type]=fn}};
  const document={querySelectorAll(){return []}};
  const context={window,document,location:{hostname:'other.example',pathname:'/test',href:'https://other.example/test',search:''},
    URL,URLSearchParams,crypto,console,Date,Math,setTimeout(){return 1},clearTimeout(){},setInterval(){},
    localStorage:{getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,v)}}
  };
  vm.createContext(context);
  vm.runInContext(script+'\nload(); globalThis.h={RB,findSheetForms,requestBeaconFrame,onBeaconFrameMessage,beaconFrameSnapshot,beaconFrameReadRequest,isBeaconSheetDocument,isBeaconFrame,isBeaconPopout,isRoll20Editor,beaconPopoutCandidates,beaconRemoteCandidate,requestBeaconAction,beaconFindRollButton,beaconInvokeRollRef,executeOfficialSheetRoll};',context);
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
  await assert.rejects(h.requestBeaconFrame({frame:f.frame}),/Unrecognized character sheet iframe origin/);
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

test('official CDN-backed D&D 2024 popout URL is recognized as a sheet document',()=>{
  const {h,context}=harness();
  context.location.hostname='advanced-sheets.production.roll20preflight.net';
  context.location.pathname='/https://storage.googleapis.com/roll20-cdn/advanced-sheets-production-9b1f7af9/dnd2024byroll20/sheet';
  context.window.parent=context.window;
  assert.equal(h.isBeaconSheetDocument(),true);
  assert.equal(h.isBeaconPopout(),true);
  assert.equal(h.isBeaconFrame(),false);
});
test('authenticated popout ready message registers a generic character candidate',()=>{
  const {h}=harness(),sent=[];
  const source={closed:false,postMessage(data,origin){sent.push({data,origin})}};
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',source,
    data:{bridge:'roll20-embetterment:beacon-sheet:v1',type:'ready',mode:'popout',
      session:'sheet-session-123',name:'Aria Moonfall'}});
  const popouts=h.beaconPopoutCandidates();
  assert.equal(popouts.length,1);
  assert.equal(popouts[0].name,'Aria Moonfall');
  assert.equal(popouts[0].kind,'D&D 2024 official sheet popout');
  assert.equal(popouts[0].popoutWindow,source);
  assert.equal(h.beaconRemoteCandidate(popouts[0]),true);
  assert.ok(h.RB.openSheets.some(x=>x.id===popouts[0].id));
  assert.equal(sent[0].origin,'https://advanced-sheets.production.roll20preflight.net');
  assert.equal(sent[0].data.type,'ack');
});
test('foreign origin cannot register a fake official sheet popout',()=>{
  const {h}=harness(),source={closed:false,postMessage(){}};
  h.onBeaconFrameMessage({origin:'https://evil.example',source,
    data:{bridge:'roll20-embetterment:beacon-sheet:v1',type:'ready',mode:'popout',
      session:'sheet-session-evil',name:'Aria Moonfall'}});
  assert.equal(h.beaconPopoutCandidates().length,0);
});
test('registered popout can answer the same read-only snapshot requests as an iframe',async()=>{
  const {h}=harness(),sent=[];
  const source={closed:false,postMessage(data,origin){sent.push({data,origin})}};
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',source,
    data:{bridge:'roll20-embetterment:beacon-sheet:v1',type:'ready',mode:'popout',
      session:'sheet-session-456',name:'Captain Rowan'}});
  const candidate=h.beaconPopoutCandidates()[0];
  const before=sent.length;
  const promise=h.requestBeaconFrame(candidate,true);
  const request=sent.slice(before).find(x=>x.data.type==='scan');
  assert.ok(request);
  assert.equal(request.origin,'https://advanced-sheets.production.roll20preflight.net');
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',source,
    data:{bridge:request.data.bridge,type:'snapshot',id:request.data.id,
      fields:{hp:{current:'31',max:'42'}},
      visible:{name:'Captain Rowan',stats:{hp:31,maxHp:42},abilityScores:{},abilityMods:{},
        saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},details:{},
        attacks:[],resources:[],coverage:{visibleFields:1,sections:['Combat'],names:['HP']}},
      tabs:['Combat','Spells','Inventory','Features & Traits','Notes','About']}});
  const scan=await promise;
  assert.equal(scan.fields.hp.current,'31');
  assert.deepEqual(Array.from(scan.tabs),['Combat','Spells','Inventory','Features & Traits','Notes','About']);
  assert.equal(h.beaconFrameSnapshot(candidate,scan),true);
  const profile=h.RB.state.profiles.find(p=>p.id===h.RB.state.current);
  assert.equal(profile.name,'Captain Rowan');
  assert.equal(profile.stats.hp,31);
  assert.equal(profile.stats.maxHp,42);
});

test('editor sends native sheet roll invocation only to the authenticated official sheet window',async()=>{
  const {h}=harness(),f=sheetFixture();
  h.RB.openSheets=h.findSheetForms(f.doc);
  const candidate=h.RB.openSheets[0],ref={id:'sheetroll:handaxe',kind:'attack',name:'Handaxe',action:'attack',tab:'Combat'};
  const promise=h.requestBeaconAction(candidate,ref);
  const request=f.sent.at(-1);
  assert.equal(request.origin,'https://advanced-sheets.production.roll20preflight.net');
  assert.equal(request.data.type,'invoke');
  assert.equal(request.data.ref.name,'Handaxe');
  h.onBeaconFrameMessage({origin:'https://evil.example',source:f.frame.contentWindow,
    data:{bridge:request.data.bridge,type:'invokeResult',id:request.data.id,ok:true}});
  let settled=false;promise.then(()=>settled=true);
  await Promise.resolve();assert.equal(settled,false);
  h.onBeaconFrameMessage({origin:'https://advanced-sheets.production.roll20preflight.net',source:f.frame.contentWindow,
    data:{bridge:request.data.bridge,type:'invokeResult',id:request.data.id,ok:true}});
  assert.equal(await promise,true);
});
test('official sheet reader resolves the actual Handaxe attack button semantically and clicks it',async()=>{
  const {h,context}=harness(),clicks=[];
  const hit={disabled:false,click(){clicks.push('attack')}},damage={disabled:false,click(){clicks.push('damage')}};
  const title={innerText:'Handaxe',textContent:'Handaxe'};
  const card={querySelector(selector){
    if(selector==='.span--item-row-title')return title;
    if(selector==='.poly-button--hit-dc button')return hit;
    if(selector==='.poly-button--damage button')return damage;
    return null;
  }};
  context.document.querySelectorAll=selector=>selector==='.attack-item'?[card]:[];
  context.document.querySelector=()=>null;
  const attackRef={kind:'attack',name:'Handaxe',action:'attack',tab:'Combat'};
  const damageRef={kind:'attack',name:'Handaxe',action:'damage',tab:'Combat'};
  assert.equal(h.beaconFindRollButton(attackRef),hit);
  assert.equal(h.beaconFindRollButton(damageRef),damage);
  assert.equal(await h.beaconInvokeRollRef(attackRef),true);
  assert.equal(await h.beaconInvokeRollRef(damageRef),true);
  assert.deepEqual(clicks,['attack','damage']);
});
test('sheet reader supports skill ability save initiative spell and healing roll locators',()=>{
  const {h,context}=harness();
  const btn=name=>({name,disabled:false,click(){}});
  const skillButton=btn('skill'),abilityButton=btn('ability'),saveButton=btn('save'),initiativeButton=btn('initiative');
  const spellAttack=btn('spellAttack'),spellDamage=btn('spellDamage'),heal=btn('heal');
  const skill={innerText:'Acrobatics',textContent:'Acrobatics'};
  const ability={innerText:'STR 18 +4 +7',textContent:'STR 18 +4 +7',querySelector(sel){
    return sel==='.poly-button--ability button'?abilityButton:
      sel==='.poly-button--compact-saving-throw button'?saveButton:null;
  }};
  const spell={querySelector(sel){
    if(sel==='.spell-item__name.span--item-row-title')return {innerText:'Fire Bolt',textContent:'Fire Bolt'};
    if(sel==='.poly-button--hit-dc button')return spellAttack;
    if(sel==='.poly-button--damage button')return spellDamage;
    return null;
  }};
  const action={querySelector(sel){
    if(sel==='.action-item__name')return {innerText:'Second Wind',textContent:'Second Wind'};
    if(sel==='.poly-button--healing button')return heal;
    return null;
  }};
  context.document.querySelectorAll=selector=>{
    if(selector==='.skill button.skill__name')return [skill];
    if(selector==='.inline-ability')return [ability];
    if(selector==='.spell-item')return [spell];
    if(selector==='.action-item')return [action];
    return [];
  };
  context.document.querySelector=selector=>selector==='.initiative-btn button'?initiativeButton:null;
  assert.equal(h.beaconFindRollButton({kind:'skill',name:'Acrobatics',action:'skill'}),skill);
  assert.equal(h.beaconFindRollButton({kind:'ability',name:'STR',action:'ability'}),abilityButton);
  assert.equal(h.beaconFindRollButton({kind:'save',name:'STR',action:'save'}),saveButton);
  assert.equal(h.beaconFindRollButton({kind:'initiative',name:'Initiative',action:'initiative'}),initiativeButton);
  assert.equal(h.beaconFindRollButton({kind:'spell',name:'Fire Bolt',action:'attack'}),spellAttack);
  assert.equal(h.beaconFindRollButton({kind:'spell',name:'Fire Bolt',action:'damage'}),spellDamage);
  assert.equal(h.beaconFindRollButton({kind:'action',name:'Second Wind',action:'healing'}),heal);
});
test('invalid or fabricated sheet roll references are never executed',async()=>{
  const {h}=harness();
  assert.equal(h.beaconFindRollButton({kind:'javascript',name:'x',action:'eval'}),null);
  assert.equal(await h.beaconInvokeRollRef({kind:'attack',name:'',action:'attack'}),false);
});

test('generic Roll-labeled controls resolve by exact accessible label only',()=>{
  const {h,context}=harness();
  const hitDie={getAttribute(name){return name==='aria-label'?'Roll a d10 hit die for Fighter':null},disabled:false,click(){}};
  const rest={getAttribute(name){return name==='aria-label'?'Short Rest':null},disabled:false,click(){}};
  context.document.querySelectorAll=selector=>selector==='button[aria-label]'?[hitDie,rest]:[];
  context.document.querySelector=()=>null;
  assert.equal(h.beaconFindRollButton({kind:'generic',name:'D10 (Fighter)',action:'roll',
    ariaLabel:'Roll a d10 hit die for Fighter'}),hitDie);
  assert.equal(h.beaconFindRollButton({kind:'generic',name:'Short Rest',action:'roll',
    ariaLabel:'Short Rest'}),null);
});
