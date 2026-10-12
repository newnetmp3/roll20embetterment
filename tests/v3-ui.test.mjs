import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(x=>/^\d{2}_.*\.js$/.test(x)&&x!=='30_boot.js').sort();
function panelHarness(){
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
    setTimeout(fn,ms){const id=timeouts.size+1;timeouts.set(id,{fn,ms});return id;},clearTimeout(id){timeouts.delete(id);},
    localStorage:{getItem(key){return store.get(key)||null;},setItem(key,value){store.set(key,value);}}
  };
  vm.createContext(context);
  vm.runInContext(files.map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n')+
    '\nglobalThis.uiApi={r3StartUI,r3StartEditorBridge,r3Empty,r3Coverage,R3_UI,R3_AUTO,r3AutoTick,r3AutoStoreSnapshot,r3AutoCombine,r3AutoSignature,r3Candidates,r3ToggleAuto,r3AutoMoveOffscreen,r3AutoHealthTick,r3AutoStoreHealth,r3AutoCandidate,r3StartAuto,r3SendScan,r3AutoQueueDirty,R3_HUD,r3HudEntries,r3HudMarkup,r3HudRender,r3HudHp,r3HudSave};',context);
  function click(id){const el=nodes.get(id);assert.ok(el,'Unknown control '+id);shadow.handlers.get('click')({target:el});}
  function respond(snapshot,type='result'){
    const msg=sent.at(-1).message;
    windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:frameWindow,
      data:{protocol:'r20eb:import:v3',type,id:msg.id,snapshot,error:'Simulated sheet failure'}
    });
  }
  return {context,api:context.uiApi,nodes,shadow,document,sent,store,intervals,timeouts,windowListeners,click,respond};
}
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
  assert.deepEqual([...h.api.R3_UI.snapshot.inventory.map(x=>x.name)],['Rope']);
  assert.equal(h.api.R3_UI.snapshot.coverage.inventory,1);
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
