// Roll20 Embetterment HUD v1: read-only combat presentation of v3 sheet data.
// This module never dispatches native Roll20 rolls, casts or sheet mutations.
const R3_HUD={category:'actions',collapsed:false,drawerOpen:false,renderedSnapshot:null,
  renderedCategory:null,renderedCollapsed:null,renderedDrawer:null,renderedDebug:null,openKeys:[],scrollTop:0};
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
    if(typeof stored?.drawerOpen==='boolean')R3_HUD.drawerOpen=stored.drawerOpen;
  }catch{}
}
function r3HudSave(){
  try{localStorage.setItem(r3StorageKey()+':hud',JSON.stringify({
    category:R3_HUD.category,collapsed:R3_HUD.collapsed,drawerOpen:R3_HUD.drawerOpen
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
// Argon core has a portrait panel + side-stat stacks and segmented action
// panels. The provided Twilight: 2000 module is a system adapter, NOT a
// standalone HUD/theme; this is a Roll20-native implementation of its layout
// concepts, not a Foundry runtime dependency or asset copy.
function r3HudPassive(snapshot){
  const authoritative=snapshot?.stats?.passivePerception;
  if(r3HudHasValue(authoritative))return {label:'PASSIVE',value:authoritative,source:'Observed on official sheet'};
  const perception=snapshot?.skills?.Perception;
  if(Number.isFinite(perception))
    return {label:'PASSIVE BASE',value:10+perception,
      source:'Calculated base: 10 + observed Perception modifier. Other bonuses not included.'};
  return {label:'PASSIVE',value:null,source:'Not observed in official sheet'};
}
function r3HudQuickTile(entry,kind,index){
  const name=r3String(entry?.name,80)||'No entry';
  const group=R3_HUD_TABS.find(tab=>tab.key===kind);
  const icon=kind==='actions'?'⚔':kind==='bonus'?'✦':kind==='reactions'?'↶':'◆';
  const letter=name.match(/[A-Za-z0-9]/)?.[0]?.toUpperCase()||icon;
  return '<button type="button" class="hud-quick" data-hud-category="'+r3Escape(kind)+
    '" title="Browse '+r3Escape(group?.title||kind)+': '+r3Escape(name)+
    ' (read-only)" aria-label="Browse '+r3Escape(name)+'">'+
    '<span class="hud-quick-icon" aria-hidden="true">'+r3Escape(letter)+'</span>'+
    '<span class="hud-quick-name">'+r3Escape(name)+'</span></button>';
}
function r3HudActionGroup(snapshot,kind){
  const title=kind==='actions'?'ACTION':kind==='bonus'?'BONUS ACTION':'REACTION';
  const items=r3HudEntries(snapshot,kind);
  const limit=kind==='actions'?6:4;
  const tiles=items.slice(0,limit).map((item,i)=>r3HudQuickTile(item,kind,i)).join('');
  const fallback=items.length?'':'<span class="hud-action-empty">No confirmed '+r3Escape(title.toLowerCase())+' entries</span>';
  return '<div class="hud-action-group hud-action-'+kind+'">'+
    '<div class="hud-action-head"><span>'+title+'</span><b>'+items.length+'</b></div>'+
    '<div class="hud-action-tiles">'+tiles+fallback+'</div></div>';
}
function r3HudMarkup(snapshot){
  const name=r3String(snapshot?.name,80)||'No character imported';
  const hp=snapshot?.stats||{};
  const collapsed=R3_HUD.collapsed;
  const active=R3_HUD_TABS.find(t=>t.key===R3_HUD.category);
  const items=r3HudEntries(snapshot,R3_HUD.category);
  const passive=r3HudPassive(snapshot);
  const portrait='<div class="hud-portrait-dock">'+
    '<div class="hud-portrait-rim"><div class="hud-portrait-face" aria-hidden="true">'+
    r3Escape(name.slice(0,1).toUpperCase())+'</div></div>'+
    '<div class="hud-portrait-caption">'+r3Escape(name)+'</div>'+
    '<div class="hud-portrait-hp">'+r3HudHp(snapshot)+'</div></div>';
  const header='<header class="hud-top">'+
    '<span class="hud-brand">R20 <b>EMBETTERMENT</b> <small>ARGON-INSPIRED COMBAT HUD</small></span>'+
    '<div class="hud-top-actions">'+
    '<button type="button" id="r3-hud-auto">'+(R3_AUTO.enabled?'● Sync On':'○ Sync Off')+'</button>'+
    '<button type="button" id="r3-hud-debug">'+(R3_UI.shown?'Close Debug':'Debug')+'</button>'+
    '<button type="button" id="r3-hud-collapse">'+(collapsed?'Expand':'Minimize')+'</button>'+
    '</div></header>';
  const statStrip='<div class="hud-vitals">'+
    r3HudStat('AC',hp.ac)+r3HudStat('SPEED',hp.speed,' ft')+
    r3HudStat('INIT',hp.initiative)+
    '<div title="'+r3Escape(passive.source)+'">'+r3HudStat(passive.label,passive.value)+'</div>'+
    '</div>';
  const categories=R3_HUD_TABS.map(tab=>{
    const count=r3HudEntries(snapshot,tab.key).length;
    return '<button type="button" class="hud-tab'+(R3_HUD.category===tab.key?' selected':'')+
      '" data-hud-category="'+tab.key+'" aria-pressed="'+(R3_HUD.category===tab.key)+'">'+
      '<span aria-hidden="true">'+tab.icon+'</span> '+tab.title+' <small>'+count+'</small></button>';
  }).join('');
  const cards=!snapshot?'<p class="hud-empty">Import a sheet once through Debug, then enable Sync.</p>':
    items.length?'<div class="hud-cards">'+items.slice(0,80).map(r3HudCard).join('')+'</div>':
    '<p class="hud-empty">No confirmed entries in this category.</p>';
  const drawer=R3_HUD.drawerOpen?
    '<div class="hud-drawer" role="region" aria-label="Action details">'+
    '<div class="hud-drawer-head"><strong>'+r3Escape(active?.title||'Actions')+
    '</strong><span>'+items.length+' observed</span>'+
    '<button type="button" id="r3-hud-drawer-close" aria-label="Close detail drawer">×</button></div>'+
    '<div class="hud-body">'+cards+'</div></div>':'';
  const main=collapsed?'':'<div class="hud-command">'+
    portrait+'<div class="hud-command-deck">'+statStrip+
    '<div class="hud-action-panels">'+r3HudActionGroup(snapshot,'actions')+
    r3HudActionGroup(snapshot,'bonus')+r3HudActionGroup(snapshot,'reactions')+'</div>'+
    r3HudResourceBar(snapshot)+
    '<nav class="hud-tabs" aria-label="Combat action categories">'+categories+'</nav>'+
    '</div>'+drawer+'</div>';
  return '<section class="hud-shell'+(collapsed?' collapsed':'')+
    '" aria-label="R20 Embetterment combat HUD">'+header+main+'</section>';
}
function r3HudRender(){
  const el=R3_UI.root?.getElementById('r3-hud');if(!el)return;
  if(R3_HUD.renderedSnapshot===R3_UI.snapshot&&
    R3_HUD.renderedCategory===R3_HUD.category&&
    R3_HUD.renderedCollapsed===R3_HUD.collapsed&&
    R3_HUD.renderedDrawer===R3_HUD.drawerOpen&&
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
  R3_HUD.renderedDrawer=R3_HUD.drawerOpen;
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
    '#r3-hud{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:min(950px,calc(100vw - 24px));pointer-events:auto}',
    '.hud-shell{font:12px/1.3 system-ui,sans-serif;color:#e9e1d2;border:1px solid #836b48;border-radius:10px;overflow:hidden;background:linear-gradient(160deg,#242b2f,#12171c);box-shadow:0 10px 32px #000d,0 0 0 1px #394047 inset}',
    '.hud-shell button{font:inherit;cursor:pointer;color:inherit}.hud-top{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#20282e;padding:5px 10px;border-bottom:1px solid #635538;min-height:28px}',
    '.hud-brand{font-size:10px;letter-spacing:.15em;color:#b4a48a}.hud-brand b{color:#e9ca87}.hud-brand small{margin-left:8px;font-size:9px;color:#8496a7;letter-spacing:.06em}',
    '.hud-top-actions{display:flex;gap:4px;flex:none}.hud-top-actions button,.hud-drawer-head button{background:#2c3743;border:1px solid #5d6a70;border-radius:4px;padding:3px 8px;font-size:10px}.hud-top-actions button:hover,.hud-drawer-head button:hover{border-color:#d5a763}',
    '.hud-command{display:grid;grid-template-columns:145px minmax(0,1fr);gap:8px;padding:9px;align-items:stretch}.hud-portrait-dock{display:flex;flex-direction:column;align-items:center;gap:4px;justify-content:center;background:linear-gradient(#27333b,#1a232a);border:1px solid #7c694a;border-radius:8px;min-width:0;padding:6px}',
    '.hud-portrait-rim{width:91px;height:91px;border-radius:50%;padding:5px;box-shadow:0 0 0 2px #574b33,0 0 0 4px #283441 inset;background:conic-gradient(#d2b783,#534b40,#c79b57,#343d42,#d2b783)}',
    '.hud-portrait-face{height:100%;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 30%,#536875,#26343e 62%,#0f1822);font:700 44px Georgia,serif;color:#f5d89c;text-shadow:0 3px 8px #000d}',
    '.hud-portrait-caption{font:600 14px Georgia,serif;color:#efe4c8;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}.hud-portrait-hp{width:100%}',
    '.hud-portrait-hp .hud-hp{background:none;border:0;padding:0}.hud-hp-label{display:flex;gap:3px;align-items:center;justify-content:space-between}.hud-hp-label span{font-size:9px;color:#b7a38b}.hud-hp-label strong{font-size:11px;color:#f4dddd}.hud-hp-track{height:6px;margin-top:3px;background:#49272c;border:1px solid #31252b;border-radius:6px;overflow:hidden}.hud-hp-fill{background:linear-gradient(90deg,#8d3339,#ed6158);height:100%;transition:width .22s}',
    '.hud-command-deck{display:flex;flex-direction:column;min-width:0;gap:6px}.hud-vitals{display:flex;gap:5px;flex-wrap:wrap;align-items:stretch}.hud-vitals>div{min-width:76px;flex:1}.hud-stat{display:flex;align-items:center;justify-content:center;gap:7px;background:#18212a;border:1px solid #4d5151;padding:5px;border-radius:4px;min-height:28px}.hud-stat span{font-size:9px;letter-spacing:.06em;color:#b6a48c}.hud-stat strong{font-size:15px;color:#e9d3a3;font-family:Georgia,serif}',
    '.hud-action-panels{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.8fr) minmax(0,.8fr);gap:6px}.hud-action-group{background:#161d23;border:1px solid #5d5546;min-width:0;border-radius:5px;padding:5px}.hud-action-head{display:flex;justify-content:space-between;padding:0 2px 5px;align-items:center;color:#c9b28a;font-size:10px;letter-spacing:.08em}.hud-action-head b{background:#383f42;border:1px solid #78664b;padding:0 5px;border-radius:3px;color:#dec99f;font-size:10px}',
    '.hud-action-tiles{display:flex;gap:4px;overflow-x:auto;scrollbar-width:thin;min-height:77px}.hud-quick{position:relative;flex:0 0 58px;width:58px;min-width:0;background:linear-gradient(#3a3d40,#252d34);border:1px solid #776a52;border-radius:5px;padding:4px;display:flex;flex-direction:column;align-items:center;gap:3px}.hud-quick:hover,.hud-quick:focus-visible{background:#49515a;border-color:#e5b767}.hud-quick-icon{display:grid;place-items:center;width:39px;height:39px;border-radius:5px;border:1px solid #8f7146;background:radial-gradient(circle,#3e4750,#1b242e);color:#f1cf8a;font:bold 20px Georgia,serif}.hud-quick-name{display:block;text-align:center;font-size:9px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;width:100%}.hud-action-empty{font-size:10px;color:#8999a7;align-self:center;text-align:center;margin:auto 6px}',
    '.hud-resources{display:flex;gap:4px;overflow:hidden;white-space:nowrap;min-height:19px}.hud-res-chip{background:#283138;border:1px solid #54524c;border-radius:4px;padding:2px 6px;color:#c8c5bc;font-size:10px}',
    '.hud-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:thin}.hud-tab{flex:0 0 auto;white-space:nowrap;background:#262f37;border:1px solid #555f68;border-radius:4px;padding:5px 7px;font-size:10px!important}.hud-tab:hover{background:#3b4751}.hud-tab.selected{background:#51452e;border-color:#c49b59;color:#f7dab1}.hud-tab small{color:#adb8c0;margin-left:3px}',
    '.hud-drawer{grid-column:1/-1;background:#151c23;border:1px solid #584c3e;border-radius:5px;padding:6px;min-width:0}.hud-drawer-head{display:flex;align-items:center;gap:9px;color:#e3c589;padding:2px 4px 5px}.hud-drawer-head span{font-size:10px;color:#a4b1bd;flex:1}.hud-drawer-head button{padding:0 7px;font-size:17px}.hud-body{max-height:min(29vh,235px);overflow-y:auto;scrollbar-width:thin}',
    '.hud-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:5px}.hud-card{border:1px solid #455360;border-radius:5px;background:#23303a;min-width:0}.hud-card[open]{border-color:#b28c54}.hud-card summary{display:flex;gap:5px;align-items:center;list-style:none;cursor:pointer;padding:7px;font-size:11px}.hud-card summary::-webkit-details-marker{display:none}.hud-card-mark{background:#3a4140;border:1px solid #836842;display:grid;place-items:center;width:26px;height:26px;border-radius:4px;color:#e2bf79;font:700 15px Georgia,serif}.hud-card-title{flex:1;min-width:0;overflow-wrap:anywhere}.hud-card-title small{display:block;font-size:10px;font-weight:normal;color:#aeb6bc}.hud-card-count,.hud-card-caret{color:#e6bf7f}.hud-card-body{border-top:1px solid #3d4a56;padding:6px;font-size:11px;color:#ced8df;overflow-wrap:anywhere}.hud-card-body p{white-space:pre-wrap}.hud-card-tags{display:flex;gap:4px;flex-wrap:wrap}.hud-card-tags span{border:1px solid #5c6267;border-radius:4px;padding:2px 4px}.hud-card-field{border-bottom:1px solid #4b515a;padding:3px}.hud-card-note,.hud-empty{font-size:10px;color:#a9b4c1}',
    '.hud-shell.collapsed .hud-top{border:0}@media(max-width:750px){.hud-command{grid-template-columns:110px minmax(0,1fr)}.hud-portrait-rim{width:75px;height:75px}.hud-portrait-face{font-size:32px}.hud-action-panels{grid-template-columns:repeat(3,minmax(0,1fr))}.hud-brand small{display:none}.hud-quick{flex-basis:49px;width:49px}.hud-quick-icon{height:32px;width:32px;font-size:17px}.hud-quick-name{font-size:8px}.hud-portrait-caption{font-size:12px}}',
    '@media(max-width:500px){.hud-command{grid-template-columns:1fr}.hud-portrait-dock{display:grid;grid-template-columns:55px 1fr 110px;gap:7px;align-items:center}.hud-portrait-rim{width:50px;height:50px}.hud-portrait-face{font-size:25px}.hud-portrait-caption{max-width:unset}.hud-action-panels{grid-template-columns:1fr}.hud-action-tiles{min-height:58px}.hud-vitals>div{min-width:68px}.hud-resources{overflow-x:auto}}'
  ].join('');
}
