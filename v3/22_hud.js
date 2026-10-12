// Roll20 Embetterment HUD v1: read-only combat presentation of v3 sheet data.
// This module never dispatches native Roll20 rolls, casts or sheet mutations.
const R3_HUD={category:'actions',collapsed:false,drawerOpen:false,flyout:'',spellLevel:'',weaponSet:0,weaponSets:[null,null,null,null,null,null],chooser:null,used:{action:false,bonus:false,reaction:false},renderedSnapshot:null,
  renderedCategory:null,renderedCollapsed:null,renderedDrawer:null,renderedFlyout:null,renderedWeaponSet:null,renderedChooser:null,renderedUsed:null,renderedDebug:null,openKeys:[],scrollTop:0};
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
    if(Number.isInteger(stored?.weaponSet)&&stored.weaponSet>=0&&stored.weaponSet<3)
      R3_HUD.weaponSet=stored.weaponSet;
    if(Array.isArray(stored?.weaponSets)&&stored.weaponSets.length===6)
      R3_HUD.weaponSets=stored.weaponSets.map(item=>
        item&&['attacks','inventory','spells'].includes(item.kind)&&
        typeof item.key==='string'&&item.key.length>0&&item.key.length<=140?
          {kind:item.kind,key:item.key}:null);
  }catch{}
}
function r3HudSave(){
  try{localStorage.setItem(r3StorageKey()+':hud',JSON.stringify({
    category:R3_HUD.category,collapsed:R3_HUD.collapsed,drawerOpen:R3_HUD.drawerOpen,
    weaponSet:R3_HUD.weaponSet,weaponSets:R3_HUD.weaponSets
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
// Argon Core reference: bottom-aligned horizontal panels, action tiles,
// weapon loadouts over the portrait, and flyouts expanding up over the bar.
// These UI operations are local/read-only until Roll20 native action routing
// can be verified. No Foundry runtime, assets or network are required.
function r3HudWeaponCandidates(snapshot){
  if(!snapshot)return [];
  const result=[];
  for(const kind of ['attacks','inventory','spells']){
    const entries=kind==='inventory'?r3HudEntries(snapshot,kind):
      (Array.isArray(snapshot[kind])?snapshot[kind]:[]);
    for(const item of entries.slice(0,120)){
      const key=r3String(item._key||item.name,140);
      if(key&&!result.some(x=>x.kind===kind&&x.key===key))
        result.push({kind,key,item});
    }
  }
  return result.slice(0,175);
}
function r3HudLoadoutItem(snapshot,index){
  const slot=R3_HUD.weaponSets[index];
  if(!slot)return null;
  return r3HudWeaponCandidates(snapshot).find(c=>c.kind===slot.kind&&c.key===slot.key)?.item||null;
}
function r3HudIcon(symbol){
  const icons={
    blade:'<path d="M5 21l5-5M13 13l8-8-2-2-8 8M6 18l-3 3m4-6 4 4"/>',
    book:'<path d="M4 4c4-2 8-2 12 0v16c-4-2-8-2-12 0zM16 4c2-1 4-1 5 0v16c-2-1-4-1-5 0zM10 9v5"/>',
    flame:'<path d="M12 2c1 5-4 6-2 10 2-1 3-3 4-5 6 6 6 11 1 14-5 3-11 0-11-6 0-5 5-8 8-13z"/>',
    shield:'<path d="M12 2L3 6v7c0 6 6 9 9 10 3-1 9-4 9-10V6zM9 12l2 2 4-5"/>',
    bag:'<path d="M7 9h10l3 12H4L7 9zM9 9V6a3 3 0 0 1 6 0v3M8 15h8"/>',
    lightning:'<path d="M13 2L5 13h7l-1 9 8-12h-7z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
    exit:'<path d="M12 3a9 9 0 1 1-9 9M2 6l10 6-10 6M2 12h13"/>',
    dice:'<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="12" cy="12" r="1"/>',
    move:'<path d="M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3"/>',
    star:'<path d="M12 2l3.1 6.4 7 .9-5 4.9 1.2 7-6.3-3.4L5.7 21l1.2-7-5-4.9 7-.9z"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
    eye:'<path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0z"/><circle cx="12" cy="12" r="3"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+
    (icons[symbol]||icons.star)+'</svg>';
}
function r3HudBarButton(label,icon,flyout,more=''){
  return '<button type="button" class="hud-bar-button '+more+'" data-hud-flyout="'+r3Escape(flyout)+'" title="Browse '+r3Escape(label)+' (read-only)">'+
    '<span class="hud-bar-art">'+r3HudIcon(icon)+'</span>'+
    '<span class="hud-bar-label">'+r3Escape(label)+'</span></button>';
}
function r3HudSetMarkup(snapshot){
  const entries=R3_HUD.weaponSets;
  return '<div class="hud-loadout" aria-label="Three two-slot weapon sets">'+
    [0,1,2].map(set=>{
      const slots=[0,1].map(side=>{
        const index=set*2+side;
        const item=r3HudLoadoutItem(snapshot,index);
        const name=item?.name||'Empty '+(side?'bonus':'action')+' slot';
        const icon=side?'lightning':'blade';
        return '<button type="button" data-hud-slot="'+index+'" class="hud-loadout-slot'+
          (item?' assigned':'')+'" title="'+r3Escape(name)+
          ': assign an observed attack, spell or item">'+
          (item?'<span class="hud-slot-letter">'+r3Escape(r3String(name,1).toUpperCase())+'</span>':
          r3HudIcon(icon))+'</button>';
      }).join('');
      return '<div class="hud-loadout-pair'+(R3_HUD.weaponSet===set?' active':'')+'">'+
        '<button type="button" class="hud-loadout-number" data-hud-set="'+set+
        '" title="Select weapon set '+(set+1)+'">SET '+(set+1)+'</button>'+
        '<div class="hud-loadout-slots">'+slots+'</div></div>';
    }).join('')+'</div>';
}
function r3HudSpellLevels(snapshot){
  const levels=new Map();
  for(const spell of snapshot?.spells||[]){
    const raw=spell.level;
    const level=raw===0||String(raw??'').toLowerCase()==='cantrip'?'0':
      /^\d$/.test(String(raw??''))?String(raw):'other';
    if(!levels.has(level))levels.set(level,[]);
    levels.get(level).push(spell);
  }
  return [...levels.entries()].sort((a,b)=>
    a[0]==='other'?1:b[0]==='other'?-1:Number(a[0])-Number(b[0]));
}
function r3HudFlyoutMarkup(snapshot){
  if(R3_HUD.chooser!==null){
    const candidates=r3HudWeaponCandidates(snapshot);
    const slot=R3_HUD.chooser;
    return '<section class="hud-flyout" aria-label="Assign weapon set slot">'+
      '<header><strong>QUICK SLOT '+(Math.floor(slot/2)+1)+' · '+
      (slot%2?'BONUS':'ACTION')+'</strong>'+
      '<button type="button" id="r3-hud-flyout-close" aria-label="Close">×</button></header>'+
      '<div class="hud-choice-list"><button type="button" data-hud-assign="clear">Clear slot</button>'+
      candidates.map((c,i)=>'<button type="button" data-hud-assign="'+i+'">'+
        r3Escape(c.item.name)+'<small>'+r3Escape(c.kind)+'</small></button>').join('')+
      '</div><small class="hud-hint">Assignments customize HUD shortcuts only; nothing is equipped or cast on Roll20.</small></section>';
  }
  if(!R3_HUD.flyout)return '';
  const flyout=R3_HUD.flyout;
  const titles={spells:'CAST SPELL',skills:'SAVES / SKILLS / TOOLS',inventory:'USE ITEM',
    features:'USE FEATURE',actions:'ACTION',bonus:'BONUS ACTION',reactions:'REACTION',
    resources:'RESOURCES'};
  let content='';
  if(flyout==='spells'){
    const levels=r3HudSpellLevels(snapshot);
    if(!levels.length)content='<p class="hud-empty">No labeled spells have been imported.</p>';
    else{
      const selected=levels.some(([lev])=>lev===R3_HUD.spellLevel)?R3_HUD.spellLevel:levels[0][0];
      const spells=levels.find(([lev])=>lev===selected)?.[1]||[];
      const slot=snapshot?.slots?.[selected];
      const slots=slot?(' · Slots '+r3HudValue(slot.current??slot.remaining)+' / '+r3HudValue(slot.max)):'';
      content='<div class="hud-spell-levels">'+levels.map(([lev,arr])=>
        '<button type="button" data-hud-spell-level="'+r3Escape(lev)+'" class="'+
        (lev===selected?'active':'')+'">'+(lev==='0'?'Cantrip':lev==='other'?'Unclassified':'Level '+lev)+
        ' <small>'+arr.length+'</small></button>').join('')+'</div>'+
        '<div class="hud-flyout-caption">'+(selected==='0'?'Cantrips':selected==='other'?'Unclassified spells':'Level '+selected)+
        slots+'</div><div class="hud-flyout-cards">'+spells.slice(0,65).map(r3HudCard).join('')+'</div>';
    }
  }else if(flyout==='skills'){
    const groups=[['SAVING THROWS',snapshot?.saves||{}],['SKILLS',snapshot?.skills||{}],
      ['ABILITY CHECKS',snapshot?.modifiers||{}]];
    content=groups.map(([label,values])=>'<div class="hud-skill-group"><b>'+label+'</b>'+
      (Object.keys(values).length?Object.entries(values).map(([name,value])=>
        '<div class="hud-skill-row">'+r3Escape(name)+' <strong>'+r3HudValue(value)+'</strong></div>').join(''):
        '<span class="hud-empty">No imported entries</span>')+'</div>').join('');
  }else{
    const cards=r3HudEntries(snapshot,flyout);
    content=cards.length?'<div class="hud-flyout-cards">'+cards.slice(0,80).map(r3HudCard).join('')+'</div>':
      '<p class="hud-empty">No confirmed entries in this category.</p>';
  }
  return '<section class="hud-flyout" aria-label="Combat '+r3Escape(titles[flyout]||flyout)+' flyout">'+
    '<header><strong>'+r3Escape(titles[flyout]||flyout)+'</strong>'+
    '<small>Read-only · official sheet remains authoritative</small>'+
    '<button type="button" id="r3-hud-flyout-close" aria-label="Close">×</button></header>'+
    content+'</section>';
}
function r3HudSegment(label,kind,buttons){
  const tracks=kind==='action'||kind==='bonus'||kind==='reaction';
  const used=!!R3_HUD.used[kind];
  return '<section class="hud-segment hud-segment-'+kind+'" aria-label="'+r3Escape(label)+'">'+
    '<div class="hud-segment-buttons">'+buttons+'</div>'+
    '<div class="hud-segment-caption"><span>'+r3Escape(label)+'</span>'+
    (tracks?'<button type="button" data-hud-used="'+kind+'" aria-pressed="'+used+
      '" title="Mark '+r3Escape(label)+' as used (local indicator only)">'+
      (used?'●':'○')+'</button>':'')+'</div></section>';
}
function r3HudMarkup(snapshot){
  const name=r3String(snapshot?.name,80)||'No character imported';
  const hp=snapshot?.stats||{};
  const collapsed=R3_HUD.collapsed;
  const passive=r3HudPassive(snapshot);
  const actionIndex=R3_HUD.weaponSet*2;
  const actionItem=r3HudLoadoutItem(snapshot,actionIndex);
  const bonusItem=r3HudLoadoutItem(snapshot,actionIndex+1);
  const attacks=r3HudEntries(snapshot,'actions');
  const weapon=actionItem||attacks[0];
  const mainButtons=[
    r3HudBarButton(weapon?.name||'WEAPON','blade','actions','hud-weapon-button'),
    r3HudBarButton('DODGE / DISENGAGE','shield','actions','hud-small-button'),
    r3HudBarButton('CAST SPELL','book','spells','hud-color-spells'),
    r3HudBarButton('USE FEATURE','flame','features'),
    r3HudBarButton('READY / DASH','clock','actions','hud-small-button'),
    r3HudBarButton('USE ITEM','bag','inventory')
  ].join('');
  const bonusButtons=[
    r3HudBarButton(bonusItem?.name||'OFF HAND','blade','bonus','hud-color-bonus'),
    r3HudBarButton('CAST SPELL','book','spells','hud-color-bonus')
  ].join('');
  const freeButtons=r3HudBarButton('FEATURE','star','features','hud-color-free');
  const reactionButtons=[
    r3HudBarButton(r3HudEntries(snapshot,'reactions')[0]?.name||'REACTION',
      'shield','reactions','hud-color-reaction')
  ].join('');
  const passButtons='<button type="button" class="hud-bar-button hud-color-pass" '+
    'title="End turn is not wired to Roll20 yet" disabled>'+
    '<span class="hud-bar-art">'+r3HudIcon('exit')+'</span>'+
    '<span class="hud-bar-label">END TURN</span></button>';
  const statRow='<div class="hud-portrait-stats">'+
    r3HudStat('AC',hp.ac)+r3HudStat('SPEED',hp.speed,' ft')+
    r3HudStat('INIT',hp.initiative)+
    '<div title="'+r3Escape(passive.source)+'">'+r3HudStat(passive.label,passive.value)+'</div></div>';
  const portrait='<aside class="hud-portrait-panel">'+
    r3HudSetMarkup(snapshot)+
    '<button type="button" class="hud-portrait-shortcuts" data-hud-flyout="skills">'+
    'SAVES / SKILLS / TOOLS ▾</button>'+
    '<div class="hud-avatar-pane"><div class="hud-avatar" aria-hidden="true">'+
    r3Escape(name.slice(0,1).toUpperCase())+'</div>'+
    '<div class="hud-portrait-name">'+r3Escape(name)+'</div>'+r3HudHp(snapshot)+
    statRow+'</div></aside>';
  const controls='<div class="hud-controller">'+
    '<div class="hud-toolbar"><span>R20 EMBETTERMENT <small>ARGON PORT</small></span>'+
    '<div class="hud-toolbar-actions">'+
    '<button type="button" id="r3-hud-auto">'+(R3_AUTO.enabled?'● Sync':'○ Sync')+'</button>'+
    '<button type="button" id="r3-hud-debug">Debug</button>'+
    '<button type="button" id="r3-hud-collapse">'+(collapsed?'Show HUD':'Hide')+'</button></div></div>'+
    '<div class="hud-action-track"><span>Action tracking (local)</span>'+
    '<button type="button" id="r3-hud-reset-turn">Reset tracking</button></div>'+
    '<div class="hud-main-segments">'+
    r3HudSegment('MAIN ACTION','action',mainButtons)+
    r3HudSegment('BONUS','bonus',bonusButtons)+
    r3HudSegment('FREE','free',freeButtons)+
    r3HudSegment('REACTION','reaction',reactionButtons)+
    r3HudSegment('PASS','pass',passButtons)+'</div>'+
    '<div class="hud-resources-bottom">'+r3HudResourceBar(snapshot)+'</div>'+
    '</div>';
  const compact='<div class="hud-collapsed">'+
    '<span>'+r3Escape(name)+' · '+r3HudValue(hp.hp)+' / '+r3HudValue(hp.maxHp)+' HP</span>'+
    '<button type="button" id="r3-hud-collapse">Show HUD</button></div>';
  return '<section class="hud-shell'+(collapsed?' collapsed':'')+'" aria-label="R20 Embetterment combat HUD">'+
    (collapsed?compact:'<div class="hud-reference-bar">'+portrait+controls+'</div>')+
    (!collapsed?r3HudFlyoutMarkup(snapshot):'')+'</section>';
}
function r3HudRender(){
  const el=R3_UI.root?.getElementById('r3-hud');if(!el)return;
  if(R3_HUD.renderedSnapshot===R3_UI.snapshot&&
    R3_HUD.renderedCategory===R3_HUD.category&&
    R3_HUD.renderedCollapsed===R3_HUD.collapsed&&
    R3_HUD.renderedDrawer===R3_HUD.drawerOpen&&
    R3_HUD.renderedFlyout===R3_HUD.flyout&&
    R3_HUD.renderedWeaponSet===R3_HUD.weaponSet&&
    R3_HUD.renderedChooser===R3_HUD.chooser&&
    R3_HUD.renderedUsed===JSON.stringify(R3_HUD.used)&&
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
  R3_HUD.renderedFlyout=R3_HUD.flyout;
  R3_HUD.renderedWeaponSet=R3_HUD.weaponSet;
  R3_HUD.renderedChooser=R3_HUD.chooser;
  R3_HUD.renderedUsed=JSON.stringify(R3_HUD.used);
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
