// Roll20 Embetterment HUD v1: read-only combat presentation of v3 sheet data.
// This module never dispatches native Roll20 rolls, casts or sheet mutations.
const R3_HUD={category:'actions',collapsed:false,renderedSnapshot:null,
  renderedCategory:null,renderedCollapsed:null,renderedDebug:null,openKeys:[],scrollTop:0};
const R3_HUD_TABS=[
  {key:'actions',title:'Actions',icon:'⚔'},
  {key:'bonus',title:'Bonus',icon:'✦'},
  {key:'reactions',title:'Reactions',icon:'↶'},
  {key:'spells',title:'Spells',icon:'✧'},
  {key:'inventory',title:'Inventory',icon:'◈'},
  {key:'features',title:'Features',icon:'◆'},
  {key:'resources',title:'Resources',icon:'◉'}
];
function r3HudLoad(){
  try{
    const stored=JSON.parse(localStorage.getItem(r3StorageKey()+':hud')||'null');
    if(stored&&R3_HUD_TABS.some(t=>t.key===stored.category))
      R3_HUD.category=stored.category;
    if(typeof stored?.collapsed==='boolean')R3_HUD.collapsed=stored.collapsed;
  }catch{}
}
function r3HudSave(){
  try{localStorage.setItem(r3StorageKey()+':hud',JSON.stringify({
    category:R3_HUD.category,collapsed:R3_HUD.collapsed
  }));}catch{}
}
function r3HudValue(value,suffix=''){
  return value===undefined||value===null||value===''?'—':r3Escape(value)+suffix;
}
function r3HudHasValue(value){
  return value!==undefined&&value!==null&&value!=='';
}
function r3HudEntries(snapshot,kind){
  if(!snapshot)return [];
  const items=key=>Array.isArray(snapshot[key])?snapshot[key]:[];
  if(kind==='actions')return items('attacks').map(x=>({...x,_hudSource:'Attack'}));
  if(kind==='spells')return items('spells').map(x=>({...x,_hudSource:'Spell'}));
  if(kind==='inventory')return items('inventory').filter(x=>!r3InventoryZero(x))
    .map(x=>({...x,_hudSource:'Item'}));
  if(kind==='features')return items('features').map(x=>({...x,_hudSource:'Feature'}));
  if(kind==='resources')return items('resources').map(x=>({...x,_hudSource:'Resource'}));
  if(kind==='bonus'||kind==='reactions'){
    // Only explicitly labeled action economy belongs here; no guessing
    // from a feature's prose, its name or D&D spell traditions.
    const expected=kind==='bonus'?/^(?:1\s+)?bonus action$/i:/^(?:1\s+)?reaction$/i;
    const spells=items('spells').filter(x=>expected.test(r3String(x.castingTime,55)))
      .map(x=>({...x,_hudSource:'Spell'}));
    const features=items('features').filter(x=>expected.test(r3String(x.actionType,55)))
      .map(x=>({...x,_hudSource:'Feature'}));
    return [...features,...spells];
  }
  return [];
}
function r3HudHp(snapshot){
  const hp=snapshot?.stats?.hp,max=snapshot?.stats?.maxHp;
  const valid=Number.isFinite(hp)&&Number.isFinite(max)&&max>0;
  const pct=valid?Math.round(Math.max(0,Math.min(100,100*hp/max))):null;
  return '<div class="hud-hp" aria-label="Hit points"><div class="hud-hp-label">'+
    '<span>HIT POINTS</span><strong>'+r3HudValue(hp)+' / '+r3HudValue(max)+'</strong></div>'+
    '<div class="hud-hp-track"><div class="hud-hp-fill" style="width:'+(pct??0)+'%"></div></div></div>';
}
function r3HudStat(label,value,suffix=''){
  return '<div class="hud-stat"><span>'+r3Escape(label)+'</span><strong>'+
    r3HudValue(value,r3HudHasValue(value)?suffix:'')+'</strong></div>';
}
function r3HudResourceBar(snapshot){
  const slots=Object.entries(snapshot?.slots||{}).slice(0,9);
  const resources=Array.isArray(snapshot?.resources)?snapshot.resources.slice(0,5):[];
  if(!slots.length&&!resources.length)return '';
  const chips=[];
  for(const [level,slot] of slots){
    if(!slot||typeof slot!=='object')continue;
    const a=r3HudHasValue(slot.current)?slot.current:r3HudHasValue(slot.remaining)?slot.remaining:'—';
    const b=r3HudHasValue(slot.max)?'/'+slot.max:'';
    chips.push('<span class="hud-res-chip" title="Observed spell slot counts">Slot '+r3Escape(level)+' · '+r3Escape(a)+r3Escape(b)+'</span>');
  }
  for(const item of resources){
    const label=r3String(item.name,32);if(!label)continue;
    const count=item.checkboxes?
      ' · '+r3Escape(item.checkboxes.checked)+'/'+r3Escape(item.checkboxes.total)+' checked':'';
    chips.push('<span class="hud-res-chip" title="Observed resource, usage meaning unconfirmed">'+
      r3Escape(label)+count+'</span>');
  }
  return chips.length?'<div class="hud-resources">'+chips.join('')+'</div>':'';
}
function r3HudCard(item,index){
  const key=r3Escape(r3String(item._key||item.name,140)+'|'+r3String(item.tab,60)+'|'+index);
  const tags=[];
  for(const [label,value] of [['Level',item.level],['Range',item.range],
    ['Casting',item.castingTime],['Uses',item.uses]]){
    if(r3HudHasValue(value))tags.push('<span>'+r3Escape(label)+' '+r3Escape(value)+'</span>');
  }
  if(r3HudHasValue(item.quantity))tags.push('<span>Qty '+r3Escape(item.quantity)+'</span>');
  if(item.checkboxes)tags.push('<span>'+r3Escape(item.checkboxes.checked)+'/'+
    r3Escape(item.checkboxes.total)+' checked</span>');
  const details=r3String(item.visible,1100);
  const controls=(item.controls||[]).slice(0,18).map(c=>
    '<div class="hud-card-field">'+r3Escape(c.label||c.kind)+': '+
      r3Escape(c.value===true?'On':c.value===false?'Off':c.value)+'</div>').join('');
  return '<details class="hud-card" data-hud-card="'+key+'"><summary>'+
    '<span class="hud-card-mark">'+r3Escape((item._hudSource||'Item').slice(0,1))+'</span>'+
    '<span class="hud-card-title">'+r3Escape(item.name||'Unnamed entry')+
      '<small>'+r3Escape(item._hudSource||'Observed')+'</small></span>'+
    (r3HudHasValue(item.quantity)?'<span class="hud-card-count">×'+r3Escape(item.quantity)+'</span>':'')+
    '<span class="hud-card-caret">⌄</span></summary>'+
    '<div class="hud-card-body">'+(tags.length?'<div class="hud-card-tags">'+tags.join('')+'</div>':'')+
    (details?'<p>'+r3Escape(details)+'</p>':'<p>No further labeled details were observed on the sheet.</p>')+
    controls+'<div class="hud-card-note">Reference only · no Roll20 action performed</div></div></details>';
}
function r3HudMarkup(snapshot){
  const name=r3String(snapshot?.name,80)||'No character imported';
  const hp=snapshot?.stats||{};
  const collapsed=R3_HUD.collapsed;
  const items=r3HudEntries(snapshot,R3_HUD.category);
  const selected=R3_HUD_TABS.find(t=>t.key===R3_HUD.category);
  const tabs=R3_HUD_TABS.map(tab=>{
    const count=r3HudEntries(snapshot,tab.key).length;
    return '<button type="button" class="hud-tab'+(R3_HUD.category===tab.key?' selected':'')+
      '" data-hud-category="'+tab.key+'" aria-pressed="'+(R3_HUD.category===tab.key)+'">'+
      '<span aria-hidden="true">'+tab.icon+'</span> '+tab.title+
      ' <small>'+count+'</small></button>';
  }).join('');
  const header='<header class="hud-top">'+
    '<div class="hud-avatar" aria-hidden="true">'+r3Escape(name.slice(0,1).toUpperCase())+'</div>'+
    '<div class="hud-character"><span>R20 EMBETTERMENT</span><strong>'+r3Escape(name)+'</strong></div>'+
    '<div class="hud-top-actions">'+
      '<button type="button" id="r3-hud-auto" title="Toggle per-game automatic sheet synchronization">'+
      (R3_AUTO.enabled?'● Sync On':'○ Sync Off')+'</button>'+
      '<button type="button" id="r3-hud-debug" aria-expanded="'+R3_UI.shown+'">'+
      (R3_UI.shown?'Close Debug':'Debug')+'</button>'+
      '<button type="button" id="r3-hud-collapse" aria-expanded="'+!collapsed+'">'+
      (collapsed?'Expand':'Minimize')+'</button>'+
    '</div></header>';
  const vitals='<div class="hud-vitals">'+r3HudHp(snapshot)+
    r3HudStat('AC',hp.ac)+r3HudStat('SPEED',hp.speed,' ft')+
    r3HudStat('INIT',hp.initiative)+r3HudStat('PASSIVE',hp.passivePerception)+'</div>';
  let entries='';
  if(!snapshot){
    entries='<p class="hud-empty">Import a character through Debug once, then enable Sync to keep this HUD current.</p>';
  }else if(items.length){
    entries='<div class="hud-cards">'+items.slice(0,80).map(r3HudCard).join('')+'</div>';
  }else{
    entries='<p class="hud-empty">No confirmed entries in this category. Import more sheet tabs or check Debug diagnostics.</p>';
  }
  const body='<div class="hud-body"><div class="hud-collection-label">'+
    r3Escape(selected?.title||'Actions')+'<span>'+items.length+
    ' observed</span></div>'+entries+'</div>';
  const main=collapsed?'':'<div class="hud-main">'+vitals+
    r3HudResourceBar(snapshot)+
    '<nav class="hud-tabs" aria-label="Combat action categories">'+tabs+'</nav>'+
    body+
    '<footer class="hud-footer">Read-only preview · official Roll20 controls remain authoritative</footer>'+
    '</div>';
  return '<section class="hud-shell'+(collapsed?' collapsed':'')+
    '" aria-label="R20 Embetterment combat HUD">'+header+main+'</section>';
}
function r3HudRender(){
  const el=R3_UI.root?.getElementById('r3-hud');if(!el)return;
  if(R3_HUD.renderedSnapshot===R3_UI.snapshot&&
    R3_HUD.renderedCategory===R3_HUD.category&&
    R3_HUD.renderedCollapsed===R3_HUD.collapsed&&
    R3_HUD.renderedDebug===R3_UI.shown&&
    R3_HUD.renderedSync===R3_AUTO.enabled)return;
  const oldBody=el.querySelector?.('.hud-body');
  if(oldBody){
    R3_HUD.scrollTop=oldBody.scrollTop;
    R3_HUD.openKeys=[...(el.querySelectorAll?.('details.hud-card[open]')||[])]
      .map(card=>card.getAttribute('data-hud-card')).filter(Boolean).slice(0,80);
  }
  el.innerHTML=r3HudMarkup(R3_UI.snapshot);
  R3_HUD.renderedSnapshot=R3_UI.snapshot;
  R3_HUD.renderedCategory=R3_HUD.category;
  R3_HUD.renderedCollapsed=R3_HUD.collapsed;
  R3_HUD.renderedDebug=R3_UI.shown;
  R3_HUD.renderedSync=R3_AUTO.enabled;
  const body=el.querySelector?.('.hud-body');
  if(body)body.scrollTop=R3_HUD.scrollTop;
  const expanded=new Set(R3_HUD.openKeys);
  for(const card of el.querySelectorAll?.('details.hud-card')||[])
    if(expanded.has(card.getAttribute('data-hud-card')))card.open=true;
}
function r3HudStyles(){
  return [
    '#r3-hud{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:min(990px,calc(100vw - 24px));pointer-events:auto}',
    '.hud-shell{color:#eee7d9;background:linear-gradient(170deg,#242b36f5,#101823f7);border:1px solid #8a744e;border-radius:15px;box-shadow:0 14px 48px #000c,0 0 0 1px #111b27 inset;overflow:hidden;font:13px/1.35 system-ui,sans-serif}',
    '.hud-shell button{cursor:pointer;color:inherit;font:inherit}.hud-top{display:flex;align-items:center;gap:11px;padding:9px 12px;background:linear-gradient(90deg,#374052,#1c2738);border-bottom:1px solid #6a5738}',
    '.hud-avatar{height:40px;width:40px;flex:none;display:grid;place-items:center;border-radius:50%;background:#18212e;border:2px solid #c89e5d;color:#f0d49c;font:700 21px Georgia,serif}',
    '.hud-character{display:flex;flex-direction:column;min-width:0;flex:1}.hud-character>span{font-size:9px;letter-spacing:.16em;color:#b5a37e}.hud-character strong{font:600 20px Georgia,serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hud-top-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:end}.hud-top-actions button{background:#202d40;border:1px solid #647389;border-radius:6px;padding:5px 9px;font-size:11px}.hud-top-actions button:hover{background:#3b5065}',
    '.hud-main{padding:0 11px 9px}.hud-vitals{display:grid;grid-template-columns:minmax(180px,2fr) repeat(4,minmax(60px,1fr));align-items:stretch;gap:7px;margin:10px 0}',
    '.hud-hp,.hud-stat{background:#152132;border:1px solid #3a4b60;border-radius:7px;padding:6px 9px;min-width:0}.hud-hp-label{display:flex;justify-content:space-between;gap:4px;align-items:center}.hud-hp-label span,.hud-stat span{font-size:10px;letter-spacing:.08em;color:#adbace}.hud-hp-label strong{font-size:16px;color:#f6e7da}.hud-hp-track{height:6px;background:#3a2530;border-radius:5px;overflow:hidden;margin-top:5px}.hud-hp-fill{height:100%;background:linear-gradient(90deg,#933e45,#e35c55);border-radius:5px;transition:width .2s}',
    '.hud-stat{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.hud-stat strong{color:#e8d3a7;font:600 17px Georgia,serif}',
    '.hud-resources{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 9px}.hud-res-chip{border:1px solid #5d5d6f;border-radius:5px;padding:4px 8px;background:#253244;font-size:11px;color:#dcd6bf}',
    '.hud-tabs{display:flex;gap:5px;overflow-x:auto;padding:0 0 8px;scrollbar-width:thin}.hud-tab{flex:none;border:1px solid #48576e;background:#1b293a;border-radius:6px;padding:7px 10px;white-space:nowrap;font-size:12px!important}.hud-tab.selected{border-color:#cca366;background:#574530;color:#ffe5b7}.hud-tab small{margin-left:4px;color:#bac1ce}',
    '.hud-body{max-height:min(24vh,205px);min-height:75px;overflow-y:auto;padding:2px 0 3px;scrollbar-width:thin}.hud-collection-label{display:flex;justify-content:space-between;color:#deb77b;font:600 13px Georgia,serif;margin:3px 0 7px}.hud-collection-label span{color:#9caabe;font:11px system-ui}',
    '.hud-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px}.hud-card{border:1px solid #445367;background:#1c2a3b;border-radius:7px;min-width:0}.hud-card[open]{border-color:#a88953}.hud-card summary{cursor:pointer;display:flex;gap:7px;align-items:center;list-style:none;padding:8px}.hud-card summary::-webkit-details-marker{display:none}',
    '.hud-card-mark{height:28px;width:28px;border:1px solid #96754a;border-radius:6px;flex:none;display:grid;place-items:center;background:#293d4b;color:#f7d696;font:700 16px Georgia,serif}.hud-card-title{flex:1;min-width:0;font-size:12px;font-weight:650;overflow-wrap:anywhere}.hud-card-title small{display:block;font-size:10px;color:#aebaca;font-weight:400}.hud-card-count{color:#e7c797;font-weight:600}.hud-card-caret{color:#baad90}',
    '.hud-card-body{border-top:1px solid #364353;padding:8px;color:#cbd5e1;font-size:11px;overflow-wrap:anywhere}.hud-card-body p{white-space:pre-wrap;margin:6px 0}.hud-card-tags{display:flex;gap:4px;flex-wrap:wrap}.hud-card-tags span{border:1px solid #52647a;border-radius:5px;padding:2px 5px}.hud-card-field{padding:3px 0;border-bottom:1px solid #354459}.hud-card-note,.hud-footer{font-size:10px;color:#a4b3c5}.hud-footer{text-align:right;margin-top:7px}.hud-empty{padding:17px 9px;text-align:center;color:#bac7d6}',
    '.hud-shell.collapsed .hud-top{border-bottom:0}@media(max-width:660px){.hud-top{gap:7px;padding:7px!important}.hud-avatar{width:32px;height:32px;font-size:17px}.hud-character strong{font-size:16px}.hud-top-actions button{padding:4px 6px}.hud-vitals{grid-template-columns:repeat(4,minmax(0,1fr))}.hud-hp{grid-column:1/-1}.hud-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.hud-body{max-height:26vh}}'
  ].join('');
}
