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
    localStorage:{getItem(key){return store.get(key)||null;},setItem(key,value){store.set(key,value);}}
  };
  vm.createContext(context);
  vm.runInContext(files.map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n')+
    '\nglobalThis.uiApi={r3StartUI,r3StartEditorBridge,r3Empty,r3Coverage,R3_UI,R3_AUTO,r3AutoTick,r3AutoStoreSnapshot,r3AutoCombine,r3AutoSignature,r3Candidates,r3ToggleAuto,r3AutoMoveOffscreen,r3AutoHealthTick,r3AutoStoreHealth,r3AutoCandidate,r3StartAuto,r3SendScan,r3AutoQueueDirty,R3_HUD,r3HudEntries,r3HudMarkup,r3HudRender,r3HudHp,r3HudSave,r3HudStyles,r3HudPortraitUrl,r3HudLoad,R3_NATIVE,r3NativeCandidate,r3NativeProbe,r3NativeConfirm,R3_TOKEN,r3TokenPoll,r3TokenRecordSnapshot,r3TokenSwitch,r3TokenLinkedInfo,r3StartTokenWatch,R3_NATIVE_BG,r3NativeBgEnsure,r3NativeBgCandidate,r3NativeIsOwned,r3NativeBgResolve,r3NativeBgReveal,r3TokenPlayerId,r3TokenControls};',context);
  function click(id){const el=nodes.get(id);assert.ok(el,'Unknown control '+id);shadow.handlers.get('click')({target:el});}
  function respond(snapshot,type='result'){
    const msg=sent.at(-1).message;
    windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:frameWindow,
      data:{protocol:'r20eb:import:v3',type,id:msg.id,snapshot,error:'Simulated sheet failure'}
    });
  }
  return {context,api:context.uiApi,nodes,shadow,document,sent,store,intervals,timeouts,windowListeners,frameWindow,click,respond};
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

test('attack flyout autoloads each observed weapon without choosing loadouts or importing twice',()=>{
  const h=panelHarness('Independent Hero');h.api.r3StartEditorBridge();h.api.r3StartUI();
  const first=h.api.r3Empty();first.name='Independent Hero';
  first.attacks=[
    {name:'Handaxe',_key:'handaxe-m',tab:'Combat',
      visible:'Handaxe Melee 5 ft. +7 Attack 1d6+4'},
    {name:'Handaxe',_key:'handaxe-o',tab:'Combat',
      visible:'Handaxe offhand +5 Attack 1d6+2'},
    {name:'Shortbow',_key:'shortbow',tab:'Combat',
      visible:'Shortbow Ranged 80/320 ft. +8 Attack 1d6+4'}
  ];
  h.api.R3_UI.snapshot=h.api.r3Coverage(first);h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  let html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-attack-row"/g)].length,3);
  assert.equal([...html.matchAll(/class="hud-attack-button"/g)].length,3);
  assert.match(html,/3 attacks from the official sheet/);
  assert.match(html,/To hit \+7/);
  assert.match(html,/Damage 1d6\+2/);
  assert.match(html,/Shortbow/);
  assert.equal(h.sent.length,0,'auto-rendered attacks cannot roll without a click');
  assert.equal(h.api.R3_HUD.chooser,null);
  assert.deepEqual(Array.from(h.api.R3_HUD.weaponSets),[null,null,null,null,null,null]);
  const updated=h.api.r3Empty();updated.name='Independent Hero';
  updated.attacks=[...first.attacks,{name:'Warhammer',_key:'warhammer',tab:'Combat',
    visible:'Warhammer +9 Attack 1d8+5'}];
  h.api.R3_UI.snapshot=h.api.r3Coverage(updated);h.api.r3HudRender();
  html=h.nodes.get('r3-hud').innerHTML;
  assert.equal([...html.matchAll(/class="hud-attack-row"/g)].length,4,
    'a later authenticated import updates the attack menu automatically');
  assert.match(html,/Warhammer/);
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
  assert.equal([...html.matchAll(/class="hud-attack-row"/g)].length,3);
  assert.match(html,/class="hud-attack-button" disabled aria-label="Attack with Dagger"/);
  assert.doesNotMatch(html,/<script>|<img onerror/);
  assert.match(html,/&lt;script&gt;oops&lt;\/script&gt;/);
  assert.match(html,/data-hud-attack-key="evil&quot;/);
  assert.equal(h.sent.length,0);
});
test('native attack UI supports arbitrary imported character names and own actions',async()=>{
  for(const [character,attack] of [
    ['Elowen Dawnsong','Longbow'],['Brom Stonebeard','Warhammer'],
    ['Sora Windfall','Shortbow']
  ]){
    const h=panelHarness(character);h.api.r3StartEditorBridge();h.api.r3StartUI();
    const snap=h.api.r3Empty();snap.name=character;
    snap.attacks=[{name:attack,tab:'Combat',_key:attack.toLowerCase()}];
    h.api.R3_UI.snapshot=h.api.r3Coverage(snap);h.api.r3HudRender();
    h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
    const html=h.nodes.get('r3-hud').innerHTML;
    assert.match(html,/ATTACKS &amp; WEAPONS/);
    assert.match(html,/data-hud-attack-key="/);
    assert.doesNotMatch(html,/Find native Roll20 attack/);
    h.shadow.handlers.get('click')({target:{dataset:{hudAttackKey:attack.toLowerCase()}}});
    assert.equal(h.sent.at(-1).message.type,'native-probe');
    assert.equal(h.sent.at(-1).message.characterName,character);
    assert.equal(h.sent.at(-1).message.attackName,attack);
    const id=h.sent.at(-1).message.id;
    h.windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:h.frameWindow,
      data:{protocol:'r20eb:import:v3',type:'native-result',id,status:'ready',
        label:'Roll Attack',token:'single-use-token'}
    });
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.sent.at(-1).message.type,'native-invoke',
      'one explicit Attack click runs the verified native probe then invokes once');
    assert.equal(h.sent.at(-1).message.characterName,character);
    assert.equal(h.sent.at(-1).message.attackName,attack);
    assert.equal(h.sent.at(-1).message.token,'single-use-token');
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
test('explicit Auto-sync Off is sticky across token changes and restart',()=>{
  const x=multiTokenRig(),h=x.h;
  h.api.r3StartAuto();
  x.selections.push(x.a);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,true);
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.enabled,false);
  assert.equal(h.api.R3_AUTO.explicitlyDisabled,true);
  x.selections.push(x.b);h.api.r3TokenPoll();
  assert.equal(h.api.R3_AUTO.enabled,false);
  const priorGen=h.api.R3_AUTO.generation;
  h.api.R3_AUTO.explicitlyDisabled=false;
  h.api.R3_AUTO.name='';h.api.R3_AUTO.characterId='';
  vm.runInContext('r3AutoLoad()',h.context);
  assert.equal(h.api.R3_AUTO.explicitlyDisabled,true,
    'read-back of Off survives a reload');
  assert.equal(h.api.R3_AUTO.generation,priorGen);
  h.api.r3ToggleAuto();
  assert.equal(h.api.R3_AUTO.explicitlyDisabled,false);
  assert.equal(h.api.R3_AUTO.characterId,'char-dwarf',
    're-enabling prefers current verified controlled token');
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

test('two imported attacks named Dagger get different per-card native probe identities',async()=>{
  const h=panelHarness('Different Player');
  h.api.r3StartEditorBridge();h.api.r3StartUI();
  const snap=h.api.r3Empty();snap.name='Different Player';
  const a={name:'Dagger',_key:'dagger|melee|+7|1d4+4',
    visible:'Dagger Melee +7 Attack 1d4+4',tab:'Combat'};
  const b={name:'Dagger',_key:'dagger|offhand|+5|1d4+2',
    visible:'Dagger Melee +5 Attack 1d4+2',tab:'Combat'};
  snap.attacks=[a,b];h.api.R3_UI.snapshot=h.api.r3Coverage(snap);
  h.api.r3HudRender();
  h.shadow.handlers.get('click')({target:{dataset:{hudFlyout:'actions'}}});
  const html=h.nodes.get('r3-hud').innerHTML;
  assert.match(html,/data-hud-attack-key="dagger\|melee\|\+7\|1d4\+4"/);
  assert.match(html,/data-hud-attack-key="dagger\|offhand\|\+5\|1d4\+2"/);
  assert.match(html,/To hit \+7/);
  assert.match(html,/Damage 1d4\+2/);
  h.shadow.handlers.get('click')({target:{dataset:{hudAttackKey:b._key}}});
  const outgoing=h.sent.at(-1).message;
  assert.equal(outgoing.type,'native-probe');
  assert.equal(outgoing.characterName,'Different Player');
  assert.equal(outgoing.attackName,'Dagger');
  assert.equal(outgoing.attackKey,b._key);
  assert.equal(outgoing.attackText,b.visible);
  h.windowListeners.get('message')({
    origin:'https://advanced-sheets.production.roll20preflight.net',
    source:h.frameWindow,data:{protocol:'r20eb:import:v3',
      type:'native-result',id:outgoing.id,status:'ready',
      token:'unique-second-dagger',label:'+5 Attack'}
  });
  await new Promise(resolve=>setImmediate(resolve));
  const invoke=h.sent.at(-1).message;
  assert.equal(invoke.type,'native-invoke');
  assert.equal(invoke.attackKey,b._key);
  assert.equal(invoke.attackText,b.visible);
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
    '\nglobalThis.sheetApi={r3SheetRevealAll,r3SheetAllowsBackground,r3SheetVisibilityInstall,r3SheetOnPlayerJournal,r3SheetAllowPrivateReaders,R3_SHEET_VIS};',h.context);
  const api=h.context.sheetApi;
  api.r3SheetRevealAll(true);
  assert.equal(x.dialogs[0].style.left,'30px');
  assert.equal(x.dialogs[1].style.left,'30px');
  assert.equal(h.api.R3_NATIVE_BG.sessions.size,0);
  assert.equal(h.api.R3_NATIVE_BG.dialog,null);
  assert.equal(api.r3SheetAllowsBackground(),false);
  await assert.rejects(h.api.r3NativeBgEnsure('Elowen'),/original Roll20 character sheet takes priority/);
  assert.equal(x.log.filter(a=>a.kind==='show').length,2,'rescue must not open another invisible sheet');
  api.r3SheetAllowPrivateReaders();
  assert.equal(api.r3SheetAllowsBackground(),true,'explicit user choice can reenable private readers');
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
  assert.equal(h.context.sheetApi.R3_SHEET_VIS.manualPriority,true,
    'synthetic R20eb Journal opener never overrides manual priority');
});
test('Firefox manual sheet priority persists across extension startup and blocks new hidden openers',()=>{
  const h=panelHarness('Aria');
  let installed=[];
  h.document.addEventListener=(type,fn)=>installed.push(type);
  vm.runInContext(readFileSync(join(root,'extension/firefox/sheet-visibility.js'),'utf8')+
    '\nglobalThis.sheetApi={r3SheetRevealAll,r3SheetAllowsBackground,r3SheetVisibilityInstall,R3_SHEET_VIS,r3SheetVisibilityKey};',h.context);
  h.context.sheetApi.r3SheetRevealAll(true);
  const key=h.context.sheetApi.r3SheetVisibilityKey();
  assert.equal(h.store.get(key),'true');
  h.context.sheetApi.R3_SHEET_VIS.manualPriority=false;
  h.context.sheetApi.r3SheetVisibilityInstall();
  assert.equal(h.context.sheetApi.r3SheetAllowsBackground(),false);
  assert.deepEqual(installed,['pointerdown','dblclick','keydown']);
  h.api.R3_AUTO.enabled=true;h.api.R3_AUTO.name='Aria';
  vm.runInContext('globalThis.tryAutoOpen=r3AutoOpenFromJournal;',h.context);
  assert.equal(h.context.tryAutoOpen(Date.now()),false);
});
