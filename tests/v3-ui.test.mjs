import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=readdirSync(join(root,'v3')).filter(x=>/^\d{2}_.*\.js$/.test(x)&&x!=='30_boot.js').sort();
function panelHarness(){
  const nodes=new Map(),windowListeners=new Map(),sent=[];
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
    setInterval(){return 1;},clearInterval(){},
    setTimeout(){return 1;},clearTimeout(){},
    localStorage:{getItem(key){return store.get(key)||null;},setItem(key,value){store.set(key,value);}}
  };
  vm.createContext(context);
  vm.runInContext(files.map(f=>readFileSync(join(root,'v3',f),'utf8')).join('\n')+
    '\nglobalThis.uiApi={r3StartUI,r3StartEditorBridge,r3Empty,r3Coverage,R3_UI};',context);
  function click(id){const el=nodes.get(id);assert.ok(el,'Unknown control '+id);shadow.handlers.get('click')({target:el});}
  function respond(snapshot,type='result'){
    const msg=sent.at(-1).message;
    windowListeners.get('message')({
      origin:'https://advanced-sheets.production.roll20preflight.net',
      source:frameWindow,
      data:{protocol:'r20eb:import:v3',type,id:msg.id,snapshot,error:'Simulated sheet failure'}
    });
  }
  return {context,api:context.uiApi,nodes,shadow,document,sent,store,windowListeners,click,respond};
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
  const results=h.nodes.get('r3-results'),content=h.nodes.get('r3-content');
  assert.equal(results.writes,1);
  const list=results.querySelector('.results');
  list.scrollTop=317;content.scrollTop=88;
  h.click('r3-refresh');
  h.windowListeners.get('focus')();
  h.windowListeners.get('focus')();
  assert.equal(results.writes,1,'focus/refresh must not repaint results');
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
