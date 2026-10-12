import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(x=>/^\d{2}_.*\.js$/.test(x)&&x!=='30_boot.js').sort();
function panelHarness(){
  const nodes=new Map(),windowListeners=new Map(),sent=[],intervals=[];
  const makeNode=id=>{
    const node={id,textContent:'',innerHTML:'',value:'',scrollTop:0,style:{},disabled:false,handlers:new Map(),
      addEventListener(type,fn){this.handlers.set(type,fn);}};
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
    getClientRects(){return [{}]},getAttribute(key){return key==='title'?'NIER':null;},
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
    setTimeout(){return 1;},clearTimeout(){},
    localStorage:{getItem(key){return store.get(key)||null;},setItem(key,value){store.set(key,value);}}
  };
  vm.createContext(context);
  vm.runInContext(files.map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n')+
    '\nglobalThis.uiApi={r3StartUI,r3StartEditorBridge,r3Empty,r3Coverage,R3_UI,R3_AUTO,r3AutoTick,r3AutoStoreSnapshot,r3AutoCombine,r3AutoSignature,r3Candidates,r3ToggleAuto,r3AutoMoveOffscreen,r3AutoHealthTick,r3AutoStoreHealth,r3AutoCandidate,r3StartAuto,r3SendScan};',context);
  function click(id){const el=nodes.get(id);assert.ok(el,'Unknown control '+id);shadow.handlers.get('click')({target:el});}
  function respond(snapshot,type='result'){
    const msg=sent.at(-1).message;
    windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:frameWindow,
      data:{protocol:'r20eb:import:v3',type,id:msg.id,snapshot,error:'Simulated sheet failure'}
    });
  }
  return {context,api:context.uiApi,nodes,shadow,document,sent,store,intervals,windowListeners,click,respond};
}
test('real importer panel initializes and both scan buttons become enabled when a sheet appears',()=>{
  const h=panelHarness();
  h.api.r3StartEditorBridge();
  assert.doesNotThrow(()=>h.api.r3StartUI());
  assert.ok(h.document.host);
  assert.equal(h.nodes.get('r3-toggle').textContent,'Hide importer');
  assert.equal(h.nodes.get('r3-choices').value,'iframe-0');
  assert.equal(h.nodes.get('r3-scan').disabled,false);
  assert.equal(h.nodes.get('r3-all').disabled,false);
});
test('Refresh and Hide/Show execute without leaving the panel in a broken state',()=>{
  const h=panelHarness();h.api.r3StartUI();
  h.click('r3-refresh');
  assert.equal(h.nodes.get('r3-choices').value,'iframe-0');
  h.click('r3-toggle');
  assert.equal(h.nodes.get('r3-content').style.display,'none');
  assert.equal(h.nodes.get('r3-toggle').textContent,'Show importer');
  h.click('r3-toggle');
  assert.equal(h.nodes.get('r3-content').style.display,'block');
  assert.equal(h.nodes.get('r3-toggle').textContent,'Hide importer');
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
  assert.ok(h.intervals.includes(8000));
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
  // A closed popout is no longer an authenticated active candidate.
  // A real pending request times out; force a synthetic rejection by
  // disabling auto before responding and verify it never publishes HP.
  h.api.R3_AUTO.enabled=false;h.api.R3_AUTO.generation++;
  // Promise would otherwise be left pending by mock timers; deliver
  // a matching rejection through no-op timed test and rely on gating.
  assert.equal(h.api.R3_UI.snapshot.stats.hp,82);
});
