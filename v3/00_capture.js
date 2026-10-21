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
    slots:{},spells:[],attacks:[],inventory:[],features:[],resources:[],misc:[],observations:[],
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
// Preserve only an explicit row identifier on the card itself. Rendered
// labels, child element IDs, ordinals and data-testid strings are NOT stable
// repeating-action identifiers and are never promoted to a macro ID.
function r3NativeObservedRowId(card){
  const names=['data-repeating-row-id','data-repeating-id','data-row-id'];
  const ids=names.map(name=>r3Attr(card,name)).filter(Boolean);
  if(ids.length!==1||!/^[A-Za-z0-9_-]{4,120}$/.test(ids[0]))return '';
  return ids[0];
}
// A directly callable reference is recognized only if the official rendered
// card or its own visible button publishes an *entire* Roll20 macro. Captions,
// data-testid strings and arbitrary UI click handlers are not executable IDs.
function r3NativeObservedActionRef(card){
  const own=['data-roll20-macro','data-native-macro'].map(key=>r3Attr(card,key));
  const buttons=Array.from(card.querySelectorAll?.('button[data-roll20-macro],button[data-native-macro]')||[])
    .slice(0,18).filter(r3Shown);
  const refs=[...own,...buttons.flatMap(button=>['data-roll20-macro','data-native-macro']
    .map(key=>r3Attr(button,key)))].filter(Boolean);
  if(refs.length===0||new Set(refs).size!==1)return '';
  const value=refs[0];
  return /^%\\{[A-Za-z0-9_-]{4,120}\\|[^{}\\r\\n]{1,100}\\}$/.test(value)?value:'';
}
function r3CardInfo(card,kind,name,tab){
  const info={name,tab,visible:r3Text(card,1100)};
  const nativeRowId=r3NativeObservedRowId(card);
  if(nativeRowId)info.nativeRowId=nativeRowId;
  const nativeActionRef=r3NativeObservedActionRef(card);
  if(nativeActionRef)info.nativeActionRef=nativeActionRef;
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
  const key=info.nativeRowId?'row:'+info.nativeRowId:
    name.toLowerCase()+'|'+(kind==='spells'?info.level||'':'')+'|'+(kind==='attacks'?info.visible.slice(0,60):'');
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
// Capture otherwise unclassified *explicitly identified* native controls.
// A button without an official macro remains only an observation; it cannot
// become a synthetic Roll20 action just because it has a visible label.
function r3MiscNativeActions(root,s,tab){
  const candidates=Array.from(root.querySelectorAll?.(
    'button[data-roll20-macro],button[data-native-macro]')||[]).slice(0,300);
  const classified=Object.values(R3_CATEGORIES).join(',');
  for(const button of candidates){
    if(s.misc.length>=100)break;
    if(!r3Shown(button)||button.closest?.(classified))continue;
    const ref=r3NativeObservedActionRef(button);
    const name=r3String(r3Attr(button,'aria-label')||r3Attr(button,'title')||
      r3Text(button,100),125);
    if(!ref||!name||/^(more|close|cancel|next|previous|settings|menu)$/i.test(name))continue;
    const key='native:'+ref;
    if(!s.misc.some(item=>item._key===key))
      s.misc.push({name,_key:key,tab,visible:name,nativeActionRef:ref});
  }
}
function r3Capture(root,tab='Current view'){
  const s=r3Empty();s.name=r3NameFromDocument(root);
  if(!root?.querySelectorAll){s.diagnostics.notes.push('No readable official sheet DOM');return s;}
  r3Inputs(root,s,tab);r3VisibleStats(root,s,tab);r3Cards(root,s,tab);
  r3MiscNativeActions(root,s,tab);
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
    features:s.features.length,resources:s.resources.length,misc:(s.misc||[]).length,observations:s.observations.length};
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
  target.misc=Array.isArray(target.misc)?target.misc:[];
  for(const item of source.misc||[]){
    if(target.misc.length>=100)break;
    if(!target.misc.some(old=>old._key===item._key))target.misc.push(item);
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
