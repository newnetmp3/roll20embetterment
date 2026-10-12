// ==UserScript==
// @name         roll20 Embetterment
// @namespace    https://github.com/newnetmp3/roll20embetterment
// @version      3.2.2
// @description  Player-first combat HUD backed by authenticated D&D 2024 sheet data.
// @author       roll20 Embetterment contributors
// @match        https://app.roll20.net/editor/*
// @match        https://app.roll20.net/editor
// @match        https://advanced-sheets.production.roll20preflight.net/dnd2024byroll20/*
// @match        https://advanced-sheets.production.roll20preflight.net/*dnd2024byroll20/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// @downloadURL  https://raw.githubusercontent.com/newnetmp3/roll20embetterment/main/roll20-embetterment.user.js
// ==/UserScript==

(()=>{
// ===== v3/00_capture.js =====
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
  if(kind==='inventory')r3InventoryControls(card,info);
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
    // Plain words in the description are not proof of spell flags.
    // The flags above require the official single-letter header tokens.
  }
  return info;
}
// The live 2024 Inventory uses compact − [count] + steppers; the count
// may lack any quantity label or test id. Use the two adjacent buttons as
// evidence instead of assuming every anonymous numeric field is a count.
function r3InventoryStepperButton(button){
  const text=r3Text(button,14);
  const hint=[r3Attr(button,'aria-label'),r3Attr(button,'title'),
    r3Attr(button,'data-testid'),r3String(button.className,100)].join(' ');
  return {
    minus:/^[−–-]$/.test(text)||/\b(?:decrease|decrement|subtract|minus|reduce quantity)\b/i.test(hint),
    plus:/^\+$/.test(text)||/\b(?:increase|increment|plus|add quantity)\b/i.test(hint)
  };
}
function r3InventoryStepper(el){
  // Reject resource/charge counters even if they also have +/- buttons.
  if(el.closest?.('.resource-tracker,[class*="resource-tracker"],[class*="charge-tracker"],[data-testid*="resource-row"]'))
    return false;
  for(let group=el.parentElement,depth=0;group&&depth<3;group=group.parentElement,depth++){
    const inputs=Array.from(group.querySelectorAll?.('input,[role="spinbutton"]')||[]).slice(0,8);
    if(inputs.length>1)break; // don't correlate buttons from unrelated controls
    if(inputs.length!==1||inputs[0]!==el)continue;
    const buttons=Array.from(group.querySelectorAll?.('button')||[]).slice(0,10).filter(r3Shown);
    if(buttons.length<2)continue;
    const directions=buttons.map(r3InventoryStepperButton);
    if(directions.some(x=>x.minus)&&directions.some(x=>x.plus))return true;
  }
  return false;
}
function r3InventoryRowFor(nameElement){
  // `.item-row__name` may be the nearest match of an expansive selector,
  // but it omits the quantity stepper next to the name. Prefer a complete
  // item wrapper before falling back to its bounded single-title ancestors.
  const outer=nameElement.closest?.(
    '.item-row,.inventory-item,.equipment-item,[data-testid*="item-row"],'+
    '[data-testid*="inventory-item"],[data-testid*="equipment-item"]');
  if(outer)return outer;
  let best=null;
  for(let parent=nameElement.parentElement,depth=0;parent&&depth<5;
      parent=parent.parentElement,depth++){
    const names=Array.from(parent.querySelectorAll?.(
      '.span--item-row-title,[data-testid*="item-name"],[data-testid*="equipment-name"]'
    )||[]);
    if(names.length>1)break;
    if(names.length===1)best=parent;
  }
  return best||nameElement.parentElement?.parentElement||nameElement.parentElement||nameElement;
}
// Keep only raw, explicitly observed states in an inventory item's own row.
// 2024 quantity controls can be Vue incrementers; changing their number to
// zero often leaves the item's ordinary innerText unchanged. Don't infer
// whether a toggle means equipped, carried, attuned or consumed.
function r3InventoryControls(row,info){
  const controls=Array.from(row.querySelectorAll?.(
    'input,select,[role="spinbutton"],[role="checkbox"],[role="switch"],button[aria-pressed]'
  )||[]).slice(0,36);
  const observed=[];
  const quantities=[];
  for(const el of controls){
    if(!r3Shown(el))continue;
    // Nested inventory cards/resource sections must not be mistaken for
    // another item's quantity. Only the innermost named inventory row owns
    // a control when there is a nested row.
    const owner=el.closest?.('.item-row,.inventory-item,.equipment-item,[data-testid*="inventory-row"]');
    if(owner&&owner!==row)continue;
    const role=r3Attr(el,'role'),type=r3String(el.type,35).toLowerCase();
    const labels=r3Descriptor(el);
    const label=r3String(labels.find(l=>!/(?:^[0-9a-f]{8}-[0-9a-f-]{27,}$)/i.test(l))||'',100);
    const testId=r3Attr(el,'data-testid');
    const state=type==='checkbox'?(!!el.checked):
      role==='checkbox'||role==='switch'?r3Attr(el,'aria-checked')==='true':
      r3Attr(el,'aria-pressed')?r3Attr(el,'aria-pressed')==='true':null;
    if(state!==null){
      observed.push({kind:'toggle',label:label||role||'Checkbox',
        value:state,source:role||type||'aria-pressed'});
      continue;
    }
    if(String(el.tagName||'').toUpperCase()==='BUTTON')continue;
    const numeric=r3Number(r3Read(el),0,9999);
    if(numeric===null)continue;
    // Exact quantity/incrementer semantics only; a resource counter from
    // a potion or magic item is not necessarily an item count.
    const namedQuantity=/(?:quantity|qty|item count|stack count)/i.test(
      [label,testId,r3Attr(el,'aria-label')].join(' '))||
      /(?:utility-incrementer__input|item-quantity)/i.test(
        [testId,r3String(el.className,120)].join(' '));
    const pairedStepper=!namedQuantity&&r3InventoryStepper(el);
    const quantity=namedQuantity||pairedStepper;
    if(quantity)quantities.push(numeric);
    observed.push({kind:quantity?'quantity':'number',
      label:label||(quantity?'Item quantity':'Unlabeled numeric control'),
      value:numeric,source:pairedStepper?'observed adjacent minus/plus buttons':
        testId||type||role||'input'});
  }
  if(observed.length)info.controls=observed.slice(0,24);
  if(quantities.length===1)info.quantity=quantities[0];
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
    const row=r3InventoryRowFor(el);
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
// Quantity zero is an explicit observation, unlike a row absent because a
// tab is offscreen, filtered or virtualized. Keep zero rows in reader scans
// as removal signals; prune only when publishing an editor-side snapshot.
function r3InventoryZero(item){
  return item?.quantity===0;
}
function r3InventoryPrune(snapshot){
  if(Array.isArray(snapshot?.inventory))
    snapshot.inventory=snapshot.inventory.filter(item=>!r3InventoryZero(item));
  return r3Coverage(snapshot);
}
// Reconcile already-imported UUID-addressed input observations only when
// the reader captured a nearby *exact* field caption in the same single-
// control wrapper. This preserves existing exported evidence (Nier AC 17,
// Speed 55) without assigning meaning to an anonymous UUID or numeric value.
function r3RecoverObservedStats(snapshot){
  if(!snapshot?.stats||!Array.isArray(snapshot.observations))return snapshot;
  for(const [field,caption,min,max] of [
    ['ac',/^(?:armor class|ac)$/i,1,60],
    ['speed',/^speed(?:\s*\(ft\))?$/i,0,1000],
    ['passivePerception',/^passive perception$/i,0,60]
  ]){
    if(snapshot.stats[field]!==undefined)continue;
    const matches=[];
    for(const obs of snapshot.observations.slice(0,750)){
      // UUID-only fields cannot be mapped from their IDs. The local caption
      // is an independent observation, not a value-based inference.
      if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(r3String(obs.label,160)))continue;
      const labels=Array.isArray(obs.nearbyText)?obs.nearbyText:[];
      if(labels.length!==1||!caption.test(r3String(labels[0],90)))continue;
      const n=r3Number(obs.value,min,max);
      if(n!==null)matches.push({value:n,tab:r3String(obs.tab,70),label:labels[0]});
    }
    if(!matches.length||matches.some(x=>x.value!==matches[0].value))continue;
    snapshot.stats[field]=matches[0].value;
    snapshot.provenance=snapshot.provenance||{};
    snapshot.provenance['stats.'+field]={kind:'exact nearby control caption',
      label:matches[0].label,tab:matches[0].tab};
  }
  return snapshot;
}
function r3Coverage(s){
  r3RecoverObservedStats(s);
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
    for(const item of source[kind]){
      if(keys.has(item._key)){
        // On a full traversal, a later Inventory-tab observation takes
        // precedence over the generic first view, including quantity 0.
        if(kind==='inventory'){
          const index=target[kind].findIndex(x=>x._key===item._key);
          if(index>=0)target[kind][index]=item;
        }
      }else if(target[kind].length<400){
        target[kind].push(item);keys.add(item._key);
      }
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


// Low-cost, read-only HP sampling: only mounted official inputs, never tab
// traversal, card collection, token guessing or sheet state mutation.
function r3CaptureHealth(root=document.body){
  const s=r3Empty();s.name=r3NameFromDocument(root);
  if(!root?.querySelectorAll)return r3Coverage(s);
  const inputs=Array.from(root.querySelectorAll('input')||[]).slice(0,600);
  let explicitMax=null;
  for(const el of inputs){
    if(!r3Shown(el))continue;
    const labels=r3Descriptor(el);
    for(const label of labels){
      const field=r3Field(label);
      if(field?.kind!=='stat'||!['hp','maxHp','tempHp'].includes(field.key))continue;
      const value=r3Number(r3Read(el),0,9999);
      if(value===null)break;
      const source={kind:'hp watch input',tab:'HP watch',label};
      if(field.key==='maxHp'){explicitMax={value,source};}
      else r3Push(s,'stat',field.key,value,source);
      if(field.key==='hp'&&s.stats.maxHp===undefined){
        const maximum=r3Number(r3Attr(el,'aria-valuemax'),1,9999);
        if(maximum!==null)r3Push(s,'stat','maxHp',maximum,
          {kind:'hp watch aria maximum',tab:'HP watch',label});
      }
      break;
    }
  }
  if(explicitMax){s.stats.maxHp=explicitMax.value;s.provenance['stats.maxHp']=explicitMax.source;}
  if(s.stats.hp!==undefined)s.diagnostics.tabs.push('HP watch');
  return r3Coverage(s);
}

// ===== v3/10_reader.js =====
// v3 authenticated cross-origin reader and explicit, bounded tab traversal.
const R3_PENDING=new Map();
const R3_POPOUTS=new Map();
const R3_SESSION=(crypto.randomUUID?.()||('session-'+Date.now()+'-'+Math.random())).slice(0,100);
let r3Counter=0,r3ListenerStarted=false,r3ReaderDirtyTimer=null;
function r3SheetContext(){return location.origin===R3_ORIGIN&&/\/dnd2024byroll20(?:\/|$)/.test(location.pathname);}
function r3EditorContext(){return location.origin===R3_EDITOR&&/^\/editor(?:\/|$)/.test(location.pathname);}
function r3ReaderPeer(){
  if(window.parent!==window)return window.parent;
  try{return window.opener&&!window.opener.closed?window.opener:null;}catch{return null;}
}
function r3Msg(type,extras={}){return {protocol:R3_PROTOCOL,type,...extras};}
function r3TabLabel(el){return r3String(el?.getAttribute?.('aria-label')||r3Text(el,80),80);}
function r3Tabs(){
  const all=Array.from(document.querySelectorAll('[role="tab"],.layout-tabbed-panel__tab-link[role="tab"]')).slice(0,150);
  return [...new Set(all)].filter(el=>r3Shown(el)&&!el.disabled&&r3TabLabel(el)&&r3TabLabel(el).length<65);
}
function r3Active(tab){return tab?.getAttribute?.('aria-selected')==='true'||tab?.getAttribute?.('data-state')==='active'||/\b(active|selected|current)\b/i.test(String(tab?.className||''));}
function r3Pause(ms){return new Promise(r=>setTimeout(r,ms));}
function r3TabKey(tab){
  const group=tab?.closest?.('[role="tablist"]');
  const groupName=r3Attr(group,'aria-label')||r3Attr(group,'id')||
    r3String(group?.className,80)||'tablist';
  return groupName+'|'+r3TabLabel(tab).toLowerCase();
}
function r3ResolveTab(key,label){
  const tabs=r3Tabs();
  return tabs.find(tab=>r3TabKey(tab)===key)||
    tabs.find(tab=>r3TabLabel(tab).toLowerCase()===label.toLowerCase())||null;
}
async function r3CollectAllTabs(progress){
  // Vue can replace every tab element after clicking a tab. Store labels
  // and stable tablist identities, NOT stale element references.
  const descriptors=()=>r3Tabs().map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const original=r3Tabs().filter(r3Active).map(tab=>({key:r3TabKey(tab),label:r3TabLabel(tab)}));
  const acc=r3Empty(),seen=new Set();
  let visited=0;
  const primaryLabel=/^(combat|spells|inventory|features\s*(?:&|and)\s*traits|skills\s*(?:&|and)\s*tools|notes|about)$/i;
  const collect=label=>{
    r3Merge(acc,r3Capture(document.body,label));visited++;
    progress?.(label,r3Coverage(acc));
  };
  const visit=async ({key,label})=>{
    if(visited>=32||seen.has(key))return false;
    const tab=r3ResolveTab(key,label);
    if(!tab||!r3Shown(tab)){
      acc.diagnostics.notes.push('Tab not available when visited: '+label);
      return false;
    }
    seen.add(key);
    if(!r3Active(tab)){
      tab.click();await r3Pause(290);
    }
    collect(label);
    return true;
  };
  try{
    collect('Current view');
    const initial=descriptors();
    // The six main 2024 sheet panels must not be pushed out of the first
    // 14 tabs by nested filter tabs (a previous source of false zeroes).
    const main=initial.filter(x=>primaryLabel.test(x.label));
    for(const mainTab of main){
      if(visited>=32)break;
      if(!await visit(mainTab))continue;
      const children=descriptors().filter(x=>!primaryLabel.test(x.label)&&!seen.has(x.key)).slice(0,20);
      for(const child of children){
        if(visited>=32)break;
        await visit(child);
      }
    }
    // Visit any other initially visible tabs missed by the priority pass.
    for(const extra of initial.filter(x=>!primaryLabel.test(x.label))){
      if(visited>=32)break;
      await visit(extra);
    }
  }finally{
    // Restore by identity rather than trying to click detached old nodes.
    for(const prior of original){
      const tab=r3ResolveTab(prior.key,prior.label);
      if(tab&&!r3Active(tab)){tab.click();await r3Pause(130);}
    }
  }
  if(visited>=32)acc.diagnostics.limits.push('32 tab views maximum');
  const scanned=acc.diagnostics.tabs;
  if(!scanned.some(label=>/^inventory\b/i.test(label)))
    acc.diagnostics.notes.push('Inventory tab was not visited. Check whether its tab is exposed and visible.');
  else if(!acc.inventory.length)
    acc.diagnostics.notes.push('Inventory tab visited, but no identifiable item-name rows were rendered.');
  if(!acc.resources.length)
    acc.diagnostics.notes.push('No named resource trackers detected in rendered tabs; resource checkboxes may be nested or unmounted.');
  acc.diagnostics.notes.push('Only rendered DOM was read. Virtualized/offscreen rows are not guaranteed complete.');
  return r3Coverage(acc);
}
function r3CurrentTabLabel(){
  // An ordinary current-view scan must carry the real active primary tab:
  // generic 2024 inventory rows are deliberately imported only in Inventory.
  // Avoid guessing from a nested filter (e.g. "Weapons") or hidden tabs.
  const main=/^(?:combat|spells|inventory|features\s*(?:&|and)\s*traits|skills\s*(?:&|and)\s*tools|notes|about)$/i;
  const active=r3Tabs().filter(r3Active);
  return active.map(r3TabLabel).find(name=>main.test(name))||'Current view';
}
async function r3ReaderScan(mode,sendProgress){
  if(mode==='all')return r3CollectAllTabs(sendProgress);
  if(mode==='hp')return r3CaptureHealth(document.body);
  return r3Capture(document.body,r3CurrentTabLabel());
}
async function r3ReaderReceive(event){
  const peer=r3ReaderPeer();if(!peer||event.source!==peer||event.origin!==R3_EDITOR)return;
  const data=event.data;if(data?.protocol!==R3_PROTOCOL)return;
  if(data.type==='hello'){r3ReaderAnnounce();return;}
  if(data.type!=='scan'||typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  if(!['current','all','hp'].includes(data.mode))return;
  try{
    const snap=await r3ReaderScan(data.mode,(tab,coverage)=>{
      peer.postMessage(r3Msg('progress',{id:data.id,tab,coverage}),R3_EDITOR);
    });
    peer.postMessage(r3Msg('result',{id:data.id,snapshot:snap,session:R3_SESSION}),R3_EDITOR);
  }catch(error){
    peer.postMessage(r3Msg('failure',{id:data.id,error:r3String(error?.message||error,250)}),R3_EDITOR);
  }
}
function r3ReaderAnnounce(){
  const peer=r3ReaderPeer();if(!peer)return;
  try{peer.postMessage(r3Msg('ready',{session:R3_SESSION,name:r3NameFromDocument(document),
    mode:window.parent===window?'popout':'iframe'}),R3_EDITOR);}catch{}
}
function r3ReaderChanged(event){
  const target=event?.target;
  if(!target||!r3Shown(target))return;
  if(event.type==='click'){
    // Support native checkbox/switch roles and inventory toggles even when
    // Roll20 renders them as non-input controls. Ordinary clicks, tab
    // navigation and attack rolls must not initiate an expensive scan.
    const control=target.closest?.('button,[role="checkbox"],[role="switch"],[aria-pressed]');
    if(!control)return;
    const hint=[r3Attr(control,'aria-label'),r3Attr(control,'title'),
      r3Attr(control,'data-testid'),r3String(control.className,140)].join(' ');
    const role=r3Attr(control,'role');
    const inventory=!!target.closest?.(
      '.item-row,.inventory-item,.equipment-item,[data-testid*="inventory-row"]');
    const stepperButton=inventory&&
      (r3InventoryStepperButton(control).minus||r3InventoryStepperButton(control).plus);
    if(!/(?:increment|decrement|stepper|counter|quantity|checkbox|charge|toggle-resource)/i.test(hint)&&
      !['checkbox','switch'].includes(role)&&!stepperButton&&
      !(inventory&&(/toggle/i.test(hint)||r3Attr(control,'aria-pressed'))))return;
  }else if(!['INPUT','TEXTAREA','SELECT'].includes(String(target.tagName||'').toUpperCase())
    &&!['spinbutton','checkbox','switch'].includes(r3Attr(target,'role')))return;
  if(r3ReaderDirtyTimer!==null)clearTimeout(r3ReaderDirtyTimer);
  // Debounce inside the actual official sheet so keystrokes send one small
  // authenticated hint instead of generating a cross-window message each.
  r3ReaderDirtyTimer=setTimeout(()=>{
    r3ReaderDirtyTimer=null;
    const peer=r3ReaderPeer();
    if(!peer)return;
    try{peer.postMessage(r3Msg('dirty',{session:R3_SESSION,
      name:r3NameFromDocument(document)}),R3_EDITOR);}catch{}
  },350);
}
function r3StartReader(){
  window.addEventListener('message',r3ReaderReceive);
  for(const type of ['input','change','click'])
    document.addEventListener(type,r3ReaderChanged,true);
  r3ReaderAnnounce();
  let attempts=0;
  const timer=setInterval(()=>{if(++attempts>=24)clearInterval(timer);else r3ReaderAnnounce();},1500);
  window.addEventListener('focus',r3ReaderAnnounce);
}
function r3FrameList(){
  return Array.from(document.querySelectorAll('iframe')).slice(0,100)
    .filter(frame=>{
      try{
        const url=new URL(frame.src||frame.getAttribute('src'),location.href);
        return url.origin===R3_ORIGIN&&/\/dnd2024byroll20(?:\/|$)/.test(url.pathname);
      }catch{return false;}
    }).map((frame,i)=>{
      const name=r3String(frame.getAttribute('title')||frame.closest('.characterdialog')?.querySelector('.asv__header__name')?.textContent||'',90)
        .replace(/^Character sheet for\s+/i,'');
      return {key:'iframe-'+i,name:name||'2024 character sheet '+(i+1),frame,window:frame.contentWindow,
        visible:r3Shown(frame),type:'iframe'};
    });
}
function r3Candidates(){
  // Drop windows which were closed by the player. Don't retain dead popout
  // references or allow their stale names to block the next real sheet.
  for(const [session,candidate] of R3_POPOUTS){
    try{if(candidate.window.closed)R3_POPOUTS.delete(session);}
    catch{R3_POPOUTS.delete(session);}
  }
  return [...r3FrameList(),...R3_POPOUTS.values()];
}
function r3Listen(event){
  if(event.origin!==R3_ORIGIN||event.data?.protocol!==R3_PROTOCOL||!event.source)return;
  const data=event.data,candidate=r3Candidates().find(c=>c.window===event.source);
  if(data.type==='ready'){
    // Cross-origin official popouts announce their opener with the same
    // authenticated bridge as embedded official sheets. Roll20 often sends
    // an initial "ready" before Vue has populated the character's name.
    // Later announcements must refresh that session's identity.
    if(data.mode==='popout'&&/^[\w.:-]{6,100}$/.test(String(data.session||''))){
      const existing=R3_POPOUTS.get(data.session);
      if(existing&&existing.window!==event.source)return; // session collision
      if(!existing&&R3_POPOUTS.size>=16)return; // bounded registry
      const name=r3String(data.name,90);
      if(existing){
        // Vue can briefly unmount its name control during rerenders. Do not
        // replace a known identity with a generic loading-state title.
        if(name&&!/^(?:unnamed sheet|official sheet popout|2024 character sheet)/i.test(name))
          existing.name=name;
      }else{
        R3_POPOUTS.set(data.session,{key:'popout-'+data.session,
          name:name||'Official sheet popout',window:event.source,
          visible:true,type:'popout'});
      }
    }
    r3UIRefresh?.();
    return;
  }
  if(data.type==='dirty'){
    // Only a known official iframe or authenticated popup session may
    // request a re-read. A name match alone never authorizes an unknown
    // postMessage source or a different character.
    if(!candidate||typeof data.session!=='string'||!/^[\w.:-]{6,100}$/.test(data.session))return;
    if(candidate.type==='popout'&&candidate.key!=='popout-'+data.session)return;
    if(r3String(data.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())return;
    r3AutoQueueDirty(candidate);
    return;
  }
  const pending=R3_PENDING.get(data.id);
  if(!candidate||!pending||pending.window!==event.source)return;
  if(data.type==='progress'){
    r3UIStatus?.('Reading '+r3String(data.tab,65)+'…',data.coverage);
    return;
  }
  if(!['result','failure'].includes(data.type))return;
  clearTimeout(pending.timeout);R3_PENDING.delete(data.id);
  if(data.type==='failure')pending.reject(new Error(r3String(data.error,250)));
  else if(!data.snapshot||data.snapshot.schema!==3)pending.reject(new Error('Malformed sheet snapshot'));
  else pending.resolve(data.snapshot);
}
function r3SendScan(candidate,mode){
  if(!candidate?.window)return Promise.reject(new Error('No matching official 2024 iframe or popout'));
  if(!candidate.visible)return Promise.reject(new Error('Sheet iframe is hidden. Open the character sheet in Roll20 first.'));
  return new Promise((resolve,reject)=>{
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-'+(++r3Counter);
    const timeout=setTimeout(()=>{R3_PENDING.delete(id);reject(new Error(
      'Official sheet reader did not answer. Ensure the new userscript is active on the advanced-sheets.production.roll20preflight.net domain and reload the character sheet.'));},
      mode==='all'?40000:mode==='hp'?2500:12000);
    R3_PENDING.set(id,{resolve,reject,window:candidate.window,timeout});
    try{candidate.window.postMessage(r3Msg('scan',{id,mode}),R3_ORIGIN);}
    catch(e){R3_PENDING.delete(id);clearTimeout(timeout);reject(e);}
  });
}
function r3StartEditorBridge(){
  if(r3ListenerStarted)return;r3ListenerStarted=true;
  window.addEventListener('message',r3Listen);
}

// ===== v3/20_ui.js =====
// v3 minimal companion: explicit imports, provenance, completeness, JSON export.
const R3_UI={host:null,root:null,shown:false,busy:false,status:'Open your official Roll20 2024 character sheet, then select it below.',
  snapshot:null,selected:'',view:'summary',storageWarning:'',renderedSnapshot:null,renderedView:null,
  renderedChoices:null,scrollByView:Object.create(null),openByView:Object.create(null)};
function r3Escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function r3StorageKey(){
  return 'roll20-embetterment-v3:'+(new URLSearchParams(location.search).get('id')||location.pathname.match(/\/editor\/(\d+)/)?.[1]||'editor');
}
function r3Load(){
  try{
    const s=JSON.parse(localStorage.getItem(r3StorageKey())||'null');
    if(s?.schema===3&&s.snapshot?.schema===3&&JSON.stringify(s).length<4000000)
      R3_UI.snapshot=r3InventoryPrune(s.snapshot);
  }catch{/* Corrupted storage should never prevent scanning. */}
}
function r3Save(snapshot){
  try{
    localStorage.setItem(r3StorageKey(),JSON.stringify({schema:3,snapshot}));
    R3_UI.storageWarning='';
  }catch{
    R3_UI.storageWarning='Browser storage limit reached. Snapshot remains available until reload; export JSON now.';
  }
}
function r3ReportCounts(snapshot){
  return Object.entries(snapshot?.coverage||{}).map(([key,value])=>
    '<div class="metric"><b>'+r3Escape(value)+'</b><span>'+r3Escape(key)+'</span></div>').join('');
}
function r3InfoRow(label,value,source){
  return '<div class="kv"><span>'+r3Escape(label)+'</span><strong>'+r3Escape(value)+'</strong>'+
    (source?'<small>'+r3Escape(source.kind||'')+'</small>':'')+'</div>';
}
function r3ObjectRows(obj,lookup,prefix){
  return Object.entries(obj||{}).map(([key,value])=>
    r3InfoRow(key,typeof value==='object'?JSON.stringify(value):value,lookup?.[prefix+'.'+key])).join('')||
    '<p class="muted">No identifiable fields in the rendered sheet.</p>';
}
function r3CardsView(kind){
  const snap=R3_UI.snapshot;
  // Defend against old v3.1.5 local caches and manually seeded snapshots.
  // Explicitly zeroed items do not belong in the active Inventory list.
  const items=kind==='inventory'?(snap?.inventory||[]).filter(item=>!r3InventoryZero(item)):
    (snap?.[kind]||[]);
  if(!items.length)return '<p class="muted">No '+r3Escape(kind)+' found in the scanned, rendered sheet tabs.</p>';
  return items.slice(0,400).map(item=>
    '<details class="entry" data-entry-key="'+r3Escape(kind+':'+item.tab+':'+item.name)+'"><summary>'+r3Escape(item.name)+' <small>'+r3Escape(item.tab)+'</small></summary>'+
    '<div class="entrybody">'+r3Escape(item.visible||'')+'</div>'+
    (kind==='inventory'&&Object.prototype.hasOwnProperty.call(item,'quantity')?
      '<div class="kv"><span>Observed quantity</span><strong>'+r3Escape(item.quantity)+'</strong></div>':
      kind==='inventory'&&item.controls?.length?
        '<div class="muted">Quantity not detected from this item row; zero removal needs a readable counter.</div>':'')+
    (kind==='inventory'&&item.controls?.length?item.controls.map(control=>
      '<div class="kv"><span>'+r3Escape(control.label||control.kind)+'</span><strong>'+
      r3Escape(control.value===true?'On':control.value===false?'Off':control.value)+'</strong>'+
      '<small>'+r3Escape(control.source||'observed')+'</small></div>').join(''):'')+
    (item.checkboxes?'<div class="muted">Visible checkboxes: '+r3Escape(item.checkboxes.checked)+' of '+r3Escape(item.checkboxes.total)+' checked (sheet-specific meaning)</div>':'')+
    (item.actions?.length?'<div class="chips">'+item.actions.map(b=>'<span>'+r3Escape(b.label)+'</span>').join('')+'</div>':'')+
    '</details>').join('');
}
function r3Results(){
  const snap=R3_UI.snapshot;
  if(!snap)return '<p class="muted">No import yet. Only the official sheet reader supplies data; nothing is filled from default or token values.</p>';
  const menu=['summary','spells','attacks','inventory','features','resources','skills','fields','diagnostics'];
  const nav='<nav class="views">'+menu.map(v=>
    '<button data-view="'+v+'"'+(R3_UI.view===v?' class="selected"':'')+'>'+r3Escape(v)+'</button>').join('')+'</nav>';
  let content='';
  if(R3_UI.view==='summary'){
    content='<h3>Combat statistics</h3>'+r3ObjectRows(snap.stats,snap.provenance,'stats')+
      '<h3>Abilities</h3>'+r3ObjectRows(snap.abilities,snap.provenance,'abilities')+
      '<h3>Modifiers and saving throws</h3>'+r3ObjectRows(snap.modifiers,snap.provenance,'modifiers')+
      '<h3>Saving throws</h3>'+r3ObjectRows(snap.saves,snap.provenance,'saves')+
      '<h3>Spell slots</h3>'+r3ObjectRows(snap.slots);
  }else if(['spells','attacks','inventory','features','resources','skills'].includes(R3_UI.view)){
    content=R3_UI.view==='skills'?r3ObjectRows(snap.skills,snap.provenance,'skills'):r3CardsView(R3_UI.view);
  }else if(R3_UI.view==='fields'){
    content='<p class="muted">Raw labeled controls actually present in the rendered DOM; no guessed values.</p>'+
      (snap.observations||[]).slice(0,750).map(o=>r3InfoRow(o.label,o.value)).join('');
  }else{
    const d=snap.diagnostics;
    content='<p><b>Captured:</b> '+r3Escape(snap.capturedAt)+'</p>'+
      '<p><b>Visited tabs:</b> '+r3Escape(d.tabs.join(', ')||'none')+'</p>'+
      '<p><b>Rejected hidden/invalid:</b> '+r3Escape(d.rejected)+'</p>'+
      '<p><b>Unclassified controls:</b> '+r3Escape(d.unclassified)+'</p>'+
      '<p><b>Collection limits:</b> '+r3Escape(d.limits.join('; ')||'None reached')+'</p>'+
      '<p><b>Notes:</b> '+r3Escape(d.notes.join('; ')||'Current rendered DOM only')+'</p>';
  }
  return '<p class="stamp">Imported from: <strong>'+r3Escape(snap.name)+'</strong> · '+r3Escape(snap.capturedAt)+'</p>'+
    '<div class="metrics">'+r3ReportCounts(snap)+'</div>'+nav+'<div class="results">'+content+'</div>';
}
function r3UIStatus(message,coverage){
  R3_UI.status=message;
  const el=R3_UI.root?.getElementById('r3-status');
  if(el)el.textContent=message+(coverage?' · '+Object.entries(coverage).filter(([k])=>['spells','attacks','inventory','features','resources'].includes(k)).map(([k,v])=>k+' '+v).join(', '):'');
}
// Avoid replacing the scrollable results DOM whenever Roll20 restores window focus.
function r3RenderResults(){
  const results=R3_UI.root.getElementById('r3-results');
  if(R3_UI.renderedSnapshot===R3_UI.snapshot&&R3_UI.renderedView===R3_UI.view)return;
  const priorView=R3_UI.renderedView;
  const previous=results.querySelector?.('.results');
  if(previous&&priorView){
    R3_UI.scrollByView[priorView]=previous.scrollTop;
    R3_UI.openByView[priorView]=[...previous.querySelectorAll('details.entry[open]')]
      .map(entry=>entry.getAttribute('data-entry-key')).filter(Boolean);
  }
  const content=R3_UI.root.getElementById('r3-content');
  const outerScroll=content.scrollTop;
  results.innerHTML=r3Results();
  R3_UI.renderedSnapshot=R3_UI.snapshot;
  R3_UI.renderedView=R3_UI.view;
  const current=results.querySelector?.('.results');
  if(current){
    current.scrollTop=R3_UI.scrollByView[R3_UI.view]??0;
    const expanded=new Set(R3_UI.openByView[R3_UI.view]||[]);
    for(const entry of current.querySelectorAll('details.entry')){
      if(expanded.has(entry.getAttribute('data-entry-key')))entry.open=true;
    }
  }
  content.scrollTop=outerScroll;
}
function r3UIRefresh(){
  if(!R3_UI.root)return;
  const frames=r3Candidates();
  if(!frames.some(c=>c.key===R3_UI.selected))R3_UI.selected=frames.find(c=>c.visible)?.key||'';
  const selector=frames.map(c=>'<option value="'+r3Escape(c.key)+'"'+(c.key===R3_UI.selected?' selected':'')+'>'+
    r3Escape(c.name)+' ('+c.type+(c.visible?'':' — HIDDEN')+')</option>').join('')||
    '<option value="">No official sheet detected</option>';
  const choice=R3_UI.root.getElementById('r3-choices');
  if(R3_UI.renderedChoices!==selector){choice.innerHTML=selector;R3_UI.renderedChoices=selector;}
  if(choice.value!==R3_UI.selected)choice.value=R3_UI.selected;
  r3RenderResults();
  r3HudRender();
  R3_UI.root.getElementById('r3-wrap').style.display=R3_UI.shown?'block':'none';
  R3_UI.root.getElementById('r3-content').style.display=R3_UI.shown?'block':'none';
  // The actual toggle is r3-toggle. A stale reference to r3-title used to
  // throw here and stop every button handler before it could launch a scan.
  R3_UI.root.getElementById('r3-toggle').textContent=R3_UI.shown?'Hide importer':'Show importer';
  const scan=R3_UI.root.getElementById('r3-scan'),all=R3_UI.root.getElementById('r3-all');
  scan.disabled=R3_UI.busy||R3_AUTO.running||!R3_UI.selected;
  all.disabled=R3_UI.busy||R3_AUTO.running||!R3_UI.selected;
  R3_UI.root.getElementById('r3-export').disabled=!R3_UI.snapshot;
  r3UIStatus(R3_UI.status);
  r3AutoDisplay();
}
async function r3StartImport(mode){
  if(R3_AUTO.running){r3UIStatus('Auto-sync is reading the sheet; wait for it to finish.');return;}
  const candidate=r3Candidates().find(x=>x.key===R3_UI.selected);
  if(!candidate){r3UIStatus('Open an official Roll20 2024 sheet and refresh the list.');return;}
  R3_UI.busy=true;r3UIRefresh();r3UIStatus(mode==='all'?'Reading all available sheet tabs…':'Reading current sheet tab…');
  try{
    const snapshot=await r3SendScan(candidate,mode);
    if(!snapshot||snapshot.schema!==3)throw new Error('Unexpected sheet format');
    // Replace the previous profile only on an explicit successful import.
    // A partially rendered sheet remains explicit in its diagnostics.
    R3_UI.snapshot=r3InventoryPrune(snapshot);r3Save(R3_UI.snapshot);
    R3_UI.view='summary';
    R3_UI.status='Imported '+snapshot.name+'. Review each category and Diagnostics for coverage.';
  }catch(err){
    R3_UI.status='Import failed: '+r3String(err?.message||err,320);
  }finally{R3_UI.busy=false;r3UIRefresh();}
}
function r3Export(){
  if(!R3_UI.snapshot)return;
  const blob=new Blob([JSON.stringify(R3_UI.snapshot,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  const name=r3String(R3_UI.snapshot.name,60).replace(/[^a-z0-9-]+/gi,'-')||'character';
  anchor.href=url;anchor.download='r20eb-v3-'+name+'.json';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function r3UIEvent(event){
  const target=event.target;
  // Clicking a glyph/count inside a category button must behave like
  // clicking the button itself; no handlers are assigned to inner markup.
  const field=(key,selector)=>target?.dataset?.[key]??
    target?.closest?.(selector)?.dataset?.[key];
  const hudCategory=field('hudCategory','[data-hud-category]');
  const flyout=field('hudFlyout','[data-hud-flyout]');
  const slot=field('hudSlot','[data-hud-slot]');
  const weaponSet=field('hudSet','[data-hud-set]');
  const assignment=field('hudAssign','[data-hud-assign]');
  const spellLevel=field('hudSpellLevel','[data-hud-spell-level]');
  const spent=field('hudUsed','[data-hud-used]');
  if(target?.id==='r3-toggle'){R3_UI.shown=!R3_UI.shown;r3UIRefresh();}
  else if(target?.id==='r3-refresh')r3UIRefresh();
  else if(target?.id==='r3-scan')return r3StartImport('current');
  else if(target?.id==='r3-all')return r3StartImport('all');
  else if(target?.id==='r3-export')r3Export();
  else if(target?.id==='r3-auto'){r3ToggleAuto();r3HudRender();}
  else if(target?.id==='r3-hud-debug'){R3_UI.shown=!R3_UI.shown;r3UIRefresh();}
  else if(target?.id==='r3-hud-collapse'){
    R3_HUD.collapsed=!R3_HUD.collapsed;
    if(R3_HUD.collapsed){
      R3_HUD.flyout='';R3_HUD.chooser=null;
    }else R3_HUD.used={action:false,bonus:false,reaction:false};
    r3HudSave();r3HudRender();
  }
  else if(target?.id==='r3-hud-auto'){r3ToggleAuto();r3HudRender();}
  else if(target?.id==='r3-hud-reset-turn'){
    R3_HUD.used={action:false,bonus:false,reaction:false};r3HudRender();
  }
  else if(target?.id==='r3-hud-drawer-close'||target?.id==='r3-hud-flyout-close'){
    R3_HUD.drawerOpen=false;R3_HUD.flyout='';R3_HUD.chooser=null;
    r3HudSave();r3HudRender();
  }
  else if(slot!==undefined&&/^[0-5]$/.test(String(slot))){
    R3_HUD.chooser=Number(slot);R3_HUD.flyout='';r3HudRender();
  }
  else if(assignment!==undefined&&R3_HUD.chooser!==null){
    const chosen=assignment==='clear'?null:r3HudWeaponCandidates(R3_UI.snapshot)[Number(assignment)];
    if(assignment==='clear'||chosen){
      R3_HUD.weaponSets[R3_HUD.chooser]=chosen?{kind:chosen.kind,key:chosen.key}:null;
      R3_HUD.chooser=null;r3HudSave();r3HudRender();
    }
  }
  else if(weaponSet!==undefined&&/^[0-2]$/.test(String(weaponSet))){
    R3_HUD.weaponSet=Number(weaponSet);r3HudSave();r3HudRender();
  }
  else if(spellLevel!==undefined&&/^(?:[0-9]|other)$/.test(String(spellLevel))){
    R3_HUD.spellLevel=String(spellLevel);r3HudRender();
  }
  else if(spent&&['action','bonus','reaction'].includes(spent)){
    R3_HUD.used[spent]=!R3_HUD.used[spent];r3HudRender();
  }
  else if(flyout&&['spells','skills','actions','bonus','reactions','inventory',
    'features','resources'].includes(flyout)){
    R3_HUD.chooser=null;
    R3_HUD.flyout=R3_HUD.flyout===flyout?'':flyout;
    R3_HUD.openKeys=[];R3_HUD.scrollTop=0;r3HudRender();
  }
  else if(hudCategory&&R3_HUD_TABS.some(tab=>tab.key===hudCategory)){
    R3_HUD.category=hudCategory;R3_HUD.flyout=hudCategory;
    R3_HUD.chooser=null;R3_HUD.openKeys=[];R3_HUD.scrollTop=0;
    r3HudSave();r3HudRender();
  }
  else if(target?.dataset?.view){R3_UI.view=target.dataset.view;r3UIRefresh();}
}
function r3StartUI(){
  if(document.getElementById('r20eb-v3-root'))return;
  r3Load();r3HudLoad();
  const host=document.createElement('div');host.id='r20eb-v3-root';
  host.style.cssText='position:fixed;inset:0;z-index:2147483000;pointer-events:none';
  const root=host.attachShadow({mode:'open'});R3_UI.host=host;R3_UI.root=root;
  const style=[
    ':host{all:initial;color-scheme:dark;font:13px/1.5 system-ui,sans-serif}',
    '*{box-sizing:border-box}button,select{font:inherit}',
    '#r3-wrap{position:absolute;top:14px;right:14px;width:min(520px,calc(100vw - 28px));max-height:calc(100vh - 28px);pointer-events:auto;border:1px solid #77829c;border-radius:12px;background:#161b28;color:#eef0f7;box-shadow:0 10px 40px #000b;overflow:hidden}',
    '#r3-toggle{width:100%;background:#303d58;color:#fff;border:0;padding:11px 14px;text-align:left;font-weight:700;cursor:pointer}',
    '#r3-content{padding:12px;max-height:calc(100vh - 90px);overflow:auto}',
    'button{background:#34465f;color:#f7f8fd;border:1px solid #66748e;border-radius:6px;padding:7px 10px;cursor:pointer}',
    'button:disabled{opacity:.4;cursor:not-allowed}button:hover:not(:disabled){background:#49698c}',
    'select{background:#222e43;color:#fff;border:1px solid #65748d;border-radius:5px;min-width:0;width:100%;padding:7px}',
    '.actions{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.actions>*{flex:1}',
    '.muted,.stamp{color:#b6c3d9}.muted{font-size:12px}.stamp{font-size:11px}',
    '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:12px 0}',
    '.metric{border:1px solid #4a5871;border-radius:6px;padding:5px;text-align:center;min-width:0}.metric b{display:block;font-size:16px}.metric span{font-size:10px;overflow-wrap:anywhere}',
    '.views{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0}.views button{font-size:11px;text-transform:capitalize;padding:5px 8px}.views button.selected{background:#9c7642;color:white}',
    '.results{max-height:39vh;overflow:auto;padding:4px 0}.results h3{margin:12px 0 5px;color:#e6c28e}',
    '.kv{display:flex;gap:8px;align-items:center;border-bottom:1px solid #384357;padding:6px 2px;overflow-wrap:anywhere}.kv span{flex:1}.kv strong{color:#e6c28e}.kv small{font-size:10px;color:#93a3c0}',
    '.entry{border-bottom:1px solid #384357;padding:6px 0}.entry summary{cursor:pointer}.entry small{color:#9daecb;margin-left:6px}',
    '.entrybody{padding:9px;white-space:pre-wrap;overflow-wrap:anywhere;color:#bac7da}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips span{border:1px solid #4e617c;border-radius:8px;padding:2px 6px}',
    '#r3-status{font-size:12px;color:#f1d39d;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}',
    '.notice{font-size:11px;color:#b8c5d8;line-height:1.4}label{font-weight:650}'
  ].join('')+r3HudStyles();
  root.innerHTML='<style>'+style+'</style><div id="r3-hud"></div><div id="r3-wrap"><button id="r3-toggle">Hide importer</button>'+
    '<div id="r3-content"><label for="r3-choices">Official character sheet</label>'+
    '<select id="r3-choices"></select><div class="actions"><button id="r3-refresh">Refresh list</button>'+
    '<button id="r3-scan">Read current tab</button><button id="r3-all">Import all tabs</button>'+
    '<button id="r3-export" disabled>Export JSON</button></div>'+
    '<div class="actions"><button id="r3-auto" title="Automatically import the selected character. When available, Roll20 journal entry is opened offscreen.">Auto-sync: Off</button></div>'+
    '<div id="r3-auto-status" class="notice" role="status" aria-live="polite">Auto-sync is off</div>'+
    '<div class="notice">New independent v3 importer · no old HUD/profile code · read-only for character data. '+
    'Auto-sync is optional and remembered per game. It uses the official Roll20 journal to open the chosen character in the background when available; if not, open the Journal sidebar once or use a visible sheet. Full background import visits tabs and restores the original selection. Visible player-opened sheets are read without switching tabs.</div>'+
    '<div id="r3-status" role="status" aria-live="polite"></div>'+
    '<div id="r3-results"></div></div></div>';
  // Surface handler errors in the panel instead of leaving apparently inert buttons.
  root.addEventListener('click',event=>{
    try{
      const action=r3UIEvent(event);
      if(action&&typeof action.catch==='function')action.catch(err=>r3UIStatus('Action failed: '+r3String(err?.message||err,250)));
    }catch(err){
      r3UIStatus('Action failed: '+r3String(err?.message||err,250));
      console.error('[roll20 Embetterment] Importer control',err);
    }
  });
  root.getElementById('r3-choices').addEventListener('change',event=>{R3_UI.selected=event.target.value;r3UIRefresh();});
  root.addEventListener('keydown',event=>{event.stopPropagation();},true);
  root.addEventListener('keyup',event=>event.stopPropagation(),true);
  root.addEventListener('keypress',event=>event.stopPropagation(),true);
  document.body.appendChild(host);
  r3UIRefresh();
  // Wiki-compatible Shift+A toggle, scoped away from text entry and common
  // modified shortcuts. Keeping this in the editor avoids touching Roll20's
  // official sheet keyboard behavior.
  window.addEventListener('keydown',event=>{
    if(event.key?.toLowerCase()!=='a'||!event.shiftKey||event.ctrlKey||
      event.altKey||event.metaKey||event.repeat)return;
    const target=event.target;
    if(target?.isContentEditable||/^(?:input|textarea|select)$/i.test(target?.tagName||''))return;
    event.preventDefault?.();event.stopPropagation?.();
    R3_HUD.collapsed=!R3_HUD.collapsed;
    if(R3_HUD.collapsed){R3_HUD.flyout='';R3_HUD.chooser=null;}
    else R3_HUD.used={action:false,bonus:false,reaction:false};
    r3HudSave();r3HudRender();
  },true);
  window.addEventListener('focus',()=>{if(!R3_UI.busy)r3UIRefresh();});
}

// ===== v3/22_hud.js =====
// Roll20 Embetterment HUD v1: read-only combat presentation of v3 sheet data.
// This module never dispatches native Roll20 rolls, casts or sheet mutations.
const R3_HUD={category:'actions',collapsed:false,drawerOpen:false,flyout:'',spellLevel:'',weaponSet:0,weaponSets:[null,null,null,null,null,null],chooser:null,used:{action:false,bonus:false,reaction:false},renderedSnapshot:null,
  renderedCategory:null,renderedCollapsed:null,renderedDrawer:null,renderedFlyout:null,renderedSpellLevel:null,renderedWeaponSet:null,renderedLoadouts:null,renderedChooser:null,renderedUsed:null,renderedDebug:null,openKeys:[],scrollTop:0};
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
    r3HudBarButton(bonusItem?.name||r3HudEntries(snapshot,'bonus')[0]?.name||'OFF HAND','blade','bonus','hud-color-bonus'),
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
    '<button type="button" id="r3-hud-auto">'+(R3_AUTO.enabled?'● Sync On':'○ Sync Off')+'</button>'+
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
    R3_HUD.renderedSpellLevel===R3_HUD.spellLevel&&
    R3_HUD.renderedLoadouts===JSON.stringify(R3_HUD.weaponSets)&&
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
  R3_HUD.renderedSpellLevel=R3_HUD.spellLevel;
  R3_HUD.renderedLoadouts=JSON.stringify(R3_HUD.weaponSets);
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
  ].join('');
}

// ===== v3/25_auto.js =====
// Opt-in background importer for a character the player can already open.
// Never fetch privileged data, synthesize character records, or scan other sheets.
const R3_AUTO={
  enabled:false,name:'',characterId:'',running:false,active:false,opened:false,openedAt:0,
  lastScan:0,lastFull:0,lastOpenAttempt:0,lastError:'',timer:null,healthTimer:null,
  healthRunning:false,lastHealth:0,generation:0,preOpenDialogs:null,dirtyTimer:null,
  ownedDialog:null,originalPosition:null
};
function r3AutoKey(){return r3StorageKey()+':auto';}
function r3AutoLoad(){
  try{
    const stored=JSON.parse(localStorage.getItem(r3AutoKey())||'null');
    if(stored?.enabled&&typeof stored.name==='string'&&stored.name.length<120){
      R3_AUTO.enabled=true;R3_AUTO.name=stored.name;
      R3_AUTO.characterId=r3String(stored.characterId,100);
    }
  }catch{}
}
function r3AutoSave(){
  try{localStorage.setItem(r3AutoKey(),JSON.stringify({
    enabled:R3_AUTO.enabled,name:R3_AUTO.name,characterId:R3_AUTO.characterId
  }));}catch{}
}
function r3AutoDisplay(message){
  // Routine UI refreshes must not erase a useful "journal not loaded" status.
  if(message!==undefined)R3_AUTO.lastError=message||'';
  const status=R3_UI.root?.getElementById('r3-auto-status');
  if(status)status.textContent=R3_AUTO.enabled?
    ('Auto-sync: '+(R3_AUTO.lastError||'watching for your character sheet')):'Auto-sync is off';
  const toggle=R3_UI.root?.getElementById('r3-auto');
  if(toggle)toggle.textContent=R3_AUTO.enabled?'Auto-sync: On':'Auto-sync: Off';
}
function r3AutoDialogFor(candidate){
  return candidate?.frame?.closest?.('.characterdialog[data-characterid],.characterdialog')||null;
}
function r3AutoId(candidate){
  return r3String(candidate?.characterId||r3AutoDialogFor(candidate)?.getAttribute?.('data-characterid'),100);
}
function r3AutoCandidate(){
  // A player-popped-out official sheet is a valid authenticated reader.
  // It has no parent dialog with a character ID, so require a unique exact
  // name. Prefer the popout when the same sheet also has an embedded frame.
  const choices=r3Candidates().filter(c=>c.visible&&c.window&&
    (c.type==='iframe'||c.type==='popout'));
  // Never allow an explicit, conflicting character ID to be rescued by a
  // coincidental display-name match.
  const eligible=choices.filter(c=>!R3_AUTO.characterId||!r3AutoId(c)||
    r3AutoId(c)===R3_AUTO.characterId);
  const named=eligible.filter(c=>r3String(c.name,120).toLowerCase()===
    R3_AUTO.name.toLowerCase());
  const popouts=named.filter(c=>c.type==='popout');
  if(popouts.length===1)return popouts[0];
  if(popouts.length>1)return null; // same-named popouts are ambiguous
  if(R3_AUTO.characterId){
    const exact=eligible.filter(c=>c.type==='iframe'&&r3AutoId(c)===R3_AUTO.characterId);
    if(exact.length===1)return exact[0];
    if(exact.length>1)return null;
  }
  return named.length===1?named[0]:null;
}
function r3AutoRemember(candidate){
  const charId=r3AutoId(candidate);
  if(charId&&!R3_AUTO.characterId){
    R3_AUTO.characterId=charId;r3AutoSave();
  }
}
function r3AutoJournalEntry(){
  // Only journal entries, never chat messages, roll cards or dialog buttons.
  const found=Array.from(document.querySelectorAll(
    '#journal [data-characterid],#journal [data-itemid],#journal .character,'+
    '#journal [data-id],.journalitem[data-characterid],.journalitem[data-itemid]'
  )||[]).slice(0,500);
  const id=R3_AUTO.characterId,name=R3_AUTO.name.toLowerCase();
  if(id){
    const exact=found.find(el=>[el.getAttribute?.('data-characterid'),
      el.getAttribute?.('data-itemid'),el.getAttribute?.('data-id')]
      .some(v=>v===id));
    if(exact)return exact;
  }
  const matches=found.filter(el=>{
    const title=r3String(el.getAttribute?.('title')||
      el.getAttribute?.('aria-label')||el.querySelector?.('.name,.journalitem-name')?.textContent||
      el.textContent,120).toLowerCase();
    return title===name;
  });
  return matches.length===1?matches[0]:null;
}
function r3AutoOpenFromJournal(now){
  if(R3_AUTO.opened&&now-R3_AUTO.openedAt<30000)return false;
  if(R3_AUTO.opened){
    R3_AUTO.opened=false;
    r3AutoDisplay('Roll20 did not expose the requested sheet; open its Journal entry manually if needed.');
  }
  if(now-R3_AUTO.lastOpenAttempt<60000)return false;
  R3_AUTO.lastOpenAttempt=now;
  const entry=r3AutoJournalEntry();
  if(!entry){
    r3AutoDisplay('Waiting for a matching journal entry. If Roll20 has not loaded the Journal, open its sidebar tab once.');
    return false;
  }
  // Roll20's normal double-click is the only supported open action here.
  // Do not clone the generic headless iframe: its URL has no character ID,
  // and cloning it cannot supply Roll20's official character handshake.
  try{
    // Only a dialog CREATED by this request may be moved offscreen.
    R3_AUTO.preOpenDialogs=new Set(document.querySelectorAll('.characterdialog')||[]);
    entry.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
    R3_AUTO.opened=true;R3_AUTO.openedAt=Date.now();
    r3AutoDisplay('Requested character sheet from the Roll20 journal; waiting for it to load');
    return true;
  }catch(e){
    r3AutoDisplay('Journal entry could not be opened automatically: '+r3String(e?.message||e,130));
    return false;
  }
}
function r3AutoMoveOffscreen(candidate){
  const dialog=r3AutoDialogFor(candidate);
  if(!dialog)return false;
  // The 30s check only applies to claiming a newly opened dialog.
  // A dialog already owned by auto-sync remains a background reader for
  // later five-minute full scans until the feature is turned off.
  if(R3_AUTO.ownedDialog===dialog)return true;
  if(R3_AUTO.preOpenDialogs?.has(dialog))return false;
  if(!R3_AUTO.opened||Date.now()-R3_AUTO.openedAt>30000){
    R3_AUTO.opened=false;return false;
  }
  // Preserve layout/rendering rather than display:none (which would prevent
  // Vue controls from mounting and being imported). Only move a dialog the
  // script itself asked the journal to open, never a player-opened dialog.
  R3_AUTO.ownedDialog=dialog;
  R3_AUTO.originalPosition={left:dialog.style.left,top:dialog.style.top,
    position:dialog.style.position};
  dialog.style.position='fixed';
  dialog.style.left='-20000px';
  dialog.style.top='-20000px';
  return true;
}
function r3AutoRestoreDialog(){
  if(R3_AUTO.ownedDialog?.style&&R3_AUTO.originalPosition){
    const d=R3_AUTO.ownedDialog.style,p=R3_AUTO.originalPosition;
    d.left=p.left;d.top=p.top;d.position=p.position;
  }
  R3_AUTO.ownedDialog=null;R3_AUTO.originalPosition=null;
  R3_AUTO.opened=false;R3_AUTO.openedAt=0;R3_AUTO.preOpenDialogs=null;
}
function r3AutoSignature(s){
  return JSON.stringify([s.name,s.stats,s.abilities,s.modifiers,s.saves,s.skills,s.slots,
    s.spells,s.attacks,s.inventory,s.features,s.resources]);
}
function r3AutoCombine(prev,current){
  if(!prev||r3String(prev.name).toLowerCase()!==r3String(current.name).toLowerCase())
    return r3InventoryPrune(current);
  // Current-view scans refresh only fields they genuinely observed; don't
  // erase saved inventory/spells/features because their tabs were not visited.
  const merged={...prev,capturedAt:current.capturedAt,stats:{...prev.stats,...current.stats},
    abilities:{...prev.abilities,...current.abilities},modifiers:{...prev.modifiers,...current.modifiers},
    saves:{...prev.saves,...current.saves},skills:{...prev.skills,...current.skills},
    slots:{...prev.slots,...current.slots},provenance:{...prev.provenance,...current.provenance}};
  // Spell slot rows expose current/remaining/max separately. A partial
  // current-tab refresh often sees only one property; preserve the others.
  for(const [level,values] of Object.entries(current.slots||{})){
    if(values&&typeof values==='object'&&!Array.isArray(values))
      merged.slots[level]={...(prev.slots?.[level]||{}),...values};
  }
  for(const kind of ['resources','attacks','spells','inventory','features']){
    const indexed=new Map((prev[kind]||[]).map(item=>[item._key||item.name,item]));
    for(const entry of current[kind]||[]){
      const key=entry._key||entry.name;
      // A positively observed quantity of zero removes an item from the
      // saved inventory. Missing/off-tab/virtualized rows never do.
      if(kind==='inventory'&&r3InventoryZero(entry))indexed.delete(key);
      else indexed.set(key,entry);
    }
    merged[kind]=[...indexed.values()];
  }
  // Keep bounded observations from the last full import, not every poll.
  return r3Coverage(merged);
}
function r3AutoHasRecognizedData(snapshot){
  // HP/AC and other stats are not necessarily mounted outside Combat.
  // A named Inventory/Features/Spells/Skills tab is still a useful scan.
  // Treat an entirely empty/malformed result as not yet populated so it
  // cannot replace a previously successful full import.
  return ['stats','abilities','modifiers','saves','skills','slots'].some(kind=>
    snapshot[kind]&&typeof snapshot[kind]==='object'&&
    !Array.isArray(snapshot[kind])&&Object.keys(snapshot[kind]).length>0)||
    ['spells','attacks','inventory','features','resources'].some(kind=>
      Array.isArray(snapshot[kind])&&snapshot[kind].length>0);
}
function r3AutoStoreSnapshot(snapshot,mode){
  const candidateName=r3String(snapshot?.name,120);
  if(snapshot?.schema!==3||candidateName.toLowerCase()!==R3_AUTO.name.toLowerCase())
    throw new Error('Sheet identity did not match the auto-sync character');
  if(!r3AutoHasRecognizedData(snapshot))
    throw new Error('Sheet has not populated recognizable character values yet');
  // A partial scan cannot erase the full inventory, spells and actions.
  const next=mode==='all'?r3InventoryPrune(snapshot):r3AutoCombine(R3_UI.snapshot,snapshot);
  if(r3AutoSignature(R3_UI.snapshot||{})!==r3AutoSignature(next)){
    R3_UI.snapshot=r3Coverage(next);r3Save(R3_UI.snapshot);
    r3UIRefresh();
  }
}
function r3AutoQueueDirty(candidate){
  if(!R3_AUTO.enabled||R3_UI.busy||!R3_AUTO.name)return;
  const current=r3AutoCandidate();
  if(!current||current.window!==candidate?.window)return;
  if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
  const generation=R3_AUTO.generation;
  // Normal edits start a scan after ~400ms. Limit full current-tab reads
  // to once every 2 seconds during rapid typing/slider movement.
  const ms=Math.max(400,2100-(Date.now()-R3_AUTO.lastScan));
  R3_AUTO.dirtyTimer=setTimeout(()=>{
    R3_AUTO.dirtyTimer=null;
    if(!R3_AUTO.enabled||R3_AUTO.generation!==generation||R3_UI.busy)return;
    if(r3AutoCandidate()?.window!==candidate.window)return;
    r3AutoTick(true);
  },ms);
}
async function r3AutoTick(eventTriggered=false){
  if(!R3_AUTO.enabled||R3_AUTO.running||R3_UI.busy||!R3_AUTO.name)return;
  const now=Date.now();
  const candidate=r3AutoCandidate();
  if(!candidate){
    r3AutoOpenFromJournal(now);
    return;
  }
  r3AutoRemember(candidate);
  const background=r3AutoMoveOffscreen(candidate);
  // Only navigate sheet tabs when the script itself opened an offscreen
  // dialog. A player-opened visible sheet is read without changing tabs.
  const mode=background&&now-R3_AUTO.lastFull>300000?'all':'current';
  // Event-triggered current-view checks bypass the periodic 12-second gate,
  // but retain a 2-second minimum between heavier DOM reads. Full-tab
  // traversal remains limited to the established background scheduler.
  if(now-R3_AUTO.lastScan<(mode==='all'?10000:eventTriggered?2000:12000))return;
  R3_AUTO.running=true;
  const generation=R3_AUTO.generation;
  r3UIRefresh();
  try{
    const snapshot=await r3SendScan(candidate,mode);
    // A disabled auto-sync must never publish a late response.
    if(!R3_AUTO.enabled||R3_AUTO.generation!==generation)return;
    r3AutoStoreSnapshot(snapshot,mode);
    R3_AUTO.lastScan=Date.now();
    if(mode==='all')R3_AUTO.lastFull=R3_AUTO.lastScan;
    r3AutoDisplay((candidate.type==='popout'?'Popout sheet':background?'Background':'Visible sheet')+' '+mode+
      ' import updated '+new Date(R3_AUTO.lastScan).toLocaleTimeString());
  }catch(e){
    R3_AUTO.lastScan=Date.now();
    if(R3_AUTO.enabled)r3AutoDisplay('Waiting: '+r3String(e?.message||e,170));
  }finally{R3_AUTO.running=false;r3UIRefresh();}
}

function r3AutoStoreHealth(snapshot){
  if(snapshot?.schema!==3||r3String(snapshot.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())
    return false;
  if(!Object.prototype.hasOwnProperty.call(snapshot.stats||{},'hp'))return false;
  const prior=R3_UI.snapshot;
  if(!prior||r3String(prior.name,120).toLowerCase()!==R3_AUTO.name.toLowerCase())return false;
  const keys=['hp','maxHp','tempHp'],nextStats={...prior.stats},nextSources={...prior.provenance};
  let changed=false;
  for(const key of keys){
    if(!Object.prototype.hasOwnProperty.call(snapshot.stats,key))continue;
    if(nextStats[key]!==snapshot.stats[key]){
      nextStats[key]=snapshot.stats[key];changed=true;
      nextSources['stats.'+key]=snapshot.provenance?.['stats.'+key];
    }
  }
  if(!changed)return false;
  R3_UI.snapshot=r3Coverage({...prior,stats:nextStats,provenance:nextSources,
    capturedAt:snapshot.capturedAt});
  r3Save(R3_UI.snapshot);r3UIRefresh();
  r3AutoDisplay('HP '+nextStats.hp+(nextStats.maxHp!==undefined?'/'+nextStats.maxHp:'')+
    ' updated '+new Date().toLocaleTimeString());
  return true;
}
async function r3AutoHealthTick(){
  if(!R3_AUTO.enabled||!R3_AUTO.name||R3_AUTO.healthRunning||R3_AUTO.running||R3_UI.busy)return;
  const candidate=r3AutoCandidate();
  if(!candidate)return;
  const generation=R3_AUTO.generation;
  R3_AUTO.healthRunning=true;
  try{
    const snapshot=await r3SendScan(candidate,'hp');
    if(R3_AUTO.enabled&&!R3_AUTO.running&&!R3_UI.busy&&R3_AUTO.generation===generation)
      r3AutoStoreHealth(snapshot);
  }catch{
    // A missing/unmounted HP input or unavailable official iframe/popout
    // is not a fabricated zero. The slower importer reports its status.
  }finally{
    R3_AUTO.lastHealth=Date.now();R3_AUTO.healthRunning=false;
  }
}

function r3ToggleAuto(){
  if(R3_AUTO.enabled){
    R3_AUTO.enabled=false;R3_AUTO.generation++;
    if(R3_AUTO.dirtyTimer!==null)clearTimeout(R3_AUTO.dirtyTimer);
    R3_AUTO.dirtyTimer=null;
    r3AutoSave();r3AutoRestoreDialog();
    r3AutoDisplay('');return;
  }
  const selected=r3Candidates().find(c=>c.key===R3_UI.selected);
  const name=r3String(R3_UI.snapshot?.name||selected?.name,120);
  if(!name||/^(?:2024 character sheet|unnamed sheet)/i.test(name)){
    r3UIStatus('Import a named character once before enabling auto-sync.');
    r3AutoDisplay();
    return;
  }
  R3_AUTO.enabled=true;R3_AUTO.generation++;R3_AUTO.name=name;
  if(selected&&selected.name.toLowerCase()===name.toLowerCase())r3AutoRemember(selected);
  r3AutoSave();r3AutoDisplay('Enabled for '+name+'; checking Roll20 session');
  r3AutoTick();
}
function r3StartAuto(){
  r3AutoLoad();
  r3AutoDisplay();
  if(R3_AUTO.timer===null)R3_AUTO.timer=setInterval(()=>{r3AutoTick();},8000);
  if(R3_AUTO.healthTimer===null)R3_AUTO.healthTimer=setInterval(()=>{r3AutoHealthTick();},1000);
  if(R3_AUTO.enabled)setTimeout(()=>{r3AutoTick();},1600);
}

// ===== v3/30_boot.js =====
// Production v3 entry point. v2 source is deliberately not bundled.
function r3Boot(){
  if(r3SheetContext()){r3StartReader();return;}
  if(r3EditorContext()){r3StartEditorBridge();r3StartUI();r3StartAuto();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r3Boot,{once:true});
else r3Boot();
})();