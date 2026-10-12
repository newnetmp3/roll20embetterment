// v3 clean-room importer: DOM observations only; no legacy runtime or Roll20 internals.
'use strict';
const R3_ORIGIN='https://advanced-sheets.production.roll20preflight.net';
const R3_EDITOR='https://app.roll20.net';
const R3_PROTOCOL='r20eb:import:v3';
const R3_ABILITIES=['str','dex','con','int','wis','cha'];
const R3_SKILLS=['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];
const R3_CATEGORIES={
  spells:'.spell-item,[data-testid*="spell-item"],[data-testid*="spell-row"],.sheet-spell',
  attacks:'.attack-item,[data-testid*="attack-item"],.sheet-attack',
  inventory:'.inventory-item,.equipment-item,[data-testid*="inventory-item"],[data-testid*="equipment-item"],[data-testid*="inventory-row"],[data-testid*="equipment-row"],.item-row--inventory,.sheet-item',
  features:'.feature-item,.trait-item,.action-item,[data-testid*="feature-item"],[data-testid*="trait-item"],.sheet-feature',
  resources:'.resource-item,[data-testid*="resource-item"],[data-testid*="resource-row"],.sheet-resource'
};
const R3_NAMES={
  spells:['.spell-item__name','.span--item-row-title','[data-testid*="spell-name"]','[class*="spell-name"]'],
  attacks:['.span--item-row-title','.attack-item__title-chat','.attack-item__title-col','[data-testid*="attack-name"]'],
  inventory:['.inventory-item__name','.equipment-item__name','.span--item-row-title','[class*="item-row-title"]','[data-testid*="item-name"]','[data-testid*="equipment-name"]'],
  features:['.action-item__name','.feature-item__name','.trait-item__name','.span--item-row-title'],
  resources:['.resource-item__name','.span--item-row-title']
};
function r3String(value,max=160){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function r3Text(el,max=300){return r3String(typeof el?.innerText==='string'?el.innerText:'',max);}
function r3Attr(el,key){return r3String(el?.getAttribute?.(key),160);}
function r3Shown(el){
  if(!el||el.disabled||el.type==='hidden'||el.hidden||el.getAttribute?.('aria-hidden')==='true')return false;
  if(el.closest?.('[hidden],[inert],[aria-hidden="true"]'))return false;
  // Explicitly hidden ancestor styles also apply to text inputs and cards.
  if(el.closest?.('[style*="display: none"],[style*="display:none"],[style*="visibility: hidden"],[style*="visibility:hidden"]'))return false;
  const rects=el.getClientRects?.();
  return !rects||rects.length>0;
}
function r3Read(el){return r3String(el?.value!==undefined?el.value:el?.getAttribute?.('value'),800);}
function r3Number(raw,min=-9999,max=9999){
  const s=r3String(raw,40).replace(/−/g,'-');
  if(!/^[+-]?\d{1,4}(?:\.\d{1,2})?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
function r3Canonical(raw){return r3String(raw,100).toLowerCase().replace(/[_-]+/g,' ').replace(/hit\s*points?/g,'hp').replace(/\s+/g,' ');}
function r3Descriptor(el){
  const parts=[r3Attr(el,'title'),r3Attr(el,'aria-label'),r3Attr(el,'name'),r3Attr(el,'data-attribute'),r3Attr(el,'id')];
  const label=el?.labels?.[0];if(label)parts.push(r3Text(label,100));
  // Follow explicit aria-labelledby references; never infer from UUIDs.
  const refs=r3Attr(el,'aria-labelledby').split(/\s+/).filter(Boolean).slice(0,4);
  for(const id of refs){
    if(!/^[\w:.-]{1,80}$/.test(id))continue;
    const target=el?.ownerDocument?.getElementById?.(id);
    const name=r3Text(target,100);if(name)parts.push(name);
  }
  return [...new Set(parts.filter(Boolean))];
}
function r3Field(raw){
  const name=r3Canonical(raw);
  const hit={
    'current hp':'hp','hp current':'hp','hp':'hp','hp remaining':'hp','remaining hp':'hp',
    'max hp':'maxHp','maximum hp':'maxHp','hp max':'maxHp','hp maximum':'maxHp',
    'temp hp':'tempHp','temporary hp':'tempHp','hp temp':'tempHp','temp':'tempHp','temphp':'tempHp',
    'armor class':'ac','ac':'ac','speed':'speed','speed (ft)':'speed','walking speed':'speed',
    'initiative':'initiative','initiative bonus':'initiative','initiative modifier':'initiative',
    'proficiency bonus':'proficiency','pb':'proficiency','level':'level','character level':'level',
    'spell save dc':'spellSaveDc','spell attack bonus':'spellAttackBonus',
    'passive perception':'passivePerception','inspiration':'inspiration',
    'cp':'cp','sp':'sp','ep':'ep','gp':'gp','pp':'pp',
    'copper':'cp','silver':'sp','electrum':'ep','gold':'gp','platinum':'pp'
  };
  if(hit[name])return {kind:'stat',key:hit[name]};
  const ability=name.match(/^(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)(?: (score|modifier|mod|save|saving throw))?$/);
  if(ability){
    const index=['strength','dexterity','constitution','intelligence','wisdom','charisma'].indexOf(ability[1]);
    const abbr=index<0?ability[1]:R3_ABILITIES[index];
    const kind=/save|saving/.test(ability[2]||'')?'saves':/mod|modifier/.test(ability[2]||'')?'modifiers':'abilities';
    return {kind,key:abbr};
  }
  const skill=R3_SKILLS.find(s=>r3Canonical(s)===name.replace(/ (bonus|modifier|mod)$/,''));
  if(skill)return {kind:'skills',key:skill};
  const slot=name.match(/^(?:spell )?(?:slot|slots|spell slots) (?:level )?([1-9])(?: (?:current|remaining|used|max|maximum|total))?$/);
  if(slot)return {kind:'slot',key:slot[1],mode:/used/.test(name)?'used':/max|maximum|total/.test(name)?'max':'current'};
  return null;
}
function r3Empty(){
  return {schema:3,name:'',capturedAt:new Date().toISOString(),stats:{},abilities:{},modifiers:{},saves:{},skills:{},
    slots:{},spells:[],attacks:[],inventory:[],features:[],resources:[],observations:[],
    diagnostics:{tabs:[],rejected:0,unclassified:0,limits:[],notes:[]},provenance:{},coverage:{}};
}
function r3Push(s,kind,key,value,source,limit=400){
  if(!kind||!key)return;
  if(kind==='stat'){
    if(s.stats[key]===undefined){s.stats[key]=value;s.provenance['stats.'+key]=source;}
  }else if(kind==='slot'){
    if(!s.slots[key])s.slots[key]={};
    const k=source.mode||'current';
    if(s.slots[key][k]===undefined)s.slots[key][k]=value;
  }else if(s[kind]&&s[kind][key]===undefined){
    s[kind][key]=value;s.provenance[kind+'.'+key]=source;
  }
}
function r3NearbyFieldText(el){
  // At most three ancestors and two compact labels; never copy HTML.
  const hints=[];
  for(let p=el?.parentElement,depth=0;p&&depth<3;p=p.parentElement,depth++){
    const controls=p.querySelectorAll?.('input,textarea,select')?.length;
    if(controls!==undefined&&controls>1)break;
    const text=r3Text(p,105);
    if(text&&text.length<=100&&!hints.includes(text))hints.push(text);
  }
  return hints.slice(0,2);
}
function r3Observation(s,el,labels,raw,tab){
  if(s.observations.length>=750){if(!s.diagnostics.limits.includes('750 form controls'))s.diagnostics.limits.push('750 form controls');return;}
  const value=el.type==='checkbox'?!!el.checked:raw;
  const obs={label:labels.slice(0,4).join(' / ').slice(0,180),value,tab,element:r3String(el.tagName,20),type:r3String(el.type,40)};
  if(labels.length===1&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(labels[0])&&
      el.type==='text'&&r3Number(raw,0,1000)!==null){
    const nearby=r3NearbyFieldText(el);
    if(nearby.length)obs.nearbyText=nearby;
  }
  s.observations.push(obs);
}
function r3Inputs(root,s,tab){
  for(const el of Array.from(root.querySelectorAll?.('input,textarea,select,[data-attribute]')||[]).slice(0,1250)){
    if(!r3Shown(el)){s.diagnostics.rejected++;continue;}
    const labels=r3Descriptor(el);
    if(!labels.length)continue;
    const raw=r3Read(el);if(!raw&&el.type!=='checkbox')continue;
    r3Observation(s,el,labels,raw,tab);
    let mapped=false;
    for(const label of labels){
      const field=r3Field(label);
      if(!field)continue;
      const range=field.kind==='abilities'?[1,30]:field.kind==='modifiers'||field.kind==='saves'||field.kind==='skills'?[-30,50]:
        field.key==='ac'?[1,60]:field.key==='speed'?[0,1000]:field.key==='level'?[1,30]:[0,9999];
      const n=r3Number(raw,...range);
      if(n===null){s.diagnostics.rejected++;continue;}
      if(field.kind==='slot')r3Push(s,'slot',field.key,n,{kind:'input',tab,mode:field.mode,label});
      else if(field.kind==='stat'&&field.key==='maxHp'){
        s.stats.maxHp=n;s.provenance['stats.maxHp']={kind:'input',tab,label};
      }else r3Push(s,field.kind,field.key,n,{kind:'input',tab,label});
      if(field.kind==='stat'&&field.key==='hp'){
        const ariaMax=r3Number(r3Attr(el,'aria-valuemax'),1,9999);
        if(ariaMax!==null&&s.stats.maxHp===undefined)r3Push(s,'stat','maxHp',ariaMax,{kind:'aria-valuemax',tab,label});
      }
      mapped=true;break;
    }
    // The real 2024 sheet uses named input[type=range] for feature/item
    // trackers (Second Wind, Unleash Incarnation, Healer's Kit, etc.).
    // Record their *observed slider positions*, not guessed remaining uses.
    if(!mapped&&el.type==='range'&&/^(?:current view|combat|features\s*(?:&|and)\s*traits)$/i.test(tab)){
      const label=labels.find(name=>name.length<=100&&!/^[0-9a-f-]{32,}$/i.test(name)&&
        !/^(?:resource|resources|track|tracker|charge|charges|uses|remaining|used)$/i.test(name));
      const n=r3Number(raw,0,9999);
      if(label&&n!==null&&s.resources.length<400){
        const key=r3String(label,100).toLowerCase();
        if(!s.resources.some(x=>x._key===key))
          s.resources.push({name:r3String(label,100),tab,
            visible:'Observed slider position: '+n+' (availability/expended meaning not verified)',
            observedValue:n,controlType:'range',source:{kind:'named range input',tab,label},
            _key:key});
        mapped=true;
      }
    }
    if(!mapped)s.diagnostics.unclassified++;
  }
  // Exact named maximum HP is stronger evidence than a fallback aria maximum.
  const explicit=s.observations.find(o=>/(?:^|\/\s*)(?:max(?:imum)? hp|hp max)$/i.test(o.label));
  const value=explicit&&r3Number(explicit.value,1,9999);
  if(value!==null&&value!==undefined){
    s.stats.maxHp=value;s.provenance['stats.maxHp']={kind:'input',tab,label:explicit.label};
  }
}
function r3PanelValue(root,selectors,min,max){
  for(const selector of selectors){
    const el=root.querySelector?.(selector);
    if(!el||!r3Shown(el))continue;
    const raw=el.value!==undefined?r3Read(el):r3Text(el,90);
    const m=raw.match(/[+−-]?\d{1,4}(?:\.\d{1,2})?/);
    const n=r3Number(m?.[0],min,max);if(n!==null)return n;
  }
  return null;
}
function r3VisibleStats(root,s,tab){
  const known=[
    ['ac',['.armor-class__value','[data-testid="armor-class"]','[title="Armor Class"]'],1,60],
    ['speed',['[data-testid="speed"]','[title="Speed"]','.speed__value'],0,1000],
    ['initiative',['.initiative-btn button','[data-testid="initiative"]'], -30,50],
    ['proficiency',['[data-testid="proficiency-bonus"]'],0,20]
  ];
  for(const [field,selectors,min,max] of known){
    if(s.stats[field]!==undefined)continue;
    const n=r3PanelValue(root,selectors,min,max);
    if(n!==null)r3Push(s,'stat',field,n,{kind:'official visible element',tab});
  }
  // Restrict inline ability extraction to the known official ability rows.
  for(const row of Array.from(root.querySelectorAll?.('.inline-ability')||[]).slice(0,12)){
    if(!r3Shown(row))continue;
    const abbr=r3Text(row,180).match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i)?.[1]?.toLowerCase();
    if(!abbr)continue;
    const score=Array.from(row.querySelectorAll?.('input')||[]).find(r3Shown);
    const n=r3Number(score?.value,1,30);
    if(n!==null)r3Push(s,'abilities',abbr,n,{kind:'ability row',tab});
    for(const [kind,selector] of [['modifiers','.poly-button--ability button'],['saves','.poly-button--compact-saving-throw button']]){
      const v=r3PanelValue(row,[selector],-30,50);
      if(v!==null)r3Push(s,kind,abbr,v,{kind:'official roll button',tab});
    }
  }
  for(const row of Array.from(root.querySelectorAll?.('.skill')||[]).slice(0,80)){
    if(!r3Shown(row))continue;
    const name=r3Text(row.querySelector?.('button.skill__name'),80);
    const matched=R3_SKILLS.find(x=>x.toLowerCase()===name.toLowerCase());
    if(!matched)continue;
    const bonus=r3Text(row,120).match(/[+−-]\s*\d{1,2}/);
    const n=r3Number(bonus?.[0],-30,50);
    if(n!==null)r3Push(s,'skills',matched,n,{kind:'skill row',tab});
  }
  // Text is a *secondary* hint, not a replacement for form values. Parse
  // only tightly anchored label/value sequences in already rendered text.
  const visible=r3String(root.innerText,25000);
  for(const [field,regex,min,max] of [
    ['ac',/\bARMOR CLASS\s*:?\s*(\d{1,2})\b/i,1,60],
    ['speed',/\bSPEED(?:\s*\(ft\))?\s*:?\s*(\d{1,3})\b/i,0,1000],
    ['initiative',/\bINITIATIVE\s*:?\s*([+−-]?\s*\d{1,2}(?:\.\d{1,2})?)/i,-30,50],
    ['proficiency',/\bPROFICIENCY BONUS\s*:?\s*\+?\s*(\d{1,2})/i,0,20]
  ]){
    if(s.stats[field]!==undefined)continue;
    const m=visible.match(regex),n=r3Number(m?.[1]?.replace(/\s/g,''),min,max);
    if(n!==null)r3Push(s,'stat',field,n,{kind:'visible text',tab});
  }
}
function r3Name(row,kind){
  for(const selector of R3_NAMES[kind]||[]){
    const child=row.querySelector?.(selector);
    if(child&&r3Shown(child)){
      const name=r3Text(child,125);if(name)return name;
    }
  }
  // Explicit heading/accessible name is next; never use a whole card's text
  // as the name (it may include damage, description and resource counts).
  const titled=row.querySelector?.('[data-testid$="-name"],[role="heading"],h3,h4');
  return r3Text(titled,125)||r3Attr(row,'aria-label');
}
function r3CardInfo(card,kind,name,tab){
  const info={name,tab,visible:r3Text(card,1100)};
  const tag=r3Attr(card,'data-testid');if(tag)info.testId=tag;
  const buttons=Array.from(card.querySelectorAll?.('button')||[]).slice(0,18)
    .filter(r3Shown).map(b=>({label:r3String(r3Attr(b,'aria-label')||r3Attr(b,'title')||r3Text(b,70),70)}))
    .filter(b=>b.label);
  if(buttons.length)info.actions=buttons;
  if(kind==='spells'){
    // The official 2024 card flattens header and description into one
    // innerText string. Words like "range", "duration" and "action" in the
    // description are NOT field labels. Only use the short header, or
    // explicit labeled fields with recognizable values.
    const header=info.visible.slice(name.length,name.length+100);
    const level=header.match(/\b(?:cantrip|level\s*[1-9])\b/i);
    if(level)info.level=r3String(level[0],30);
    const range=header.match(/^\s*(self(?:\s+\d+\s*(?:ft\.?|feet)\s+radius)?|touch|\d+\s*(?:ft\.?|feet|miles?))\b/i);
    if(range)info.range=r3String(range[1],60);
    else {
      const explicit=header.match(/\brange\s*:\s*(self|touch|\d+\s*(?:ft\.?|feet|miles?))\b/i);
      if(explicit)info.range=r3String(explicit[1],60);
    }
    const explicitCasting=header.match(/\bcasting\s*time\s*:\s*(?:\d+\s+)?(?:bonus action|action|reaction|minutes?|hours?)\b/i);
    // Only 1 action is valid numeric shorthand; CON 11 Action is a save DC.
    const compactCasting=header.match(/\b(?:1\s+)?(?:bonus action|action|reaction)\b(?=\s+(?:V|S|M|R|C)\b)/i);
    const casting=explicitCasting||compactCasting;
    if(casting){
      info.castingTime=r3String(casting[0],70);
      // Read V/S/M components and R/C flags only immediately after
      // the casting time in the official sheet's compact header.
      const tail=header.slice(casting.index+casting[0].length);
      const tokens=tail.match(/^\s*([VSMRC](?:\s+[VSMRC])*)(?=\s|$)/);
      if(tokens){
        const codes=tokens[1].split(/\s+/);
        const components=[...new Set(codes.filter(x=>/^[VSM]$/.test(x)))];
        if(components.length)info.components=components.join(' ');
        if(codes.includes('R'))info.ritual=true;
        if(codes.includes('C'))info.concentration=true;
      }
    }
    const duration=header.match(/\bduration\s*:\s*(?:instantaneous|concentration|up to\s+\d+|\d+\s+(?:rounds?|minutes?|hours?|days?))[^,;.]{0,20}/i);
    if(duration)info.duration=r3String(duration[0],70);
    const components=header.match(/\bcomponents\s*:\s*[VSM](?:\s*,?\s*[VSM]){0,2}\b/i);
    if(components)info.components=r3String(components[0],45);
    // Absence of readable metadata means "unknown", not a false flag.
    if(/\britual\b/i.test(header))info.ritual=true;
    if(/\bconcentration\b/i.test(header))info.concentration=true;
  }
  return info;
}
// Only named, rendered inventory rows are imported. Many 2024 sheets use
// generic item-row components instead of .inventory-item/.equipment-item.
function r3AddNamedCard(s,kind,row,name,tab){
  if(!Array.isArray(s[kind])||!name||s[kind].length>=400)return;
  const info=r3CardInfo(row,kind,name,tab);
  const key=name.toLowerCase()+'|'+(kind==='spells'?info.level||'':'')+'|'+(kind==='attacks'?info.visible.slice(0,60):'');
  if(!s[kind].some(x=>x._key===key))s[kind].push({...info,_key:key});
}
function r3InventoryRows(root,s,tab){
  // Generic .item-row and .span--item-row-title also appear on other tabs.
  // Use them only after visiting the *actual* Inventory tab.
  if(!/^inventory\b/i.test(tab))return;
  const names=Array.from(root.querySelectorAll?.(
    '.span--item-row-title,[class*="item-row-title"],[data-testid*="item-name"],'+
    '[data-testid*="equipment-name"],.inventory-item__name,.equipment-item__name'
  )||[]).slice(0,500);
  for(const el of names){
    if(!r3Shown(el))continue;
    const name=r3Text(el,125);
    if(!name||/^(equipment|other possessions|attunement|inventory|add item|search)$/i.test(name))continue;
    const row=el.closest?.(
      '.item-row,[class*="item-row__"],[class*="item-row--"],[data-testid*="item-row"],'+
      '.inventory-item,.equipment-item,[data-testid*="inventory-item"],[data-testid*="equipment-item"]'
    )||el.parentElement?.parentElement||el.parentElement||el;
    if(!r3Shown(row))continue;
    // Don't manufacture a giant "item" whose wrapper holds several names.
    if((row.querySelectorAll?.('.span--item-row-title,[data-testid*="item-name"]')||[]).length>1)continue;
    r3AddNamedCard(s,'inventory',row,name,tab);
  }
}
function r3ResourceControls(root,s,tab){
  // 2024 resources are normally charge/checkbox trackers *inside* features
  // or inventory items, not standalone .resource-item cards.
  const controls=Array.from(root.querySelectorAll?.(
    '.resource-tracker,[class*="resource-tracker"],[class*="resource-row"],'+
    '[data-testid*="resource"],[class*="resource-uses"],[class*="charge-tracker"]'
  )||[]).slice(0,500);
  const seen=new Set();
  for(const el of controls){
    if(!r3Shown(el))continue;
    const group=el.closest?.(
      '.resource-item,[data-testid*="resource-row"],.resource-tracker,'+
      '[class*="resource-tracker"],[class*="resource-row"]'
    )||el;
    if(seen.has(group))continue;seen.add(group);
    if(!r3Shown(group))continue;
    const parent=group.closest?.(
      '.item-row,.inventory-item,.equipment-item,.feature-item,.trait-item,.action-item,'+
      '[data-testid*="feature-item"],[data-testid*="inventory-item"]'
    )||group.parentElement;
    const resourceLabel=group.querySelector?.(
      '[data-testid*="resource-name"],[class*="resource__name"],'+
      '[class*="resource-name"],[class*="resource-label"]'
    );
    let name=r3Text(resourceLabel,125);
    if(!name)name=r3Attr(group,'aria-label')||r3Attr(group,'title');
    if(!name&&group!==el)name=r3Attr(el,'aria-label')||r3Attr(el,'title');
    if(!name||/^(resources?|charges?|uses?|track(?:er)?|remaining|used)$/i.test(name)){
      const owner=parent&&parent!==group?parent:null;
      name=owner&&(r3Name(owner,'inventory')||r3Name(owner,'features')||r3Name(owner,'attacks'))||'';
    }
    if(!name||/^(resources?|charges?|uses?|track(?:er)?|remaining|used)$/i.test(name))continue;
    const item=r3CardInfo(group,'resources',name,tab);
    // Checkboxes describe *visible state*. Checked may mean expended or
    // available depending on the sheet; never infer remaining charges.
    const checks=Array.from(group.querySelectorAll?.('input[type="checkbox"],[role="checkbox"]')||[]).slice(0,100);
    if(checks.length)item.checkboxes={total:checks.length,checked:checks.filter(c=>c.checked||r3Attr(c,'aria-checked')==='true').length};
    if(!item.visible)item.visible=r3Text(parent,250);
    const key=name.toLowerCase();
    if(!s.resources.some(x=>x._key===key)&&s.resources.length<400)
      s.resources.push({...item,_key:key});
  }
}
function r3Cards(root,s,tab){
  // Card collections and keyed bonus maps have different data contracts.
  // Skills are parsed by r3VisibleStats into s.skills (an object), never here.
  for(const [kind,selector] of Object.entries(R3_CATEGORIES)){
    if(!Array.isArray(s[kind])){
      s.diagnostics.notes.push('Card category '+kind+' is not an array; skipped');
      continue;
    }
    const cards=Array.from(root.querySelectorAll?.(selector)||[]).slice(0,300);
    if(cards.length===300)s.diagnostics.limits.push(kind+' cards capped at 300 per tab');
    for(const row of cards){
      if(!r3Shown(row))continue;
      const name=r3Name(row,kind);if(!name)continue;
      r3AddNamedCard(s,kind,row,name,tab);
    }
  }
  r3InventoryRows(root,s,tab);
  r3ResourceControls(root,s,tab);
}
function r3Capture(root,tab='Current view'){
  const s=r3Empty();s.name=r3NameFromDocument(root);
  if(!root?.querySelectorAll){s.diagnostics.notes.push('No readable official sheet DOM');return s;}
  r3Inputs(root,s,tab);r3VisibleStats(root,s,tab);r3Cards(root,s,tab);
  s.diagnostics.tabs.push(tab);r3Coverage(s);return s;
}
function r3NameFromDocument(root){
  for(const selector of ['[data-testid="character-name"]','.profile__name input','.profile__name',
    '.character-name','[class*="profile__name"]']){
    const el=root.querySelector?.(selector);
    const name=r3String(el?.value||r3Text(el,120),120);
    if(name&&!/^(character|character sheet|name)$/i.test(name))return name;
  }
  return r3String(root.ownerDocument?.title||root.title,120).replace(/\s+[—–]\s+.*$/,'')||'Unnamed sheet';
}
function r3Coverage(s){
  s.coverage={stats:Object.keys(s.stats).length,abilities:Object.keys(s.abilities).length,
    modifiers:Object.keys(s.modifiers).length,saves:Object.keys(s.saves).length,
    skills:Object.keys(s.skills).length,slots:Object.keys(s.slots).length,
    spells:s.spells.length,attacks:s.attacks.length,inventory:s.inventory.length,
    features:s.features.length,resources:s.resources.length,observations:s.observations.length};
  return s;
}
function r3Merge(target,source){
  for(const key of ['stats','abilities','modifiers','saves','skills']){
    for(const [k,v] of Object.entries(source[key]))if(target[key][k]===undefined){
      target[key][k]=v;target.provenance[key+'.'+k]=source.provenance[key+'.'+k];}
  }
  for(const [k,v] of Object.entries(source.slots)){
    target.slots[k]={...v,...(target.slots[k]||{})};
  }
  for(const kind of Object.keys(R3_CATEGORIES)){
    if(!Array.isArray(target[kind])||!Array.isArray(source[kind]))continue;
    const keys=new Set(target[kind].map(x=>x._key));
    for(const item of source[kind])if(!keys.has(item._key)&&target[kind].length<400){
      target[kind].push(item);keys.add(item._key);
    }
  }
  const obs=new Set(target.observations.map(o=>o.tab+'|'+o.label+'|'+o.value));
  for(const o of source.observations)if(target.observations.length<750&&!obs.has(o.tab+'|'+o.label+'|'+o.value)){
    target.observations.push(o);obs.add(o.tab+'|'+o.label+'|'+o.value);
  }
  target.diagnostics.rejected+=source.diagnostics.rejected;
  target.diagnostics.unclassified+=source.diagnostics.unclassified;
  target.diagnostics.tabs.push(...source.diagnostics.tabs);
  target.diagnostics.limits.push(...source.diagnostics.limits);
  target.diagnostics.notes.push(...source.diagnostics.notes);
  if(!target.name||target.name==='Unnamed sheet')target.name=source.name;
  target.capturedAt=new Date().toISOString();return r3Coverage(target);
}
