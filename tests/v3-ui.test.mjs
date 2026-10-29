import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(x=>/^\d{2}_.*\.js$/.test(x)&&x!=='30_boot.js').sort();
function panelHarness(character='NIER'){
  const nodes=new Map(),windowListeners=new Map(),sent=[],intervals=[],timeouts=new Map();
  const makeNode=id=>{
    const node={id,textContent:'',innerHTML:'',value:'',scrollTop:0,style:{},disabled:false,handlers:new Map(),
      addEventListener(type,fn){this.handlers.set(type,fn);}};
    if(id==='r3-hud'){
      let markup='';node.writes=0;
      Object.defineProperty(node,'innerHTML',{get(){return markup;},set(value){
        markup=value;node.writes++;
        // HUD controls are rendered inside this nested container, not
        // during the initial shadow root innerHTML assignment.
        for(const [,childId] of markup.matchAll(/id="([^"]+)"/g))
          nodes.set(childId,makeNode(childId));
      }});
    }
    if(id==='r3-results'){
      let markup='',scroller=null;
      node.writes=0;
      Object.defineProperty(node,'innerHTML',{get(){return markup;},set(value){
        markup=value;node.writes++;
        const entries=[...markup.matchAll(/data-entry-key="([^"]+)"/g)].map(([,key])=>({
          key,open:false,getAttribute(name){return name==='data-entry-key'?key:null;}
        }));
        scroller=markup.includes('class="results"')?{scrollTop:0,entries,querySelectorAll(selector){
          if(selector==='details.entry[open]')return entries.filter(x=>x.open);
          return selector==='details.entry'?entries:[];
        }}:null;
      }});
      node.querySelector=selector=>selector==='.results'?scroller:null;
    }
    return node;
  };
  const shadow={
    handlers:new Map(),nodes,
    getElementById(id){return nodes.get(id)||null;},
    addEventListener(type,fn){this.handlers.set(type,fn);},
    set innerHTML(markup){
      for(const [,id] of markup.matchAll(/id="([^"]+)"/g))nodes.set(id,makeNode(id));
    }
  };
  const frameWindow={postMessage(message,origin){sent.push({message,origin});}};
  const frame={src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/test',
    getClientRects(){return [{}]},getAttribute(key){return key==='title'?character:null;},
    closest(){return null},contentWindow:frameWindow};
  const body={appendChild(host){document.host=host;}};
  const document={
    body,host:null,getElementById(id){return this.host?.id===id?this.host:null;},
    createElement(tag){return {id:'',style:{},attachShadow(){return shadow;}};},
    querySelectorAll(sel){return sel==='iframe'?[frame]:[];}
  };
  const store=new Map();
  const context={console,crypto,Date,Math,Number,String,Array,URL,URLSearchParams,Blob,
    document,location:{origin:'https://app.roll20.net',pathname:'/editor/123',search:'?id=123'},
    window:{addEventListener(type,fn){windowListeners.set(type,fn);}},
    setInterval(fn,ms){intervals.push(ms);return intervals.length;},clearInterval(){},
    setTimeout(fn,ms){const id=timeouts.size+1;timeouts.set(id,{fn,ms});return id;},clearTimeout(id){timeouts.delete(id);},
    localStorage:{getItem(key){return store.get(key)||null;},
      setItem(key,value){store.set(key,value);},removeItem(key){store.delete(key);}}
  };
  vm.createContext(context);
  vm.runInContext(files.map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n')+
    '\nglobalThis.uiApi={r3StartUI,r3StartEditorBridge,r3Empty,r3Coverage,R3_UI,R3_AUTO,r3AutoTick,r3AutoStoreSnapshot,r3AutoCombine,r3AutoSignature,r3Candidates,r3ToggleAuto,r3AutoMoveOffscreen,r3AutoHealthTick,r3AutoStoreHealth,r3AutoCandidate,r3StartAuto,r3SendScan,r3AutoQueueDirty,R3_HUD,r3HudEntries,r3HudAttackCatalog,r3HudWeaponToggle,r3HudAttackMenu,r3HudMarkup,r3HudRender,r3HudHp,r3HudSave,r3HudStyles,r3HudPortraitUrl,r3HudLoad,R3_NATIVE,r3NativeCandidate,r3NativeProbe,r3NativeConfirm,r3NativeChatCommand,r3NativeChatAttack,r3NativeMappedAbility,r3NativeMappedPreview,r3NativeMappedAttack,R3_NATIVE_CATEGORIES,r3NativeMapSource,r3NativeMapAbility,r3NativeMapPreview,r3NativeInvoke,R3_TOKEN,r3TokenPoll,r3TokenRecordSnapshot,r3TokenSwitch,r3TokenLinkedInfo,r3StartTokenWatch,R3_NATIVE_BG,r3NativeBgEnsure,r3NativeBgCandidate,r3NativeIsOwned,r3NativeBgResolve,r3NativeBgReveal,r3TokenPlayerId,r3TokenControls};',context);
  function click(id){const el=nodes.get(id);assert.ok(el,'Unknown control '+id);shadow.handlers.get('click')({target:el});}
  function respond(snapshot,type='result'){
    const msg=sent.at(-1).message;
    windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:frameWindow,
      data:{protocol:'r20eb:import:v3',type,id:msg.id,snapshot,error:'Simulated sheet failure'}
    });
  }
  return {context,api:context.uiApi,nodes,shadow,document,sent,store,intervals,timeouts,windowListeners,frame,frameWindow,click,respond};
}
function dmDialogRig(name='Example Level Seven Mage',id='-P5ExampleSheetABC123'){
  const h=panelHarness('Character sheet for '+name);
  const dialog={
    getAttribute(k){return k==='data-characterid'?id:null;},
    querySelector(sel){return sel==='.asv__header__name'?{textContent:name}:null;}
  };
  h.frame.closest=selector=>
    /\.characterdialog/.test(selector)?dialog:null;
  // Exact observed Roll20 HTML structure:
  // iframe#advanced-charsheet-dialog__charsheet inside
  // .characterdialog[data-characterid] with .asv__header__name,
  // no requirement for window.Campaign.characters.models.
  h.frame.id='advanced-charsheet-dialog__charsheet';
  return {h,dialog};
}
test('DM-opened Roll20 2024 dialog imports its PC without hydrated Campaign characters',async()=>{
  const {h}=dmDialogRig();
  const old=h.api.r3Empty();old.name='Nier';old.stats.hp=84;
  h.store.set('roll20-embetterment-v3:123',JSON.stringify({schema:3,snapshot:old}));
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  assert.equal(h.api.R3_UI.snapshot,null,'do not show stored Nier before verifying active sheet');
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active,null,'manual DM sheet must not forge controlled token');
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'-P5ExampleSheetABC123');
  assert.equal(h.api.R3_UI.snapshot.name,'Example Level Seven Mage');
  assert.equal(h.api.R3_AUTO.origin,'visible');
  assert.equal(h.api.R3_AUTO.characterId,'-P5ExampleSheetABC123');
  assert.equal(h.sent.length,1,'auto-read the already open official sheet');
  assert.equal(h.sent[0].message.mode,'current','never navigate manually opened sheet tabs');
  const sheet=h.api.r3Empty();sheet.name='Example Level Seven Mage';
  sheet.stats.hp=42;sheet.stats.maxHp=42;sheet.stats.ac=16;
  h.respond(h.api.r3Coverage(sheet));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.api.R3_UI.snapshot.stats.hp,42);
  assert.equal(h.api.R3_UI.snapshot.stats.ac,16);
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/Nier/);
  assert.equal(h.api.R3_TOKEN.active,null,'reading a DM sheet confers no map-token authority');
});
test('open DM sheet wins over stale selected-character display without pretending token control',()=>{
  const {h}=dmDialogRig();
  h.api.r3StartUI();
  h.api.R3_TOKEN.active={tokenId:'old-token',characterId:'old-nier',name:'Nier'};
  const old=h.api.r3Empty();old.name='Nier';h.api.R3_UI.snapshot=old;
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active,null);
  assert.equal(h.api.R3_UI.snapshot.name,'Example Level Seven Mage');
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot.name,'Example Level Seven Mage');
});
test('a DM sheet without a character dialog ID cannot invent a current character',()=>{
  const {h}=dmDialogRig('Example Level Seven Mage','');
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'');
  assert.equal(h.api.R3_UI.snapshot,null);
  assert.equal(h.api.R3_AUTO.enabled,false);
});
test('DM sheet with contradictory official title and header fails identity matching',()=>{
  const {h,dialog}=dmDialogRig();
  dialog.querySelector=sel=>sel==='.asv__header__name'?
    {textContent:'Another Player Character'}:null;
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'');
  assert.equal(h.api.R3_UI.snapshot,null);
});
test('closing DM dialog drops its snapshot and invalidates pending auto-reader',()=>{
  const {h}=dmDialogRig();
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.origin,'visible');
  h.frame.closest=()=>null;
  for(let i=0;i<4;i++)h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'');
  assert.equal(h.api.R3_UI.snapshot,null);
  assert.equal(h.api.R3_AUTO.enabled,false);
});
test('session modes are exclusive and a fresh controlled token wins over an unchanged DM dialog',()=>{
  const {h}=dmDialogRig('Example Level Seven Mage','-P5ExampleSheetABC123');
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(vm.runInContext('r3SessionMode()',h.context),'dm-sheet');
  assert.equal(vm.runInContext('r3SessionLabel()',h.context),'DM Sheet · Read-only');
  assert.equal(h.api.r3AutoCandidate()?.window,h.frameWindow);
  const tok={tokenId:'token-ally',characterId:'char-ally',name:'Ally',tokenImage:''};
  h.api.r3TokenSwitch(tok);
  assert.equal(vm.runInContext('r3SessionMode()',h.context),'player-character');
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active?.characterId,'char-ally',
    'unchanged open DM dialog must not steal focus from fresh player-token selection');
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'');
  assert.equal(h.api.R3_AUTO.origin,'token');
});
test('DM sync toggle stays on the current sheet rather than switching to manual private import',()=>{
  const {h}=dmDialogRig('Example Level Seven Mage','-P5ExampleSheetABC123');
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.origin,'visible');
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.enabled,false);
  assert.equal(h.api.R3_AUTO.origin,'visible');
  const wasSent=h.sent.length;
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.enabled,true);
  assert.equal(h.api.R3_AUTO.origin,'visible');
  assert.equal(h.api.R3_AUTO.characterId,'-P5ExampleSheetABC123');
  assert.equal(h.api.r3AutoCandidate()?.window,h.frameWindow);
  assert.ok(h.sent.length>=wasSent,'re-enable can retry only the visible official frame');
});
test('DM reader targets only current visible exact-ID dialog, not another sheet',()=>{
  const {h,dialog}=dmDialogRig('Example Level Seven Mage','-P5ExampleSheetABC123');
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.r3AutoCandidate()?.window,h.frameWindow);
  // A mismatched dialog ID cannot be used to publish another character,
  // even if an iframe happens to keep the same display name.
  dialog.getAttribute=()=>'-P5OtherSheetXYZ';
  assert.equal(h.api.r3AutoCandidate(),null);
});
test('new DM campaign never displays cached Nier until its identity is verified',()=>{
  const h=panelHarness('Elowen');
  const old=h.api.r3Empty();old.name='Nier';old.stats.hp=84;
  h.store.set('roll20-embetterment-v3:123',JSON.stringify({schema:3,snapshot:old}));
  const model={id:'char-elowen',get(k){return {name:'Elowen',controlledby:''}[k];}};
  h.context.window.Campaign={characters:{models:[model],get(){return null;}}};
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  assert.equal(h.api.R3_UI.snapshot,null,'saved Nier profile must not leak on startup');
  assert.match(h.nodes.get('r3-hud').innerHTML,/No character imported/);
  h.api.r3TokenPoll(); // No selected token; DM explicitly opened this sheet
  assert.equal(h.api.R3_TOKEN.active,null,'visible sheet is NOT forged into a controlled token');
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'char-elowen');
  assert.equal(h.api.R3_UI.snapshot.name,'Elowen');
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/Nier/);
  assert.equal(h.api.R3_AUTO.origin,'visible');
  assert.equal(h.api.R3_AUTO.characterId,'char-elowen');
  assert.equal(h.api.R3_AUTO.enabled,true);
});
test('DM generic frame title is resolved from the authenticated current-sheet reader',()=>{
  const h=panelHarness('2024 character sheet');
  const model={id:'char-new',get(k){return {name:'New Level 7 PC',controlledby:''}[k];}};
  h.context.window.Campaign={characters:{models:[model]}};
  h.api.r3StartUI();
  assert.equal(h.api.R3_UI.snapshot,null);
  h.api.R3_NATIVE.readers.set(h.frameWindow,{name:'New Level 7 PC',session:'current-reader'});
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot.name,'New Level 7 PC');
  assert.equal(h.api.R3_TOKEN.active,null,'DM sheet does not create fake token access');
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'char-new');
});
test('conflicting official reader name and iframe title cannot select a character',()=>{
  const h=panelHarness('Nier');
  h.context.window.Campaign={characters:{models:[
    {id:'c1',get(k){return k==='name'?'Nier':'';}},
    {id:'c2',get(k){return k==='name'?'New Level 7 PC':'';}}
  ]}};
  h.api.r3StartUI();
  h.api.R3_NATIVE.readers.set(h.frameWindow,{name:'New Level 7 PC',session:'session'});
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot,null,'contradictory sheet names must fail closed');
});
test('an ambiguous or unmatched DM character sheet cannot adopt an old saved identity',()=>{
  const h=panelHarness('Elowen');
  h.context.window.Campaign={characters:{models:[
    {id:'one',get(k){return k==='name'?'Elowen':'';}},
    {id:'two',get(k){return k==='name'?'Elowen':'';}}
  ]}};
  const saved=h.api.r3Empty();saved.name='Nier';saved.stats.hp=84;
  h.store.set('roll20-embetterment-v3:123',JSON.stringify({schema:3,snapshot:saved}));
  h.api.r3StartUI();h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot,null);
  assert.equal(h.api.R3_TOKEN.visibleSheetId,'');
  assert.equal(h.api.R3_AUTO.enabled,false,'do not trigger name-only sync with two matching PCs');
});
test('campaign navigation clears Nier in the same extension session',()=>{
  const h=panelHarness('Elowen');
  h.context.window.Campaign={characters:{models:[]}};
  h.api.r3StartUI();
  const old=h.api.r3Empty();old.name='Nier';old.stats.hp=84;
  h.api.R3_UI.snapshot=h.api.r3Coverage(old);
  h.api.R3_TOKEN.active={tokenId:'nier-token',characterId:'nier-char',name:'Nier'};
  h.api.R3_TOKEN.selectionIds=['nier-token'];
  h.api.R3_TOKEN.snapshots.set('nier-char',{name:'Nier',snapshot:old});
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='Nier';
  h.api.R3_AUTO.characterId='nier-char';h.api.R3_AUTO.origin='token';
  h.context.location.search='?id=456';
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot,null);
  assert.equal(h.api.R3_TOKEN.active,null);
  assert.equal(h.api.R3_TOKEN.snapshots.size,0);
  assert.equal(h.api.R3_AUTO.name,'');
  assert.equal(h.api.R3_UI.campaignKey,'roll20-embetterment-v3:456');
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/Nier/);
});
test('real importer panel initializes and both scan buttons become enabled when a sheet appears',()=>{
  const h=panelHarness();
  h.api.r3StartEditorBridge();
  assert.doesNotThrow(()=>h.api.r3StartUI());
  assert.ok(h.document.host);
  assert.equal(h.nodes.get('r3-toggle').textContent,'Show importer');
  assert.equal(h.nodes.get('r3-wrap').style.display,'none','debug importer is hidden by default');
  assert.match(h.nodes.get('r3-hud').innerHTML,/No character imported/);
  assert.equal(h.nodes.get('r3-choices').value,'iframe-0');
  assert.equal(h.nodes.get('r3-scan').disabled,false);
  assert.equal(h.nodes.get('r3-all').disabled,false);
});

test('cascade section changes require a click; pointer hover never dispatches',()=>{
  const h=panelHarness();h.api.r3StartUI();
  assert.equal(h.shadow.handlers.has('pointerover'),false,
    'hover must not synthesize click events to change cascade branches');
  assert.equal(h.api.R3_HUD.flyout,'');
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'spells'}}});
  assert.equal(h.api.R3_HUD.flyout,'spells','explicit click still opens the category');
});
test('Attack flyout requires no private-reader toggle or permission warning',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.api.R3_HUD.flyout='actions';
  h.api.r3HudRender();
  const markup=h.nodes.get('r3-hud').innerHTML;
  assert.doesNotMatch(markup,/Enable private sheet reader|Allow private reader/);
  assert.doesNotMatch(markup,/Private native-sheet readers are disabled/);
  assert.equal(h.nodes.has('r3-hud-native-allow-reader'),false);
});
test('Refresh and Hide/Show execute without leaving the panel in a broken state',()=>{
  const h=panelHarness();h.api.r3StartUI();
  h.click('r3-refresh');
  assert.equal(h.nodes.get('r3-choices').value,'iframe-0');
  h.click('r3-hud-debug');
  assert.equal(h.nodes.get('r3-content').style.display,'block');
  assert.equal(h.nodes.get('r3-wrap').style.display,'block');
  assert.equal(h.nodes.get('r3-toggle').textContent,'Hide importer');
  h.click('r3-toggle');
  assert.equal(h.nodes.get('r3-content').style.display,'none');
  assert.equal(h.nodes.get('r3-wrap').style.display,'none');
  assert.equal(h.nodes.get('r3-toggle').textContent,'Show importer');
});
test('click Read current tab sends a real scan request and displays returned stats',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.click('r3-scan');
  assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].message.type,'scan');
  assert.equal(h.sent[0].message.mode,'current');
  assert.equal(h.sent[0].origin,'https://advanced-sheets.production.roll20preflight.net');
  assert.match(h.nodes.get('r3-status').textContent,/Reading current sheet tab/);
  assert.equal(h.nodes.get('r3-scan').disabled,true);
  const data=h.api.r3Empty();data.name='NIER';data.stats.hp=82;data.stats.maxHp=84;data.abilities.str=18;
  h.respond(h.api.r3Coverage(data));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.get('r3-status').textContent,/Imported NIER/);
  assert.match(h.nodes.get('r3-results').innerHTML,/82/);
  assert.equal(h.nodes.get('r3-export').disabled,false);
  assert.equal(h.nodes.get('r3-scan').disabled,false);
  assert.ok([...h.store.keys()].some(k=>k.includes('roll20-embetterment-v3')));
});
test('Import all tabs sends all mode and exposes reader errors rather than silent nonresponse',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.click('r3-all');
  assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].message.mode,'all');
  h.respond(null,'failure');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(h.nodes.get('r3-status').textContent,/Import failed: Simulated sheet failure/);
  assert.equal(h.nodes.get('r3-all').disabled,false);
});
test('all UI control failures are surfaced in a visible status element',()=>{
  const h=panelHarness();h.api.r3StartUI();
  // A broken selector used to make every button appear inert; guard it visibly.
  h.shadow.getElementById=id=>{
    if(id==='r3-toggle')throw Error('Deliberate broken control');
    return h.nodes.get(id)||null;
  };
  h.click('r3-refresh');
  assert.match(h.nodes.get('r3-status').textContent,/Action failed: Deliberate broken control/);
});

test('focus and Refresh list preserve scroll, view and existing result DOM',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snapshot=h.api.r3Empty();snapshot.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.click('r3-refresh');
  const results=h.nodes.get('r3-results'),content=h.nodes.get('r3-content');
  assert.equal(results.writes,2);
  const list=results.querySelector('.results');
  assert.ok(list);
  list.scrollTop=317;content.scrollTop=88;
  h.click('r3-refresh');
  h.windowListeners.get('focus')();
  h.windowListeners.get('focus')();
  assert.equal(results.writes,2,'focus/refresh must not repaint results');
  assert.equal(results.querySelector('.results'),list);
  assert.equal(list.scrollTop,317);
  assert.equal(content.scrollTop,88);
});
test('category changes and explicit reimports restore scroll and expanded inventory',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const data=h.api.r3Empty();
  data.name='Nier';data.inventory=[{name:'Healing Potion',tab:'Inventory',visible:'2 bottles'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(data);
  h.click('r3-refresh');
  const view=name=>h.shadow.handlers.get('click')({target:{dataset:{view:name}}});
  view('inventory');
  const results=h.nodes.get('r3-results');
  const inventory=results.querySelector('.results');
  assert.equal(inventory.entries.length,1);
  inventory.scrollTop=239;inventory.entries[0].open=true;
  h.nodes.get('r3-content').scrollTop=65;
  view('summary');view('inventory');
  const returned=results.querySelector('.results');
  assert.equal(returned.scrollTop,239);
  assert.equal(returned.entries[0].open,true);
  assert.equal(h.nodes.get('r3-content').scrollTop,65);
  const updated=h.api.r3Empty();
  updated.name='Nier';updated.inventory=[{name:'Healing Potion',tab:'Inventory',visible:'3 bottles'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(updated);
  h.click('r3-refresh');
  const repainted=results.querySelector('.results');
  assert.equal(repainted.scrollTop,239);
  assert.equal(repainted.entries[0].open,true);
});

test('verified selected character auto-imports all tabs through a private reader without opening Journal',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const auto=h.api.R3_AUTO;
  auto.enabled=true;auto.name='NIER';auto.characterId='-verified-id';
  const frame=h.api.r3Candidates()[0].frame;
  const dialog={style:{position:'absolute',left:'40px',top:'50px'},
    getAttribute(key){return key==='data-characterid'?'-verified-id':null;}};
  frame.closest=selector=>selector.includes('characterdialog')?dialog:null;
  let opened=false,journalLookups=0;
  const originalQuery=h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll=selector=>{
    if(selector==='iframe')return opened?[frame]:[];
    if(selector.includes('#journal'))journalLookups++;
    return originalQuery(selector);
  };
  h.context.r3NativeBgResolve=name=>({id:'-verified-id',name,model:{}});
  h.context.r3NativeBgEnsure=async name=>{
    opened=true;
    Object.assign(h.api.R3_NATIVE_BG,{dialog,characterId:'-verified-id',name});
    return h.api.r3Candidates()[0];
  };
  const pending=h.api.r3AutoTick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(opened,true,'private reader opens from verified Roll20 character model');
  assert.equal(journalLookups,0,'Journal is not needed for a controlled character');
  assert.equal(h.sent.length,1,'Auto status: '+auto.lastError+'; candidate: '+
    String(h.api.r3AutoCandidate()?.name)+'; owned: '+
    String(h.api.R3_NATIVE_BG.dialog===dialog));
  assert.equal(h.sent[0].message.mode,'all','first background import traverses every mounted tab');
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=84;
  snap.inventory=[{name:'Rope',_key:'rope',quantity:1,tab:'Inventory'}];
  h.respond(h.api.r3Coverage(snap));await pending;
  assert.equal(h.api.R3_UI.snapshot.inventory[0].name,'Rope');
  assert.ok(auto.lastFull>0,'subsequent full scans are periodically scheduled');
});

test('opt-in auto-sync sends a real current-view request without manually clicking Import',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const previous=h.api.r3Empty();
  previous.name='NIER';previous.stats.hp=80;
  previous.inventory=[{name:'Dagger',tab:'INVENTORY',_key:'dagger||',visible:'Dagger Gear'}];
  previous.spells=[{name:'Druidcraft',tab:'SPELLS',_key:'druidcraft||',visible:'Druidcraft'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(previous);
  h.click('r3-refresh');
  h.click('r3-auto');
  assert.equal(h.api.R3_AUTO.enabled,true);
  assert.equal(h.nodes.get('r3-auto').textContent,'Auto-sync: On');
  assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].message.type,'scan');
  assert.equal(h.sent[0].message.mode,'current','a user-opened sheet is not navigated through tabs');
  const latest=h.api.r3Empty();latest.name='NIER';latest.stats.hp=82;latest.stats.maxHp=84;
  h.respond(h.api.r3Coverage(latest));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1,'current-only refresh preserves inventory');
  assert.equal(h.api.R3_UI.snapshot.spells.length,1,'current-only refresh preserves spell list');
  assert.ok([...h.store.keys()].some(k=>k.endsWith(':auto')),'opt-in is remembered for this game');
  h.click('r3-auto');
  assert.equal(h.api.R3_AUTO.enabled,false);
});
test('selected private sheet publishes verified attacks/resources before slow all-tab traversal completes',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const reader=await h.api.r3NativeBgEnsure('Elowen');
  h.api.R3_TOKEN.active={tokenId:'token-elf',name:'Elowen',characterId:'char-elf'};
  Object.assign(h.api.R3_AUTO,{enabled:true,origin:'token',
    name:'Elowen',characterId:'char-elf',lastFull:0,lastScan:0});
  let receive=null,finish=null;
  h.context.fastTestScan=(candidate,mode,onProgress)=>{
    assert.equal(candidate.window,reader.window);
    assert.equal(mode,'all');
    receive=onProgress;
    return new Promise(resolve=>{finish=resolve;});
  };
  vm.runInContext('r3SendScan = (...args)=>globalThis.fastTestScan(...args)',h.context);
  const work=h.api.r3AutoTick();
  assert.equal(h.api.R3_AUTO.running,true);
  assert.equal(typeof receive,'function');
  const combat=h.api.r3Empty();combat.name='Elowen';
  combat.attacks=[{name:'Dagger',_key:'dagger',tab:'Combat',
    visible:'Dagger +7 Attack 1d4+4',actions:[{label:'+7 Attack'}]}];
  receive(h.api.r3Coverage(combat),'Combat');
  assert.equal(h.api.R3_UI.snapshot.attacks.length,1,
    'Attack list appears before the background full scan returns');
  assert.equal(h.api.r3NativeMappedPreview('dagger').sheetAction,true);
  const part=h.api.r3Empty();part.name='Elowen';
  part.resources=[{name:'Second Wind',_key:'second-wind',
    visible:'Second Wind 1 / 3',tab:'Features & Traits'}];
  receive(h.api.r3Coverage(part),'Features & Traits');
  assert.equal(h.api.R3_UI.snapshot.resources.length,1);
  assert.equal(h.api.R3_UI.snapshot.attacks.length,1,
    'a new tab must not erase early verified attack mappings');
  const stale=h.api.r3Empty();stale.name='Different Hero';
  receive(h.api.r3Coverage(stale),'Spells');
  assert.equal(h.api.R3_UI.snapshot.name,'Elowen',
    'a different character cannot overwrite progressive mappings');
  const all=h.api.r3Empty();all.name='Elowen';
  all.attacks=combat.attacks;all.resources=part.resources;
  finish(h.api.r3Coverage(all));await work;
  assert.equal(h.api.R3_AUTO.running,false);
  assert.ok(h.api.R3_AUTO.lastFull>0);
  assert.equal(h.api.R3_UI.snapshot.attacks.length,1);
  assert.equal(h.api.R3_UI.snapshot.resources.length,1);
});
test('auto import fails closed when official character identity mismatches',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='Nier';prev.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.api.R3_AUTO.name='Nier';
  const other=h.api.r3Empty();other.name='Different Character';other.stats.hp=12;
  assert.throws(()=>h.api.r3AutoStoreSnapshot(h.api.r3Coverage(other),'all'),/identity did not match/);
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});
test('auto background importer locates exact journal character then moves only script-opened dialog',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const a=h.api.R3_AUTO;
  a.enabled=true;a.name='NIER';a.characterId='-my-character-id';
  const frame=h.api.r3Candidates()[0].frame;
  const dialog={style:{position:'absolute',left:'70px',top:'45px'},
    getAttribute(k){return k==='data-characterid'?'-my-character-id':null;}};
  // Without the journal entry/iframe target, open through the real journal.
  const originalQuery=h.document.querySelectorAll.bind(h.document);
  let opened=0,frameReady=false;
  const entry={getAttribute(k){return k==='data-characterid'?'-my-character-id':null;},
    dispatchEvent(e){opened++;assert.equal(e.type,'dblclick');}};
  h.context.MouseEvent=function(type,options){this.type=type;this.options=options;};
  h.document.querySelectorAll=selector=>{
    if(selector==='iframe')return frameReady?[frame]:[];
    if(selector.includes('#journal'))return [entry];
    return originalQuery(selector);
  };
  await h.api.r3AutoTick();
  assert.equal(opened,1);assert.equal(a.opened,true);
  frameReady=true;
  frame.closest=selector=>selector.includes('.characterdialog')?dialog:null;
  const promise=h.api.r3AutoTick();
  assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].message.mode,'all');
  assert.equal(dialog.style.left,'-20000px');
  a.openedAt=Date.now()-65000;
  assert.equal(h.api.r3AutoMoveOffscreen(h.api.r3Candidates()[0]),true,
    'an already owned offscreen dialog must survive beyond the initial opening window');
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  snap.inventory=[{name:'Dagger',tab:'INVENTORY',_key:'dagger||'}];
  h.respond(h.api.r3Coverage(snap));
  await promise;
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
  h.api.r3ToggleAuto();
  assert.equal(dialog.style.left,'70px','disabling restores the original dialog');
  assert.equal(dialog.style.top,'45px');
});
test('full automatic imports replace deleted spells rather than merging stale spell cards',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const first=h.api.r3Empty();first.name='Nier';
  first.stats.hp=82;
  first.spells=[{name:'Power Word Pain',_key:'old-spell'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(first);
  h.api.R3_AUTO.name='Nier';
  const next=h.api.r3Empty();next.name='Nier';next.stats.hp=82;
  next.spells=[{name:'Druidcraft',_key:'druidcraft'}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(next),'all');
  assert.deepEqual([...h.api.R3_UI.snapshot.spells.map(x=>x.name)],['Druidcraft']);
});

test('disable auto-sync before a pending scan responds leaves the stored profile unchanged',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const stored=h.api.r3Empty();stored.name='NIER';stored.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(stored);
  h.click('r3-auto');
  assert.equal(h.sent.length,1);
  assert.equal(h.nodes.get('r3-all').disabled,true,'manual scan is disabled while auto reading');
  h.click('r3-auto');
  assert.equal(h.api.R3_AUTO.enabled,false);
  const response=h.api.r3Empty();response.name='NIER';response.stats.hp=60;
  h.respond(h.api.r3Coverage(response));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82,'late response must not overwrite data after disable');
});
test('auto-sync status survives routine focus/refresh, without resetting results',async()=>{
  const h=panelHarness();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.R3_AUTO.lastError='Waiting for a matching journal entry';
  h.click('r3-refresh');
  assert.match(h.nodes.get('r3-auto-status').textContent,/Waiting for a matching journal entry/);
  h.windowListeners.get('focus')();
  assert.match(h.nodes.get('r3-auto-status').textContent,/Waiting for a matching journal entry/);
});


test('fast HP watch uses only hp scans, preserving spells, inventory and panel scroll',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const previous=h.api.r3Empty();previous.name='NIER';previous.stats.hp=82;previous.stats.maxHp=84;
  previous.spells=[{name:'Druidcraft',tab:'Spells',_key:'druidcraft'}];
  previous.inventory=[{name:'Healer kit',tab:'Inventory',_key:'healer'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(previous);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const pending=h.api.r3AutoHealthTick();
  assert.equal(h.sent.at(-1).message.mode,'hp');
  const hp=h.api.r3Empty();hp.name='NIER';hp.stats.hp=79;hp.stats.maxHp=84;
  h.respond(h.api.r3Coverage(hp));await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,79);
  assert.equal(h.api.R3_UI.snapshot.spells.length,1);
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
  const writes=h.nodes.get('r3-results').writes;
  const pending2=h.api.r3AutoHealthTick();
  h.respond(h.api.r3Coverage(hp));await pending2;
  assert.equal(h.nodes.get('r3-results').writes,writes,'unchanged HP avoids results repaint');
});
test('late HP watch responses after turning auto-sync off cannot overwrite data',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const current=h.api.r3Empty();current.name='NIER';current.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(current);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const pending=h.api.r3AutoHealthTick();
  h.api.r3ToggleAuto();
  const changed=h.api.r3Empty();changed.name='NIER';changed.stats.hp=3;
  h.respond(h.api.r3Coverage(changed));await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});
test('a conflicting official character ID cannot be rescued by identical name',()=>{
  const h=panelHarness();h.api.r3StartUI();
  h.api.R3_AUTO.name='NIER';h.api.R3_AUTO.characterId='expected-character';
  const frame=h.api.r3Candidates()[0].frame;
  frame.closest=selector=>selector.includes('.characterdialog')?
    {getAttribute:()=> 'different-character'}:null;
  assert.equal(h.api.r3AutoCandidate(),null);
  frame.closest=selector=>selector.includes('.characterdialog')?
    {getAttribute:()=> 'expected-character'}:null;
  assert.ok(h.api.r3AutoCandidate());
});
test('automatic scheduler samples HP each second without accelerating full tab imports',()=>{
  const h=panelHarness();h.api.r3StartUI();h.api.r3StartAuto();
  assert.ok(h.intervals.includes(1000));
  assert.ok(h.intervals.includes(3000),'resume paused private reads promptly');
});


test('scheduled full import is not starved by an in-flight fast HP request',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.R3_AUTO.healthRunning=true;
  const pending=h.api.r3AutoTick();
  assert.equal(h.sent.at(-1).message.mode,'current');
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  h.respond(h.api.r3Coverage(snap));await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});


function registerOfficialPopout(h,name='NIER',session='popout-sess-123'){
  const messages=[];
  const popup={closed:false,postMessage(message,origin){messages.push({message,origin});}};
  function announce(nextName=name){
    h.windowListeners.get('message')({origin:'https://advanced-sheets.production.roll20preflight.net',
      source:popup,data:{protocol:'r20eb:import:v3',type:'ready',mode:'popout',
        session,name:nextName}});
  }
  function reply(snapshot,type='result'){
    const request=messages.at(-1)?.message;
    assert.ok(request?.id,'popup must receive a scan request first');
    h.windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',source:popup,
      data:{protocol:'r20eb:import:v3',type,id:request.id,snapshot}});
  }
  announce();
  return {popup,messages,announce,reply};
}
test('automatically syncs fast HP directly from the official player popout',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats={hp:82,maxHp:84};
  prev.spells=[{name:'Druidcraft',_key:'druidcraft'}];
  prev.inventory=[{name:'Healer kit',_key:'healer'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  // Roll20 may leave an embedded iframe mounted as well: the player
  // popout takes precedence for live readings.
  const p=registerOfficialPopout(h);
  assert.equal(h.api.r3AutoCandidate().type,'popout');
  assert.match(h.nodes.get('r3-choices').innerHTML,/popout/);
  const tick=h.api.r3AutoHealthTick();
  assert.equal(p.messages.length,1);
  assert.equal(p.messages[0].message.mode,'hp');
  assert.equal(p.messages[0].origin,'https://advanced-sheets.production.roll20preflight.net');
  const next=h.api.r3Empty();next.name='NIER';next.stats={hp:76,maxHp:84};
  p.reply(h.api.r3Coverage(next));await tick;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,76);
  assert.equal(h.api.R3_UI.snapshot.spells.length,1);
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
});
test('popout current-tab auto import remains read-only and does not navigate player tabs',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const p=registerOfficialPopout(h);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const pending=h.api.r3AutoTick();
  assert.equal(p.messages.length,1);
  assert.equal(p.messages[0].message.mode,'current','player-owned popup must not receive all-tabs scan');
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=73;
  p.reply(h.api.r3Coverage(snap));await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,73);
  assert.match(h.nodes.get('r3-auto-status').textContent,/Popout sheet current import updated/);
  assert.equal(h.api.R3_AUTO.ownedDialog,null);
});
test('popout ready announcements refresh a late-loaded Vue character name',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const p=registerOfficialPopout(h,'Unnamed sheet');
  assert.equal(h.api.r3AutoCandidate().type,'iframe','unnamed popout must not override an exact iframe');
  p.announce('NIER');
  assert.equal(h.api.r3AutoCandidate().type,'popout');
  assert.match(h.nodes.get('r3-choices').innerHTML,/NIER \(popout\)/);
  p.announce('Unnamed sheet');
  assert.equal(h.api.r3AutoCandidate().type,'popout',
    'temporary Vue loading states must not erase a confirmed name');
});
test('closed popout is pruned and the next fresh popout can take over',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const first=registerOfficialPopout(h,'NIER','popup-one-session');
  assert.equal(h.api.r3AutoCandidate().window,first.popup);
  first.popup.closed=true;
  assert.equal(h.api.r3AutoCandidate().type,'iframe');
  assert.equal(h.api.r3Candidates().some(c=>c.type==='popout'),false);
  const second=registerOfficialPopout(h,'NIER','popup-two-session');
  assert.equal(h.api.r3AutoCandidate().window,second.popup);
});
test('invalid popout origin and ambiguous same-name popouts never become automatic reader',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const impostor={closed:false,postMessage(){}};
  h.windowListeners.get('message')({origin:'https://example.invalid',
    source:impostor,data:{protocol:'r20eb:import:v3',type:'ready',
      mode:'popout',session:'fake-popup-session',name:'NIER'}});
  assert.equal(h.api.r3Candidates().filter(c=>c.type==='popout').length,0);
  const first=registerOfficialPopout(h,'NIER','popup-aaa-session');
  const second=registerOfficialPopout(h,'NIER','popup-bbb-session');
  assert.equal(h.api.r3AutoCandidate(),null,'two popouts with identical names are ambiguous');
  second.popup.closed=true;
  assert.equal(h.api.r3AutoCandidate().window,first.popup);
});
test('stale popup scan response after window close is ignored',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const p=registerOfficialPopout(h);
  const pending=h.api.r3AutoHealthTick();
  p.popup.closed=true;
  const next=h.api.r3Empty();next.name='NIER';next.stats.hp=1;
  p.reply(h.api.r3Coverage(next));
  // The closed window is not an authenticated candidate; any late response
  // is ignored, then the request times out without applying stale health.
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
  const timeout=[...h.timeouts.values()].find(x=>x.ms===2500);
  assert.ok(timeout,'HP watch has a bounded timeout');
  timeout.fn();
  await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});


test('automatic Inventory-tab refresh works with no HP or other stat mounted',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.inventory=[{name:'Potion',_key:'potion',tab:'Inventory',visible:'Potion x1'}];
  prev.spells=[{name:'Druidcraft',_key:'druidcraft',tab:'Spells'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const pending=h.api.r3AutoTick();
  assert.equal(h.sent.at(-1).message.mode,'current');
  const live=h.api.r3Empty();live.name='NIER';
  live.inventory=[
    {name:'Potion',_key:'potion',tab:'Inventory',visible:'Potion x3'},
    {name:'Longbow',_key:'longbow',tab:'Inventory',visible:'Longbow'}
  ];
  h.respond(h.api.r3Coverage(live));await pending;
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
  assert.equal(h.api.R3_UI.snapshot.inventory.length,2);
  assert.equal(h.api.R3_UI.snapshot.inventory.find(x=>x.name==='Potion').visible,'Potion x3');
  assert.equal(h.api.R3_UI.snapshot.spells.length,1,'inventory refresh preserves off-tab spell list');
  assert.match(h.nodes.get('r3-auto-status').textContent,/current import updated/);
});
test('current auto-sync accepts visible feature/resource/skill and spell slot changes with zero stats',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=80;
  prev.skills.Athletics=3;prev.slots['1']={current:3,max:4};
  prev.resources=[{name:'Second Wind',_key:'second wind',observedValue:1}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.api.R3_AUTO.name='NIER';
  const partial=h.api.r3Empty();partial.name='NIER';
  partial.skills.Athletics=5;partial.slots['1']={current:2};
  partial.resources=[{name:'Second Wind',_key:'second wind',observedValue:0}];
  partial.features=[{name:'Action Surge',_key:'action surge'}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(partial),'current');
  assert.equal(h.api.R3_UI.snapshot.stats.hp,80);
  assert.equal(h.api.R3_UI.snapshot.skills.Athletics,5);
  assert.equal(h.api.R3_UI.snapshot.slots['1'].current,2);
  assert.equal(h.api.R3_UI.snapshot.slots['1'].max,4);
  assert.equal(h.api.R3_UI.snapshot.resources[0].observedValue,0);
  assert.equal(h.api.R3_UI.snapshot.features[0].name,'Action Surge');
});
test('statless all-tabs import may replace removed entries when recognized cards are present',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const first=h.api.r3Empty();first.name='NIER';first.stats.hp=82;
  first.spells=[{name:'Druidcraft',_key:'druidcraft'},{name:'Old Spell',_key:'old'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(first);h.api.R3_AUTO.name='NIER';
  const next=h.api.r3Empty();next.name='NIER';
  next.spells=[{name:'Detect Magic',_key:'detect magic'}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(next),'all');
  assert.deepEqual([...h.api.R3_UI.snapshot.spells.map(x=>x.name)],['Detect Magic']);
  assert.equal(h.api.R3_UI.snapshot.stats.hp,undefined,'all mode is authoritative');
});
test('empty, unrecognized and mismatched current views cannot erase a good full import',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.inventory=[{name:'Potion',_key:'potion'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);h.api.R3_AUTO.name='NIER';
  const empty=h.api.r3Empty();empty.name='NIER';
  assert.throws(()=>h.api.r3AutoStoreSnapshot(h.api.r3Coverage(empty),'current'),/recognizable character values/);
  empty.observations=[{label:'unrecognized UUID',value:'20'}];
  assert.throws(()=>h.api.r3AutoStoreSnapshot(h.api.r3Coverage(empty),'current'),/recognizable character values/);
  empty.inventory=[{name:'False Potion',_key:'false'}];empty.name='OTHER';
  assert.throws(()=>h.api.r3AutoStoreSnapshot(h.api.r3Coverage(empty),'current'),/identity did not match/);
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
});


test('automatic current-tab polling has a shorter gate than a full scan',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.R3_AUTO.lastScan=Date.now()-10000;
  await h.api.r3AutoTick();
  assert.equal(h.sent.length,0,'ten seconds is too soon for a new current-tab read');
  h.api.R3_AUTO.lastScan=Date.now()-14000;
  const pending=h.api.r3AutoTick();
  assert.equal(h.sent.length,1,'14 seconds meets the 12-second minimum');
  assert.equal(h.sent[0].message.mode,'current');
  const snap=h.api.r3Empty();snap.name='NIER';snap.skills.Athletics=5;
  h.respond(h.api.r3Coverage(snap));
  await pending;
  assert.equal(h.api.R3_UI.snapshot.skills.Athletics,5);
  assert.equal(h.api.R3_AUTO.lastFull,0,'a current-tab poll does not claim a full import');
});

test('authenticated official popout dirty hints trigger fast debounced current-view update',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const popup=registerOfficialPopout(h);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.R3_AUTO.lastScan=Date.now()-4000;
  const prior=h.api.r3Empty();prior.name='NIER';prior.stats.hp=82;
  prior.inventory=[{name:'Potion',_key:'potion',visible:'1'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prior);
  const dirty={origin:'https://advanced-sheets.production.roll20preflight.net',
    source:popup.popup,data:{protocol:'r20eb:import:v3',type:'dirty',
      session:'popout-sess-123',name:'NIER'}};
  h.windowListeners.get('message')(dirty);
  h.windowListeners.get('message')(dirty);
  assert.equal(popup.messages.length,0,'a dirty hint does not itself read the sheet');
  const timers=[...h.timeouts.values()].filter(x=>x.ms===400);
  assert.equal(timers.length,1,'a burst coalesces to one scheduled current scan');
  timers[0].fn();
  assert.equal(popup.messages.length,1);
  assert.equal(popup.messages[0].message.mode,'current');
  const fresh=h.api.r3Empty();fresh.name='NIER';
  fresh.inventory=[{name:'Potion',_key:'potion',visible:'3'}];
  popup.reply(h.api.r3Coverage(fresh));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.api.R3_UI.snapshot.inventory[0].visible,'3');
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82,'off-tab HP must be retained');
});
test('dirty hints from wrong source, session, name or origin cannot trigger scans',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const popup=registerOfficialPopout(h);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  const base={protocol:'r20eb:import:v3',type:'dirty',session:'popout-sess-123',name:'NIER'};
  const send=(origin,source,data)=>h.windowListeners.get('message')({origin,source,data});
  send('https://example.invalid',popup.popup,base);
  send('https://advanced-sheets.production.roll20preflight.net',{},base);
  send('https://advanced-sheets.production.roll20preflight.net',popup.popup,{...base,session:'wrong-session'});
  send('https://advanced-sheets.production.roll20preflight.net',popup.popup,{...base,name:'OTHER'});
  assert.equal(h.api.R3_AUTO.dirtyTimer,null);
  assert.equal(popup.messages.length,0);
  assert.equal([...h.timeouts.values()].filter(x=>x.ms===400).length,0);
});
test('rapid event changes respect the two-second current scan rate limit',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const popup=registerOfficialPopout(h);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.R3_AUTO.lastScan=Date.now()-400;
  h.windowListeners.get('message')({origin:'https://advanced-sheets.production.roll20preflight.net',
    source:popup.popup,data:{protocol:'r20eb:import:v3',type:'dirty',
      session:'popout-sess-123',name:'NIER'}});
  const timers=[...h.timeouts.values()].filter(x=>x.ms>=1600&&x.ms<=1800);
  assert.equal(timers.length,1,'heavy scan is held until the two-second budget is available');
  assert.equal(popup.messages.length,0);
});
test('turning Auto-sync off cancels queued event-triggered scans',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const popup=registerOfficialPopout(h);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='NIER';
  h.api.r3AutoQueueDirty(h.api.r3AutoCandidate());
  const id=h.api.R3_AUTO.dirtyTimer;
  assert.ok(id!==null&&h.timeouts.has(id));
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.dirtyTimer,null);
  assert.equal(h.timeouts.has(id),false);
  assert.equal(popup.messages.length,0);
});


test('Inventory quantity zero removes the item from debug view without losing off-tab data',()=>{
  const h=panelHarness();h.api.r3StartUI();
  h.api.R3_AUTO.name='NIER';
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.spells=[{name:'Druidcraft',_key:'druidcraft'}];
  prev.inventory=[{name:'Healer Kit',_key:'healer kit||',tab:'Inventory',
    visible:'Healer Kit',quantity:3,
    controls:[{kind:'quantity',label:'Item quantity',value:3,source:'utility-incrementer__input'},
      {kind:'toggle',label:'Use item',value:true,source:'aria-pressed'}]}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  h.shadow.handlers.get('click')({target:{dataset:{view:'inventory'}}});
  const first=h.nodes.get('r3-results').innerHTML;
  assert.match(first,/Observed quantity/);
  assert.match(first,/Use item/);
  assert.match(first,/>On</);
  const current=h.api.r3Empty();current.name='NIER';
  current.inventory=[{name:'Healer Kit',_key:'healer kit||',tab:'Inventory',
    visible:'Healer Kit',quantity:0,
    controls:[{kind:'quantity',label:'Item quantity',value:0,source:'utility-incrementer__input'},
      {kind:'toggle',label:'Use item',value:false,source:'aria-pressed'}]}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(current),'current');
  const html=h.nodes.get('r3-results').innerHTML;
  assert.notEqual(html,first,'new observations must repaint Inventory debug details');
  assert.doesNotMatch(html,/Healer Kit/,'zero item should disappear from Inventory debug');
  assert.equal(h.api.R3_UI.snapshot.inventory.length,0);
  assert.equal(h.api.R3_UI.snapshot.coverage.inventory,0);
  assert.match(html,/No inventory found/i);
  assert.equal(h.api.R3_UI.snapshot.spells.length,1);
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});

test('one explicit zero removes only its matching item; unobserved and positive items survive',()=>{
  const h=panelHarness();h.api.r3StartUI();h.api.R3_AUTO.name='NIER';
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=80;
  prev.inventory=[
    {name:'Potion',_key:'potion||',quantity:3},
    {name:'Lantern',_key:'lantern||',quantity:1},
    {name:'Rope',_key:'rope||'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  const current=h.api.r3Empty();current.name='NIER';
  current.inventory=[
    {name:'Potion',_key:'potion||',quantity:0},
    {name:'Lantern',_key:'lantern||',quantity:2}
  ];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(current),'current');
  assert.deepEqual([...h.api.R3_UI.snapshot.inventory.map(x=>x.name)],['Lantern','Rope']);
  assert.equal(h.api.R3_UI.snapshot.inventory[0].quantity,2);
  assert.equal(h.api.R3_UI.snapshot.stats.hp,80);
  // A subsequent positive observation re-adds the item.
  const returnScan=h.api.r3Empty();returnScan.name='NIER';
  returnScan.inventory=[{name:'Potion',_key:'potion||',quantity:2}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(returnScan),'current');
  assert.equal(h.api.R3_UI.snapshot.inventory.at(-1).quantity,2);
  assert.equal(h.api.R3_UI.snapshot.coverage.inventory,3);
});
test('an unmounted or unlabelled item is never removed just because its row is missing',()=>{
  const h=panelHarness();h.api.r3StartUI();h.api.R3_AUTO.name='NIER';
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.inventory=[{name:'Potion',_key:'potion||',quantity:2}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  const unrelated=h.api.r3Empty();unrelated.name='NIER';
  unrelated.skills.Athletics=5;
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(unrelated),'current');
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
  const quantityUnknown=h.api.r3Empty();quantityUnknown.name='NIER';
  quantityUnknown.inventory=[{name:'Potion',_key:'potion||',visible:'Potion'}];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(quantityUnknown),'current');
  assert.equal(h.api.R3_UI.snapshot.inventory.length,1);
  assert.equal(h.api.R3_UI.snapshot.inventory[0].quantity,undefined);
});
test('full auto scan never persists zero-count items or retains stale previously imported entries',()=>{
  const h=panelHarness();h.api.r3StartUI();h.api.R3_AUTO.name='NIER';
  const prev=h.api.r3Empty();prev.name='NIER';prev.stats.hp=82;
  prev.inventory=[{name:'Potion',_key:'potion||',quantity:2}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(prev);
  const full=h.api.r3Empty();full.name='NIER';full.stats.hp=82;
  full.inventory=[
    {name:'Potion',_key:'potion||',quantity:0},
    {name:'Rope',_key:'rope||',quantity:1}
  ];
  h.api.r3AutoStoreSnapshot(h.api.r3Coverage(full),'all');
  assert.deepEqual([...h.api.R3_UI.snapshot.inventory.map(x=>x.name)],['Rope']);
  assert.equal(h.api.R3_UI.snapshot.coverage.inventory,1);
  const saved=JSON.parse([...h.store.values()].find(x=>x.includes('"snapshot"')));
  assert.equal(saved.snapshot.inventory[0].name,'Rope');
});
test('manual current-tab import drops observed zero items before saving and rendering',async()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  h.click('r3-scan');
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  snap.inventory=[
    {name:'Potion',_key:'potion||',quantity:0,tab:'Inventory'},
    {name:'Lantern',_key:'lantern||',quantity:4,tab:'Inventory'}
  ];
  h.respond(h.api.r3Coverage(snap));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.api.R3_UI.snapshot.coverage.inventory,1);
  assert.equal(h.api.R3_UI.snapshot.inventory[0].name,'Lantern');
  h.shadow.handlers.get('click')({target:{dataset:{view:'inventory'}}});
  const html=h.nodes.get('r3-results').innerHTML;
  assert.doesNotMatch(html,/Potion/);
  assert.match(html,/Lantern/);
});
test('older stored zero-count items are hidden and discarded on load',()=>{
  const h=panelHarness();
  const saved=h.api.r3Empty();saved.name='NIER';
  saved.inventory=[
    {name:'Potion',_key:'potion||',quantity:0,tab:'Inventory'},
    {name:'Rope',_key:'rope||',quantity:2,tab:'Inventory'}
  ];
  h.store.set('roll20-embetterment-v3:123',JSON.stringify({schema:3,snapshot:saved}));
  h.api.r3StartUI();
  assert.equal(h.api.R3_UI.snapshot,null,'old character is hidden until verified');
  const restored=vm.runInContext('r3TokenSnapshotFor({characterId:"char-nier",name:"NIER"})',h.context);
  assert.deepEqual([...restored.inventory.map(x=>x.name)],['Rope']);
  assert.equal(restored.coverage.inventory,1);
});

test('Inventory debug calls out a previously silent unknown quantity next to a detected switch',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.inventory=[{name:'Crowbar',_key:'crowbar||',tab:'Inventory',visible:'Crowbar Gear',
    controls:[{kind:'toggle',label:'headlessui-switch-100',value:true,source:'switch'}]}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.shadow.handlers.get('click')({target:{dataset:{view:'inventory'}}});
  const html=h.nodes.get('r3-results').innerHTML;
  assert.match(html,/Crowbar/);
  assert.match(html,/Quantity not detected/);
  assert.match(html,/zero removal needs a readable counter/);
  assert.match(html,/headlessui-switch-100/);
});


test('HUD v1 displays real imported vital statistics, slots and attacks',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  Object.assign(snap.stats,{hp:57,maxHp:84,ac:17,speed:55,initiative:2.14,passivePerception:16});
  snap.attacks=[{name:'Handaxe',_key:'handaxe',tab:'Combat',visible:'Handaxe 1d6 damage'}];
  snap.spells=[
    {name:'Druidcraft',_key:'druidcraft',castingTime:'1 Action'},
    {name:'Misty Step',_key:'misty step',castingTime:'Bonus Action',range:'Self'},
    {name:'Shield',_key:'shield',castingTime:'Reaction'}
  ];
  snap.slots['1']={current:2,max:4};
  snap.resources=[{name:'Wild Shape',_key:'wildshape',checkboxes:{total:2,checked:1}}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/NIER/);assert.match(html,/57 \/ 84/);assert.match(html,/width:68%/);
  assert.match(html,/AC<\/span><strong>17/);assert.match(html,/SPEED<\/span><strong>55 ft/);
  assert.match(html,/INIT<\/span><strong>2.14/);assert.match(html,/PASSIVE<\/span><strong>16/);
  assert.match(html,/Slot 1 · 2\/4/);assert.match(html,/Wild Shape/);assert.match(html,/Handaxe/);
  assert.equal(h.api.r3HudEntries(snap,'bonus').length,1);
  assert.equal(h.api.r3HudEntries(snap,'reactions').length,1);
  assert.equal(h.api.r3HudEntries(snap,'spells').length,3);
});
test('HUD shows missing fields as unknown and does not infer action economy',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;snap.stats.maxHp=84;
  snap.features=[{name:'Action Surge',_key:'surge',visible:'Action Surge'}];
  snap.spells=[{name:'Unknown Spell',_key:'spell',visible:'Some spell'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/AC<\/span><strong>—/);
  assert.match(html,/SPEED<\/span><strong>—/);
  assert.equal(h.api.r3HudEntries(snap,'bonus').length,0);
  assert.equal(h.api.r3HudEntries(snap,'reactions').length,0);
  assert.doesNotMatch(html,/Slot 1/);
  assert.match(html,/ARGON PORT/);
  assert.match(html,/hud-main-segments/);
});
test('HUD category navigation and item counts do not execute Roll20 actions',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  snap.spells=[{name:'Misty Step',_key:'misty',castingTime:'Bonus Action',tab:'Spells',visible:'Teleport'}];
  snap.inventory=[{name:'Crowbar',_key:'crowbar||',quantity:2,tab:'Inventory'},
    {name:'Consumed Potion',_key:'potion||',quantity:0,tab:'Inventory'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudCategory:'bonus'}}});
  assert.match(h.nodes.get('r3-hud').innerHTML,/Misty Step/);
  h.shadow.handlers.get('click')({target:{dataset:{hudCategory:'inventory'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/Crowbar/);assert.doesNotMatch(html,/Consumed Potion/);
  assert.equal(h.sent.length,0,'opening a card or category must not roll or cast');
  assert.match(h.store.get('roll20-embetterment-v3:123:hud'),/"category":"inventory"/);
});
test('HUD minimize, expand and debug panel retain the importer snapshot',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.click('r3-hud-collapse');
  assert.equal(h.api.R3_HUD.collapsed,true);
  assert.match(h.nodes.get('r3-hud').innerHTML,/hud-shell collapsed/);
  h.click('r3-hud-collapse');
  assert.equal(h.api.R3_HUD.collapsed,false);
  assert.match(h.nodes.get('r3-hud').innerHTML,/HIT POINTS/);
  h.click('r3-hud-debug');assert.equal(h.nodes.get('r3-wrap').style.display,'block');
  h.click('r3-hud-debug');assert.equal(h.nodes.get('r3-wrap').style.display,'none');
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});
test('HUD loads saved per-game category and collapsed state',()=>{
  const h=panelHarness();
  h.store.set('roll20-embetterment-v3:123:hud',JSON.stringify({category:'resources',collapsed:true}));
  h.api.r3StartUI();
  assert.equal(h.api.R3_HUD.category,'resources');assert.equal(h.api.R3_HUD.collapsed,true);
  assert.match(h.nodes.get('r3-hud').innerHTML,/Show HUD/);
});
test('existing HP watcher refreshes HUD while diagnostic importer stays hidden',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const initial=h.api.r3Empty();initial.name='NIER';initial.stats.hp=82;initial.stats.maxHp=84;
  h.api.R3_UI.snapshot=h.api.r3Coverage(initial);h.api.r3HudRender();
  const before=h.nodes.get('r3-hud').innerHTML;
  h.api.R3_AUTO.name='NIER';
  const next=h.api.r3Empty();next.name='NIER';next.stats.hp=51;next.stats.maxHp=84;
  assert.equal(h.api.r3AutoStoreHealth(h.api.r3Coverage(next)),true);
  const after=h.nodes.get('r3-hud').innerHTML;
  assert.notEqual(after,before);assert.match(after,/51 \/ 84/);
  assert.equal(h.nodes.get('r3-wrap').style.display,'none');
});
test('HUD sync button controls the existing per-game auto importer',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.click('r3-hud-auto');
  assert.equal(h.api.R3_AUTO.enabled,true);
  assert.match(h.nodes.get('r3-hud').innerHTML,/Sync On/);
  assert.match(h.store.get('roll20-embetterment-v3:123:auto'),/"enabled":true/);
  h.click('r3-hud-auto');
  assert.equal(h.api.R3_AUTO.enabled,false);
  assert.match(h.nodes.get('r3-hud').innerHTML,/Sync Off/);
});

test('clicking inner glyph of a HUD tab selects its category, without extra scans',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const categoryButton={dataset:{hudCategory:'features'}};
  const inner={dataset:{},closest:selector=>selector==='[data-hud-category]'?categoryButton:null};
  h.shadow.handlers.get('click')({target:inner});
  assert.equal(h.api.R3_HUD.category,'features');
  assert.equal(h.sent.length,0);
});


test('Nier previous export promotes exact labeled AC/speed to the redesigned HUD without a rescan',()=>{
  const h=panelHarness();
  const save=h.api.r3Empty();save.name='Nier';save.stats.hp=82;save.stats.maxHp=84;
  save.skills.Perception=5;
  save.observations=[
    {label:'59a75333-038c-491a-a93f-be3022111d42',value:'17',
      nearbyText:['ARMOR CLASS'],tab:'COMBAT'},
    {label:'b89b2c57-491e-4f8c-b43f-7b21bc42aa96',value:'55',
      nearbyText:['SPEED (ft)'],tab:'INVENTORY'}
  ];
  h.store.set('roll20-embetterment-v3:123',JSON.stringify({schema:3,snapshot:save}));
  h.api.r3StartUI();
  assert.equal(h.api.R3_UI.snapshot,null,
    'unverified old Nier data must not appear even when the local browser cache is populated');
  const verified=vm.runInContext('r3TokenSnapshotFor({characterId:"char-nier",name:"Nier"})',h.context);
  h.api.R3_UI.snapshot=h.api.r3Coverage(verified);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/AC<\/span><strong>17/);
  assert.match(html,/SPEED<\/span><strong>55 ft/);
  assert.match(html,/PASSIVE BASE<\/span><strong>15/);
  assert.equal(h.api.R3_UI.snapshot.stats.passivePerception,undefined,
    'base passive is displayed as calculation, not fabricated sheet value');
  assert.equal(h.api.R3_UI.snapshot.stats.ac,17);
  assert.equal(h.api.R3_UI.snapshot.stats.speed,55);
});
test('Argon-like portrait + segmented action panels replace giant grid as initial HUD',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';snap.stats.hp=82;snap.stats.maxHp=84;
  snap.attacks=[{name:'Crowbar',_key:'crowbar',tab:'Combat'}];
  snap.spells=[{name:'Shield',_key:'shield',castingTime:'Reaction'},
    {name:'Misty Step',_key:'misty',castingTime:'Bonus Action'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/hud-portrait-panel/);
  assert.match(html,/hud-loadout-pair/);
  assert.match(html,/hud-main-segments/);
  assert.match(html,/MAIN ACTION<\/span>/);
  assert.match(html,/BONUS<\/span>/);
  assert.match(html,/REACTION<\/span>/);
  assert.match(html,/FREE<\/span>/);
  assert.match(html,/PASS<\/span>/);
  assert.match(html,/Crowbar/);
  assert.match(html,/Misty Step/);
  assert.match(html,/Shield/);
  assert.doesNotMatch(html,/class="hud-flyout"/,'upward flyout is hidden by default');
  h.shadow.handlers.get('click')({target:{dataset:{hudCategory:'inventory'}}});
  assert.match(h.nodes.get('r3-hud').innerHTML,/class="hud-flyout"/);
  assert.equal(h.api.R3_HUD.flyout,'inventory');
  h.click('r3-hud-flyout-close');
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/class="hud-flyout"/);
});
test('passive perception explicit sheet observation outranks computed base',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';snap.skills.Perception=5;snap.stats.passivePerception=19;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/PASSIVE<\/span><strong>19/);
  assert.doesNotMatch(html,/PASSIVE BASE/);
});

test('reference HUD has three paired weapon sets and five segmented action groups',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-loadout-pair/g)].length,3);
  assert.equal([...html.matchAll(/data-hud-slot="/g)].length,6);
  assert.match(html,/MAIN ACTION/);
  assert.match(html,/BONUS/);
  assert.match(html,/FREE/);
  assert.match(html,/REACTION/);
  assert.match(html,/PASS/);
  assert.match(html,/END TURN/);
  assert.match(html,/disabled/,'native end turn is not yet implemented');
  assert.match(html,/CAST SPELL/);
  assert.match(html,/USE FEATURE/);
  assert.match(html,/USE ITEM/);
});
test('weapon set picker assigns imported weapons to action/bonus slots locally and restores selection',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snapshot=h.api.r3Empty();snapshot.name='NIER';snapshot.stats.hp=82;
  snapshot.attacks=[{name:'Longbow',_key:'longbow',tab:'Combat'},
    {name:'Dagger',_key:'dagger',tab:'Combat'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudSlot:'0'}}});
  assert.equal(h.api.R3_HUD.chooser,0);
  assert.match(h.nodes.get('r3-hud').innerHTML,/QUICK SLOT 1/);
  h.shadow.handlers.get('click')({target:{dataset:{hudAssign:'1'}}});
  assert.equal(h.api.R3_HUD.weaponSets[0].key,'dagger');
  assert.equal(h.api.R3_HUD.chooser,null);
  assert.match(h.nodes.get('r3-hud').innerHTML,/Dagger/);
  assert.match(h.store.get('roll20-embetterment-v3:123:hud'),/"key":"dagger"/);
  h.shadow.handlers.get('click')({target:{dataset:{hudSet:'2'}}});
  assert.equal(h.api.R3_HUD.weaponSet,2);
  assert.equal(h.sent.length,0,'assigning set slots never equips or casts in Roll20');
  h.shadow.handlers.get('click')({target:{dataset:{hudSlot:'0'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudAssign:'clear'}}});
  assert.equal(h.api.R3_HUD.weaponSets[0],null);
});
test('spell flyout groups observed levels with observed slot counts and never casts',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  snap.spells=[
    {name:'Fire Bolt',_key:'firebolt',level:0},
    {name:'Cure Wounds',_key:'cure',level:1},
    {name:'Misty Step',_key:'misty',level:2},
    {name:'Unclassified',_key:'unknown'}
  ];
  snap.slots['1']={current:2,max:4};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'spells'}}});
  let html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/class="hud-flyout"/);
  assert.match(html,/Cantrip/);assert.match(html,/Level 1/);assert.match(html,/Level 2/);
  h.shadow.handlers.get('click')({target:{dataset:{hudSpellLevel:'1'}}});
  html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/Cure Wounds/);
  assert.match(html,/Slots 2 \/ 4/);
  assert.doesNotMatch(html,/Misty Step/);
  assert.equal(h.sent.length,0,'viewing spell groups cannot cast');
  h.click('r3-hud-flyout-close');
  assert.equal(h.api.R3_HUD.flyout,'');
});
test('skills and saves shortcut opens an observed-only flyout',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const s=h.api.r3Empty();s.name='NIER';s.skills.Perception=5;s.saves.str=4;s.modifiers.dex=3;
  h.api.R3_UI.snapshot=h.api.r3Coverage(s);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'skills'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/SAVING THROWS/);
  assert.match(html,/SKILLS/);
  assert.match(html,/Perception/);
  assert.match(html,/ABILITY CHECKS/);
});
test('action markers are local only and manually reset, including after hiding HUD',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';snap.stats.hp=82;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudUsed:'action'}}});
  assert.equal(h.api.R3_HUD.used.action,true);
  assert.match(h.nodes.get('r3-hud').innerHTML,/data-hud-used="action" aria-pressed="true"/);
  assert.equal(h.sent.length,0);
  h.click('r3-hud-reset-turn');
  assert.equal(h.api.R3_HUD.used.action,false);
  h.shadow.handlers.get('click')({target:{dataset:{hudUsed:'bonus'}}});
  h.click('r3-hud-collapse');h.click('r3-hud-collapse');
  assert.equal(h.api.R3_HUD.used.bonus,false);
});
test('Shift+A toggles HUD outside text fields without accidentally triggering Roll20 editor shortcuts',()=>{
  const h=panelHarness();h.api.r3StartUI();const fn=h.windowListeners.get('keydown');
  assert.equal(typeof fn,'function');
  let stopped=0,prevented=0;
  const base={key:'A',shiftKey:true,ctrlKey:false,altKey:false,metaKey:false,repeat:false,
    preventDefault(){prevented++;},stopPropagation(){stopped++;}};
  fn({...base,target:{tagName:'INPUT'}});assert.equal(h.api.R3_HUD.collapsed,false);
  fn({...base,target:{tagName:'DIV'}});assert.equal(h.api.R3_HUD.collapsed,true);
  assert.equal(stopped,1);assert.equal(prevented,1);
  fn({...base,target:{tagName:'DIV'}});assert.equal(h.api.R3_HUD.collapsed,false);
});

test('HUD live screenshot: portrait HP stays on one line and all stats stay in visible grid',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';snap.stats.hp=82;snap.stats.maxHp=84;
  snap.stats.ac=17;snap.stats.speed=55;snap.stats.initiative=2.14;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/hud-portrait-head/);
  assert.match(html,/hud-portrait-hp/);
  assert.match(html,/82 \u002f 84/);
  assert.match(html,/AC<\/span><strong>17/);
  assert.match(html,/SPEED<\/span><strong>55 ft/);
  assert.match(html,/INIT<\/span><strong>2.14/);
  const style=h.api.r3HudStyles();
  assert.match(style,/\.hud-hp-label strong\{white-space:nowrap/);
  assert.match(style,/\.hud-portrait-panel\{flex:0 0 204px/);
  assert.match(style,/\.hud-reference-bar\{min-height:216px/);
  assert.match(style,/\.hud-resources-bottom\{min-height:21px;overflow-x:auto/);
  assert.match(style,/#r3-hud\{bottom:27px/);
});
test('HUD portrait uses only a visible exact-name journal thumbnail and never a lookalike',()=>{
  const h=panelHarness();
  const img=(text,src,shown=true)=>{
    const parent={textContent:text,parentElement:null};
    return {parentElement:parent,src,getClientRects:()=>shown?[{}]:[]};
  };
  const shadow=img('Shadow Nier','https://example.org/shadow.png');
  const journal=img('Nier','https://app.roll20.net/images/nier-avatar.png');
  let scans=0;
  const prior=h.document.querySelectorAll;
  h.document.querySelectorAll=sel=>{
    if(sel==='img'){scans++;return [shadow,journal];}
    return prior(sel);
  };
  const snap=h.api.r3Empty();snap.name='Nier';
  h.api.r3StartUI();h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  assert.match(h.nodes.get('r3-hud').innerHTML,/<img class="hud-portrait-image" src="https:\/\/app.roll20.net\/images\/nier-avatar.png" alt="">/);
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/shadow.png/);
  const before=scans;
  assert.equal(h.api.r3HudPortraitUrl(snap),'https://app.roll20.net/images/nier-avatar.png');
  assert.equal(scans,before,'a resolved portrait is reused without repeated DOM image scans');
});
test('HUD portrait rejects non-HTTPS URLs, hidden art and mismatched character rows',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';
  const rogue={parentElement:{textContent:'Nier',parentElement:null},
    src:'javascript:alert(1)',getClientRects:()=>[{}]};
  const hidden={parentElement:{textContent:'Nier',parentElement:null},
    src:'https://example.com/hidden.png',getClientRects:()=>[]};
  const other={parentElement:{textContent:'Nier’s Journal',parentElement:null},
    src:'https://example.com/journal.png',getClientRects:()=>[{}]};
  h.document.querySelectorAll=sel=>sel==='img'?[other,rogue,hidden]:[];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.doesNotMatch(html,/<img class="hud-portrait-image"/);
  assert.match(html,/class="hud-avatar" aria-hidden="true">N<\/div>/);
  assert.equal(h.api.r3HudPortraitUrl(snap),'');
});

test('second row of Floorp character stats is not capped by fixed portrait max-height',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';snap.stats.hp=82;snap.stats.maxHp=84;
  snap.stats.ac=17;snap.stats.speed=55;snap.stats.initiative=2.14;
  snap.skills.Perception=5;
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/AC<\/span><strong>17/);
  assert.match(html,/SPEED<\/span><strong>55 ft/);
  assert.match(html,/INIT<\/span><strong>2.14/);
  assert.match(html,/PASSIVE BASE<\/span><strong>15/);
  const css=h.api.r3HudStyles();
  assert.match(css,/\.hud-reference-bar\{min-height:242px;max-height:none/);
  assert.match(css,/\.hud-avatar-pane\{min-height:151px;overflow:visible/);
  assert.match(css,/\.hud-portrait-stats\{margin-top:auto;grid-auto-rows:minmax\(21px,auto\)/);
});
test('observed exact-name character art stays visible when Journal sidebar becomes Chat',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const row={textContent:'Nier',parentElement:null};
  const img={parentElement:row,src:'https://files.example.net/visible-nier.webp',getClientRects:()=>[{}]};
  h.document.querySelectorAll=sel=>sel==='img'?[img]:[];
  const snap=h.api.r3Empty();snap.name='Nier';
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  assert.match(h.nodes.get('r3-hud').innerHTML,/visible-nier.webp/);
  const saved=JSON.parse(h.store.get('roll20-embetterment-v3:123:hud'));
  assert.equal(saved.portrait.name,'Nier');
  assert.equal(saved.portrait.url,'https://files.example.net/visible-nier.webp');
  h.document.querySelectorAll=()=>[];
  const other=h.api.r3Empty();other.name='Shadow Nier';
  h.api.R3_UI.snapshot=h.api.r3Coverage(other);h.api.r3HudRender();
  assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/visible-nier.webp/,
    'portrait is scoped to exactly one selected character');
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  assert.match(h.nodes.get('r3-hud').innerHTML,/visible-nier.webp/,
    'an already observed portrait survives when Journal is not displayed');
});
test('an already saved per-game Journal portrait loads in Chat without opening Journal',()=>{
  const h=panelHarness();
  h.store.set('roll20-embetterment-v3:123:hud',JSON.stringify({
    category:'actions',collapsed:false,portrait:{name:'Nier',url:'https://images.example.net/nier.webp'}
  }));
  h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';
  h.document.querySelectorAll=()=>[];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  assert.match(h.nodes.get('r3-hud').innerHTML,/https:\/\/images.example.net\/nier.webp/);
});
test('invalid or cross-character persisted portrait URLs cannot be reused',()=>{
  const h=panelHarness();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Nier';
  for(const bad of [
    {name:'Nier',url:'javascript:alert(1)'},
    {name:'Shadow Nier',url:'https://example.org/shadow.webp'},
    {name:'Nier',url:'data:image/svg+xml,<svg/onload=alert(1)>'}
  ]){
    h.api.R3_HUD.portraitName='';
    h.api.R3_HUD.portraitUrl='';
    h.api.R3_HUD.portraitCache=null;
    h.store.set('roll20-embetterment-v3:123:hud',JSON.stringify({portrait:bad}));
    h.api.r3HudLoad();
    h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
    assert.doesNotMatch(h.nodes.get('r3-hud').innerHTML,/<img class="hud-portrait-image"/);
  }
});

test('attack menu groups exactly observed variants by weapon and mode with Thrown under Ranged',()=>{
  const h=panelHarness('Independent Hero');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Independent Hero';
  snap.attacks=[
    {name:'Dagger',_key:'dagger-base',tab:'Combat',visible:'Dagger +7 Attack 1d4+4'},
    {name:'Dagger (Finesse)',_key:'dagger-fin',tab:'Combat',
      visible:'Dagger (Finesse) Melee +5 Attack 1d4+2'},
    {name:'Dagger (Off-Hand)',_key:'dagger-off',tab:'Combat',
      visible:'Dagger (Off-Hand) Melee +7 Attack 1d4'},
    {name:'Dagger (Thrown)',_key:'dagger-thrown',tab:'Combat',
      visible:'Dagger (Thrown) Ranged +7 Attack 1d4+4'},
    {name:'Shortbow',_key:'shortbow',tab:'Combat',
      visible:'Shortbow Ranged +8 Attack 1d6+4'},
    {name:'Molotov Cocktail',_key:'molotov',tab:'Combat',
      visible:'Molotov Cocktail +4 Attack 1d6'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const catalog=h.api.r3HudAttackCatalog(snap);
  assert.equal(catalog.attackCount,6);
  assert.deepEqual(Array.from(catalog.modes.melee.map(x=>x.name)),['Dagger']);
  assert.deepEqual(Array.from(catalog.modes.ranged.map(x=>x.name)),['Dagger','Shortbow']);
  assert.deepEqual(Array.from(catalog.modes.other.map(x=>x.name)),['Molotov Cocktail']);
  assert.deepEqual(Array.from(catalog.modes.melee[0].variants.map(x=>x.item._key)),
    ['dagger-base','dagger-fin','dagger-off']);
  assert.equal(catalog.modes.ranged[0].variants[0].item._key,'dagger-thrown');
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  let html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-weapon-group/g)].length,1);
  assert.match(html,/data-hud-attack-mode="melee"/);
  assert.match(html,/data-hud-attack-mode="ranged"/);
  assert.match(html,/data-hud-attack-mode="other"/);
  assert.doesNotMatch(html,/data-hud-dice-key="dagger-off"/,
    'variant buttons not rendered until weapon menu opens');
  h.shadow.handlers.get('click')({target:{dataset:{hudWeapon:'melee|dagger'}}});
  html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/data-hud-dice-key="dagger-base"/);
  assert.match(html,/data-hud-dice-key="dagger-fin"/);
  assert.match(html,/data-hud-dice-key="dagger-off"/);
  assert.equal([...html.matchAll(/class="hud-weapon-option"/g)].length,3);
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackMode:'ranged'}}});
  html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-weapon-group/g)].length,2);
  assert.doesNotMatch(html,/data-hud-dice-key="dagger-off"/);
  assert.match(html,/Shortbow/);
  assert.match(html,/Dagger/);
  h.shadow.handlers.get('click')({target:{dataset:{hudWeapon:'ranged|dagger'}}});
  html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/data-hud-dice-key="dagger-thrown"/);
  assert.doesNotMatch(html,/data-hud-dice-key="dagger-base"/);
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackMode:'other'}}});
  html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/Molotov Cocktail/);
  assert.equal(h.sent.length,0,'menu exploration cannot roll');
});
test('Attack-native status is visible at the top without adding rows before weapons',()=>{
  const h=panelHarness('Elowen');h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Dagger',_key:'dagger',visible:'Dagger +7 Attack 1d4+4'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.R3_HUD.flyout='actions';
  vm.runInContext('r3NativeStatus("Official Combat button not yet available")',h.context);
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/hud-attack-live-status/);
  assert.match(html,/<small class="hud-attack-live-status" role="status" title="Official Combat button not yet available">/);
  assert.ok(html.indexOf('hud-attack-live-status')<html.indexOf('hud-attack-list'),
    'status must appear in stable titlebar, before scrollable content');
});
test('clicking Attack keeps the same scrolled weapon visible through native status rerenders',()=>{
  const h=panelHarness('Independent Hero');
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Independent Hero';
  snap.attacks=[{name:'Dagger',_key:'dagger',tab:'Combat',
    visible:'Dagger Melee +7 Attack 1d4+4',actions:[{label:'+7 Attack'}]}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.R3_HUD.flyout='actions';
  h.api.r3HudRender();
  const hud=h.nodes.get('r3-hud');
  const original=Object.getOwnPropertyDescriptor(hud,'innerHTML');
  let flyout={scrollTop:337,scrollLeft:13};
  Object.defineProperty(hud,'innerHTML',{
    get(){return original.get.call(hud);},
    set(markup){
      original.set.call(hud,markup);
      flyout=markup.includes('class="hud-flyout"')?
        {scrollTop:0,scrollLeft:0}:null;
    }
  });
  hud.querySelector=selector=>selector==='.hud-flyout'?flyout:null;
  hud.querySelectorAll=()=>[];
  // This is the same click path used by the HUD Attack button.
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackKey:'dagger'}}});
  assert.equal(flyout.scrollTop,337,'attack button must not jump the list to the top');
  assert.equal(flyout.scrollLeft,13,'horizontal position is also retained');
  // Official sheet preparation can generate multiple status messages.
  for(const msg of ['Checking the official attacks control…',
    'Waiting for the official sheet','Clicked the official roll button']){
    vm.runInContext('r3NativeStatus('+JSON.stringify(msg)+')',h.context);
    assert.equal(flyout.scrollTop,337,'status '+msg+' must keep the exact viewport');
    assert.equal(flyout.scrollLeft,13);
  }
  const html=hud.innerHTML;
  assert.ok(html.indexOf('class="hud-attack-list"')>=0);
  assert.ok(html.indexOf('class="hud-native-status"')>
    html.indexOf('class="hud-attack-list"'),
    'progress messages must appear after the attack list, not push it down');
  // Changing weapon categories intentionally opens a new viewport.
  h.api.R3_HUD.attackMode='ranged';
  h.api.r3HudRender();
  assert.equal(flyout.scrollTop,0);
});

test('weapon variants update when authenticated re-import changes attack catalog',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.attacks=[
    {name:'Handaxe',_key:'handaxe',visible:'Handaxe Melee +7 Attack 1d6+4'},
    {name:'Handaxe (Thrown)',_key:'handaxe-thrown',visible:'Handaxe Ranged +7 Attack 1d6+4'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const first=h.api.r3HudAttackCatalog(h.api.R3_UI.snapshot);
  assert.equal(first.modes.ranged[0].variants[0].item._key,'handaxe-thrown');
  h.api.R3_UI.snapshot=h.api.r3Coverage({...snap,attacks:[snap.attacks[0]]});
  h.api.r3HudRender();
  const updated=h.api.r3HudAttackCatalog(h.api.R3_UI.snapshot);
  assert.equal(updated.modes.ranged.length,0);
  assert.equal(updated.modes.melee.length,1);
});

test('duplicate legacy attack without stable identity is displayed but not rolled; HTML escaped',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.attacks=[
    {name:'Dagger',tab:'Combat',visible:'Dagger +7 Attack 1d4+4'},
    {name:'Dagger',tab:'Combat',visible:'Dagger +5 Attack 1d4+2'},
    {name:'<script>oops</script>',_key:'evil"',tab:'Combat',
      visible:'<img onerror=alert(1)> +4 Attack 1d6+1'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-weapon-group/g)].length,2);
  h.shadow.handlers.get('click')({target:{dataset:{hudWeapon:'other|dagger'}}});
  const expanded=h.nodes.get('r3-hud').innerHTML;
  assert.match(expanded,/class="hud-dice-button" disabled aria-label="Roll imported dice for Dagger"/);
  assert.doesNotMatch(html,/<script>|<img onerror/);
  assert.match(html,/&lt;script&gt;oops&lt;\/script&gt;/);
  assert.match(html,/&lt;script&gt;oops&lt;\/script&gt;/);
  assert.match(html,/data-hud-weapon-row="other\|&lt;script&gt;oops&lt;\/script&gt;"/);
  assert.equal(h.sent.length,0);
});
function observedChatRig(character='Elowen',draft=''){
  const h=panelHarness(character),sent=[],events=[];
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  const model={id:'char-player',get(k){return {name:character,controlledby:'player-one'}[k]}};
  h.context.window.Campaign={characters:{models:[model],get(id){return id==='char-player'?model:null}}};
  h.context.window.currentPlayer={id:'player-one'};
  const textarea={value:draft,disabled:false,dispatchEvent(e){events.push(e.type)}};
  const send={disabled:false,click(){sent.push(textarea.value);textarea.value=''}};
  h.document.querySelector=selector=>selector==='#textchat-input textarea'?textarea:
    selector==='#textchat-input .btn'?send:null;
  return {h,sent,textarea,send,events,model};
}
test('sheet-free attack fails closed when Roll20 chat has an unsent draft',()=>{
  const x=observedChatRig('Elowen','A message the player is writing');
  const snap=x.h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Spear',_key:'spear',visible:'Spear +4 Attack 1d6+2'}];
  x.h.api.R3_UI.snapshot=x.h.api.r3Coverage(snap);
  assert.equal(x.h.api.r3NativeChatAttack('spear'),false);
  assert.equal(x.sent.length,0);
  assert.equal(x.textarea.value,'A message the player is writing');
  assert.match(x.h.api.R3_NATIVE.status,/unsent draft/);
});
test('sheet-free attack does not require an open character dialog, but requires a controlled model',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Spear',_key:'spear',visible:'Spear +4 Attack 1d6+2'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  x.model.get=k=>({name:'Elowen',controlledby:'someone-else'})[k];
  assert.equal(h.api.r3NativeChatAttack('spear'),false);
  assert.equal(x.sent.length,0);
  assert.match(h.api.R3_NATIVE.status,/Controlled By/);
  x.model.get=k=>({name:'Elowen',controlledby:'player-one'})[k];
  h.api.R3_TOKEN.active={name:'Elsewhere',characterId:'char-other'};
  assert.equal(h.api.r3NativeChatAttack('spear'),false);
  assert.equal(x.sent.length,0);
  assert.match(h.api.R3_NATIVE.status,/another character/);
});
test('sheet-free Attack never guesses a missing modifier or changes private chat drafts',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Saving throw effect',_key:'effect',visible:'Save DC 17 8d6 fire damage'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3NativeChatCommand(snap.attacks[0]),null);
  assert.equal(h.api.r3NativeChatAttack('effect'),false);
  assert.equal(x.sent.length,0);
  assert.match(h.api.R3_NATIVE.status,/No confirmed hit-roll modifier/);
});
test('sheet-free rolls strip unsafe template and macro markup from imported names',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Spear}} {{evil=[[100d100]]}}',_key:'spear',
    visible:'Spear +4 Attack 1d6+2'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3NativeChatAttack('spear'),true);
  assert.equal(x.sent.length,1);
  assert.doesNotMatch(x.sent[0],/evil|100d100/);
  assert.ok(x.sent[0].includes('1d20+4'));
  assert.ok(x.sent[0].includes('1d6+2'));
});
test('sheet-free Attack reports missing Roll20 chat controls rather than opening a sheet',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Spear',_key:'spear',visible:'Spear +4 Attack 1d6+2'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.document.querySelector=()=>null;
  assert.equal(h.api.r3NativeChatAttack('spear'),false);
  assert.equal(x.sent.length,0);
  assert.match(h.api.R3_NATIVE.status,/Roll20 chat controls are not available/);
  assert.equal(h.sent.length,0);
});
test('shared native mappings cover spells, features, inventory, skills, saves, ability checks and resources',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  const categories=[
    ['spells','Fireball','fireball','%{char-player|repeating_spell_ROW_cast}','Cast'],
    ['features','Second Wind','second-wind','%{char-player|repeating_feature_ROW_use}','Use'],
    ['inventory','Potion of Healing','potion','%{char-player|repeating_item_ROW_use}','Use'],
    ['resources','Ki Point','ki','%{char-player|repeating_resource_ROW_use}','Use']
  ];
  for(const [kind,name,key] of categories)
    snap[kind]=[{name,_key:key,visible:'Official sheet item '+name,actions:[{label:'Roll'}]}];
  snap.skills={Acrobatics:7};snap.saves={Dexterity:5};snap.modifiers={Wisdom:2};
  x.model.abilities={models:[
    ...categories.map(([,name,,action],i)=>({id:'ability-'+i,get(k){return {name,action}[k];}})),
    {id:'skill',get(k){return {name:'Acrobatics',action:'%{char-player|skill_acrobatics_check}'}[k];}},
    {id:'save',get(k){return {name:'Dexterity',action:'%{char-player|dexterity_save}'}[k];}},
    {id:'check',get(k){return {name:'Wisdom',action:'%{char-player|wisdom_ability_check}'}[k];}}
  ]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  for(const [kind,name,key,,caption] of categories){
    assert.equal(h.api.r3NativeMapPreview(kind,key).abilityName,name,kind+' mapped');
    assert.equal(h.api.r3NativeInvoke(kind,key),true,kind+' dispatched');
    assert.equal(x.sent.at(-1),'%{char-player|'+name+'}');
    assert.equal(x.sent.length,categories.indexOf(categories.find(x=>x[0]===kind))+1);
    h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:
      kind==='spells'?'spells':kind==='inventory'?'inventory':
      kind==='features'?'features':'resources'}}});
    const html=h.nodes.get('r3-hud').innerHTML;
    assert.match(html,new RegExp('data-hud-native-kind="'+kind+'"'));
    assert.ok(html.includes('>'+caption+'</button>'),kind+' native button');
  }
  for(const [kind,key] of [['skills','Acrobatics'],['saves','Dexterity'],['modifiers','Wisdom']]){
    assert.equal(h.api.r3NativeMapPreview(kind,key).abilityName,key);
    assert.equal(h.api.r3NativeInvoke(kind,key),true);
    assert.equal(x.sent.at(-1),'%{char-player|'+key+'}');
  }
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'skills'}}});
  const skills=h.nodes.get('r3-hud').innerHTML;
  for(const kind of ['skills','saves','modifiers'])
    assert.match(skills,new RegExp('data-hud-native-kind="'+kind+'"'));
  assert.equal(h.sent.length,0,'no user sheet iframe is ever used');
});
test('Inventory, Spells and Features use compact single-column expandable lists',()=>{
  const h=panelHarness('NIER');h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.inventory=[
    {name:'Crowbar',_key:'crowbar',tab:'Inventory',quantity:1,
      controls:[{kind:'toggle',label:'Equipped',value:false}],visible:'Crowbar Gear'},
    {name:'Torch',_key:'torch',tab:'Inventory',quantity:9,visible:'Torch Gear'},
    {name:'Elixir of Health',_key:'elixir',tab:'Inventory',quantity:2,visible:'Elixir of Health Gear'}
  ];
  snap.spells=[{name:'Detect Magic',_key:'detect-magic',tab:'Spells',
    visible:'Detect Magic 1 action',level:'1',actions:[{label:'Show More'}]},
    {name:'Druidcraft',_key:'druidcraft',tab:'Spells',level:'Cantrip',visible:'Druidcraft'}];
  snap.features=[{name:'Action Surge',_key:'surge',tab:'Features & Traits',
    visible:'Action Surge once per short rest'},
    {name:'Second Wind',_key:'wind',tab:'Combat',
      visible:'Second Wind recovery'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  for(const [flyout,count] of [['inventory',3],['spells',1],['features',2]]){
    h.api.R3_HUD.flyout=flyout;h.api.r3HudRender();
    const html=h.nodes.get('r3-hud').innerHTML;
    assert.match(html,/class="hud-flyout-cards hud-list"/,flyout+' list');
    assert.equal((html.match(/class="hud-list-row"/g)||[]).length,count,
      'one full-width row for each '+flyout+' entry in selected level');
    assert.match(html,/class="hud-list-heading"/);
    assert.match(html,/<details class="hud-card hud-list-card" data-hud-card=/);
    assert.doesNotMatch(html,/Native unmapped/,'passive sheet entries do not need an unmapped badge');
    assert.doesNotMatch(html,/data-hud-native-kind="(?:inventory|spells|features)"/,
      'do not manufacture native actions without a real button or macro');
    assert.ok(html.indexOf('class="hud-list-heading"')<
      html.indexOf('class="hud-card-body"'),'details are collapsed below summary');
  }
  h.api.R3_HUD.flyout='inventory';h.api.r3HudRender();
  const inventory=h.nodes.get('r3-hud').innerHTML;
  assert.match(inventory,/Qty 2/);
  assert.match(inventory,/No verified native Use action was found/);
  assert.match(inventory,/Equipped: Off/);
  assert.match(h.api.r3HudStyles(),/\.hud-flyout-cards\.hud-list\{display:flex!important;flex-direction:column!important/);
});
// Model the live replacement of Shadow DOM nodes during the battlefield
// rerender. The importer harness otherwise has no DOM querySelectorAll.
function hudListDom(h){
  const hud=h.nodes.get('r3-hud'),shadow=h.shadow;
  let html='',lastWrites=-1,cards=[],buttons=[],flyout=null;
  function refresh(){
    // innerHTML always replaces DOM nodes even when the markup is identical.
    if(lastWrites===hud.writes)return;
    lastWrites=hud.writes;
    html=hud.innerHTML;
    cards=[...html.matchAll(/<details class="hud-card hud-list-card" data-hud-card="([^"]+)"/g)]
      .map(([,key])=>{
        const card={key,open:false,getAttribute(k){return k==='data-hud-card'?key:null;}};
        card.summary={
          matches(sel){return sel==='summary';},
          closest(sel){return sel==='details.hud-card'?card:null;},
          focus(opts){shadow.activeElement=this;this.preventScroll=opts?.preventScroll;}
        };
        card.querySelector=sel=>sel==='summary'?card.summary:null;
        return card;
      });
    buttons=[...html.matchAll(/<button[^>]*data-hud-native-kind="([^"]+)" data-hud-native-key="([^"]+)"/g)]
      .map(([,kind,key])=>({
        dataset:{hudNativeKind:kind,hudNativeKey:key},
        matches(sel){return sel==='button[data-hud-native-kind][data-hud-native-key]';},
        focus(opts){shadow.activeElement=this;this.preventScroll=opts?.preventScroll;}
      }));
    flyout=html.includes('class="hud-flyout"')?{scrollTop:0,scrollLeft:0}:null;
  }
  hud.querySelector=sel=>{refresh();return sel==='.hud-flyout'?flyout:null;};
  hud.querySelectorAll=sel=>{
    refresh();
    if(sel==='details.hud-card[open]')return cards.filter(c=>c.open);
    if(sel==='details.hud-card')return cards;
    if(sel==='button[data-hud-native-kind][data-hud-native-key]')return buttons;
    return [];
  };
  hud.contains=el=>{refresh();return cards.some(c=>c.summary===el)||buttons.includes(el);};
  return {get cards(){refresh();return cards;},get buttons(){refresh();return buttons;},
    get flyout(){refresh();return flyout;}};
}
test('expanded list rows and keyboard summary focus survive native status repaints',()=>{
  const h=panelHarness('NIER');h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.inventory=[{name:'Torch',_key:'torch',tab:'Inventory',quantity:3}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.R3_HUD.flyout='inventory';h.api.r3HudRender();
  const dom=hudListDom(h);
  assert.equal(dom.cards.length,1);
  dom.cards[0].open=true;
  h.shadow.activeElement=dom.cards[0].summary;
  dom.flyout.scrollTop=231;dom.flyout.scrollLeft=8;
  h.api.R3_NATIVE.revision++;h.api.r3HudRender();
  assert.equal(dom.cards[0].open,true,'details remain expanded without a legacy .hud-body');
  assert.equal(h.shadow.activeElement,dom.cards[0].summary,'focused summary survives DOM replacement');
  assert.equal(h.shadow.activeElement.preventScroll,true);
  assert.equal(dom.flyout.scrollTop,231);
  assert.equal(dom.flyout.scrollLeft,8);
  // Identical row keys from another selected character must never restore
  // an old character's expansion or steal keyboard focus.
  const other=h.api.r3Empty();other.name='Another character';
  other.inventory=[{name:'Torch',_key:'torch',tab:'Inventory',quantity:1}];
  const priorFocus=h.shadow.activeElement;
  h.api.R3_UI.snapshot=h.api.r3Coverage(other);h.api.r3HudRender();
  assert.equal(dom.cards[0].open,false,'character switch clears expansion state');
  assert.equal(h.shadow.activeElement,priorFocus,'character switch does not redirect focus');
  dom.cards[0].open=true;
  h.api.R3_HUD.flyout='features';h.api.r3HudRender();
  assert.equal(h.api.R3_HUD.openKeys.length,0,'flyout changes clear stale card keys');
});
test('verified native list action keeps keyboard focus during read-only status updates',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.inventory=[{name:'Healing Potion',_key:'healing',tab:'Inventory',quantity:2}];
  x.model.abilities={models:[{id:'ability-1',get(k){return {
    name:'Healing Potion',action:'%{char-player|repeating_inventory_HEAL_use}'
  }[k];}}]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.R3_HUD.flyout='inventory';h.api.r3HudRender();
  const dom=hudListDom(h);
  assert.equal(dom.buttons.length,1,'native action is displayed only for mapped control');
  const old=dom.buttons[0];
  h.shadow.activeElement=old;
  dom.flyout.scrollTop=107;
  h.api.R3_NATIVE.revision++;h.api.r3HudRender();
  assert.notEqual(dom.buttons[0],old,'HUD really recreated the button');
  assert.equal(h.shadow.activeElement,dom.buttons[0],'keyboard target follows the verified action');
  assert.equal(h.shadow.activeElement.preventScroll,true);
  assert.equal(dom.flyout.scrollTop,107);
  assert.equal(x.sent.length,0,'focus restoration does not invoke the action');
});

test('focused cascade category survives HUD status repaints but not character switch',()=>{
  const h=panelHarness('Elowen');h.api.r3StartUI();
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.api.R3_HUD.flyout='actions';
  vm.runInContext("function r3BattlefieldMarkup(){return '<section class=\"r3-bf-shell\">'+"+
    "'<nav class=\"r3-cascade-rail\">'+"+
    "['actions','spells','features'].map(id=>'<button type=\"button\" class=\"r3-cascade-entry\" data-hud-flyout=\"'+id+'\">'+id+'</button>').join('')+"+
    "'</nav></section>'}",h.context);
  h.api.r3HudRender();
  const hud=h.nodes.get('r3-hud');
  let writes=-1,buttons=[];
  function refresh(){
    if(writes===hud.writes)return;
    writes=hud.writes;
    buttons=['actions','spells','features'].map(category=>({
      dataset:{hudFlyout:category},
      matches(selector){return selector==='button.r3-cascade-entry';},
      closest(selector){return selector==='.r3-cascade-rail'?{}:null;},
      focus(options){h.shadow.activeElement=this;this.preventScroll=options?.preventScroll;}
    }));
  }
  hud.querySelectorAll=selector=>{
    refresh();
    return selector==='.r3-cascade-rail button.r3-cascade-entry'?buttons:[];
  };
  hud.contains=element=>{refresh();return buttons.includes(element);};
  refresh();
  h.shadow.activeElement=buttons[0];
  const old=buttons[0];
  h.api.R3_NATIVE.revision++;h.api.r3HudRender();
  assert.notEqual(buttons[0],old,'DOM controls were actually replaced');
  assert.equal(h.shadow.activeElement,buttons[0],'first level menu regains focus');
  assert.equal(h.shadow.activeElement.preventScroll,true);
  h.api.R3_HUD.flyout='spells';h.api.r3HudRender();
  assert.equal(h.shadow.activeElement,buttons[0],'menu category change retains keyboard entry');
  const beforeSwitch=h.shadow.activeElement;
  h.api.R3_TOKEN.active={characterId:'other',name:'Other'};
  const other=h.api.r3Empty();other.name='Other';
  h.api.R3_UI.snapshot=h.api.r3Coverage(other);
  h.api.r3HudRender();
  assert.equal(h.shadow.activeElement,beforeSwitch,'no focus jump to another character');
});

test('Left arrow returns from cascade branch to parent and ignores text caret movement',()=>{
  const h=panelHarness();h.api.r3StartUI();
  let focusCount=0,prevented=0;
  const parent={focus(opts){focusCount++;assert.equal(opts?.preventScroll,true);}};
  const cascade={querySelector(selector){
    return selector==='.r3-cascade-rail button[aria-expanded="true"]'?parent:null;
  }};
  const target={
    closest(sel){
      if(sel==='.r3-cascade-branch')return {};
      if(sel==='.r3-bf-cascade')return cascade;
      return null;
    }
  };
  const event={key:'ArrowLeft',target,
    preventDefault(){prevented++;},stopPropagation(){}};
  h.shadow.handlers.get('keydown')(event);
  assert.equal(focusCount,1);
  assert.equal(prevented,1);
  const editor={closest(selector){
    if(selector==='.r3-cascade-branch')return {};
    if(selector==='input,textarea,select,[contenteditable="true"]')return {};
    return null;
  }};
  h.shadow.handlers.get('keydown')({...event,target:editor});
  assert.equal(focusCount,1,'Left inside notes/editor must not hijack the caret');
  assert.equal(prevented,1);
});

test('verified native List buttons remain clickable on the row, while Show More never becomes Cast',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.inventory=[{name:'Healing Potion',_key:'healing',tab:'Inventory',quantity:2,
    visible:'Healing Potion quantity 2'}];
  snap.spells=[{name:'Magic Missile',_key:'magic',tab:'Spells',
    visible:'Magic Missile 1 action',actions:[{label:'Show More'}]}];
  snap.features=[{name:'Second Wind',_key:'wind',tab:'Combat',
    visible:'Second Wind Bonus Action 1d10+5',
    actions:[{label:'1d10+5'}]}];
  x.model.abilities={models:[
    {id:'ability-item',get(k){return {name:'Healing Potion',
      action:'%{char-player|repeating_inventory_HEAL_use}'}[k]}},
    {id:'ability-spell',get(k){return {name:'Magic Missile',
      action:'%{char-player|repeating_spell_ROW_cast}'}[k]}}
  ]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  for(const [kind,flyout,verb] of [
    ['inventory','inventory','Use'],['spells','spells','Cast'],['features','features','Roll']
  ]){
    h.api.R3_HUD.flyout=flyout;h.api.r3HudRender();
    const html=h.nodes.get('r3-hud').innerHTML;
    assert.match(html,new RegExp('data-hud-native-kind="'+kind+'"'),kind+' native action');
    assert.match(html,new RegExp('>'+verb+'<\\/button>'),kind+' action verb');
    assert.match(html,/class="hud-list-row has-native"/);
    assert.ok(html.indexOf('data-hud-native-kind=')>html.indexOf('</summary>'),
      'button sits outside summary to avoid changing expansion state');
  }
  h.api.R3_HUD.flyout='inventory';h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudNativeKind:'inventory',hudNativeKey:'healing'}}});
  assert.deepEqual(x.sent,['%{char-player|Healing Potion}']);
  assert.equal(h.sent.length,0,'no fabricated reader or chat action');
  assert.equal(h.api.r3NativeMapPreview('spells','magic').abilityName,'Magic Missile');
  x.model.abilities={models:[]};
  assert.equal(h.api.r3NativeMapPreview('spells','magic').sheetAction,undefined,
    'Show More alone cannot cast a spell');
});

test('generic native controls dispatch original macro and never synthetic dice or resource edits',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.spells=[{name:'Mage Hand',_key:'mage-hand',visible:'Cantrip'}];
  x.model.abilities={models:[{get(k){return {
    name:'Mage Hand',action:'%{char-player|repeating_spell_ROW_cast}'
  }[k];}}]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'spells'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudNativeKind:'spells',hudNativeKey:'mage-hand'}}});
  assert.deepEqual(x.sent,['%{char-player|Mage Hand}']);
  assert.equal(h.sent.length,0);
  assert.match(h.api.R3_NATIVE.status,/Invoked mapped Roll20 spells action/);
});
test('HUD maps observed Second Wind dice control as native Roll, but Show More is not spellcasting',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.features=[{name:'Second Wind',_key:'second-wind',tab:'Current view',
    visible:'Second Wind Bonus Action 1d10+5 available',
    actions:[{label:'1d10+5'}]}];
  snap.spells=[{name:'Detect Magic',_key:'detect-magic',tab:'SPELLS',
    visible:'Detect Magic 30 ft, 1 action',actions:[{label:'Show More'}]}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.R3_HUD.flyout='features';h.api.r3HudRender();
  const feature=h.api.r3NativeMapPreview('features','second-wind');
  assert.equal(feature.sheetAction,true,'exact observed feature dice button');
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/data-hud-native-kind="features"/);
  assert.match(html,/>Roll<\/button>/,'do not present healing dice roll as charge spending');
  assert.equal(h.api.r3NativeMapPreview('spells','detect-magic').sheetAction,undefined);
  assert.equal(x.sent.length,0,'render and preview never roll');
});
test('official observed saving throw and ability check controls are native; labels cannot be invented',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.saves={Strength:5,Constitution:3};
  snap.modifiers={Dexterity:2};
  snap.controls=[
    {kind:'action',element:'button',label:'Roll a Strength saving throw'},
    {kind:'action',element:'button',label:'Roll a Dexterity ability check'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3NativeMapPreview('saves','Strength').sheetAction,true);
  assert.equal(h.api.r3NativeMapPreview('modifiers','Dexterity').sheetAction,true);
  assert.equal(h.api.r3NativeMapPreview('saves','Constitution').sheetAction,undefined,
    'value alone never invents a Roll20 button');
  assert.equal(x.sent.length,0);
});
test('native registry rejects ambiguous, stale, cross-kind, unverified and unmanaged controls',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.spells=[{name:'Shield',_key:'a'},{name:'Shield',_key:'b'}];
  snap.features=[{name:'Shield',_key:'feature-shield'}];
  snap.inventory=[{name:'Antidote',_key:'item',quantity:3,
    controls:[{label:'Quantity',value:3}]}];
  x.model.abilities={models:[{get(k){return {name:'Shield',action:'%{char-player|repeating_spell_ROW_cast}'}[k];}},
    {get(k){return {name:'Antidote',action:'%{char-player|repeating_spell_ROW_cast}'}[k];}}]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  assert.match(h.api.r3NativeMapPreview('spells','a').reason,/Several source/);
  assert.match(h.api.r3NativeMapPreview('features','feature-shield').reason,/not an identified features/);
  assert.match(h.api.r3NativeMapPreview('inventory','item').reason,/not an identified inventory/);
  assert.equal(h.api.r3NativeInvoke('inventory','item'),false);
  assert.equal(x.sent.length,0);
  assert.deepEqual(Array.from(h.api.R3_UI.snapshot.inventory.map(x=>x.quantity)),[3]);
  assert.match(h.api.r3NativeMapSource('inventory','other').reason,/no unique source identity/);
  h.api.R3_TOKEN.active={name:'Wrong PC',characterId:'char-other'};
  assert.equal(h.api.r3NativeInvoke('spells','a'),false);
  assert.equal(x.sent.length,0);
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'inventory'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/No verified native Use action was found/);
  assert.doesNotMatch(html,/Native unmapped/);
  assert.doesNotMatch(html,/data-hud-native-key="item"/);
});
test('native macro mapping rejects additional chat, wrong identity and selection-relative targets',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.spells=[{name:'Magic Missile',_key:'missile'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  const ability={id:'safe-ability',get(k){return this[k];},
    name:'Magic Missile',action:'%{char-player|repeating_spell_ROW_cast}'};
  x.model.abilities={models:[ability]};
  assert.equal(h.api.r3NativeMapPreview('spells','missile').abilityName,'Magic Missile');
  for(const invalid of [
    '%{char-player|repeating_spell_ROW_cast} &{template:default} {{leak=1}}',
    '%{selected|repeating_spell_ROW_cast}',
    '%{char-other|repeating_spell_ROW_cast}',
    '%{char-player|repeating_spell_ROW_cast',
    '!api repeating_spell_ROW_cast'
  ]){
    ability.action=invalid;
    assert.equal(h.api.r3NativeMapPreview('spells','missile').abilityName,undefined,invalid);
    assert.equal(h.api.r3NativeInvoke('spells','missile'),false,invalid);
  }
  assert.equal(x.sent.length,0,'invalid native action macros must never be sent to chat');
});
test('exact official repeating row ID safely disambiguates same-named native attacks',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[
    {name:'Dagger',_key:'first',nativeRowId:'row-attack-001',visible:'Dagger +6 Attack 1d4+3'},
    {name:'Dagger',_key:'second',nativeRowId:'row-attack-002',visible:'Dagger +4 Attack 1d4+2'}
  ];
  const actions=[
    {name:'Attack A',action:'%{char-player|repeating_attack_row-attack-001_attack}'},
    {name:'Attack B',action:'%{char-player|repeating_attack("row-attack-002", "attack")}'}
  ];
  x.model.abilities={models:actions.map((model,i)=>({
    id:'native-'+i,get(k){return model[k];}
  }))};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3NativeMappedPreview('first').abilityName,'Attack A');
  assert.equal(h.api.r3NativeMappedPreview('second').abilityName,'Attack B');
  assert.equal(h.api.r3NativeMappedAttack('second'),true);
  assert.deepEqual(x.sent,['%{char-player|Attack B}']);
  actions[1].action='%{char-player|repeating_attack_row-attack-002-other_attack}';
  assert.equal(h.api.r3NativeMappedPreview('second').abilityName,undefined,
    'row-id substring must not match a different row');
  assert.equal(h.api.r3NativeMappedAttack('second'),false);
  assert.equal(x.sent.length,1);
});
test('capture preserves only row identity explicitly exposed on official sheet card',()=>{
  const h=panelHarness('Elowen');
  const observed=vm.runInContext('r3NativeObservedRowId',h.context);
  const card=attrs=>({getAttribute(k){return attrs[k]??null;}});
  assert.equal(observed(card({'data-row-id':'-OfficialRow12'})),'-OfficialRow12');
  assert.equal(observed(card({'data-testid':'attack-999','id':'row-42'})),'');
  assert.equal(observed(card({'data-row-id':'bad id'})),'');
  assert.equal(observed(card({'data-row-id':'attack-one','data-repeating-id':'attack-two'})),'');
});

test('explicit authenticated sheet macros execute directly when token-bar abilities are absent',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.spells=[
    {name:'Shield',_key:'shield-1',nativeActionRef:'%{char-player|repeating_spell_ROW111_cast}'},
    {name:'Shield',_key:'shield-2',nativeActionRef:'%{char-player|repeating_spell_ROW222_cast}'}
  ];
  x.model.abilities={models:[]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3NativeMapPreview('spells','shield-2').source,
    'Exact authenticated official-sheet action reference');
  assert.equal(h.api.r3NativeInvoke('spells','shield-2'),true);
  assert.deepEqual(x.sent,['%{char-player|repeating_spell_ROW222_cast}']);
  snap.spells[1].nativeActionRef='%{char-other|repeating_spell_ROW222_cast}';
  assert.equal(h.api.r3NativeInvoke('spells','shield-2'),false);
  assert.equal(x.sent.length,1);
  snap.spells[1].nativeActionRef='%{char-player|repeating_spell_ROW222_cast}; !api';
  assert.equal(h.api.r3NativeInvoke('spells','shield-2'),false);
  assert.equal(x.sent.length,1);
});

test('MISC discovers unclassified controlled-character repeating abilities without a sheet',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  x.model.abilities={models:[
    {id:'custom-row-01',get(k){return {name:'Custom Item Action',
      action:'%{char-player|repeating_custom_rowfoo_effect}'}[k];}},
    {id:'attack-row-01',get(k){return {name:'Dagger',
      action:'%{char-player|repeating_attack_rowbar_attack}'}[k];}},
    {id:'malicious-row-01',get(k){return {name:'Injected',action:'!api repeating_custom_foo'}[k];}},
    {id:'foreign-row-01',get(k){return {name:'Foreign',
      action:'%{char-other|repeating_custom_bar_effect}'}[k];}}
  ]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  const list=h.api.r3HudEntries(snap,'misc');
  assert.deepEqual(Array.from(list.map(item=>item.name)),['Custom Item Action']);
  assert.equal(h.api.r3NativeMapPreview('misc','ability:custom-row-01').abilityName,
    'Custom Item Action');
  assert.equal(h.api.r3NativeInvoke('misc','ability:custom-row-01'),true);
  assert.deepEqual(x.sent,['%{char-player|repeating_custom_rowfoo_effect}']);
  h.api.R3_TOKEN.active={name:'Other PC',characterId:'char-other'};
  assert.equal(h.api.r3NativeInvoke('misc','ability:custom-row-01'),false);
  assert.equal(x.sent.length,1);
});
test('MISC native actions are source-bound, and unknown controls remain unmapped',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.misc=[{name:'Custom roll',_key:'misc-custom',
    nativeActionRef:'%{char-player|repeating_custom_ROW123_roll}'}];
  x.model.abilities={models:[]};
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  assert.equal(h.api.r3HudEntries(snap,'misc').length,1);
  assert.equal(h.api.r3NativeMapPreview('misc','misc-custom').abilityName,'Custom roll');
  assert.equal(h.api.r3NativeInvoke('misc','misc-custom'),true);
  assert.deepEqual(x.sent,['%{char-player|repeating_custom_ROW123_roll}']);
  snap.misc.push({name:'Unmapped custom',_key:'unknown'});
  assert.equal(h.api.r3NativeInvoke('misc','unknown'),false);
  assert.equal(x.sent.length,1);
});
test('official rendered controls are imported into MISC only with complete explicit macros',()=>{
  const h=panelHarness('Elowen');
  const capture=h.context.r3Capture||vm.runInContext('r3Capture',h.context);
  const button=(name,action)=>({
    tagName:'BUTTON',innerText:name,
    getAttribute(k){return k==='aria-label'?name:k==='data-roll20-macro'?action:null;},
    querySelectorAll(){return [];},closest(){return null;},getClientRects(){return [{}];}
  });
  const valid=button('Custom roll','%{char-player|repeating_custom_ROW123_roll}');
  const malformed=button('Ignore injected','%{char-player|repeating_custom_ROW123_roll};!api');
  const unnamed=button('','%{char-player|repeating_custom_ROW123_roll}');
  const root={title:'Elowen',querySelectorAll(selector){
    return selector.includes('button[data-roll20-macro]')?[valid,malformed,unnamed]:[];
  },querySelector(){return null;}};
  const snap=capture(root,'Other');
  assert.equal(snap.misc.length,1);
  assert.equal(snap.misc[0].name,'Custom roll');
  assert.equal(snap.coverage.misc,1);
});
test('mapped native attack uses exact existing Roll20 character action and never opens a sheet',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Dagger',_key:'dagger-a',visible:'Dagger +7 Attack 1d4+4'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  x.model.abilities={models:[{id:'ab-one',get(k){return {
    name:'Dagger',action:'%{char-player|repeating_attack("row-mapped", "attack")}'
  }[k];}}]};
  h.api.r3HudRender();
  const mapping=h.api.r3NativeMappedPreview('dagger-a',h.api.R3_UI.snapshot);
  assert.equal(mapping.abilityName,'Dagger');
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackMode:'other'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/Native linked/);
  assert.match(html,/data-hud-attack-key="dagger-a"/);
  assert.doesNotMatch(html,/data-hud-dice-key="dagger-a"/);
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackKey:'dagger-a'}}});
  assert.equal(x.sent.length,1);
  assert.equal(x.sent[0],'%{char-player|Dagger}');
  assert.equal(h.sent.length,0,'never contacted an official sheet iframe');
  assert.match(h.api.R3_NATIVE.status,/Invoked the mapped Roll20/);
});
test('native action mapping refuses guesses and duplicate weapon labels',()=>{
  const x=observedChatRig('Elowen'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[
    {name:'Dagger',_key:'dagger-a',visible:'Dagger +7 Attack 1d4+4'},
    {name:'Dagger',_key:'dagger-b',visible:'Dagger +5 Attack 1d4+2'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  x.model.abilities={models:[{get(k){return {
    name:'Dagger',action:'%{char-player|repeating_attack("row-mapped", "attack")}'
  }[k];}}]};
  const map=h.api.r3NativeMappedPreview('dagger-a',h.api.R3_UI.snapshot);
  assert.match(map.reason,/same-named/);
  assert.equal(h.api.r3NativeMappedAttack('dagger-a'),false);
  assert.equal(x.sent.length,0);
  h.api.R3_UI.snapshot=h.api.r3Coverage({...snap,attacks:[snap.attacks[0]]});
  x.model.abilities.models[0].get=k=>({name:'Dagger',action:'&{template:default} {{name=Dagger}}'})[k];
  assert.match(h.api.r3NativeMappedPreview('dagger-a',h.api.R3_UI.snapshot).reason,/one complete, safe sheet-action reference/);
  assert.equal(h.api.r3NativeMappedAttack('dagger-a'),false);
  assert.equal(x.sent.length,0);
});
test('Explorer-style right click opens an observed weapon without rolling',()=>{
  const h=panelHarness();h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='NIER';
  snap.attacks=[
    {name:'Dagger',_key:'dagger',visible:'Dagger +7 Attack 1d4+4'},
    {name:'Dagger (Off-Hand)',_key:'offhand',visible:'Off-Hand Melee +5 Attack 1d4+2'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  let prevented=0;
  h.shadow.handlers.get('contextmenu')({target:{
    closest(sel){return sel==='[data-hud-weapon-row]'?{dataset:{hudWeaponRow:'melee|dagger'}}:null;}
  },preventDefault(){prevented++;},stopPropagation(){}});
  assert.equal(prevented,1);
  assert.match(h.nodes.get('r3-hud').innerHTML,/data-hud-dice-key="offhand"/);
  assert.equal(h.sent.length,0);
});
test('Attack buttons for arbitrary 2024 character names roll hit and damage in chat without sheets',()=>{
  for(const [character,weapon,bonus,damage] of [
    ['Elowen Dawnsong','Longbow','+7','1d8+3'],
    ['Brom Stonebeard','Warhammer','+5','1d10+2'],
    ['Sora Windfall','Shortbow','+8','1d6+4']
  ]){
    const x=observedChatRig(character),h=x.h;
    const snap=h.api.r3Empty();snap.name=character;
    snap.attacks=[{name:weapon,tab:'Combat',_key:weapon.toLowerCase(),
      visible:weapon+' '+bonus+' Attack '+damage}];
    h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
    h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
    assert.match(h.nodes.get('r3-hud').innerHTML,/ATTACKS &amp; WEAPONS/);
    assert.equal(x.sent.length,0);
    h.shadow.handlers.get('click')({target:{dataset:{hudDiceKey:weapon.toLowerCase()}}});
    assert.equal(x.sent.length,1,'a single player click submits one chat command');
    assert.ok(x.sent[0].includes('1d20'+bonus));
    assert.ok(x.sent[0].includes('Damage=[['+damage+']]'));
    assert.ok(x.sent[0].includes('name='+weapon+' Attack'));
    assert.equal(h.sent.length,0,'no character sheet was contacted');
    assert.match(h.api.R3_NATIVE.status,/Submitted/);
  }
});
test('native attack confirm refuses a changed active character snapshot',async()=>{
  const h=panelHarness('Elowen');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const elf=h.api.r3Empty();elf.name='Elowen';
  elf.attacks=[{name:'Spear',_key:'spear'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(elf);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudProbe:'Spear'}}});
  const id=h.sent.at(-1).message.id;
  h.windowListeners.get('message')({
    origin:'https://advanced-sheets.production.roll20preflight.net',
    source:h.frameWindow,data:{protocol:'r20eb:import:v3',type:'native-result',
      id,status:'ready',token:'token-elf',label:'Roll Attack'}
  });
  await new Promise(resolve=>setImmediate(resolve));
  const other=h.api.r3Empty();other.name='Brom';other.attacks=[{name:'Spear',_key:'spear'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(other);h.api.r3HudRender();
  const count=h.sent.length;
  h.click('r3-hud-native-confirm');
  assert.equal(h.sent.length,count,'no native click may be requested after switching character');
  assert.match(h.api.R3_NATIVE.status,/sheet changed/);
});
test('native UI cancel does not post a confirmation to the official sheet',async()=>{
  const h=panelHarness('Kaela');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Kaela';snap.attacks=[{name:'Mace',_key:'mace'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudProbe:'Mace'}}});
  const id=h.sent.at(-1).message.id;
  h.windowListeners.get('message')({
    origin:'https://advanced-sheets.production.roll20preflight.net',
    source:h.frameWindow,data:{protocol:'r20eb:import:v3',type:'native-result',
      id,status:'ready',token:'token-kaela',label:'Roll Attack'}
  });
  await new Promise(resolve=>setImmediate(resolve));
  const size=h.sent.length;
  h.click('r3-hud-native-cancel');
  assert.equal(h.sent.length,size);
  assert.equal(h.api.R3_NATIVE.preview,null);
});

test('switching auto-sync to another imported character clears the previous character ID',()=>{
  const h=panelHarness('Liora');h.api.r3StartUI();
  const next=h.api.r3Empty();next.name='Liora';
  next.attacks=[{name:'Rapier',_key:'rapier'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(next);
  h.api.R3_AUTO.name='Old Adventurer';
  h.api.R3_AUTO.characterId='previous-character-id';
  h.api.R3_AUTO.enabled=false;
  h.click('r3-hud-auto');
  assert.equal(h.api.R3_AUTO.enabled,true);
  assert.equal(h.api.R3_AUTO.name,'Liora');
  assert.equal(h.api.R3_AUTO.characterId,'');
  assert.match(h.store.get('roll20-embetterment-v3:123:auto'),/"name":"Liora"/);
});

function multiTokenRig(){
  const h=panelHarness('Elowen');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const characters=new Map();
  const collection={models:[],get(id){return characters.get(id)}};
  const selections=[];
  h.context.window.Campaign={characters:collection};
  h.context.window.d20={player:{id:'player-one'},
    engine:{selected(){return selections.slice()}}};
  const make=(id,name,controllers='player-one')=>{
    const ch={id,attributes:{name,controlledby:controllers},
      get(key){return this.attributes[key]}};
    characters.set(id,ch);collection.models.push(ch);
    const token={id:'token-'+id,attributes:{represents:id,
      imgsrc:'https://images.example.org/'+id+'.png'},
      get(key){return this.attributes[key]}};
    return {model:token};
  };
  const a=make('char-elf','Elowen Dawnsong');
  const b=make('char-dwarf','Brom Stonebeard');
  const outsider=make('char-gm','GM Monster','other-player');
  return {h,selections,make,a,b,outsider};
}
test('install-and-play auto-sync binds to verified token without importer setup',()=>{
  const x=multiTokenRig(),h=x.h;
  h.api.r3StartAuto();
  assert.equal(h.api.R3_AUTO.enabled,false,'no character has been verified yet');
  assert.equal(h.store.has('roll20-embetterment-v3:123:auto'),false);
  x.selections.push(x.a);h.api.r3TokenPoll();
  const a=h.api.R3_AUTO;
  assert.equal(a.enabled,true);
  assert.equal(a.name,'Elowen Dawnsong');
  assert.equal(a.characterId,'char-elf');
  assert.equal(a.origin,'token');
  assert.match(h.store.get('roll20-embetterment-v3:123:auto'),/"enabled":true/);
  assert.ok([...h.timeouts.values()].some(v=>v.ms===0),
    'first authorized selection queues a sync attempt without waiting for 8s timer');
  const generation=a.generation;
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(a.characterId,'char-dwarf');
  assert.equal(a.name,'Brom Stonebeard');
  assert.equal(a.generation,generation+1,'old sheet requests invalidated on PC change');
  assert.equal(h.api.R3_UI.snapshot.name,'Brom Stonebeard');
  assert.equal(h.api.R3_UI.snapshot.stats.hp,undefined);
});
test('uncontrolled and unlinked selections never enable background auto-sync',()=>{
  const x=multiTokenRig(),h=x.h;
  h.api.r3StartAuto();
  x.selections.push(x.outsider);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,false);
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push({model:{id:'unlinked',get(){return null;}}});h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,false);
  assert.equal(h.store.has('roll20-embetterment-v3:123:auto'),false);
});
test('selected token automatically resumes private sheet sync despite an old Off setting',()=>{
  const x=multiTokenRig(),h=x.h;
  const key='roll20-embetterment-v3:123:auto';
  h.store.set(key,JSON.stringify({enabled:false,name:'Earlier Character'}));
  h.api.r3StartAuto();
  assert.equal(h.api.R3_AUTO.explicitlyDisabled,true,'legacy preference read');
  x.selections.push(x.a);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,true,'authorized selection enables sync');
  assert.equal(h.api.R3_AUTO.explicitlyDisabled,false);
  assert.equal(h.api.R3_AUTO.characterId,'char-elf');
  assert.match(h.store.get(key),/"enabled":true/,'legacy Off migrated');
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.enabled,true,'no UI toggle can strand an active PC');
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,true);
  assert.equal(h.api.R3_AUTO.characterId,'char-dwarf');
  assert.equal(h.api.R3_AUTO.lastFull,0,'new PC schedules a complete sheet import');
  assert.equal(h.api.R3_AUTO.name,'Brom Stonebeard');
});
test('token-mode auto-sync refuses to open a saved character before live token selection',async()=>{
  const x=multiTokenRig(),h=x.h;
  h.api.R3_AUTO.enabled=true;
  h.api.R3_AUTO.origin='token';
  h.api.R3_AUTO.name='Elowen Dawnsong';
  h.api.R3_AUTO.characterId='char-elf';
  vm.runInContext('globalThis.testAutoTick=r3AutoTick',h.context);
  h.api.R3_TOKEN.active=null;
  h.api.R3_AUTO.lastOpenAttempt=0;
  await h.context.testAutoTick();
  assert.equal(h.api.R3_AUTO.lastOpenAttempt,0);
  assert.equal(h.api.R3_AUTO.opened,false);
});
test('automatic sync never accepts ID-less same-name sheet for a different PC',()=>{
  const x=multiTokenRig(),h=x.h;
  const twinA=x.make('twin-a','Twin');
  x.make('twin-b','Twin');
  x.selections.push(twinA);h.api.r3TokenPoll();
  const noId={type:'popout',name:'Twin',visible:true,window:{},characterId:''};
  const exact={type:'iframe',name:'Twin',visible:true,window:{},
    characterId:'twin-a'};
  h.context.r3Candidates=()=>[noId];
  assert.equal(h.api.r3AutoCandidate(),null,
    'name alone cannot identify one of two same-name player characters');
  h.context.r3Candidates=()=>[noId,exact];
  assert.equal(h.api.r3AutoCandidate(),exact);
  h.context.r3Candidates=()=>[noId,{...exact,characterId:'twin-b'}];
  assert.equal(h.api.r3AutoCandidate(),null);
});
test('token-mode Journal discovery never dispatches name-only wrong-character opening',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a);h.api.r3TokenPoll();
  let opened=0;
  const other={getAttribute(k){return k==='title'?'Elowen Dawnsong':null;},
    textContent:'Elowen Dawnsong',dispatchEvent(){opened++;}};
  const query=h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll=sel=>sel.startsWith('#journal')?[other]:query(sel);
  vm.runInContext('globalThis.tryAutoOpen=r3AutoOpenFromJournal',h.context);
  h.context.tryAutoOpen(Date.now());
  assert.equal(opened,0);
});
test('HUD automatically follows most recently selected controllable linked token',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a);
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.name,'Elowen Dawnsong');
  assert.equal(h.api.R3_UI.snapshot.name,'Elowen Dawnsong');
  assert.match(h.nodes.get('r3-hud').innerHTML,/char-elf\.png/);
  const elf=h.api.r3Empty();elf.name='Elowen Dawnsong';elf.stats.hp=41;
  elf.attacks=[{name:'Staff',_key:'staff'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(elf);h.api.r3TokenRecordSnapshot(h.api.R3_UI.snapshot);
  h.api.R3_HUD.weaponSets[0]={kind:'attacks',key:'staff'};h.api.r3HudSave();
  x.selections.push(x.b);
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.name,'Brom Stonebeard');
  assert.equal(h.api.R3_UI.snapshot.name,'Brom Stonebeard');
  assert.equal(h.api.R3_UI.snapshot.stats.hp,undefined);
  assert.equal(h.api.R3_HUD.weaponSets[0],null,'loadout must not leak to other character');
  assert.match(h.nodes.get('r3-hud').innerHTML,/char-dwarf\.png/);
  const dwarf=h.api.r3Empty();dwarf.name='Brom Stonebeard';dwarf.stats.hp=73;
  dwarf.attacks=[{name:'Axe',_key:'axe'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(dwarf);h.api.r3TokenRecordSnapshot(h.api.R3_UI.snapshot);
  h.api.R3_HUD.weaponSets[0]={kind:'attacks',key:'axe'};h.api.r3HudSave();
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push(x.a);h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot.stats.hp,41);
  assert.equal(h.api.R3_HUD.weaponSets[0].key,'staff');
  assert.match(h.nodes.get('r3-hud').innerHTML,/char-elf\.png/);
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot.stats.hp,73);
  assert.equal(h.api.R3_HUD.weaponSets[0].key,'axe');
});
test('noncontrollable and unlinked token selections cannot switch the current player HUD',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a);h.api.r3TokenPoll();
  const before=h.api.R3_TOKEN.active.characterId;
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push(x.outsider);h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.characterId,before);
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push({model:{id:'unlinked',get(key){return key==='represents'?'':null}}});
  h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.characterId,before);
});
test('latest newly selected controllable token wins in a multiselect without displaying GM tokens',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a,x.outsider,x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.name,'Brom Stonebeard');
  x.selections.length=0;h.api.r3TokenPoll();
  x.selections.push(x.outsider,x.a);h.api.r3TokenPoll();
  assert.equal(h.api.R3_TOKEN.active.name,'Elowen Dawnsong');
});
test('token selection follows each player-controlled character even when auto-sync is enabled',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a);h.api.r3TokenPoll();
  h.api.R3_AUTO.enabled=true;
  h.api.R3_AUTO.name='Elowen Dawnsong';
  h.api.R3_AUTO.characterId='char-elf';
  const previousGeneration=h.api.R3_AUTO.generation;
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.name,'Brom Stonebeard');
  assert.equal(h.api.R3_AUTO.characterId,'char-dwarf');
  assert.equal(h.api.R3_AUTO.generation,previousGeneration+1);
});
test('two different characters with the same name never share a name-only cached snapshot',()=>{
  const x=multiTokenRig(),h=x.h;
  x.make('same-one','Twin');
  const duplicate=x.make('same-two','Twin');
  const legacy=h.api.r3Empty();legacy.name='Twin';legacy.stats.hp=999;
  h.api.R3_TOKEN.legacy=h.api.r3Coverage(legacy);
  x.selections.push(duplicate);h.api.r3TokenPoll();
  assert.equal(h.api.R3_UI.snapshot.stats.hp,undefined);
  assert.equal(h.api.R3_TOKEN.snapshots.has('same-two'),false);
  const after=h.api.r3Empty();after.name='Twin';after.stats.hp=45;
  h.api.r3TokenRecordSnapshot(h.api.r3Coverage(after));
  assert.equal(h.api.R3_TOKEN.snapshots.has('same-two'),false);
});
test('real authenticated pending native attack is cancelled on character-token switch',()=>{
  const x=multiTokenRig(),h=x.h;
  x.selections.push(x.a);h.api.r3TokenPoll();
  h.api.R3_NATIVE.preview={characterName:'Elowen Dawnsong',attackName:'Staff',token:'one'};
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_NATIVE.preview,null);
});

test('duplicate-named weapons submit their own distinct observed rolls',()=>{
  const x=observedChatRig('Different Player'),h=x.h;
  const snap=h.api.r3Empty();snap.name='Different Player';
  const a={name:'Dagger',_key:'dagger|melee|+7|1d4+4',
    visible:'Dagger Melee +7 Attack 1d4+4',tab:'Combat'};
  const b={name:'Dagger',_key:'dagger|offhand|+5|1d4+2',
    visible:'Dagger Melee +5 Attack 1d4+2',tab:'Combat'};
  snap.attacks=[a,b];h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  h.shadow.handlers.get('click')({target:{dataset:{hudWeapon:'melee|dagger'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/data-hud-dice-key="dagger\|melee\|\+7\|1d4\+4"/);
  assert.match(html,/data-hud-dice-key="dagger\|offhand\|\+5\|1d4\+2"/);
  h.shadow.handlers.get('click')({target:{dataset:{hudDiceKey:b._key}}});
  assert.equal(x.sent.length,1);
  assert.ok(x.sent[0].includes('1d20+5'));
  assert.ok(x.sent[0].includes('1d4+2'));
  h.shadow.handlers.get('click')({target:{dataset:{hudDiceKey:a._key}}});
  assert.equal(x.sent.length,2);
  assert.ok(x.sent[1].includes('1d20+7'));
  assert.ok(x.sent[1].includes('1d4+4'));
});
test('legacy name-only native probe refuses two identically named imported attacks',()=>{
  const h=panelHarness('Another Player');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Another Player';
  snap.attacks=[
    {name:'Dagger',_key:'a',visible:'Dagger +7 Attack 1d4+4'},
    {name:'Dagger',_key:'b',visible:'Dagger +5 Attack 1d4+2'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  const before=h.sent.length;
  h.shadow.handlers.get('click')({target:{dataset:{hudProbe:'Dagger'}}});
  assert.equal(h.sent.length,before);
  assert.match(h.api.R3_NATIVE.status,/unique attack/);
});


function backgroundNativeRig(){
  const h=panelHarness('Elowen'),dialogs=[],frames=[],overlays=[],log=[];
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  const original=h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll=selector=>
    selector==='iframe'?frames:selector==='.characterdialog'?dialogs:
      selector==='.ui-widget-overlay'?overlays:original(selector);
  const characters=new Map(),models=[];
  function create(id,name,controlledby='player-one'){
    const model={id,attributes:{name,controlledby},get(k){return this.attributes[k]}};
    model.view={showDialog(){
      log.push({kind:'show',id});
      const dialog={id:'new-'+id,isConnected:true,style:{position:'absolute',left:'30px',top:'40px'},
        getAttribute(k){return k==='data-characterid'?id:null},
        closest(){return null}};
      const win={postMessage(message){log.push({kind:'post',id,type:message.type})}};
      const frame={src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/test',
        contentWindow:win,getClientRects(){return [{}]},
        getAttribute(k){return k==='title'?name:null},
        closest(selector){return selector.includes('.characterdialog')?dialog:null}};
      dialogs.push(dialog);frames.push(frame);
      return dialog;
    }};
    characters.set(id,model);models.push(model);
    return model;
  }
  create('char-elf','Elowen');create('char-dwarf','Brom');
  create('char-locked','Secret NPC','other-player');
  h.context.window.Campaign={characters:{models,get(id){return characters.get(id)}}};
  h.context.window.d20={player:{id:'player-one'}};
  return {h,dialogs,frames,overlays,log,create};
}
test('advanced native-sheet diagnostic still works through private reader',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  // Real Jumpgate does not require window.d20.Campaign, engine or player.
  h.context.window.d20=undefined;
  h.context.window.currentPlayer={id:'player-one'};
  assert.equal(h.api.r3NativeBgResolve('Elowen').id,'char-elf');
  const character=h.context.window.Campaign.characters.get('char-elf');
  const originalShow=character.view.showDialog;
  const received=[];
  character.view.showDialog=function(){
    originalShow.call(this);
    const w=x.frames.at(-1).contentWindow;
    w.postMessage=(msg)=>{
      received.push(msg);
      const data=msg.type==='hello'?
        {type:'ready',name:'Elowen',session:'jumpgate-2024-reader',mode:'iframe'}:
        {type:'native-result',id:msg.id,
          status:msg.type==='native-probe'?'ready':'clicked',
          token:'verified-once-only',label:'+4 Attack',
          message:'Clicked the official attack control once'};
      queueMicrotask(()=>h.windowListeners.get('message')({
        origin:'https://advanced-sheets.production.roll20preflight.net',
        source:w,data:{protocol:'r20eb:import:v3',...data}
      }));
    };
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.attacks=[{name:'Quarterstaff',_key:'staff|melee+4|1d6+2',
    visible:'Quarterstaff Melee +4 Attack 1d6+2'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  assert.match(h.nodes.get('r3-hud').innerHTML,/data-hud-dice-key="staff\|melee\+4\|1d6\+2"/);
  void h.api.r3NativeProbe('staff|melee+4|1d6+2',true);
  // The event listener deliberately does not await an async native roll;
  // yield until its authenticated reader handshake has had a chance to finish.
  for(let i=0;i<12&&h.api.R3_NATIVE.busy;i++)
    await new Promise(resolve=>setImmediate(resolve));
  assert.equal(received.filter(m=>m.type==='native-probe').length,1,
    'Attack never reached Roll20: '+h.api.R3_NATIVE.status);
  assert.equal(received.filter(m=>m.type==='native-invoke').length,1);
  assert.equal(received.find(m=>m.type==='native-invoke').attackKey,'staff|melee+4|1d6+2');
  assert.equal(x.log.filter(m=>m.kind==='show').length,1);
  assert.match(h.api.R3_NATIVE.status,/Clicked the official attack control once/);
  assert.equal(h.api.R3_NATIVE.preview,null,
    'single-click path consumed the token and cannot invoke again');
});
test('obsolete d20 Campaign alone is never permission evidence for native Attack opening',()=>{
  const x=backgroundNativeRig(),h=x.h;
  const legacy=h.context.window.Campaign;
  h.context.window.Campaign=undefined;
  h.context.window.d20={Campaign:legacy,player:{id:'player-one'}};
  assert.match(h.api.r3NativeBgResolve('Elowen').reason,/Jumpgate.*window.Campaign.characters/);
  assert.equal(x.log.filter(m=>m.kind==='show').length,0);
});
test('background native reader opens only a new linked controllable player sheet and moves it offscreen',async()=>{
  const x=backgroundNativeRig();
  const manual={style:{left:'400px',top:'100px',position:'absolute'},
    getAttribute(k){return k==='data-characterid'?'other-character':null}};
  x.dialogs.push(manual);
  const c=await x.h.api.r3NativeBgEnsure('Elowen');
  assert.equal(c.name,'Elowen');
  assert.equal(x.log.filter(y=>y.kind==='show').length,1);
  assert.equal(x.dialogs.length,2);
  assert.equal(x.dialogs[1].style.left,'-20000px');
  assert.equal(x.dialogs[1].style.top,'-20000px');
  assert.equal(manual.style.left,'400px','unrelated manually opened sheet was not moved');
  assert.equal(manual.style.position,'absolute');
  assert.equal(x.h.api.r3NativeBgCandidate().window,c.window);
  assert.equal(x.h.api.r3NativeIsOwned(c),true);
});
test('background attack session refuses to move or reopen a manually opened same-character sheet',async()=>{
  const x=backgroundNativeRig();
  const manual={style:{left:'300px',top:'20px',position:'absolute'},
    getAttribute(k){return k==='data-characterid'?'char-elf':null}};
  x.dialogs.push(manual);
  await assert.rejects(x.h.api.r3NativeBgEnsure('Elowen'),/already open/);
  assert.equal(x.log.length,0);
  assert.equal(manual.style.left,'300px');
});
test('no controller permission and duplicate names block creating background character sessions',async()=>{
  const x=backgroundNativeRig();
  await assert.rejects(x.h.api.r3NativeBgEnsure('Secret NPC'),/not show this character as controlled/);
  x.create('char-elf2','Elowen');
  await assert.rejects(x.h.api.r3NativeBgEnsure('Elowen'),/Multiple Roll20 characters share this name/);
  assert.equal(x.log.length,0);
});
test('selected hidden reader imports from exact character ID despite a generic iframe title',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const privateSheet=await h.api.r3NativeBgEnsure('Elowen');
  const frame=x.frames.at(-1);
  frame.getAttribute=k=>k==='title'?'2024 Character Sheet':null;
  h.api.R3_AUTO.enabled=true;
  h.api.R3_AUTO.name='Elowen';h.api.R3_AUTO.characterId='char-elf';
  const privateSession=h.api.r3AutoCandidate();
  assert.ok(privateSession,'ID-bound private sheet must not require a title carrying the character name');
  assert.equal(privateSession.window,privateSheet.window);
  assert.equal(privateSession.name,'Elowen');
  assert.equal(privateSession.characterId,'char-elf');
  assert.equal(h.api.r3NativeIsOwned(privateSession),true);
  h.api.R3_NATIVE.readers.set(privateSession.window,{name:'Brom',session:'wrong-session'});
  assert.equal(h.api.r3AutoCandidate(),null,
    'contradictory authenticated reader name is rejected, not silently imported');
  h.api.R3_NATIVE.readers.set(privateSession.window,{name:'Elowen',session:'right-session'});
  assert.equal(h.api.r3AutoCandidate().window,privateSession.window);
  assert.equal(x.dialogs[0].style.left,'-20000px');
});
test('two owned background readers are isolated and reusable when switching selected characters',async()=>{
  const x=backgroundNativeRig();
  const first=await x.h.api.r3NativeBgEnsure('Elowen');
  const second=await x.h.api.r3NativeBgEnsure('Brom');
  assert.notEqual(first.window,second.window);
  assert.equal(x.dialogs.length,2);
  assert.equal(x.dialogs[0].style.left,'-20000px');
  assert.equal(x.dialogs[1].style.left,'-20000px');
  const again=await x.h.api.r3NativeBgEnsure('Elowen');
  assert.equal(again.window,first.window);
  assert.equal(x.log.filter(x=>x.kind==='show').length,2);
  assert.equal(x.h.api.r3NativeIsOwned(again),true);
});
test('background sheets are not synthesized from existing iframes or unrelated character names',async()=>{
  const x=backgroundNativeRig();
  const manual=x.create('other','Different Player','player-one');
  await assert.rejects(x.h.api.r3NativeBgEnsure('Nier'),/no unique matching character model/);
  assert.equal(x.log.length,0);
  assert.ok(manual);
});

test('an attack can probe and confirm through a HUD-owned sheet without opening a manual sheet',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  snapshot.attacks=[{name:'Quarterstaff',_key:'quarterstaff|attack',
    visible:'Quarterstaff Melee +4 Attack 1d6+2'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.api.r3HudRender();
  // The fake official reader answers authenticated requests as a mounted
  // reader would. No preexisting character iframe or manually opened sheet.
  const original=x.create;
  const models=h.context.window.Campaign.characters.models;
  const char=models.find(c=>c.id==='char-elf');
  const originalShow=char.view.showDialog;
  char.view.showDialog=function(){
    originalShow.call(this);
    const frame=x.frames.at(-1),w=frame.contentWindow;
    w.postMessage=(data,origin)=>{
      x.log.push({kind:'post',type:data.type,background:data.background});
      queueMicrotask(()=>h.windowListeners.get('message')({
        origin:'https://advanced-sheets.production.roll20preflight.net',
        source:w,data:data.type==='hello'?
          {protocol:'r20eb:import:v3',type:'ready',name:'Elowen',
            session:'reader-session-elf',mode:'iframe'}:
          {protocol:'r20eb:import:v3',type:'native-result',
            id:data.id,status:data.type==='native-probe'?'ready':'clicked',
            token:'reader-sample-token',label:'+4 Attack',
            message:'Native control acknowledged'}
      }));
    };
  };
  // The authenticated ready handshake polls using short real-world delays.
  // Advance simulated timeout tasks through microtasks in this fake browser.
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  await h.api.r3NativeProbe('quarterstaff|attack');
  assert.equal(x.log.filter(l=>l.kind==='show').length,1);
  assert.equal(x.log.find(l=>l.type==='native-probe').background,true);
  assert.equal(h.api.R3_NATIVE.preview.characterName,'Elowen');
  await h.api.r3NativeConfirm();
  assert.equal(x.log.find(l=>l.type==='native-invoke').background,true);
  assert.equal(x.log.filter(l=>l.kind==='show').length,1,
    'confirm reuses the owned dialog instead of opening a second sheet');
  assert.equal(x.dialogs[0].style.left,'-20000px');
});

test('background native requests cannot reuse an unrelated same-name character token reader',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  x.create('char-twin-one','Twin'),x.create('char-twin-two','Twin');
  h.api.R3_TOKEN.active={characterId:'char-twin-one',name:'Twin'};
  const otherDialog={style:{left:'40px'},
    getAttribute(k){return k==='data-characterid'?'char-twin-two':null}};
  x.dialogs.push(otherDialog);
  x.frames.push({src:'https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/test',
    contentWindow:{postMessage(){}},getClientRects(){return [{}]},
    getAttribute(k){return k==='title'?'Twin':null},
    closest(){return otherDialog}});
  assert.equal(h.api.r3NativeCandidate('Twin'),null);
  const selected=await h.api.r3NativeBgEnsure('Twin');
  assert.equal(selected.name,'Twin');
  assert.equal(selected.frame.closest('.characterdialog').getAttribute('data-characterid'),'char-twin-one');
  assert.equal(otherDialog.style.left,'40px');
});
test('a native attack confirmation cannot cross to a different same-named selected token',async()=>{
  const h=panelHarness('Twin');h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Twin';
  snap.attacks=[{name:'Spear',_key:'spear|+5',visible:'Spear +5 Attack 1d6'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.R3_TOKEN.active={characterId:'char-second',name:'Twin'};
  h.api.R3_NATIVE.preview={characterName:'Twin',characterId:'char-first',
    attackName:'Spear',attackKey:'spear|+5',attackText:'Spear +5 Attack 1d6',
    token:'one-use',window:{}};
  await h.api.r3NativeConfirm();
  assert.equal(h.api.R3_NATIVE.preview,null);
  assert.match(h.api.R3_NATIVE.status,/sheet changed/);
  assert.equal(h.sent.length,0);
});

test('Roll20 browser currentPlayer.id is the authoritative control identity without d20.player',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  delete h.context.window.d20.player;
  h.context.window.currentPlayer={id:'player-one',get(k){return k==='id'?this.id:null}};
  assert.equal(h.api.r3TokenPlayerId(),'player-one');
  const c=await h.api.r3NativeBgEnsure('Elowen');
  assert.equal(c.name,'Elowen');
  assert.equal(x.dialogs.length,1);
  assert.equal(x.dialogs[0].style.left,'-20000px');
});
test('Roll20 Backbone currentPlayer.get("_id") and string permission are recognized for selected token',()=>{
  const x=multiTokenRig(),h=x.h;
  delete h.context.window.d20.player;
  h.context.window.currentPlayer={
    get(key){return key==='_id'?'player-one':null}
  };
  x.selections.push(x.a);
  h.api.r3TokenPoll();
  assert.equal(h.api.r3TokenPlayerId(),'player-one');
  assert.equal(h.api.R3_TOKEN.active.characterId,'char-elf');
});
test('already selected linked character can open its own background sheet before token polling',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  delete h.context.window.d20.player;
  h.context.window.currentPlayer={id:'player-one'};
  const char=x.create('second-spear','Spear Carrier');
  const token={model:{id:'token-spear',get(k){
    return k==='represents'?'second-spear':null
  }}};
  h.context.window.d20.engine={selected(){return [token]}};
  assert.equal(h.api.R3_TOKEN.active,null,'token watch has not populated active yet');
  const info=h.api.r3NativeBgResolve('Spear Carrier');
  assert.equal(info.id,'second-spear');
  const c=await h.api.r3NativeBgEnsure('Spear Carrier');
  assert.equal(c.name,'Spear Carrier');
  assert.equal(h.api.R3_TOKEN.active,null,'background opener does not alter selected HUD state');
  assert.ok(char);
});
test('a selected same-name linked token disambiguates two independently controlled characters',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const first=x.create('twina','Same Name');
  x.create('twinb','Same Name');
  delete h.context.window.d20.player;
  h.context.window.currentPlayer={id:'player-one'};
  const token={model:{id:'chosen-twin',get(key){
    return key==='represents'?'twina':null;
  }}};
  h.context.window.d20.engine={selected(){return [token]}};
  assert.equal(h.api.r3NativeBgResolve('Same Name').id,'twina');
  const candidate=await h.api.r3NativeBgEnsure('Same Name');
  assert.equal(candidate.frame.closest('.characterdialog').getAttribute('data-characterid'),'twina');
  assert.ok(first);
});
test('selected token is not proof of control if actual character permission excludes player',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  delete h.context.window.d20.player;
  h.context.window.currentPlayer={id:'player-one'};
  const token={model:{id:'locked-token',get(key){
    return key==='represents'?'char-locked':null;
  }}};
  h.context.window.d20.engine={selected(){return [token]}};
  await assert.rejects(h.api.r3NativeBgEnsure('Secret NPC'),/Controlled By/i);
  assert.equal(x.log.filter(item=>item.kind==='show').length,0);
});
test('missing editor identity provides actionable diagnostics, never opens a guessed sheet',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  delete h.context.window.d20.player;
  delete h.context.window.currentPlayer;
  await assert.rejects(h.api.r3NativeBgEnsure('Elowen'),/did not expose the logged-in player identity/);
  assert.equal(x.dialogs.length,0);
});
test('Roll20 all-player and array-shaped controlledby grants work, but view-only does not',()=>{
  const x=backgroundNativeRig(),h=x.h;
  h.context.window.currentPlayer={id:'player-one'};
  const models=h.context.window.Campaign.characters.models;
  const char=models.find(m=>m.id==='char-elf');
  char.attributes.controlledby=['other-player','player-one'];
  assert.equal(h.api.r3TokenControls(char),true);
  char.attributes.controlledby='all';
  assert.equal(h.api.r3TokenControls(char),true);
  char.attributes.controlledby='';
  char.attributes.inplayerjournals='player-one';
  assert.equal(h.api.r3TokenControls(char),false,'journal visibility is not sheet-control permission');
});

test('native HUD owner hides a newly identified sheet before iframe validation',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  let notify,observed=false,disconnected=false,known=false;
  h.context.MutationObserver=class{
    constructor(cb){notify=cb;}
    observe(){observed=true;}
    disconnect(){disconnected=true;}
  };
  const model=h.context.window.Campaign.characters.models.find(m=>m.id==='char-elf');
  const show=model.view.showDialog;
  model.view.showDialog=function(){
    show.call(this);
    const dialog=x.dialogs.at(-1);
    dialog.getAttribute=k=>k==='data-characterid'&&known?'char-elf':null;
    queueMicrotask(()=>{known=true;notify();});
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  const c=await h.api.r3NativeBgEnsure('Elowen');
  assert.equal(c.name,'Elowen');
  assert.equal(observed,true);assert.equal(disconnected,true);
  assert.equal(x.dialogs.at(-1).style.left,'-20000px');
});
test('HUD owner shields only its new modal overlay',async()=>{
  const x=backgroundNativeRig(),h=x.h,old={style:{opacity:'0.6',pointerEvents:'auto'}};
  x.overlays.push(old);
  const model=h.context.window.Campaign.characters.models.find(m=>m.id==='char-elf');
  const show=model.view.showDialog;
  model.view.showDialog=function(){show.call(this);x.overlays.push({style:{opacity:'0.6',pointerEvents:'auto'}});};
  await h.api.r3NativeBgEnsure('Elowen');
  assert.equal(x.overlays[1].style.opacity,'0');
  assert.equal(x.overlays[1].style.pointerEvents,'none');
  assert.equal(old.style.opacity,'0.6');
});
test('auto-sync Journal opener hides a new verified wrapper and modal, restores both on disable',()=>{
  const h=panelHarness(),a=h.api.R3_AUTO;
  a.enabled=true;a.name='Aria';a.characterId='char-aria';
  let observing=false;
  h.context.MutationObserver=class{
    constructor(callback){this.callback=callback;}
    observe(){observing=true;}
    disconnect(){}
  };
  h.context.MouseEvent=function(type){this.type=type;};
  const existing={style:{left:'300px'},getAttribute(k){return k==='data-characterid'?'other':null}};
  const priorOverlay={style:{opacity:'0.6',pointerEvents:'auto'}};
  const wrap={style:{position:'absolute',left:'90px',top:'75px',pointerEvents:'auto'}};
  const created={style:{left:'30px'},getAttribute(k){return k==='data-characterid'?'char-aria':null},
    closest(sel){return sel==='.ui-dialog'?wrap:null}};
  const modal={style:{opacity:'0.6',pointerEvents:'auto'}};
  const dialogs=[existing],overlays=[priorOverlay];
  const row={getAttribute(k){return k==='data-characterid'?'char-aria':null},
    dispatchEvent(event){assert.equal(event.type,'dblclick');dialogs.push(created);overlays.push(modal);}};
  const query=h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll=sel=>sel==='.characterdialog'?dialogs:
    sel==='.ui-widget-overlay'?overlays:sel.includes('#journal')?[row]:query(sel);
  vm.runInContext('globalThis.openAutoTest=r3AutoOpenFromJournal;globalThis.closeAutoTest=r3AutoRestoreDialog;',h.context);
  assert.equal(h.context.openAutoTest(Date.now()),true);
  assert.equal(observing,true);
  assert.equal(wrap.style.left,'-20000px');
  assert.equal(modal.style.opacity,'0');
  assert.equal(priorOverlay.style.opacity,'0.6');
  assert.equal(existing.style.left,'300px');
  h.context.closeAutoTest();
  assert.equal(wrap.style.left,'90px');
  assert.equal(modal.style.opacity,'0.6');
});

test('first Find waits for an official reader that ignores early hello messages',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  snapshot.attacks=[{name:'Longbow',_key:'bow-one',visible:'Longbow +5 Attack 1d8+3'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  let helloCount=0,nativeCount=0;
  const model=h.context.window.Campaign.characters.models.find(m=>m.id==='char-elf');
  const opening=model.view.showDialog;
  model.view.showDialog=function(){
    opening.call(this);
    const win=x.frames.at(-1).contentWindow;
    win.postMessage=msg=>{
      if(msg.type==='hello'){
        if(++helloCount<2)return; // First message was sent before the official reader mounted.
        queueMicrotask(()=>h.windowListeners.get('message')({
          origin:'https://advanced-sheets.production.roll20preflight.net',source:win,
          data:{protocol:'r20eb:import:v3',type:'ready',
            name:'Elowen',session:'hello-delayed-reader',mode:'iframe'}
        }));
      }else if(msg.type==='native-probe'){
        nativeCount++;
        queueMicrotask(()=>h.windowListeners.get('message')({
          origin:'https://advanced-sheets.production.roll20preflight.net',source:win,
          data:{protocol:'r20eb:import:v3',type:'native-result',
            id:msg.id,status:'ready',token:'once-only',
            label:'+5 Attack',message:'Found true native hit roll'}
        }));
      }
    };
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  h.api.r3StartEditorBridge();
  await h.api.r3NativeProbe('bow-one');
  assert.ok(helloCount>=2,'initial find retries authenticated initialization');
  assert.equal(nativeCount,1,'one player Find sends only one successful attack probe');
  assert.equal(h.api.R3_NATIVE.preview?.attackName,'Longbow');
  assert.equal(x.log.filter(item=>item.kind==='show').length,1,'no second dialog');
});
test('owned sheet can be revealed and manually closed without invisible pointer traps',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const a=await h.api.r3NativeBgEnsure('Elowen');
  const sheet=x.dialogs[0];
  assert.equal(sheet.style.opacity,'0');
  assert.notEqual(sheet.style.pointerEvents,'none','do not make an accidentally visible sheet uncloseable');
  h.api.r3NativeBgReveal();
  assert.equal(sheet.style.left,'30px');
  assert.equal(sheet.style.top,'40px');
  assert.equal(sheet.style.opacity,undefined);
  assert.equal(h.api.R3_NATIVE_BG.dialog,null,'revealed sheet is no longer privately owned');
  assert.match(h.api.R3_NATIVE.status,/visible again/);
  assert.ok(a.window);
});
test('manual sheets are not hidden by recovery styling or reveal operations',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const manual={style:{position:'absolute',left:'400px',top:'100px',opacity:'1'},
    getAttribute(key){return key==='data-characterid'?'another-player':null}};
  x.dialogs.push(manual);
  await h.api.r3NativeBgEnsure('Elowen');
  assert.equal(manual.style.opacity,'1');
  h.api.r3NativeBgReveal();
  assert.equal(manual.style.left,'400px');
  assert.equal(manual.style.top,'100px');
  assert.equal(manual.style.opacity,'1');
});

test('initial native Find retries transient Combat mounting errors on one HUD action',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  snapshot.attacks=[{name:'Rapier',_key:'rapier',visible:'Rapier +6 Attack 1d8+3'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.api.r3StartEditorBridge();
  let probes=0;
  const model=h.context.window.Campaign.characters.models.find(m=>m.id==='char-elf');
  const open=model.view.showDialog;
  model.view.showDialog=function(){
    open.call(this);
    const win=x.frames.at(-1).contentWindow;
    win.postMessage=data=>{
      const payload=data.type==='hello'?
        {type:'ready',session:'combat-reader-elf',name:'Elowen',mode:'iframe'}:
        {type:'native-result',id:data.id,status:++probes===1?'blocked':'ready',
          message:probes===1?'Matched the attack row but found no verified attack-roll button. Labels: (unlabeled).':'Verified',
          token:'single-use',label:'+6 Attack'};
      queueMicrotask(()=>h.windowListeners.get('message')({
        origin:'https://advanced-sheets.production.roll20preflight.net',
        source:win,data:{protocol:'r20eb:import:v3',...payload}
      }));
    };
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  await h.api.r3NativeProbe('rapier');
  assert.equal(probes,2);
  assert.equal(x.log.filter(item=>item.kind==='show').length,1);
  assert.equal(h.api.R3_NATIVE.preview?.attackName,'Rapier');
});
test('wrong official sheet name fails closed before attempting attack even when iframe exists',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const snapshot=h.api.r3Empty();snapshot.name='Elowen';
  snapshot.attacks=[{name:'Dagger',_key:'dagger',visible:'Dagger +5 Attack 1d4+3'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snapshot);
  h.api.r3StartEditorBridge();
  let nativeRequests=0;
  const model=h.context.window.Campaign.characters.models.find(m=>m.id==='char-elf');
  const open=model.view.showDialog;
  model.view.showDialog=function(){
    open.call(this);
    const win=x.frames.at(-1).contentWindow;
    win.postMessage=data=>{
      if(data.type!=='hello'){nativeRequests++;return;}
      queueMicrotask(()=>h.windowListeners.get('message')({
        origin:'https://advanced-sheets.production.roll20preflight.net',
        source:win,data:{protocol:'r20eb:import:v3',type:'ready',
          session:'different-player-sheet',name:'Brom',mode:'iframe'}
      }));
    };
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  await h.api.r3NativeProbe('dagger');
  assert.equal(nativeRequests,0);
  assert.equal(h.api.R3_NATIVE.preview,null);
  assert.match(h.api.R3_NATIVE.status,/identity does not match/);
});
test('private sheet styles persist as important rules and do not target player-opened windows',async()=>{
  const x=backgroundNativeRig(),styles=[];
  x.h.document.head={appendChild(element){styles.push(element);}};
  const manual={style:{left:'400px',opacity:'1'},getAttribute(k){return k==='data-characterid'?'manual':null}};
  x.dialogs.push(manual);
  await x.h.api.r3NativeBgEnsure('Elowen');
  assert.equal(styles.length,1);
  assert.match(styles[0].textContent,/data-r3-private-reader/);
  assert.match(styles[0].textContent,/opacity:0!important/);
  assert.match(styles[0].textContent,/pointer-events:none!important/);
  assert.equal(manual.style.opacity,'1');
});


test('Firefox Show Sheet rescues every native background session, not just the active one',async()=>{
  const x=backgroundNativeRig(),h=x.h;
  const first=await h.api.r3NativeBgEnsure('Elowen');
  const second=await h.api.r3NativeBgEnsure('Brom');
  assert.notEqual(first.window,second.window);
  assert.equal(x.dialogs[0].style.left,'-20000px');
  assert.equal(x.dialogs[1].style.left,'-20000px');
  vm.runInContext(readFileSync(join(root,'extension/firefox/sheet-visibility.js'),'utf8')+
    '\nglobalThis.sheetApi={r3SheetRevealAll,r3SheetAllowsBackground,r3SheetVisibilityInstall,r3SheetOnPlayerJournal,R3_SHEET_VIS};',h.context);
  const api=h.context.sheetApi;
  api.r3SheetRevealAll(true);
  assert.equal(x.dialogs[0].style.left,'30px');
  assert.equal(x.dialogs[1].style.left,'30px');
  assert.equal(h.api.R3_NATIVE_BG.sessions.size,0);
  assert.equal(h.api.R3_NATIVE_BG.dialog,null);
  assert.equal(api.r3SheetAllowsBackground(),false);
  await assert.rejects(h.api.r3NativeBgEnsure('Elowen'),/original Roll20 sheet is being opened/);
  assert.equal(x.log.filter(a=>a.kind==='show').length,2,'rescue must not open another invisible sheet');
  api.R3_SHEET_VIS.manualUntil=0;
  assert.equal(api.r3SheetAllowsBackground(),true,'automatic resume needs no toggle');
});
test('Firefox manual Journal open restores hidden Auto-sync-owned sheet before Roll20 handles click',()=>{
  const h=panelHarness('Aria'),auto=h.api.R3_AUTO;
  const wrap={style:{position:'absolute',left:'120px',top:'45px',pointerEvents:'auto'}};
  const dialog={style:{left:'12px',top:'20px'},closest(sel){return sel==='.ui-dialog'?wrap:null}};
  auto.enabled=true;auto.opened=true;auto.openedAt=Date.now();
  auto.preOpenDialogs=new Set();
  vm.runInContext('globalThis.claimAuto=r3AutoMoveDialogOffscreen;',h.context);
  assert.equal(h.context.claimAuto(dialog),true);
  assert.equal(wrap.style.left,'-20000px');
  const gen=auto.generation;
  let registered=null;
  h.document.addEventListener=(type,fn)=>{if(type==='pointerdown')registered=fn;};
  vm.runInContext(readFileSync(join(root,'extension/firefox/sheet-visibility.js'),'utf8')+
    '\nglobalThis.sheetApi={r3SheetRevealAll,r3SheetAllowsBackground,r3SheetVisibilityInstall,r3SheetOnPlayerJournal,R3_SHEET_VIS};',h.context);
  h.context.sheetApi.r3SheetVisibilityInstall();
  assert.equal(typeof registered,'function');
  registered({type:'pointerdown',isTrusted:true,target:{
    closest(sel){return sel.startsWith('#journal')?{}:null;}
  }});
  assert.equal(wrap.style.left,'120px');
  assert.equal(wrap.style.top,'45px');
  assert.equal(auto.ownedDialog,null);
  assert.ok(auto.generation>gen,'in-flight background scans are invalidated');
  assert.equal(h.context.sheetApi.r3SheetAllowsBackground(),false);
  assert.equal(h.context.claimAuto(dialog),false,'Auto-sync cannot recapture manual sheet');
  registered({type:'pointerdown',isTrusted:false,target:{
    closest(sel){return sel.startsWith('#journal')?{}:null;}
  }});
  assert.equal('manualPriority' in h.context.sheetApi.R3_SHEET_VIS,false,
    'neither trusted nor synthetic events can disable readers persistently');
  assert.equal(h.context.sheetApi.r3SheetAllowsBackground(),false,
    'the manual sheet is still in its opening grace period');
});
test('Firefox migrates legacy opt-out and automatically resumes private access',()=>{
  const h=panelHarness('Aria'),installed=[];
  h.document.addEventListener=(type,fn)=>installed.push(type);
  vm.runInContext(readFileSync(join(root,'extension/firefox/sheet-visibility.js'),'utf8')+
    '\nglobalThis.sheetApi={r3SheetRevealAll,r3SheetAllowsBackground,r3SheetVisibilityInstall,R3_SHEET_VIS,r3SheetVisibilityKey};',h.context);
  const api=h.context.sheetApi,key=api.r3SheetVisibilityKey();
  h.store.set(key,'true'); // sticky disable from an earlier signed build
  api.r3SheetVisibilityInstall();
  assert.equal(h.store.has(key),false,'obsolete opt-out removed at startup');
  assert.equal(api.r3SheetAllowsBackground(),true);
  assert.deepEqual(installed,['pointerdown','dblclick','keydown']);
  api.r3SheetRevealAll(); // Show Sheet restores dialogs rather than disabling
  assert.equal(api.r3SheetAllowsBackground(),false,'brief manual access grace');
  assert.equal(h.store.has(key),false,'Show Sheet never persists a disable');
  api.R3_SHEET_VIS.manualUntil=0;
  assert.equal(api.r3SheetAllowsBackground(),true,'automatic resume without user input');
});

function nativeDomActionRig(kind='skills'){
  const x=backgroundNativeRig(),h=x.h,received=[];
  const snap=h.api.r3Empty();snap.name='Elowen';
  snap.skills={Athletics:4};
  snap.controls=[{kind:'action',element:'button',label:'Roll a Athletics check'}];
  snap.attacks=[{name:'Quarterstaff',_key:'staff',visible:'Quarterstaff Melee +4 Attack 1d6+2',
    actions:[{label:'+4 Attack'},{label:'1d6+2'}]}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  const character=h.context.window.Campaign.characters.get('char-elf');
  const open=character.view.showDialog;
  x.afterProbe=()=>{};x.beforeInvoke=()=>{};
  character.view.showDialog=function(){
    open.call(this);
    const w=x.frames.at(-1).contentWindow;
    w.postMessage=msg=>{
      received.push(msg);
      if(msg.type==='native-invoke')x.beforeInvoke(msg);
      if(msg.type==='native-probe')x.afterProbe(msg);
      const data=msg.type==='hello'?{type:'ready',name:'Elowen',session:'dom-reader-session',mode:'iframe'}:
        {type:'native-result',id:msg.id,session:'dom-reader-session',
          status:msg.type==='native-probe'?'ready':'clicked',token:'dom-once-token',
          message:'Clicked the official Roll20 roll button once; check chat for the result.'};
      queueMicrotask(()=>h.windowListeners.get('message')({origin:'https://advanced-sheets.production.roll20preflight.net',
        source:w,data:{protocol:'r20eb:import:v3',...data}}));
    };
  };
  h.context.setTimeout=(fn,ms)=>{if(ms<4000)queueMicrotask(fn);return 1;};
  x.invoke=()=>kind==='skills'?h.api.r3NativeInvoke('skills','Athletics'):h.api.r3NativeMappedAttack('staff');
  return Object.assign(x,{received,character});
}
test('source-observed attacks and skills expose native sheet controls without macro abilities or automatic rolls',async()=>{
  for(const kind of ['attacks','skills']){
    const x=nativeDomActionRig(kind),h=x.h;
    const mapped=h.api.r3NativeMapPreview(kind,kind==='skills'?'Athletics':'staff');
    assert.equal(mapped.sheetAction,true);
    h.api.r3HudRender();
    assert.equal(x.received.length,0,'rendering must never roll');
    const run=x.invoke();
    assert.equal(x.invoke(),false,'second click is suppressed while first is pending');
    assert.equal(await run,true,h.api.R3_NATIVE.status);
    assert.equal(x.received.filter(m=>m.type==='native-probe').length,1);
    const invokes=x.received.filter(m=>m.type==='native-invoke');
    assert.equal(invokes.length,1);
    assert.equal(invokes[0].kind,kind);
    assert.equal(invokes[0].readerSession,'dom-reader-session');
    assert.equal(x.log.filter(l=>l.kind==='show').length,1);
  }
});
test('Attack rebinds to a refreshed authorized source row after hidden import',async()=>{
  const x=nativeDomActionRig('attacks'),h=x.h;
  h.api.R3_AUTO.running=true;
  const pending=x.invoke();
  assert.equal(h.api.R3_NATIVE.busy,true);
  const item=h.api.R3_UI.snapshot.attacks[0];
  item.visible='Quarterstaff Melee +4 Attack 1d6+2 magic';
  h.api.R3_AUTO.running=false;
  assert.equal(await pending,true,h.api.R3_NATIVE.status);
  assert.equal(x.received.find(m=>m.type==='native-probe')?.actionText,item.visible,
    'probe must inspect the newly imported exact entry, not old stale row text');
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,1);
});
test('Attack click waits behind a hidden all-tab import then clicks only the official control',async()=>{
  const x=nativeDomActionRig('attacks'),h=x.h;
  h.api.R3_AUTO.running=true;
  const promise=x.invoke();
  assert.equal(h.api.R3_NATIVE.busy,true);
  assert.match(h.api.R3_NATIVE.status,/Finishing private sheet import/);
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,0);
  h.api.R3_AUTO.running=false;
  assert.equal(await promise,true,h.api.R3_NATIVE.status);
  assert.equal(x.received.filter(m=>m.type==='native-probe').length,1);
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,1);
  assert.equal(x.log.filter(l=>l.kind==='show').length,1,
    'one selected-character private dialog reused for the attack');
});
test('Private attack does not send any click if token identity changes while waiting for import',async()=>{
  const x=nativeDomActionRig('attacks'),h=x.h;
  h.api.R3_AUTO.running=true;
  const request=x.invoke();
  h.api.R3_TOKEN.active={characterId:'char-dwarf',name:'Brom'};
  h.api.R3_AUTO.running=false;
  assert.equal(await request,false);
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,0);
});
test('native sheet action cancels when permissions, source data, selected character or session changes during probe',async()=>{
  for(const change of ['permission','source','selection','session']){
    const x=nativeDomActionRig(),h=x.h;
    x.afterProbe=()=>{
      if(change==='permission')x.character.attributes.controlledby='someone-else';
      if(change==='source')h.api.R3_UI.snapshot.skills.Athletics=9;
      if(change==='selection')h.api.R3_TOKEN.active={name:'Brom',characterId:'char-dwarf'};
      if(change==='session')h.api.R3_NATIVE.readers.get(x.frames.at(-1).contentWindow).session='reloaded-session';
    };
    assert.equal(await x.invoke(),false,change);
    assert.equal(x.received.filter(m=>m.type==='native-invoke').length,0,change);
  }
});
test('native sheet invocation is never retried after transport failure',async()=>{
  const x=nativeDomActionRig();
  x.beforeInvoke=()=>{throw new Error('Connection lost after click request');};
  assert.equal(await x.invoke(),false);
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,1);
  assert.match(x.h.api.R3_NATIVE.status,/Check chat before retrying/);
});
test('duplicate indistinguishable source attacks never enable a native sheet action',()=>{
  const x=nativeDomActionRig('attacks'),h=x.h;
  const first=h.api.R3_UI.snapshot.attacks[0];
  h.api.R3_UI.snapshot.attacks.push({...first,_key:'duplicate'});
  assert.equal(h.api.r3NativeMappedPreview('staff').sheetAction,undefined);
  assert.equal(h.api.r3NativeMappedAttack('staff'),false);
  assert.equal(x.received.length,0);
});

test('native sheet roll stops if a private reader becomes player-owned during preparation',async()=>{
  const x=nativeDomActionRig(),h=x.h;
  x.afterProbe=()=>{
    h.api.R3_NATIVE_BG.dialog=null;h.api.R3_NATIVE_BG.frame=null;
    h.api.R3_NATIVE_BG.sessions.clear();
  };
  assert.equal(await x.invoke(),false);
  assert.equal(x.received.filter(m=>m.type==='native-invoke').length,0);
});
test('native sheet request ignores results from an old reader session',async()=>{
  const x=nativeDomActionRig(),h=x.h;
  x.afterProbe=msg=>{
    const w=x.frames.at(-1).contentWindow;
    h.windowListeners.get('message')({origin:'https://advanced-sheets.production.roll20preflight.net',source:w,
      data:{protocol:'r20eb:import:v3',type:'native-result',id:msg.id,status:'ready',
        token:'stale-token',session:'old-reader-session'}});
    assert.equal(h.api.R3_NATIVE.pending.has(msg.id),true);
  };
  assert.equal(await x.invoke(),true);
  assert.equal(x.received.find(m=>m.type==='native-invoke').token,'dom-once-token');
});
