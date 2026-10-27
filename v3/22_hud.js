// Roll20 Embetterment HUD v1: read-only combat presentation of v3 sheet data.
// This module never dispatches native Roll20 rolls, casts or sheet mutations.
const R3_HUD={category:'actions',collapsed:false,drawerOpen:false,flyout:'',spellLevel:'',weaponSet:0,weaponSets:[null,null,null,null,null,null],chooser:null,used:{action:false,bonus:false,reaction:false},renderedSnapshot:null,
  renderedCategory:null,renderedCollapsed:null,renderedDrawer:null,renderedFlyout:null,renderedPortrait:null,renderedSpellLevel:null,renderedWeaponSet:null,renderedLoadouts:null,renderedChooser:null,renderedUsed:null,renderedNative:-1,renderedDebug:null,attackMode:'melee',attackGroup:'',renderedAttackMode:null,renderedAttackGroup:null,portraitName:'',portraitUrl:'',portraitChecked:0,portraitCache:null,openKeys:[],scrollTop:0};
const R3_HUD_TABS=[
  {key:'actions',title:'Actions',icon:'⚔'},
  {key:'bonus',title:'Bonus',icon:'✦'},
  {key:'reactions',title:'Reactions',icon:'↶'},
  {key:'spells',title:'Spells',icon:'✧'},
  {key:'inventory',title:'Inventory',icon:'◈'},
  {key:'features',title:'Features',icon:'◆'},
  {key:'resources',title:'Resources',icon:'◉'},
  {key:'misc',title:'MISC',icon:'◇'}
];
function r3HudLoad(){
  // Always reset character-specific preferences before entering a different
  // character's profile. Otherwise previous weapon sets/icons would leak.
  R3_HUD.category='actions';R3_HUD.collapsed=false;R3_HUD.drawerOpen=false;
  R3_HUD.attackMode='melee';R3_HUD.attackGroup='';R3_HUD.renderedAttackMode=null;
  R3_HUD.renderedAttackGroup=null;
  R3_HUD.weaponSet=0;R3_HUD.weaponSets=[null,null,null,null,null,null];
  R3_HUD.portraitCache=null;R3_HUD.renderedSnapshot=null;
  R3_HUD.renderedLoadouts=null;
  if(typeof r3TurnLoad==='function')r3TurnLoad();
  if(typeof r3BattlefieldLoad==='function')r3BattlefieldLoad();
  try{
    const stored=JSON.parse(localStorage.getItem(r3TokenSettingsKey())||'null');
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
    // A character's previously seen Journal thumbnail survives switching
    // Roll20's sidebar from Journal to Chat, without opening hidden tabs.
    if(stored?.portrait&&typeof stored.portrait.name==='string'&&
      typeof stored.portrait.url==='string'&&stored.portrait.url.length<4096){
      try{
        const uri=new URL(stored.portrait.url);
        if(uri.protocol==='https:'&&stored.portrait.name.length<=80)
          R3_HUD.portraitCache={name:stored.portrait.name,url:uri.href};
      }catch{}
    }
  }catch{}
}
function r3HudSave(){
  try{localStorage.setItem(r3TokenSettingsKey(),JSON.stringify({
    category:R3_HUD.category,collapsed:R3_HUD.collapsed,drawerOpen:R3_HUD.drawerOpen,
    weaponSet:R3_HUD.weaponSet,weaponSets:R3_HUD.weaponSets,
    portrait:R3_HUD.portraitCache
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
  if(kind==='misc'){
    const saved=items('misc');
    const observed=typeof r3NativeMiscCatalog==='function'?r3NativeMiscCatalog(snapshot):[];
    return [...saved,...observed.filter(x=>!saved.some(y=>y.nativeActionRef===x.nativeActionRef))]
      .map(x=>({...x,_hudSource:'Misc'}));
  }
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
// All user-facing categories share one native Roll20 action registry.
// Imported sheet button labels are only evidence of an interactive control;
// they do not by themselves authorize an action or identify a macro.
function r3HudNativeEntryControl(kind,key,name){
  if(!key||typeof key!=='string'||key.length>240||!R3_NATIVE_CATEGORIES[kind])
    return '<small class="hud-native-unmapped" title="The importer did not identify this source action">Native unmapped</small>';
  const map=typeof r3NativeMapPreview==='function'?
    r3NativeMapPreview(kind,key,R3_UI.snapshot):{reason:'No native mapping available'};
  const linked=!!(map.abilityName||map.sheetAction);
  const entry=typeof r3NativeMapSource==='function'?r3NativeMapSource(kind,key,R3_UI.snapshot):null;
  const featureRoll=kind==='features'&&map.sheetAction&&
    Array.isArray(entry?.actions)&&entry.actions.some(action=>
      /^\d{1,2}d\d{1,3}(?:[+-]\d{1,3})?$/i.test(r3String(action.label,70)));
  const verb=featureRoll?'Roll':R3_NATIVE_CATEGORIES[kind]?.title||'Use';
  return '<span class="hud-native-link">'+
    '<small class="'+(linked?'hud-native-linked':'hud-native-unmapped')+'" title="'+
      r3Escape(map.sheetAction?'Checks and clicks the exact official sheet control when requested':linked?'Matches an existing Roll20 '+kind+' action':map.reason||'No mapped native action')+'">'+
      (map.sheetAction?'Native sheet':linked?'Native linked':'Native unmapped')+'</small>'+
    (linked?'<button type="button" class="hud-native-action" data-hud-native-kind="'+r3Escape(kind)+
      '" data-hud-native-key="'+r3Escape(key)+'" aria-label="'+
      r3Escape(verb+' '+name+' via Roll20')+'" title="'+
      r3Escape(featureRoll?'Click exactly the official feature dice button. Resource use is not automatically confirmed.':'Execute exactly the mapped Roll20 sheet action')+'">'+
      r3Escape(verb)+'</button>':'')+
    '</span>';
}
function r3HudSourceKind(item){
  return {Attack:'attacks',Spell:'spells',Item:'inventory',Feature:'features',
    Resource:'resources',Misc:'misc'}[item?._hudSource]||'';
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
  const kind=r3HudSourceKind(item);
  const native=kind?r3HudNativeEntryControl(kind,r3String(item._key||'',240),
    r3String(item.name,125)):'';
  const details=r3String(item.visible,1100);
  const controls=(item.controls||[]).slice(0,18).map(c=>
    '<div class="hud-card-field">'+r3Escape(c.label||c.kind)+': '+
      r3Escape(c.value===true?'On':c.value===false?'Off':c.value)+'</div>').join('');
  if(typeof r3TurnCost==='function'){
    const cost=r3TurnCost(item);
    if(cost)tags.unshift('<span class="hud-economy-cost" title="Action cost observed in official sheet">'+r3Escape(cost)+'</span>');
  }
  return '<details class="hud-card" data-hud-card="'+key+'"><summary>'+
    '<span class="hud-card-mark">'+r3Escape((item._hudSource||'Item').slice(0,1))+'</span>'+
    '<span class="hud-card-title">'+r3Escape(item.name||'Unnamed entry')+
      '<small>'+r3Escape(item._hudSource||'Observed')+'</small></span>'+
    (r3HudHasValue(item.quantity)?'<span class="hud-card-count">×'+r3Escape(item.quantity)+'</span>':'')+
    '<span class="hud-card-caret">⌄</span></summary>'+
    '<div class="hud-card-body">'+(tags.length?'<div class="hud-card-tags">'+tags.join('')+'</div>':'')+
    (details?'<p>'+r3Escape(details)+'</p>':'<p>No further labeled details were observed on the sheet.</p>')+
    controls+native+
    '<div class="hud-card-note">Source details are observed; unmapped controls do not change Roll20. Native actions run only when clicked.</div></div></details>';
}
// Argon core has a portrait panel + side-stat stacks and segmented action
// panels. The provided Twilight: 2000 module is a system adapter, NOT a
// standalone HUD/theme; this is a Roll20-native implementation of its layout
// concepts, not a Foundry runtime dependency or asset copy.
// Use only an image the Roll20 editor has already displayed inside an
// exactly named Journal entry. No network queries or substring name guesses.
function r3HudPortraitUrl(snapshot){
  const name=r3String(snapshot?.name,80),now=Date.now();
  const linked=R3_TOKEN.active;
  // Current player-controlled token is the portrait's authoritative source.
  if(linked&&linked.name.toLowerCase()===name.toLowerCase()&&linked.tokenImage)
    return linked.tokenImage;
  if(!name){R3_HUD.portraitName='';R3_HUD.portraitUrl='';return '';}
  if(name!==R3_HUD.portraitName){
    R3_HUD.portraitName=name;
    R3_HUD.portraitUrl=R3_HUD.portraitCache?.name===name?
      R3_HUD.portraitCache.url:'';
    R3_HUD.portraitChecked=0;
  }
  if(R3_HUD.portraitUrl||now-R3_HUD.portraitChecked<15000)return R3_HUD.portraitUrl;
  R3_HUD.portraitChecked=now;
  for(const img of Array.from(document.querySelectorAll?.('img')||[]).slice(0,500)){
    if(typeof img.getClientRects==='function'&&!img.getClientRects().length)continue;
    let matched=false,ancestor=img.parentElement;
    for(let depth=0;ancestor&&depth<5;ancestor=ancestor.parentElement,depth++){
      if(r3String(ancestor.textContent,110).toLowerCase()===name.toLowerCase()){
        matched=true;break;
      }
    }
    if(!matched)continue;
    const raw=img.currentSrc||img.src||img.getAttribute?.('src')||'';
    try{
      const uri=new URL(raw,location.origin);
      if(uri.protocol!=='https:')continue;
      R3_HUD.portraitUrl=uri.href;
      R3_HUD.portraitCache={name,url:uri.href};
      r3HudSave();
      break;
    }catch{}
  }
  return R3_HUD.portraitUrl;
}
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
// The 2024 importer records attack *variants*, not a weapon taxonomy.
// Classify only observed melee/ranged evidence and named variant suffixes.
// Thrown attacks always live in Ranged. Unidentified actions remain Other.
// Keep every original _key intact; grouping never changes roll execution.
function r3HudWeaponName(name){
  const raw=r3String(name,125).trim();
  const m=raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if(!m)return raw;
  const modifiers=m[2].split(/[,/+]\s*/).map(x=>x.trim());
  return modifiers.length&&modifiers.every(x=>
    /^(?:melee|ranged|thrown|finesse|off[ -]?hand|two[ -]?handed|versatile|dual wield|main hand)$/i.test(x))?
    m[1].trim():raw;
}
function r3HudAttackType(item){
  const name=r3String(item?.name,125);
  if(/\b(?:thrown|ranged)\b/i.test(name))return 'ranged';
  if(/\b(?:melee|finesse|off[ -]?hand|versatile|two[ -]?handed)\b/i.test(name))
    return 'melee';
  // The original attack's own short text can independently identify its
  // mode. Don't inspect unrelated sheet rows or guess based on weapon names.
  const visible=r3String(item?.visible,240);
  if(/\bmelee\b/i.test(visible))return 'melee';
  if(/\branged\b/i.test(visible)||/\bthrown\s+attack\b/i.test(visible))
    return 'ranged';
  return 'other';
}
function r3HudAttackVariant(item,base){
  const name=r3String(item?.name,125).trim();
  if(name.toLowerCase()===base.toLowerCase())return 'Standard';
  const suffix=name.slice(base.length).trim().replace(/^\(|\)$/g,'').trim();
  return suffix||name;
}
function r3HudAttackCatalog(snapshot){
  const attacks=Array.isArray(snapshot?.attacks)?snapshot.attacks.slice(0,400):[];
  // Identify genuine variants of the same base weapon; retain distinct
  // entries even with identical labels and/or distinct attack roll modifiers.
  const families=new Map();
  for(const item of attacks){
    const name=r3String(item?.name,125).trim();
    if(!name)continue;
    const base=r3HudWeaponName(name);
    const familyKey=base.toLowerCase();
    if(!families.has(familyKey))families.set(familyKey,{name:base,entries:[]});
    families.get(familyKey).entries.push({item,mode:r3HudAttackType(item)});
  }
  const modes={melee:[],ranged:[],other:[]};
  for(const family of families.values()){
    const known=family.entries.some(x=>x.mode==='melee');
    for(const entry of family.entries){
      // A plain weapon entry alongside an explicitly melee variant belongs
      // to that family's standard melee options, not an invented fourth mode.
      if(entry.mode==='other'&&known&&
         r3String(entry.item.name,125).trim().toLowerCase()===family.name.toLowerCase())
        entry.mode='melee';
    }
    for(const mode of Object.keys(modes)){
      const variants=family.entries.filter(x=>x.mode===mode);
      if(variants.length)modes[mode].push({name:family.name,mode,variants,
        key:mode+'|'+family.name.toLowerCase()});
    }
  }
  for(const rows of Object.values(modes))
    rows.sort((a,b)=>a.name.localeCompare(b.name));
  return {modes,attackCount:attacks.length};
}
function r3HudAttackOption(entry,base){
  const item=entry.item,name=r3HudAttackVariant(item,base);
  const key=r3String(item?._key||'',240);
  const unique=!!key&&typeof r3NativeSelectAttack==='function'&&
    r3NativeSelectAttack(key,R3_UI.snapshot)===item;
  const mapped=unique&&typeof r3NativeMappedPreview==='function'?
    r3NativeMappedPreview(key,R3_UI.snapshot):{reason:'No unique imported action key'};
  const native=unique&&!!(mapped.abilityName||mapped.sheetAction);
  const metrics=typeof r3NativeAttackMetric==='function'?
    r3NativeAttackMetric(item.visible||''):{bonus:'',damage:''};
  const meta=[metrics.bonus?'Hit '+metrics.bonus:'',
    metrics.damage?'Damage '+metrics.damage:''].filter(Boolean);
  const label=r3Escape(item.name||base);
  return '<div class="hud-weapon-option">'+
    '<div class="hud-weapon-option-label"><strong>'+r3Escape(name)+'</strong>'+
    (meta.length?'<small>'+r3Escape(meta.join(' · '))+'</small>':'')+
    '<small class="'+(native?'hud-weapon-native':'hud-weapon-unmapped')+'" title="'+
      r3Escape(mapped.sheetAction?'Checks the source row and clicks its official Attack button':native?'Source-verified Roll20 repeating attack action':mapped.reason||'No matching official action')+'">'+
      (mapped.sheetAction?'Native sheet':native?'Native linked':'Native unmapped')+'</small></div>'+
    (native?'<button type="button" class="hud-attack-button" data-hud-attack-key="'+
      r3Escape(key)+'" aria-label="Native attack '+label+'">Attack</button>':
      '<button type="button" class="hud-dice-button"'+
      (unique?' data-hud-dice-key="'+r3Escape(key)+'"':' disabled')+
      ' aria-label="Roll imported dice for '+label+'" title="Observed hit and damage only; not a native Roll20 sheet attack">Dice</button>')+
    '</div>';
}
function r3HudAttackMenu(snapshot){
  const catalog=r3HudAttackCatalog(snapshot);
  if(!catalog.attackCount)return '<p class="hud-empty">No attacks detected yet. Select your character; R20eb will read the official Combat sheet when available.</p>';
  const labels={melee:'Melee',ranged:'Ranged',other:'Other'};
  const populated=Object.keys(labels).filter(mode=>catalog.modes[mode].length);
  const selected=populated.includes(R3_HUD.attackMode)?R3_HUD.attackMode:populated[0];
  const groups=catalog.modes[selected]||[];
  const categories='<nav class="hud-attack-categories" aria-label="Attack types">'+
    populated.map(mode=>'<button type="button" data-hud-attack-mode="'+mode+'"'+
      ' class="'+(mode===selected?'selected':'')+'" aria-pressed="'+(mode===selected)+'">'+
      labels[mode]+' <small>'+catalog.modes[mode].length+'</small></button>').join('')+
    '</nav>';
  const content=groups.map(group=>{
    const expanded=R3_HUD.attackGroup===group.key;
    // A single available option rolls directly; multiple variants get
    // an Explorer-style expandable submenu, with right-click also supported.
    const hasOptions=group.variants.length>1;
    const one=group.variants[0];
    const roll=hasOptions?
      '<button type="button" class="hud-weapon-toggle" data-hud-weapon="'+
        r3Escape(group.key)+'" aria-expanded="'+expanded+
        '" aria-label="Choose '+r3Escape(group.name)+' attack variant">'+
        (expanded?'Hide options':'Options')+' ▸</button>':
      r3HudAttackOption(one,group.name);
    return '<div class="hud-weapon-group'+(expanded?' is-open':'')+'" data-hud-weapon-row="'+
      r3Escape(group.key)+'">'+
      '<div class="hud-weapon-heading">'+
        '<span class="hud-attack-icon" aria-hidden="true">'+r3HudIcon('blade')+'</span>'+
        '<strong>'+r3Escape(group.name)+'</strong>'+
        (hasOptions?'<small>'+group.variants.length+' variants</small>':'')+
        (!hasOptions?'<span class="hud-weapon-single">'+
          r3Escape(r3HudAttackVariant(one.item,group.name))+'</span>':'')+
        (hasOptions?roll:'<button type="button" class="hud-weapon-toggle" data-hud-weapon="'+
          r3Escape(group.key)+'" aria-label="Show '+r3Escape(group.name)+' attack details">⋯</button>')+
      '</div>'+
      (expanded?'<div class="hud-weapon-submenu" role="group" aria-label="'+
        r3Escape(group.name)+' '+labels[selected]+' attack variants">'+
        group.variants.map(entry=>r3HudAttackOption(entry,group.name)).join('')+'</div>':'')+
      (!hasOptions?'<div class="hud-weapon-direct">'+roll+'</div>':'')+
      '</div>';
  }).join('');
  return '<div class="hud-attack-list" aria-label="Detected weapons">'+
    '<div class="hud-attack-count">'+catalog.attackCount+' imported attacks · '+
    Object.values(catalog.modes).reduce((sum,arr)=>sum+arr.length,0)+
    ' weapon/type groups · Right-click or choose Options for variants</div>'+
    categories+'<div class="hud-weapon-list">'+content+'</div></div>';
}
function r3HudWeaponToggle(key){
  if(typeof key!=='string'||key.length>180||R3_HUD.flyout!=='actions')return false;
  const catalog=r3HudAttackCatalog(R3_UI.snapshot);
  const found=Object.values(catalog.modes).flat().find(group=>group.key===key);
  if(!found)return false;
  R3_HUD.attackMode=found.mode;
  R3_HUD.attackGroup=R3_HUD.attackGroup===key?'':key;
  r3HudRender();
  return true;
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
    features:'USE FEATURE',actions:'ATTACKS & WEAPONS',bonus:'BONUS ACTION',reactions:'REACTION',
    resources:'RESOURCES',misc:'MISC · OTHER ACTIONS'};
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
        slots+'</div><div class="hud-flyout-cards">'+spells.slice(0,65).map((item,index)=>r3HudCard({...item,_hudSource:'Spell'},index)).join('')+'</div>';
    }
  }else if(flyout==='actions'){
    content=r3HudAttackMenu(snapshot);
  }else if(flyout==='skills'){
    const groups=[['SAVING THROWS',snapshot?.saves||{}],['SKILLS',snapshot?.skills||{}],
      ['ABILITY CHECKS',snapshot?.modifiers||{}]];
    content=groups.map(([label,values])=>'<div class="hud-skill-group"><b>'+label+'</b>'+
      (Object.keys(values).length?Object.entries(values).map(([name,value])=>
        '<div class="hud-skill-row"><span class="hud-skill-value">'+r3Escape(name)+
        ' <strong>'+r3HudValue(value)+'</strong></span>'+
        r3HudNativeEntryControl(label==='SAVING THROWS'?'saves':
          label==='SKILLS'?'skills':'modifiers',name,name)+'</div>').join(''):
        '<span class="hud-empty">No imported entries</span>')+'</div>').join('');
  }else{
    const cards=r3HudEntries(snapshot,flyout);
    content=cards.length?'<div class="hud-flyout-cards">'+cards.slice(0,80).map(r3HudCard).join('')+'</div>':
      '<p class="hud-empty">No confirmed entries in this category.</p>';
  }
  return '<section class="hud-flyout" aria-label="Combat '+r3Escape(titles[flyout]||flyout)+' flyout">'+
    '<header><strong>'+r3Escape(titles[flyout]||flyout)+'</strong>'+
    '<small'+(flyout==='actions'?' class="hud-attack-live-status" role="status" title="'+
      r3Escape(R3_NATIVE.status||'Native Attack when mapped · Dice fallback is not the sheet action')+'"':'')+'>'+
      (flyout==='actions'&&R3_NATIVE.status?r3Escape(R3_NATIVE.status):
      flyout==='actions'?'Native Attack when mapped · Dice fallback is not the sheet action':
      'Native actions run only for verified links; other sheet controls remain read-only')+'</small>'+
    '<button type="button" id="r3-hud-flyout-close" aria-label="Close">×</button></header>'+
    // Native status changes repeatedly while a sheet click is prepared.
    // Keep it after the attack rows so messages do not push weapon entries
    // away from the player's current viewport while rolling.
    content+r3NativeMarkup()+'</section>';
}
function r3HudSegment(label,kind,buttons){
  const tracks=kind==='action'||kind==='bonus'||kind==='reaction';
  const used=!!R3_HUD.used[kind];
  return '<section class="hud-segment hud-segment-'+kind+(used?' hud-segment-spent':'')+'" aria-label="'+r3Escape(label)+'">'+
    '<div class="hud-segment-buttons">'+buttons+'</div>'+
    '<div class="hud-segment-caption"><span>'+r3Escape(label)+'</span>'+
    (tracks?'<button type="button" data-hud-used="'+kind+'" aria-pressed="'+used+
      '" title="Mark '+r3Escape(label)+' as used (local indicator only)">'+
      (used?'●':'○')+'</button>':'')+'</div></section>';
}
function r3HudMarkup(snapshot){
  if(typeof r3BattlefieldMarkup==='function')return r3BattlefieldMarkup(snapshot);
  const name=r3String(snapshot?.name,80)||'No character imported';
  const hp=snapshot?.stats||{};
  const collapsed=R3_HUD.collapsed;
  const passive=r3HudPassive(snapshot);
  const portraitUrl=r3HudPortraitUrl(snapshot);
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
    r3HudBarButton(bonusItem?.name||r3HudEntries(snapshot,'bonus')[0]?.name||'OFF HAND','blade','bonus','hud-color-bonus'),
    r3HudBarButton('CAST SPELL','book','spells','hud-color-bonus')
  ].join('');
  const freeButtons=r3HudBarButton('FEATURE','star','features','hud-color-free');
  const reactionButtons=[
    r3HudBarButton(r3HudEntries(snapshot,'reactions')[0]?.name||'REACTION',
      'shield','reactions','hud-color-reaction')
  ].join('');
  const passButtons='<button type="button" class="hud-bar-button hud-color-pass" '+
    (typeof r3TurnClick==='function'?'data-turn-action="end" title="Mark your turn ended locally; does not advance Roll20"':
    'title="End turn is not wired to Roll20 yet" disabled')+'>'+
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
    '<div class="hud-avatar-pane"><div class="hud-portrait-head">'+
    '<div class="hud-portrait-name">'+r3Escape(name)+'</div>'+
    '<div class="hud-avatar" aria-hidden="true">'+
    (portraitUrl?'<img class="hud-portrait-image" src="'+r3Escape(portraitUrl)+'" alt="">':
      r3Escape(name.slice(0,1).toUpperCase()))+
    '</div></div><div class="hud-portrait-hp">'+r3HudHp(snapshot)+'</div>'+
    statRow+'</div></aside>';
  const controls='<div class="hud-controller">'+
    '<div class="hud-toolbar"><span>R20 EMBETTERMENT <small>ARGON PORT</small></span>'+
    '<div class="hud-toolbar-actions">'+
    '<button type="button" id="r3-hud-auto">'+(R3_AUTO.enabled?'● Sync On':'○ Sync Off')+'</button>'+
    '<button type="button" id="r3-hud-debug">Debug</button>'+
    '<button type="button" id="r3-hud-collapse">'+(collapsed?'Show HUD':'Hide')+'</button></div></div>'+
    (typeof r3TurnMarkup==='function'?r3TurnMarkup(snapshot):
    '<div class="hud-action-track"><span>Action tracking (local)</span>'+
    '<button type="button" id="r3-hud-reset-turn">Reset tracking</button></div>')+
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
  const portrait=r3HudPortraitUrl(R3_UI.snapshot);
  if(R3_HUD.renderedPortrait===portrait&&R3_HUD.renderedSnapshot===R3_UI.snapshot&&
    R3_HUD.renderedCategory===R3_HUD.category&&
    R3_HUD.renderedCollapsed===R3_HUD.collapsed&&
    R3_HUD.renderedDrawer===R3_HUD.drawerOpen&&
    R3_HUD.renderedFlyout===R3_HUD.flyout&&
    R3_HUD.renderedAttackMode===R3_HUD.attackMode&&
    R3_HUD.renderedAttackGroup===R3_HUD.attackGroup&&
    R3_HUD.renderedSpellLevel===R3_HUD.spellLevel&&
    R3_HUD.renderedLoadouts===JSON.stringify(R3_HUD.weaponSets)&&
    R3_HUD.renderedWeaponSet===R3_HUD.weaponSet&&
    R3_HUD.renderedChooser===R3_HUD.chooser&&
    R3_HUD.renderedNative===R3_NATIVE.revision&&
    R3_HUD.renderedUsed===JSON.stringify(R3_HUD.used)&&
    R3_HUD.renderedTurn===(typeof R3_TURN==='object'?R3_TURN.revision:-1)&&
    R3_HUD.renderedBattlefield===(typeof R3_BF==='object'?R3_BF.revision:-1)&&
    R3_HUD.renderedDebugWindow===(typeof R3_DEBUG==='object'?R3_DEBUG.open:false)&&
    R3_HUD.renderedDebug===R3_UI.shown&&
    R3_HUD.renderedSync===R3_AUTO.enabled)return;
  // Firefox's attack list scrolls on .hud-flyout (not .hud-body).
  // Each native status update rebuilds the overlay. Restore this viewport
  // only if the user stayed in the same flyout/weapon group; intentionally
  // navigating to another category or weapon view starts a fresh position.
  const sameFlyout=R3_HUD.renderedFlyout===R3_HUD.flyout&&
    R3_HUD.renderedChooser===R3_HUD.chooser&&
    R3_HUD.renderedAttackMode===R3_HUD.attackMode&&
    R3_HUD.renderedAttackGroup===R3_HUD.attackGroup;
  const existingFlyout=sameFlyout?el.querySelector?.('.hud-flyout'):null;
  const flyoutScroll=existingFlyout?{
    top:existingFlyout.scrollTop,left:existingFlyout.scrollLeft
  }:null;
  const oldBody=el.querySelector?.('.hud-body');
  if(oldBody){
    R3_HUD.scrollTop=oldBody.scrollTop;
    R3_HUD.openKeys=[...(el.querySelectorAll?.('details.hud-card[open]')||[])]
      .map(card=>card.getAttribute('data-hud-card')).filter(Boolean).slice(0,80);
  }
  // Firefox battlefield notes live in a textarea. Auto-sync may repaint
  // while the player types; preserve focus/caret rather than kicking them out.
  const active=R3_UI.root?.activeElement;
  const noteFocused=active?.id==='r3-bf-notes';
  const noteStart=noteFocused?active.selectionStart:null;
  const noteEnd=noteFocused?active.selectionEnd:null;
  const debugScroll=el.querySelector?.('#r3-debug-entries')?.scrollTop;
  el.innerHTML=r3HudMarkup(R3_UI.snapshot);
  if(typeof r3BattlefieldPlacePanels==='function')r3BattlefieldPlacePanels();
  if(Number.isFinite(debugScroll)){
    const debugEntries=el.querySelector?.('#r3-debug-entries');
    if(debugEntries)debugEntries.scrollTop=debugScroll;
  }
  if(noteFocused){
    const next=el.querySelector?.('#r3-bf-notes');
    if(next){
      next.focus?.({preventScroll:true});
      if(Number.isInteger(noteStart)&&Number.isInteger(noteEnd))
        try{next.setSelectionRange(noteStart,noteEnd);}catch{}
    }
  }
  R3_HUD.renderedSnapshot=R3_UI.snapshot;
  R3_HUD.renderedPortrait=portrait;
  R3_HUD.renderedCategory=R3_HUD.category;
  R3_HUD.renderedCollapsed=R3_HUD.collapsed;
  R3_HUD.renderedDrawer=R3_HUD.drawerOpen;
  R3_HUD.renderedFlyout=R3_HUD.flyout;
  R3_HUD.renderedAttackMode=R3_HUD.attackMode;
  R3_HUD.renderedAttackGroup=R3_HUD.attackGroup;
  R3_HUD.renderedSpellLevel=R3_HUD.spellLevel;
  R3_HUD.renderedLoadouts=JSON.stringify(R3_HUD.weaponSets);
  R3_HUD.renderedWeaponSet=R3_HUD.weaponSet;
  R3_HUD.renderedChooser=R3_HUD.chooser;
  R3_HUD.renderedNative=R3_NATIVE.revision;
  R3_HUD.renderedUsed=JSON.stringify(R3_HUD.used);
  R3_HUD.renderedTurn=typeof R3_TURN==='object'?R3_TURN.revision:-1;
  R3_HUD.renderedBattlefield=typeof R3_BF==='object'?R3_BF.revision:-1;
  R3_HUD.renderedDebugWindow=typeof R3_DEBUG==='object'?R3_DEBUG.open:false;
  R3_HUD.renderedDebug=R3_UI.shown;
  R3_HUD.renderedSync=R3_AUTO.enabled;
  const body=el.querySelector?.('.hud-body');
  if(body)body.scrollTop=R3_HUD.scrollTop;
  const expanded=new Set(R3_HUD.openKeys);
  for(const card of el.querySelectorAll?.('details.hud-card')||[])
    if(expanded.has(card.getAttribute('data-hud-card')))card.open=true;
  // Apply after expanding cards and re-positioning draggable panels so
  // their layout changes cannot reset the restored scroll position.
  const nextFlyout=flyoutScroll?el.querySelector?.('.hud-flyout'):null;
  if(nextFlyout){
    nextFlyout.scrollTop=flyoutScroll.top;
    nextFlyout.scrollLeft=flyoutScroll.left;
  }
}
function r3HudStyles(){
  return [
    '.hud-attack-live-status{flex:1;min-width:0;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;line-height:1.35}',
    '#r3-hud{position:absolute;bottom:10px;left:12px;width:min(1250px,calc(100vw - 325px));pointer-events:auto;font:12px/1.25 system-ui,sans-serif}',
    '.hud-shell{position:relative;color:#f0f2f3;isolation:isolate;font-family:system-ui,sans-serif}',
    '.hud-shell button{color:inherit;font:inherit;border-radius:0;cursor:pointer;box-sizing:border-box}',
    '.hud-reference-bar{display:flex;align-items:stretch;gap:5px;min-height:183px;max-height:195px}',
    '.hud-portrait-panel{flex:0 0 165px;min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.hud-loadout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;height:48px}',
    '.hud-loadout-pair{min-width:0;opacity:.68;display:flex;flex-direction:column;gap:2px}',
    '.hud-loadout-pair.active{opacity:1}.hud-loadout-number{padding:1px 0!important;background:#424a54!important;border:0!important;font-size:8px!important;color:#dfdfe1!important;min-height:12px}',
    '.hud-loadout-pair.active .hud-loadout-number{background:#8b7851!important;color:white!important}',
    '.hud-loadout-slots{display:grid;grid-template-columns:1fr 1fr;gap:2px;flex:1}',
    '.hud-loadout-slot{min-width:0;padding:1px!important;display:grid;place-items:center;background:#454a50!important;border:1px solid #6d737b!important;color:#cfd8df!important}',
    '.hud-loadout-slot.assigned{border-color:#deb56f!important;background:#364653!important}.hud-loadout-slot svg{width:15px;height:15px}.hud-slot-letter{font:bold 16px Georgia,serif;color:#efdaa9}',
    '.hud-portrait-shortcuts{background:#515e6b!important;color:#f1f3f7!important;border:0!important;padding:4px!important;text-align:left;font-size:9px!important;font-weight:700!important;letter-spacing:.04em;min-height:20px}',
    '.hud-avatar-pane{min-height:0;flex:1;background:linear-gradient(152deg,#69737d,#2d3844 70%);position:relative;padding:4px 6px;border:1px solid #5c6974;overflow:hidden}',
    '.hud-avatar{float:right;width:63px;height:63px;display:grid;place-items:center;margin:-9px -5px -4px 3px;border-radius:50%;border:2px solid #8d9ba8;background:linear-gradient(#d6d9dc,#6d7c86);color:#394755;font:700 35px Georgia,serif}',
    '.hud-portrait-name{font-size:12px;font-weight:700;line-height:1.1;max-width:90px;min-height:37px;overflow-wrap:anywhere}.hud-portrait-hp{clear:both;padding-top:3px}',
    '.hud-hp-label{display:flex;justify-content:space-between;align-items:center;gap:4px;color:#fff;font-size:10px}.hud-hp-label span{font-size:9px}.hud-hp-track{height:6px;background:#36353c;border:1px solid #272c35;margin-top:2px}.hud-hp-fill{height:100%;background:#e34f56;transition:width .17s}',
    '.hud-portrait-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;margin-top:3px}.hud-portrait-stats .hud-stat{background:#28343e;padding:2px;min-width:0;display:flex;justify-content:space-between;gap:3px}',
    '.hud-stat span{font-size:8px;color:#cfd4d6;overflow:hidden;text-overflow:ellipsis}.hud-stat strong{font-size:10px;color:#f7f9fb;white-space:nowrap}',
    '.hud-controller{display:flex;flex-direction:column;flex:1;min-width:0;justify-content:flex-end}',
    '.hud-toolbar{height:23px;display:flex;align-items:center;justify-content:space-between;background:#46505b;padding:1px 6px;gap:5px;min-width:0}',
    '.hud-toolbar>span{font-size:9px;letter-spacing:.1em;font-weight:700;white-space:nowrap}.hud-toolbar small{color:#b7c2cc;font-size:9px}',
    '.hud-toolbar-actions{display:flex;gap:3px;flex:none}.hud-toolbar-actions button{background:#313b49!important;border:1px solid #72808b!important;padding:2px 5px!important;font-size:10px!important}',
    '.hud-action-track{display:flex;justify-content:space-between;align-items:center;background:#303b45;padding:1px 7px;color:#afbbc7;min-height:15px;font-size:9px}',
    '.hud-action-track button{border:0!important;background:none!important;color:#e3dbcb!important;padding:0 3px!important;font-size:9px!important}',
    '.hud-main-segments{display:flex;align-items:stretch;gap:4px;min-width:0;flex:1;min-height:108px}',
    '.hud-segment{min-width:0;display:flex;flex-direction:column;background:#4b5661;flex:0 0 auto}',
    '.hud-segment-action{flex:6 1 460px}.hud-segment-bonus{flex:2 1 155px;background:#535467}.hud-segment-free{flex:1 1 75px;background:#406267}',
    '.hud-segment-reaction{flex:1.2 1 90px;background:#694448}.hud-segment-pass{flex:.75 1 69px;background:#38544a}',
    '.hud-segment-buttons{display:flex;gap:2px;padding:3px 3px 1px;align-items:stretch;min-width:0;flex:1;overflow-x:auto;scrollbar-width:thin}',
    '.hud-bar-button{display:flex;flex-direction:column;align-items:stretch;justify-content:stretch;gap:1px;min-width:60px;flex:1 0 56px!important;max-width:135px;min-height:78px;background:#687682!important;border:0!important;color:white!important;padding:0!important;text-align:center}',
    '.hud-bar-button:hover:not(:disabled){background:#818e9a!important}.hud-bar-button:disabled{cursor:not-allowed;opacity:.65}',
    '.hud-bar-art{flex:1;display:grid;place-items:center;min-height:48px;padding:7px;background:linear-gradient(145deg,#64717c,#394b59)}',
    '.hud-bar-art svg{width:35px;height:35px;max-width:100%;color:#e9eff4}.hud-bar-label{font-size:8.5px!important;font-weight:700;text-transform:uppercase;padding:5px 2px 4px;white-space:normal;line-height:1.1;min-height:22px;background:#354453}',
    '.hud-small-button .hud-bar-art svg{width:24px;height:24px}.hud-small-button .hud-bar-label{font-size:7.5px!important}',
    '.hud-color-spells .hud-bar-art{background:#57677c}.hud-color-bonus .hud-bar-art{background:#625874}',
    '.hud-color-free .hud-bar-art{background:#55747a}.hud-color-reaction .hud-bar-art{background:#74565a}.hud-color-pass .hud-bar-art{background:#4c665a}',
    '.hud-weapon-button .hud-bar-art{background:linear-gradient(145deg,#76828e,#3d4d5c)}',
    '.hud-segment-caption{display:flex;align-items:center;justify-content:center;gap:7px;padding:3px;background:#4b5560;color:#cbd2d8;font-size:9px;min-height:17px;letter-spacing:.11em}',
    '.hud-segment-bonus .hud-segment-caption{background:#57546b}.hud-segment-free .hud-segment-caption{background:#425e61}',
    '.hud-segment-reaction .hud-segment-caption{background:#684748}.hud-segment-pass .hud-segment-caption{background:#395345}',
    '.hud-segment-caption button{background:none!important;border:0!important;color:#b6d1de!important;padding:0 1px!important;font-size:10px!important}',
    '.hud-segment-caption button[aria-pressed=true]{color:#e4b26e!important}',
    '.hud-resources-bottom{display:flex;justify-content:flex-start;min-height:12px;overflow:hidden}.hud-resources{display:flex;gap:3px;white-space:nowrap;overflow:hidden}',
    '.hud-res-chip{padding:1px 5px;background:#49545f;border-right:1px solid #79838e;font-size:9px;color:#d9e1e8}',
    '.hud-flyout{position:absolute;left:171px;bottom:calc(100% + 4px);width:min(770px,calc(100vw - 210px));max-height:60vh;overflow:auto;z-index:3;color:#e9eff5;background:linear-gradient(145deg,#404e5c,#283542);border:2px solid #7b8994;box-shadow:0 0 18px #000b;scrollbar-width:thin}',
    '.hud-flyout header{position:sticky;top:0;background:#4b5b6a;padding:6px 9px;display:flex;gap:8px;align-items:center;z-index:2}.hud-flyout header strong{font-size:12px}.hud-flyout header small{flex:1;font-size:10px;color:#d0d9e0}',
    '.hud-flyout header button{background:#344250!important;border:1px solid #8293a1!important;padding:2px 9px!important;font-size:16px!important}',
    '.hud-spell-levels{display:flex;gap:4px;margin:6px;overflow-x:auto}.hud-spell-levels button{background:#526371!important;border:0!important;padding:5px 8px!important;font-size:11px!important;white-space:nowrap}',
    '.hud-spell-levels button.active{background:#9e7987!important;color:white!important}.hud-spell-levels small{opacity:.8}',
    '.hud-flyout-caption{padding:2px 8px;color:#f0dbe7;font-weight:700;font-size:10px}.hud-flyout-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:4px;padding:7px}',
    '.hud-attack-list{display:flex;flex-direction:column;gap:5px;padding:7px;min-width:0}.hud-attack-count{font-size:10px;color:#becfde;padding:3px 4px}',
    '.hud-native-link{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0}.hud-native-linked{font-size:10px;color:#9bdcba}.hud-native-unmapped{font-size:10px;color:#d6ba86}',
    '.hud-native-action{border:1px solid #5e9bc8!important;border-radius:5px!important;background:#286394!important;color:#fff!important;font-weight:700!important;padding:5px 8px!important;min-height:27px}',
    '.hud-native-action:hover,.hud-native-action:focus-visible{background:#3581b9!important}.hud-skill-value{flex:1;min-width:0;overflow-wrap:anywhere}.hud-skill-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',

    '.hud-attack-categories{display:flex;flex-wrap:wrap;gap:5px;position:sticky;top:31px;z-index:2;padding:5px 0;background:#27394b;border-bottom:1px solid #567089}',
    '.hud-attack-categories button{border:1px solid #607994!important;border-radius:5px!important;background:#263d56!important;padding:7px 12px!important;color:#dae7f5!important;font-weight:650!important}',
    '.hud-attack-categories button.selected{background:#2b75b2!important;border-color:#9acaf4!important;color:white!important}.hud-attack-categories small{opacity:.8;margin-left:3px}',
    '.hud-weapon-list{display:flex;flex-direction:column;gap:6px;padding-top:5px}.hud-weapon-group{background:#192a3c;border:1px solid #3b5978;border-radius:7px;min-width:0;overflow:hidden}',
    '.hud-weapon-group.is-open{border-color:#73a8d7}.hud-weapon-heading{display:flex;align-items:center;gap:9px;padding:8px;min-height:32px}.hud-weapon-heading>strong{font-size:13px;flex:1;overflow-wrap:anywhere}',
    '.hud-weapon-heading>small,.hud-weapon-single{color:#adbed0;font-size:11px}.hud-weapon-toggle{background:#294660!important;border:1px solid #607d99!important;border-radius:5px!important;padding:6px 9px!important;flex:0 0 auto}',
    '.hud-weapon-toggle:hover,.hud-weapon-toggle:focus-visible{background:#316b9b!important}.hud-weapon-submenu{border-top:1px solid #52738e;background:#101f30;padding:4px 7px 8px 38px;display:flex;flex-direction:column;gap:4px}',
    '.hud-weapon-option{display:flex;align-items:center;gap:8px;padding:5px 0;min-width:0;border-bottom:1px solid #2d4864}.hud-weapon-option:last-child{border-bottom:0}.hud-weapon-option-label{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.hud-weapon-option-label strong{font-size:11px;overflow-wrap:anywhere}.hud-weapon-option-label small{font-size:10px;color:#c2d4e5}',
    '.hud-weapon-direct{display:flex;justify-content:flex-end;align-items:center;padding:0 8px 7px}.hud-weapon-direct .hud-weapon-option{width:100%;border:0;padding:0}.hud-weapon-direct .hud-weapon-option-label strong{display:none}',
    '.hud-weapon-native{color:#9bdcba!important}.hud-weapon-unmapped{color:#dfbd8d!important}',
    '.hud-dice-button{flex:0 0 auto;min-width:68px!important;border:1px solid #6a839b!important;border-radius:6px!important;background:#30465d!important;color:#e9eef5!important;padding:8px 9px!important;font-weight:650!important}.hud-dice-button:hover:not(:disabled){background:#44627e!important}.hud-dice-button:disabled{opacity:.45}',


    '.hud-attack-row{display:flex;align-items:center;gap:9px;background:#192a3c;border:1px solid #3b5978;border-radius:7px;padding:8px;min-width:0}',
    '.hud-attack-icon{flex:0 0 27px;color:#a9c6e4}.hud-attack-icon svg{width:25px;height:25px}',
    '.hud-attack-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.hud-attack-info>strong{font-size:12px;overflow-wrap:anywhere}',
    '.hud-attack-metrics{display:flex;flex-wrap:wrap;gap:4px}.hud-attack-metrics span{background:#2b4157;color:#e0eaf4;border-radius:4px;padding:2px 5px;font-size:10px}',
    '.hud-attack-muted{color:#9aabbc;font-size:10px}.hud-attack-details{font-size:10px;color:#b8cddd}.hud-attack-details summary{cursor:pointer;max-width:max-content}.hud-attack-details p{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0}',
    '.hud-attack-button{flex:0 0 auto;min-width:83px!important;border:1px solid #5999cf!important;border-radius:6px!important;padding:9px 11px!important;background:#206198!important;color:#fff!important;font-weight:700!important;font-size:12px!important}',
    '.hud-attack-button:hover:not(:disabled){background:#287cb9!important}.hud-attack-button:disabled{opacity:.45;cursor:not-allowed}',
    '.hud-card{background:#536477;border:1px solid #7d8a9b;min-width:0;color:#fff}.hud-card[open]{background:#435a70}',
    '.hud-card summary{display:flex;align-items:center;gap:5px;cursor:pointer;padding:5px;font-size:10px;list-style:none}.hud-card summary::-webkit-details-marker{display:none}',
    '.hud-card-mark{width:24px;height:24px;display:grid;place-items:center;background:#324252;font:700 15px Georgia,serif}.hud-card-title{min-width:0;flex:1;overflow-wrap:anywhere;font-weight:650}.hud-card-title small{display:block;font-size:9px;font-weight:400}.hud-card-count{color:#d7e4f2}.hud-card-caret{font-size:10px}',
    '.hud-card-body{padding:6px;background:#303f4d;font-size:10px;overflow-wrap:anywhere}.hud-card-body p{white-space:pre-wrap;margin:3px 0}.hud-card-tags{display:flex;flex-wrap:wrap;gap:3px}.hud-card-tags span{background:#526372;padding:1px 4px}.hud-card-field{padding:3px;border-top:1px solid #546370}.hud-card-note,.hud-hint{color:#c4ced6;font-size:9px}',
    '.hud-skill-group{display:inline-flex;flex-direction:column;min-width:150px;width:31%;gap:2px;vertical-align:top;margin:6px;background:#334657}.hud-skill-group b{background:#596a7b;padding:5px}.hud-skill-row{display:flex;justify-content:space-between;gap:15px;padding:4px}.hud-skill-row strong{color:white}',
    '.hud-choice-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:4px;max-height:36vh;overflow:auto;padding:7px}.hud-choice-list button{display:flex;justify-content:space-between;align-items:center;gap:5px;text-align:left;padding:7px!important;font-size:10px!important;background:#526375!important;border:1px solid #70808a!important}.hud-choice-list button small{font-size:9px;color:#ced5df}',
    '.hud-empty{padding:12px;font-size:11px;color:#ccd4dd}.hud-hint{padding:5px;display:block}',
    '.hud-collapsed{display:flex;align-items:center;gap:15px;padding:5px 10px;min-height:28px;background:#455461;border:1px solid #70808c}.hud-collapsed span{flex:1}.hud-collapsed button{padding:2px 8px!important;background:#283947!important;border:1px solid #788997!important}',
    '@media(max-width:1280px){#r3-hud{width:calc(100vw - 325px)}.hud-portrait-panel{flex-basis:135px}.hud-flyout{left:141px}.hud-segment-action{flex-basis:370px}.hud-bar-button{min-width:47px}.hud-bar-art svg{width:27px;height:27px}}',
    '@media(max-width:980px){#r3-hud{width:calc(100vw - 24px)}.hud-main-segments{overflow-x:auto}.hud-segment{flex-shrink:0}.hud-segment-action{width:370px}.hud-segment-bonus{width:140px}.hud-segment-free{width:70px}.hud-segment-reaction{width:75px}.hud-segment-pass{width:70px}}',
    '@media(max-width:650px){.hud-portrait-panel{flex-basis:105px}.hud-loadout{height:44px}.hud-bar-art svg{width:24px;height:24px}.hud-portrait-stats{grid-template-columns:1fr 1fr}.hud-portrait-name{font-size:10px}.hud-flyout{left:0;width:calc(100vw - 24px)}.hud-brand small{display:none}.hud-toolbar>span{font-size:8px}}'
,
    "#r3-hud{bottom:27px;width:min(1260px,calc(100vw - 325px))}",
    ".hud-reference-bar{min-height:216px;max-height:229px}",
    ".hud-portrait-panel{flex:0 0 204px;gap:3px}",
    ".hud-loadout{height:53px}",
    ".hud-portrait-shortcuts{min-height:25px;white-space:nowrap;font-size:11px!important;padding:6px!important;letter-spacing:.01em}",
    ".hud-avatar-pane{display:flex;flex-direction:column;gap:3px;padding:5px 8px 7px;min-height:0}",
    ".hud-portrait-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:59px}",
    ".hud-avatar{float:none;flex:0 0 60px;width:60px;height:60px;margin:0;position:relative;overflow:hidden}",
    ".hud-portrait-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
    ".hud-portrait-name{flex:1;min-width:0;max-width:none;min-height:0;max-height:55px;overflow:hidden;font-size:13px;line-height:1.15;overflow-wrap:anywhere}",
    ".hud-portrait-hp{clear:none;padding-top:1px;flex:none}",
    ".hud-hp-label{white-space:nowrap;font-size:11px;line-height:1.2}",
    ".hud-hp-label span,.hud-hp-label strong{white-space:nowrap;font-size:11px}",
    ".hud-hp-track{height:7px;margin-top:3px}",
    ".hud-portrait-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px;margin-top:auto}",
    ".hud-portrait-stats .hud-stat{align-items:center;padding:4px 5px;min-height:20px;gap:3px}",
    ".hud-stat span{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".hud-stat strong{font-size:11px;white-space:nowrap}",
    ".hud-main-segments{overflow-x:auto;scrollbar-width:thin}",
    ".hud-bar-label{font-size:10px!important;padding-left:3px;padding-right:3px}",
    ".hud-small-button .hud-bar-label{font-size:9px!important}",
    ".hud-resources-bottom{min-height:21px;overflow-x:auto;scrollbar-width:thin}",
    ".hud-resources{flex:none;overflow:visible}",
    ".hud-res-chip{padding:3px 6px;font-size:10px}",
    ".hud-flyout{left:210px}",
    "@media(max-width:1280px){.hud-portrait-panel{flex-basis:184px}.hud-flyout{left:190px}.hud-reference-bar{min-height:212px}.hud-avatar{width:55px;height:55px;flex-basis:55px}.hud-portrait-head{min-height:55px}}",
    "@media(max-width:980px){#r3-hud{width:calc(100vw - 24px)}.hud-portrait-panel{flex-basis:182px}.hud-flyout{left:0}}",
    "@media(max-width:650px){.hud-portrait-panel{flex-basis:175px}.hud-avatar{width:49px;height:49px;flex-basis:49px}.hud-portrait-head{min-height:49px}.hud-portrait-name{font-size:11px}.hud-hp-label span,.hud-hp-label strong{font-size:10px}.hud-portrait-stats .hud-stat{padding:3px}.hud-stat span{font-size:8px}}",
    // The prior max-height:229px clipped the second portrait stat row in
    // the real 2026-10-12 Floorp screenshot. Let content set the height.
    ".hud-reference-bar{min-height:242px;max-height:none;align-items:stretch}",
    ".hud-portrait-panel{min-height:242px;height:auto}",
    ".hud-avatar-pane{min-height:151px;overflow:visible;flex:1 0 auto}",
    ".hud-portrait-stats{margin-top:auto;grid-auto-rows:minmax(21px,auto)}",
    ".hud-portrait-stats .hud-stat{min-height:21px;overflow:hidden}",
    ".hud-portrait-stats>div[title]{min-width:0}",
    ".hud-portrait-stats>div[title] .hud-stat{height:100%}",
    "@media(max-width:650px){.hud-reference-bar{min-height:235px}.hud-portrait-panel{min-height:235px}.hud-avatar-pane{min-height:142px}}",
    ".hud-native-status{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;background:#354c5d;border-top:1px solid #8cacc0;color:#f3f8ff;font-size:11px}",
    ".hud-native-status span{flex:1 1 280px}",
    ".hud-native-status button,.hud-native-probe{padding:5px 9px!important;border:1px solid #aec5d4!important;background:#263f51!important;color:#fff!important;font-size:11px!important;border-radius:3px!important}",
    ".hud-native-probe{margin-top:7px!important;cursor:pointer}",
    typeof r3TurnStyles==='function'?r3TurnStyles():'',
    typeof r3BattlefieldStyles==='function'?r3BattlefieldStyles():'',
    typeof r3BattlefieldDragStyles==='function'?r3BattlefieldDragStyles():'',
    typeof r3BattlefieldTaskbarStyles==='function'?r3BattlefieldTaskbarStyles():'',
    typeof r3DebugStyles==='function'?r3DebugStyles():'',
    typeof r3ThemeManagerStyles==='function'?r3ThemeManagerStyles():''

  ].join('');
}

