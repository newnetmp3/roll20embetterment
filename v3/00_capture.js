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
  inventory:'.inventory-item,.equipment-item,[data-testid*="inventory-item"],[data-testid*="equipment-item"],.sheet-item',
  features:'.feature-item,.trait-item,.action-item,[data-testid*="feature-item"],[data-testid*="trait-item"],.sheet-feature',
  resources:'.resource-item,[data-testid*="resource-item"],.sheet-resource',
  skills:'.skill,[data-testid*="skill-row"]'
};
const R3_NAMES={
  spells:['.spell-item__name','.span--item-row-title','[data-testid*="spell-name"]','[class*="spell-name"]'],
  attacks:['.span--item-row-title','.attack-item__title-chat','.attack-item__title-col','[data-testid*="attack-name"]'],
  inventory:['.inventory-item__name','.equipment-item__name','.span--item-row-title','[data-testid*="item-name"]'],
  features:['.action-item__name','.feature-item__name','.trait-item__name','.span--item-row-title'],
  resources:['.resource-item__name','.span--item-row-title'],
  skills:['button.skill__name','.skill__name','[data-testid*="skill-name"]']
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
  return [...new Set(parts.filter(Boolean))];
}
function r3Field(raw){
  const name=r3Canonical(raw);
  const hit={
    'current hp':'hp','hp current':'hp','hp':'hp','hp remaining':'hp','remaining hp':'hp',
    'max hp':'maxHp','maximum hp':'maxHp','hp max':'maxHp','hp maximum':'maxHp',
    'temp hp':'tempHp','temporary hp':'tempHp','hp temp':'tempHp',
    'armor class':'ac','ac':'ac','speed':'speed','speed (ft)':'speed','walking speed':'speed',
    'initiative':'initiative','initiative bonus':'initiative','initiative modifier':'initiative',
    'proficiency bonus':'proficiency','pb':'proficiency','level':'level','character level':'level',
    'spell save dc':'spellSaveDc','spell attack bonus':'spellAttackBonus',
    'passive perception':'passivePerception','inspiration':'inspiration',
    'cp':'cp','sp':'sp','ep':'ep','gp':'gp','pp':'pp'
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
function r3Observation(s,el,labels,raw,tab){
  if(s.observations.length>=750){if(!s.diagnostics.limits.includes('750 form controls'))s.diagnostics.limits.push('750 form controls');return;}
  const value=el.type==='checkbox'?!!el.checked:raw;
  s.observations.push({label:labels.slice(0,4).join(' / ').slice(0,180),value,tab,element:r3String(el.tagName,20),type:r3String(el.type,40)});
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
      else r3Push(s,field.kind,field.key,n,{kind:'input',tab,label});
      if(field.kind==='stat'&&field.key==='hp'){
        const ariaMax=r3Number(r3Attr(el,'aria-valuemax'),1,9999);
        if(ariaMax!==null&&s.stats.maxHp===undefined)r3Push(s,'stat','maxHp',ariaMax,{kind:'aria-valuemax',tab,label});
      }
      mapped=true;break;
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
    for(const [key,re] of [['level',/\b(?:cantrip|level\s*[1-9])\b/i],['castingTime',/\b(?:casting time|bonus action|reaction|action|ritual)\s*[:\-]?\s*[^,\n]{0,40}/i],
      ['range',/\b(?:range|reach)\s*[:\-]?\s*[^,\n]{0,40}/i],['duration',/\bduration\s*[:\-]?\s*[^,\n]{0,40}/i],
      ['components',/\bcomponents?\s*[:\-]?\s*[^,\n]{0,45}/i]]){
      const m=info.visible.match(re);if(m)info[key]=r3String(m[0],70);
    }
    info.concentration=/\bconcentration\b/i.test(info.visible);
    info.ritual=/\britual\b/i.test(info.visible);
  }
  return info;
}
function r3Cards(root,s,tab){
  for(const [kind,selector] of Object.entries(R3_CATEGORIES)){
    const cards=Array.from(root.querySelectorAll?.(selector)||[]).slice(0,300);
    if(cards.length===300)s.diagnostics.limits.push(kind+' cards capped at 300 per tab');
    for(const row of cards){
      if(!r3Shown(row))continue;
      const name=r3Name(row,kind);if(!name)continue;
      const info=r3CardInfo(row,kind,name,tab);
      const key=name.toLowerCase()+'|'+(kind==='spells'?info.level||'':'')+'|'+(kind==='attacks'?info.visible.slice(0,60):'');
      if(!s[kind].some(x=>x._key===key)){
        if(s[kind].length>=400)continue;
        s[kind].push({...info,_key:key});
      }
    }
  }
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
