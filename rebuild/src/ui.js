/* Independent, bounded Shadow-DOM taskbar. */
function R4UI(api){
const s=api.state,host=document.createElement('div');
host.id='r20eb-clean-v4';
const root=host.attachShadow({mode:'open'});
let open=false,debug=false,settings=false,lastMarkup='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const themes={bg3:['#171e2d','#d3ad64','#f2ead9'],tokyo:['#1a1b26','#7aa2f7','#c0caf5'],win9x:['#c0c0c0','#000080','#161616']};
root.innerHTML=`<style>
:host{all:initial;font:13px system-ui,sans-serif;color:var(--ink);pointer-events:none}
*{box-sizing:border-box}button{cursor:pointer;font:inherit}
#bar{position:fixed;bottom:7px;left:90px;max-width:calc(100vw - 470px);min-width:300px;
 display:flex;align-items:center;flex-wrap:wrap;gap:6px;background:var(--base);border:1px solid var(--accent);
 border-radius:7px;padding:6px 8px;box-shadow:0 5px 22px #0009;pointer-events:auto;z-index:2147483000}
button{background:transparent;border:1px solid #ffffff40;border-radius:4px;color:var(--ink);padding:5px 7px}
button:hover,button:focus-visible{border-color:var(--accent)}
#grip{cursor:grab;color:var(--accent);font-weight:bold;user-select:none}
#status{font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#panel,#debug,#settings{position:fixed;left:90px;bottom:56px;background:var(--base);color:var(--ink);
 width:min(470px,calc(100vw - 480px));max-height:70vh;overflow:auto;pointer-events:auto;
 border:1px solid var(--accent);border-radius:6px;padding:10px;z-index:2147483000}
#progress{position:fixed;top:7px;left:120px;background:var(--base);color:var(--ink);
 width:420px;max-width:calc(100vw - 530px);padding:7px 10px;border:1px solid var(--accent);
 border-radius:6px;pointer-events:auto;z-index:2147483000;font-size:12px}
#track{background:#ffffff36;height:5px;margin:5px 0}#fill{height:100%;background:var(--accent)}
[hidden]{display:none!important}h3{margin:3px 0 8px;color:var(--accent)}
nav{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
nav button[aria-pressed=true]{background:var(--accent);color:var(--base)}
.item{padding:6px 0;border-bottom:1px solid #ffffff2b}.item summary{cursor:pointer}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px}
.row small{display:block;opacity:.75;max-width:320px;overflow-wrap:anywhere}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}
[data-dock=top]{bottom:auto!important;top:48px}
[data-dock=left],[data-dock=right]{max-width:85px!important;min-width:75px!important;flex-direction:column}
[data-dock=right]{left:auto!important;right:350px}
@media(max-width:850px){#bar{left:70px;min-width:0;max-width:calc(100vw - 150px)}
 #panel,#debug,#settings{left:70px;width:calc(100vw - 150px)}#progress{display:none!important}}
</style>
<div id="progress" hidden><span id="progressText"></span><div id="track"><div id="fill"></div></div>
 <details><summary>Details</summary><pre id="errors"></pre><button id="retry">Retry failed reads</button></details></div>
<div id="bar" role="toolbar" aria-label="R20eb taskbar"><span id="grip">R20</span>
 <button id="character">Character</button><span id="status">Loading…</span>
 <button id="actions">Actions</button>
 <label title="Action used"><input type="checkbox" data-used="action">A</label>
 <label title="Bonus action used"><input type="checkbox" data-used="bonus">B</label>
 <label title="Reaction used"><input type="checkbox" data-used="reaction">R</label>
 <button id="movement" title="Reset distance">0 ft</button><button id="debugButton">Debug</button>
 <button id="settingsButton" title="Right-click taskbar for settings">⋯</button></div>
<section id="panel" hidden><h3 id="heading"></h3><nav id="categories"></nav><div id="items"></div></section>
<section id="debug" hidden><h3>R20eb diagnostics</h3><pre id="diagnostics"></pre></section>
<section id="settings" hidden><h3>Display</h3><button id="theme">Change theme</button>
 <button id="dock">Dock</button></section>`;
const $=id=>root.getElementById(id);
const keys=['attacks','spells','features','inventory','skills','saves','resources','misc'];
function panelHtml(){
 const roster=[...s.roster.values()];
 if(s.tab==='characters')return roster.length?roster.map(e=>'<div class="row"><span>'+esc(e.name)+
   '</span><button data-preview="'+esc(e.id)+'">Read-only view</button></div>').join(''):
   '<p>Open Journal to discover characters.</p>';
 const snap=api.activeSnapshot();
 if(!snap)return '<p>Waiting for a verified Roll20 character sheet. No guessed data or rolls.</p>';
 const rows=snap.categories?.[s.tab]||[];
 if(!rows.length)return '<p>No rendered '+esc(s.tab)+' available.</p>';
 const groups=new Map();
 for(const a of rows){const key=s.tab==='attacks'?a.name:a.name+':'+groups.size;
   if(!groups.has(key))groups.set(key,{name:a.name,items:[]});
   groups.get(key).items.push(a);}
 return [...groups.values()].map(g=>'<details class="item"><summary>'+esc(g.name)+
   (g.items.length>1?' · '+g.items.length+' variants':'')+'</summary>'+
   g.items.map(a=>'<div class="row"><span>'+esc(a.name)+'<small>'+esc(a.details)+
   '</small></span><button data-action="'+esc(a.actionId)+'" '+
   (!a.actionId||s.mode!=='player'?'disabled':'')+'>'+
   (a.actionId?s.tab==='attacks'?'Attack':s.tab==='spells'?'Cast':'Use':'Observed')+
   '</button></div>').join('')+'</details>').join('');
}
function paint(){
 if(!host.isConnected&&document.documentElement)document.documentElement.append(host);
 const palette=themes[s.theme]||themes.bg3;
 for(const [i,k] of ['--base','--accent','--ink'].entries())host.style.setProperty(k,palette[i]);
 $('bar').dataset.dock=s.dock;
 $('character').textContent=s.name||'Character';
 $('status').textContent=s.mode==='player'?'Player · '+(s.snapshot?.stats?.hp??'—')+' HP':
  s.mode==='dm-sheet'?'DM sheet · read-only':s.mode==='preview'?'Journal · read-only':s.status;
 $('movement').textContent=Math.round(s.distance)+' ft';
 for(const x of root.querySelectorAll('[data-used]'))x.checked=!!s.actionUsed[x.dataset.used];
 const completed=[...s.progress.values()].filter(p=>p.complete).length;
 const pct=api.percent(),errors=s.errors.size;
 const rightRect=document.querySelector('#sidebarcontainer,#rightsidebar')?.getBoundingClientRect();
 const available=(rightRect?.left>window.innerWidth*.45?rightRect.left:window.innerWidth-350)-120;
 $('progress').style.width=Math.min(420,Math.max(0,available-10))+'px';
 $('progress').hidden=!s.roster.size||(completed===s.roster.size&&!errors)||available<205;
 $('progressText').textContent='Importing '+completed+' of '+s.roster.size+' · '+pct+'% · '+
  errors+' errors · '+s.status;
 $('fill').style.width=pct+'%';
 $('errors').textContent=[...s.errors].map(([id,e])=>(s.roster.get(id)?.name||id)+': '+e).join('\n')||'No errors';
 $('panel').hidden=!open;$('debug').hidden=!debug;$('settings').hidden=!settings;
 if(open){
  $('heading').textContent=s.tab==='characters'?'Journal preview':(s.name||'No character')+' · '+s.tab;
  $('categories').innerHTML=s.tab==='characters'?'':keys.map(k=>
   '<button data-category="'+k+'" aria-pressed="'+(s.tab===k)+'">'+k+'</button>').join('');
  const html=panelHtml();
  if(lastMarkup!==s.tab+'|'+s.mode+'|'+s.id+'|'+html){
   const scroll=$('panel').scrollTop;$('items').innerHTML=html;
   $('panel').scrollTop=scroll;lastMarkup=s.tab+'|'+s.mode+'|'+s.id+'|'+html;
  }
 }
 if(debug)$('diagnostics').textContent=[
  'Campaign: '+s.game,'Mode: '+s.mode,'Character: '+s.id+' '+s.name,
  'Jumpgate: '+s.selectionStatus,'Native reader: '+(s.activeReader?'bound':'unbound'),
  'Progress: '+pct+'%','Errors: '+errors,'Status: '+s.status,
  'Cached character IDs: '+[...s.cache.keys()].join(', '),'',...s.logs.slice(-35)
 ].join('\n');
}
$('character').onclick=()=>{s.tab='characters';open=true;lastMarkup='';paint();};
$('actions').onclick=()=>{s.tab='attacks';open=!open;lastMarkup='';paint();};
$('debugButton').onclick=()=>{debug=!debug;settings=false;paint();};
$('settingsButton').onclick=()=>{settings=!settings;debug=false;paint();};
$('movement').onclick=()=>{s.distance=0;s.lastXY=null;paint();};
$('retry').onclick=()=>api.retry();
$('theme').onclick=()=>{const t=Object.keys(themes);s.theme=t[(t.indexOf(s.theme)+1)%t.length];paint();};
$('dock').onclick=()=>{const docks=['bottom','top','left','right'];s.dock=docks[(docks.indexOf(s.dock)+1)%4];paint();};
root.addEventListener('click',event=>{
 const category=event.target.closest('[data-category]');
 if(category){s.tab=category.dataset.category;lastMarkup='';paint();return;}
 const preview=event.target.closest('[data-preview]');
 if(preview){api.preview(preview.dataset.preview);s.tab='attacks';lastMarkup='';paint();return;}
 const action=event.target.closest('[data-action]');
 if(action&&!action.disabled){
  const found=(api.activeSnapshot()?.categories?.[s.tab]||[]).find(a=>a.actionId===action.dataset.action);
  if(found)void api.invoke(found);
 }
});
root.addEventListener('change',event=>{
 if(event.target.matches('[data-used]'))s.actionUsed[event.target.dataset.used]=event.target.checked;
});
$('bar').addEventListener('contextmenu',e=>{e.preventDefault();settings=!settings;paint();});
let drag=null;
$('grip').addEventListener('pointerdown',e=>{
 const r=$('bar').getBoundingClientRect();
 drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};e.target.setPointerCapture(e.pointerId);
});
$('grip').addEventListener('pointermove',e=>{
 if(!drag)return;
 $('bar').style.left=Math.max(0,Math.min(window.innerWidth-80,drag.left+e.clientX-drag.x))+'px';
 $('bar').style.top=Math.max(0,Math.min(window.innerHeight-40,drag.top+e.clientY-drag.y))+'px';
 $('bar').style.bottom='auto';
});
$('grip').addEventListener('pointerup',()=>{drag=null;});
s.repaint=paint;paint();
}
