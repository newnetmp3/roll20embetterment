// 2024/Beacon sheet adapter: inspect only text currently rendered to the player.
// Uses no Roll20 internal APIs, no hidden state and no network requests.
function beaconVisibleText(scope) {
  const el=scope?.nodeType===9?scope.body:scope;
  return typeof el?.innerText==='string' ? el.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ').slice(0,45000) : '';
}
function beaconRegion(text,start,ends=[],limit=2400) {
  const first=text.match(start);
  if(!first)return '';
  const region=text.slice(first.index,first.index+limit);
  const lead=first[0].length,tail=region.slice(lead);
  let end=tail.length;
  for(const re of ends){const m=tail.match(re);if(m)end=Math.min(end,m.index);}
  return region.slice(0,lead+end);
}
function beaconRollText(el){
  return String(el?.innerText??el?.textContent??'').replace(/\s+/g,' ').trim();
}
function beaconRollName(card,selectors=[]){
  for(const selector of selectors){
    const el=card?.querySelector?.(selector),value=beaconRollText(el);
    if(value)return value.slice(0,120);
  }
  return '';
}
function beaconCollectRollActions(scope,tab=''){
  if(!scope?.querySelectorAll)return [];
  const active=beaconRollText(scope.querySelector?.('[role="tab"][aria-selected="true"]'));
  const actualTab=/^(?:Combat|Skills & Tools|Spells|Inventory|Features & Traits|Notes|About)$/i.test(active)?active:
    (/^(?:Combat|Skills & Tools|Spells|Inventory|Features & Traits|Notes|About)$/i.test(tab)?tab:'');
  const panel=scope.querySelector?.('[role="tabpanel"]:not([style*="display: none"])')||scope;
  const out=[],seen=new Set(),seenButtons=new Set(),push=(kind,name,action,button,meta={})=>{
    if(!button||!name)return;
    const refTab=meta.global?'':actualTab,clean={...meta};delete clean.global;
    const key=[kind,name,action,refTab].join('|').toLowerCase();
    if(seen.has(key))return;seen.add(key);seenButtons.add(button);
    out.push({id:'sheetroll:'+key.replace(/[^a-z0-9|_-]/g,'-').slice(0,180),origin:'sheet',
      kind,name:name.slice(0,120),action,tab:String(refTab||'').slice(0,80),
      label:beaconRollText(button).slice(0,80),...clean});
  };
  for(const card of Array.from(panel.querySelectorAll?.('.attack-item')||[]).slice(0,120)){
    const name=beaconRollName(card,['.span--item-row-title','.attack-item__title-chat','.attack-item__title-col']);
    push('attack',name,'attack',card.querySelector?.('.poly-button--hit-dc button'),{group:'Attacks'});
    push('attack',name,'damage',card.querySelector?.('.poly-button--damage button'),{group:'Attacks'});
  }
  for(const card of Array.from(panel.querySelectorAll?.('.spell-item')||[]).slice(0,160)){
    const name=beaconRollName(card,['.spell-item__name.span--item-row-title','.spell-item__name','.spell-item__name--wrapper']);
    push('spell',name,'attack',card.querySelector?.('.poly-button--hit-dc button'),{group:'Spells'});
    push('spell',name,'damage',card.querySelector?.('.poly-button--damage button'),{group:'Spells'});
  }
  for(const row of Array.from(scope.querySelectorAll('.skill')).slice(0,80)){
    const button=row.querySelector?.('button.skill__name'),name=beaconRollText(button);
    push('skill',name,'skill',button,{group:'Skills',global:true});
  }
  for(const row of Array.from(scope.querySelectorAll('.inline-ability')).slice(0,20)){
    const text=beaconRollText(row),abbr=text.match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i)?.[1]?.toUpperCase();
    if(!abbr)continue;
    push('ability',abbr,'ability',row.querySelector?.('.poly-button--ability button'),{group:'Abilities',global:true});
    push('save',abbr,'save',row.querySelector?.('.poly-button--compact-saving-throw button'),{group:'Saves',global:true});
  }
  const initiative=scope.querySelector?.('.initiative-btn button');
  if(initiative)push('initiative','Initiative','initiative',initiative,{group:'Initiative',global:true});
  // Catch additional official Roll20 controls such as tool checks and Hit
  // Dice without opening arbitrary controls. Only buttons whose accessible
  // label explicitly begins with "Roll " qualify for this generic fallback.
  for(const button of Array.from(scope.querySelectorAll?.('button[aria-label]')||[]).slice(0,500)){
    const aria=String(button.getAttribute?.('aria-label')||'').replace(/\s+/g,' ').trim();
    if(!/^Roll\b/i.test(aria))continue;
    if(seenButtons.has(button))continue;
    const visible=beaconRollText(button),name=(visible||aria.replace(/^Roll\s+(?:a\s+)?/i,'')).slice(0,120);
    push('generic',name,'roll',button,{group:'Other Rolls',global:true,ariaLabel:aria.slice(0,200)});
  }
  for(const card of Array.from(panel.querySelectorAll?.('.action-item')||[]).slice(0,160)){
    const name=beaconRollName(card,['.action-item__name','.span--item-row-title','.name-chat'])||
      beaconRollText(card).split(/\s+\d+d\d+/)[0].trim().slice(0,120);
    push('action',name,'healing',card.querySelector?.('.poly-button--healing button'),{group:'Actions'});
    push('action',name,'attack',card.querySelector?.('.poly-button--hit-dc button'),{group:'Actions'});
    push('action',name,'damage',card.querySelector?.('.poly-button--damage button'),{group:'Actions'});
  }
  return out.slice(0,400);
}
// Actual Roll20 2024 HP/ability values are often editable <input> values.
// innerText excludes form values, so the visible-text adapter alone can show
// empty scores and stale token HP even while the sheet is open. Only inspect
// visible controls in the player-opened sheet; never the headless VTT iframe.
function beaconVisibleFormValues(scope) {
  const root=scope?.nodeType===9?scope.body:scope;
  const result={stats:{},abilityScores:{},abilityMods:{},saveBonuses:{}};
  if(!root?.querySelectorAll)return result;
  const usable=el=>!!el&&el.type!=='hidden'&&!el.disabled&&
    !el.closest?.('[hidden],[inert],[aria-hidden="true"]')&&
    (!el.getClientRects||el.getClientRects().length>0);
  const integer=(value,min,max)=>{
    const raw=String(value??'').trim();
    if(!/^[+-]?\d{1,4}$/.test(raw))return null;
    const n=Number(raw);
    return Number.isInteger(n)&&n>=min&&n<=max?n:null;
  };
  const inputs=Array.from(root.querySelectorAll('input')||[]).slice(0,600).filter(usable);
  // Find the smallest bounded panel with the literal HIT POINTS, Current and
  // Max headings. The first three visible numeric inputs represent current,
  // maximum and temporary HP in the official 2024 editor. Never use numbers
  // from a whole game dialog or an unrelated resource panel.
  for(const input of inputs){
    let node=input.parentElement;
    for(let depth=0;node&&node!==root&&depth<9;node=node.parentElement,depth++){
      const text=beaconVisibleText(node);
      if(text.length>900)break;
      if(!/\bHIT\s*POINTS\b/i.test(text)||!/\bCurrent\b/i.test(text)||!/\bMax\b/i.test(text))continue;
      const panelInputs=Array.from(node.querySelectorAll?.('input')||[]).filter(usable);
      if(panelInputs.length<2||panelInputs.length>7)continue;
      const hp=integer(panelInputs[0].value,0,9999),maxHp=integer(panelInputs[1].value,1,9999);
      if(hp===null||maxHp===null||hp>maxHp+999)continue;
      result.stats.hp=hp;result.stats.maxHp=maxHp;
      const temp=integer(panelInputs[2]?.value,0,9999);
      if(temp!==null)result.stats.tempHp=temp;
      break;
    }
    if(result.stats.hp!==undefined)break;
  }
  // Ability score editors are inside the official .inline-ability row. The
  // displayed modifier and saving throw are official roll buttons, not
  // editable score inputs; read those without making up a derived bonus.
  for(const row of Array.from(root.querySelectorAll('.inline-ability')||[]).slice(0,12)){
    const abbr=beaconRollText(row).match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i)?.[1]?.toLowerCase();
    if(!abbr)continue;
    const scoreInput=Array.from(row.querySelectorAll?.('input')||[]).find(usable);
    const score=integer(scoreInput?.value,1,30);
    const mod=integer(beaconRollText(row.querySelector?.('.poly-button--ability button')),-15,20);
    const save=integer(beaconRollText(row.querySelector?.('.poly-button--compact-saving-throw button')),-15,30);
    if(score!==null&&(mod===null||Math.abs(Math.floor((score-10)/2)-mod)<=1))
      result.abilityScores[abbr]=score;
    if(mod!==null)result.abilityMods[abbr]=mod;
    if(save!==null)result.saveBonuses[abbr]=save;
  }
  // Initiative is a live official button even when the header's text order
  // prevents the generic INITIATIVE regex from finding the value.
  const initButton=root.querySelector?.('.initiative-btn button');
  if(initButton){
    const raw=beaconRollText(initButton),match=raw.match(/^[+−-]?\s*\d{1,2}(?:\.\d{1,2})?$/);
    if(match){
      const value=Number(raw.replace(/[−\s]/g,c=>c==='−'?'-':''));
      if(Number.isFinite(value)&&value>=-30&&value<=30)result.stats.init=value;
    }
  }
  return result;
}

function beaconImportVisible(scope,label='Open character sheet') {
  const text=beaconVisibleText(scope);
  const result={name:label,stats:{},abilityScores:{},abilityMods:{},saveBonuses:{},
    skillBonuses:{},spellSlots:{},usedSlots:{},resources:[],attacks:[],sheetRolls:beaconCollectRollActions(scope),details:{},
    coverage:{visibleFields:0,sections:[],names:[]},signature:text.slice(0,35000)};
  if(!text.trim())return result;
  const count=(group,name)=>{result.coverage.visibleFields++;if(!result.coverage.sections.includes(group))result.coverage.sections.push(group);result.coverage.names.push(name);};
  const num=(value,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:null;};
  const lines=text.split('\n').map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
  if(/^(?:Open character sheet|Character Sheet)$/i.test(result.name)){
    const top=lines.slice(0,12).find(x=>/^[A-Za-z][\w '’.-]{1,55}(?:\s+He\/Him|\s+She\/Her|\s+They\/Them)?$/i.test(x)
      && !/^(?:Public|Whisper|Advantage|Disadvantage|Automatic|Query|Combat|Spells|Sheet Settings|Character Sheet)$/i.test(x));
    if(top)result.name=top.replace(/\s+(?:He\/Him|She\/Her|They\/Them)$/i,'');
  }
  const hp=beaconRegion(text,/\bHIT\s*POINTS\b/i,[/\bABILITIES\b/i,/\bAC\s*\/\s*SPEED\b/i],500);
  const hpPair=hp.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  if(hpPair){
    const current=num(hpPair[1],0,9999),maximum=num(hpPair[2],1,9999);
    if(current!==null&&maximum!==null&&current<=maximum+999){
      result.stats.hp=current;result.stats.maxHp=maximum;count('Combat','HP/max HP');
    }
    const next=hp.slice(hpPair.index+hpPair[0].length,hpPair.index+hpPair[0].length+30);
    const temp=next.match(/^\s*(\d{1,4})(?:\s|$)/);
    if(temp){const n=num(temp[1],0,9999);if(n!==null){result.stats.tempHp=n;count('Combat','Temporary HP');}}
  }
  // The 2024 sheet displays current values in its rendered header. Treat
  // them as the live view, not an older attribute-cache default.
  const initiative=text.match(/\bINITIATIVE\s*:?\s*([+-]?\s*\d{1,2}(?:\.\d{1,2})?)\b/i);
  if(initiative){
    const value=Number(initiative[1].replace(/\s/g,''));
    if(Number.isFinite(value)&&value>=-30&&value<=30){
      result.stats.init=value;count('Combat','Initiative');
    }
  }
  const ac=text.match(/\bARMOR\s*CLASS\s*:?\s*(\d{1,2})\b/i);
  if(ac){const n=num(ac[1],1,40);if(n!==null){result.stats.ac=n;count('Combat','AC');}}
  const speed=text.match(/\bSPEED\s*(?:\(\s*(?:ft|feet)\s*\))?\s*:?\s*(\d{1,3})\b/i);
  if(speed){const n=num(speed[1],0,500);if(n!==null){result.stats.speed=n;count('Combat','Speed');}}
  const pb=text.match(/\bProficiency\s+Bonus\s*:?\s*\+?\s*(\d{1,2})\b/i);
  if(pb){const n=num(pb[1],1,15);if(n!==null){result.stats.proficiency=n;count('Combat','Proficiency');}}
  const classMatch=text.match(/\b(Fighter|Paladin|Rogue|Ranger|Cleric|Druid|Wizard|Sorcerer|Warlock|Bard|Barbarian|Monk)\s+(\d{1,2})(?:\s*[-–]\s*([A-Za-z][A-Za-z '’]{2,80}))?/i);
  if(classMatch){
    result.details.class=classMatch[1];
    const level=num(classMatch[2],1,20);if(level!==null){result.stats.level=level;count('Identity','Level');}
    if(classMatch[3])result.details.subclass=classMatch[3].trim();
    count('Identity','Class');
  }
  const abilities=beaconRegion(text,/\bABILITIES\b/i,[/\bAC\s*\/\s*SPEED\b/i,/\bSKILLS\b/i,/\bCOMBAT\b/i,/\bRESOURCES\b/i],2000);
  const regex=/\b(STR|DEX|CON|INT|WIS|CHA)\s+(\d{1,2})\s+([+-]\s*\d{1,2})\s+([+-]\s*\d{1,2})(?=\s|$)/gi;
  for(const m of abilities.matchAll(regex)){
    const score=num(m[2],1,30),mod=num(m[3].replace(/\s/g,''),-15,20),save=num(m[4].replace(/\s/g,''),-15,30);
    if(score===null||mod===null||save===null||Math.abs(Math.floor((score-10)/2)-mod)>1)continue;
    const key=m[1].toLowerCase();
    result.abilityScores[key]=score;result.abilityMods[key]=mod;result.saveBonuses[key]=save;
    count('Abilities',m[1]+'/save');
  }
  // Prefer current, visible form controls over text parsing, because innerText
  // does not expose <input>. Keep unsupported fields absent, not zeroed.
  const liveControls=beaconVisibleFormValues(scope);
  for(const section of ['stats','abilityScores','abilityMods','saveBonuses']){
    for(const [key,value] of Object.entries(liveControls[section])){
      if(result[section][key]===value)continue;
      const wasPresent=result[section][key]!==undefined;
      result[section][key]=value;
      if(!wasPresent)count(section==='stats'?'Combat':'Abilities',key);
    }
  }
  const skills=beaconRegion(text,/\bSKILLS\b/i,[/\bCOMBAT\b/i,/\bSPELLS\b/i,/\bINVENTORY\b/i,/\bFEATURES\b/i,/\bRESOURCES\b/i],3800);
  for(const skill of skillNames){
    const escaped=skill.replace(/ /g,'\\s+');
    const rx=new RegExp('(?:^|\\n)\\s*'+escaped+'\\s+(?:(?:STR|DEX|CON|INT|WIS|CHA)\\s+)?([+-]\\s*\\d{1,2})(?:\\s|$)','im');
    const m=skills.match(rx);
    if(m){const n=num(m[1].replace(/\s/g,''),-15,35);if(n!==null){result.skillBonuses[skill]=n;count('Skills',skill);}}
  }
  const resources=beaconRegion(text,/\bRESOURCES\b/i,[/\b(?:SHEET SETTINGS|CHARACTER SHEET|ABILITY CHECKS|PERSONAL JOURNAL)\b/i],1600);
  const resourceLines=resources.split('\n').map(s=>s.trim()).filter(Boolean),seenResources=new Set();
  for(let i=1;i<resourceLines.length&&i<75;i++){
    const m=resourceLines[i].match(/^[−-]?\s*(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if(!m)continue;
    const name=resourceLines[i-1],current=num(m[1],0,999),max=num(m[2],1,999);
    if(current===null||max===null||current>max||!name||name.length>90||
      /^(?:HIT POINTS|RESOURCES|CURRENT|MAX|TEMP|SLOTS|DAMAGE|HEAL)$/i.test(name))continue;
    const id='sheet:beacon:resource:'+name.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,85);
    if(seenResources.has(id))continue;
    seenResources.add(id);
    result.resources.push({id,origin:'sheet',name,current,max,reset:'manual'});
    count('Resources',name);
  }
  // Visible attacks are informational only; legacy repeating commands are
  // never synthesized for Beacon.
  const attacks=beaconRegion(text,/\bATTACKS\b/i,
    [/\b(?:SPELLS|INVENTORY|FEATURES\s*(?:&|AND)\s*TRAITS|NOTES|ABOUT|RESOURCES)\b/i],3500);
  const rows=attacks.split('\n').map(s=>s.trim()).filter(Boolean),seenAttacks=new Set();
  for(let i=2;i<rows.length&&i<100;i++){
    const dmg=rows[i].match(/\b(\d{1,2}d\d{1,3}(?:\s*[+-]\s*\d{1,3})?)\b/i);
    if(!dmg)continue;
    const preceding=rows.slice(Math.max(0,i-7),i);
    const index=preceding.findLastIndex(s=>/^(?:Melee|Ranged|Thrown|Reach)(?:\s|$)/i.test(s));
    if(index<1)continue;
    const name=preceding[index-1];
    if(!name||name.length>85||/^(?:Attack|Damage|Range|Hit|DC|Melee|Ranged)$/i.test(name))continue;
    const key=name.toLowerCase();if(seenAttacks.has(key))continue;
    seenAttacks.add(key);
    const tail=preceding.slice(index).join(' ');
    const toHit=tail.match(/([+-]\s*\d{1,2})\s*Attack/i);
    const range=tail.match(/(\d{1,3})\s*ft/i);
    result.attacks.push({id:'sheet:beacon:attack:'+key.replace(/[^a-z0-9]/g,'-').slice(0,80),
      origin:'sheet',name,toHit:toHit?.[1]?.replace(/\s/g,'')||'',
      damage:dmg[1].replace(/\s/g,''),range:range?range[1]+' ft':'',
      description:'Visible on Roll20 2024. Use the original sheet to roll.',command:''});
    count('Attacks',name);
  }
  result.coverage.names=result.coverage.names.slice(0,120);
  return result;
}
function mergeBeaconSnapshot(named,visible,{preferVisibleStats=false}={}){
  // A live 2024 UI value outranks stale Roll20 attributes *only when the
  // caller explicitly opts in*. Legacy snapshots retain named-first behavior.
  const liveSections=new Set(['stats','abilityScores','abilityMods','saveBonuses','skillBonuses']);
  for(const section of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','spellSlots','usedSlots']){
    for(const [k,v] of Object.entries(visible[section]||{})){
      if(named[section]?.[k]===undefined||(preferVisibleStats&&liveSections.has(section)))
        named[section][k]=v;
    }
  }
  named.details={...visible.details,...named.details};
  for(const section of ['resources','attacks']){
    const existing=new Set(named[section].map(x=>x.name.toLowerCase()));
    for(const x of visible[section]){
      if(!existing.has(x.name.toLowerCase())){named[section].push(x);existing.add(x.name.toLowerCase());}
    }
  }
  named.sheetRolls=Array.isArray(visible.sheetRolls)?visible.sheetRolls.slice(0,400):[];
  if((!named.name||/^(?:Open character sheet|Character Sheet)$/i.test(named.name))&&visible.name)named.name=visible.name;
  named.coverage.visibleFields=visible.coverage.visibleFields;
  named.coverage.visibleSections=visible.coverage.sections;
  named.coverage.visibleNames=visible.coverage.names;
  if(!named.coverage.attributes&&visible.coverage.visibleFields)named.edition='2024 / visible sheet';
  return named;
}
