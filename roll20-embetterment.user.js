// ==UserScript==
// @name         roll20 Embetterment
// @namespace    https://github.com/newnetmp3/roll20embetterment
// @version      3.0.0
// @description  Independent read-only D&D 2024 sheet importer with comprehensive capture and diagnostics.
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
      else if(field.kind==='stat'&&field.key==='maxHp'){
        s.stats.maxHp=n;s.provenance['stats.maxHp']={kind:'input',tab,label};
      }else r3Push(s,field.kind,field.key,n,{kind:'input',tab,label});
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
    if(kind==='skills')continue; // skill bonuses are keyed values, not named cards
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

// ===== v3/10_reader.js =====
// v3 authenticated cross-origin reader and explicit, bounded tab traversal.
const R3_PENDING=new Map();
const R3_POPOUTS=new Map();
const R3_SESSION=(crypto.randomUUID?.()||('session-'+Date.now()+'-'+Math.random())).slice(0,100);
let r3Counter=0,r3ListenerStarted=false;
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
async function r3CollectAllTabs(progress){
  const original=r3Tabs().filter(r3Active);
  const acc=r3Empty();
  const seen=new Set();let visited=0;
  const collect=label=>{
    const snap=r3Capture(document.body,label);r3Merge(acc,snap);visited++;
    progress?.(label,r3Coverage(acc));
  };
  const visit=async tab=>{
    if(!tab||!tab.isConnected||!r3Shown(tab)||visited>=32)return;
    const label=r3TabLabel(tab);if(!label)return;
    const identity=label+'|'+(tab.closest?.('[role="tablist"]')?.getAttribute?.('aria-label')||'');
    if(seen.has(identity))return;
    seen.add(identity);
    if(!r3Active(tab)){tab.click();await r3Pause(210);}
    collect(label);
  };
  try{
    collect('Current view');
    const top=r3Tabs().slice(0,14);
    for(const tab of top){
      if(visited>=32)break;
      await visit(tab);
      if(/^(spells|inventory|combat|features\s*(?:&|and)\s*traits|skills\s*&\s*tools)$/i.test(r3TabLabel(tab))){
        const second=r3Tabs().filter(x=>!top.includes(x)).slice(0,20);
        const prior=second.filter(r3Active);
        try{for(const child of second){if(visited>=32)break;await visit(child);}}
        finally{for(const child of prior)if(child?.isConnected&&!r3Active(child)){child.click();await r3Pause(100);}}
      }
    }
  }finally{
    for(const tab of original)if(tab?.isConnected&&!r3Active(tab)){tab.click();await r3Pause(130);}
  }
  if(visited>=32)acc.diagnostics.limits.push('32 tab views maximum');
  acc.diagnostics.notes.push('Only rendered DOM was read. Virtualized/offscreen rows are not guaranteed complete.');
  return r3Coverage(acc);
}
async function r3ReaderScan(mode,sendProgress){
  if(mode==='all')return r3CollectAllTabs(sendProgress);
  return r3Capture(document.body,'Current view');
}
async function r3ReaderReceive(event){
  const peer=r3ReaderPeer();if(!peer||event.source!==peer||event.origin!==R3_EDITOR)return;
  const data=event.data;if(data?.protocol!==R3_PROTOCOL)return;
  if(data.type==='hello'){r3ReaderAnnounce();return;}
  if(data.type!=='scan'||typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  if(!['current','all'].includes(data.mode))return;
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
function r3StartReader(){
  window.addEventListener('message',r3ReaderReceive);
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
  const frames=r3FrameList(),other=[...R3_POPOUTS.values()].filter(x=>!x.window.closed);
  return [...frames,...other];
}
function r3Listen(event){
  if(event.origin!==R3_ORIGIN||event.data?.protocol!==R3_PROTOCOL||!event.source)return;
  const data=event.data,candidate=r3Candidates().find(c=>c.window===event.source);
  if(data.type==='ready'){
    // Popouts can announce from their authenticated origin and only when
    // their opener is the Roll20 editor. Never accept arbitrary origins.
    if(!candidate&&data.mode==='popout'&&/^[\w.:-]{6,100}$/.test(String(data.session||''))){
      R3_POPOUTS.set(data.session,{key:'popout-'+data.session,
        name:r3String(data.name||'Official sheet popout',90),
        window:event.source,visible:true,type:'popout'});
    }
    r3UIRefresh?.();
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
      mode==='all'?40000:12000);
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
const R3_UI={host:null,root:null,shown:true,busy:false,status:'Open your official Roll20 2024 character sheet, then select it below.',
  snapshot:null,selected:'',view:'summary',storageWarning:''};
function r3Escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function r3StorageKey(){
  return 'roll20-embetterment-v3:'+(new URLSearchParams(location.search).get('id')||location.pathname.match(/\/editor\/(\d+)/)?.[1]||'editor');
}
function r3Load(){
  try{
    const s=JSON.parse(localStorage.getItem(r3StorageKey())||'null');
    if(s?.schema===3&&s.snapshot?.schema===3&&JSON.stringify(s).length<4000000)R3_UI.snapshot=s.snapshot;
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
  if(!snap?.[kind]?.length)return '<p class="muted">No '+r3Escape(kind)+' found in the scanned, rendered sheet tabs.</p>';
  return snap[kind].slice(0,400).map(item=>
    '<details class="entry"><summary>'+r3Escape(item.name)+' <small>'+r3Escape(item.tab)+'</small></summary>'+
    '<div class="entrybody">'+r3Escape(item.visible||'')+'</div>'+
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
  if(el)el.textContent=message+(coverage?' · '+Object.entries(coverage).filter(([k])=>['spells','attacks','inventory','features'].includes(k)).map(([k,v])=>k+' '+v).join(', '):'');
}
function r3UIRefresh(){
  if(!R3_UI.root)return;
  const frames=r3Candidates();
  const selector=frames.map(c=>'<option value="'+r3Escape(c.key)+'"'+(c.key===R3_UI.selected?' selected':'')+'>'+
    r3Escape(c.name)+' ('+c.type+(c.visible?'':' — HIDDEN')+')</option>').join('');
  R3_UI.root.getElementById('r3-choices').innerHTML=selector||'<option value="">No official sheet detected</option>';
  if(!frames.some(c=>c.key===R3_UI.selected))R3_UI.selected=frames.find(c=>c.visible)?.key||'';
  R3_UI.root.getElementById('r3-choices').value=R3_UI.selected;
  R3_UI.root.getElementById('r3-results').innerHTML=r3Results();
  R3_UI.root.getElementById('r3-content').style.display=R3_UI.shown?'block':'none';
  R3_UI.root.getElementById('r3-title').textContent=R3_UI.shown?'Hide importer':'Show importer';
  const scan=R3_UI.root.getElementById('r3-scan'),all=R3_UI.root.getElementById('r3-all');
  scan.disabled=R3_UI.busy||!R3_UI.selected;all.disabled=R3_UI.busy||!R3_UI.selected;
  R3_UI.root.getElementById('r3-export').disabled=!R3_UI.snapshot;
  r3UIStatus(R3_UI.status);
}
async function r3StartImport(mode){
  const candidate=r3Candidates().find(x=>x.key===R3_UI.selected);
  if(!candidate){r3UIStatus('Open an official Roll20 2024 sheet and refresh the list.');return;}
  R3_UI.busy=true;r3UIRefresh();r3UIStatus(mode==='all'?'Reading all available sheet tabs…':'Reading current sheet tab…');
  try{
    const snapshot=await r3SendScan(candidate,mode);
    if(!snapshot||snapshot.schema!==3)throw new Error('Unexpected sheet format');
    // Replace the previous profile only on an explicit successful import.
    // A partially rendered sheet remains explicit in its diagnostics.
    R3_UI.snapshot=r3Coverage(snapshot);r3Save(R3_UI.snapshot);
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
  if(target?.id==='r3-toggle'){R3_UI.shown=!R3_UI.shown;r3UIRefresh();}
  else if(target?.id==='r3-refresh')r3UIRefresh();
  else if(target?.id==='r3-scan')r3StartImport('current');
  else if(target?.id==='r3-all')r3StartImport('all');
  else if(target?.id==='r3-export')r3Export();
  else if(target?.dataset?.view){R3_UI.view=target.dataset.view;r3UIRefresh();}
}
function r3StartUI(){
  if(document.getElementById('r20eb-v3-root'))return;
  r3Load();
  const host=document.createElement('div');host.id='r20eb-v3-root';
  host.style.cssText='position:fixed;bottom:16px;right:16px;z-index:2147483000;pointer-events:auto';
  const root=host.attachShadow({mode:'open'});R3_UI.host=host;R3_UI.root=root;
  const style=[
    ':host{all:initial;color-scheme:dark;font:13px/1.5 system-ui,sans-serif}',
    '*{box-sizing:border-box}button,select{font:inherit}',
    '#r3-wrap{width:min(520px,calc(100vw - 28px));max-height:calc(100vh - 40px);border:1px solid #77829c;border-radius:12px;background:#161b28;color:#eef0f7;box-shadow:0 10px 40px #000b;overflow:hidden}',
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
  ].join('');
  root.innerHTML='<style>'+style+'</style><div id="r3-wrap"><button id="r3-toggle">Hide importer</button>'+
    '<div id="r3-content"><label for="r3-choices">Official character sheet</label>'+
    '<select id="r3-choices"></select><div class="actions"><button id="r3-refresh">Refresh list</button>'+
    '<button id="r3-scan">Read current tab</button><button id="r3-all">Import all tabs</button>'+
    '<button id="r3-export" disabled>Export JSON</button></div>'+
    '<div class="notice">New independent v3 importer · no old HUD/profile code · read-only for character data. '+
    'Only player-opened 2024 sheets are scanned. Full import visits tabs you can see, then restores the original tab.</div>'+
    '<div id="r3-status" role="status" aria-live="polite"></div>'+
    '<div id="r3-results"></div></div></div>';
  root.addEventListener('click',r3UIEvent);
  root.getElementById('r3-choices').addEventListener('change',event=>{R3_UI.selected=event.target.value;r3UIRefresh();});
  root.addEventListener('keydown',event=>{event.stopPropagation();},true);
  root.addEventListener('keyup',event=>event.stopPropagation(),true);
  root.addEventListener('keypress',event=>event.stopPropagation(),true);
  document.body.appendChild(host);
  r3UIRefresh();
  window.addEventListener('focus',()=>{if(!R3_UI.busy)r3UIRefresh();});
}

// ===== v3/30_boot.js =====
// Production v3 entry point. v2 source is deliberately not bundled.
function r3Boot(){
  if(r3SheetContext()){r3StartReader();return;}
  if(r3EditorContext()){r3StartEditorBridge();r3StartUI();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r3Boot,{once:true});
else r3Boot();
})();