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
function beaconImportVisible(scope,label='Open character sheet') {
  const text=beaconVisibleText(scope);
  const result={name:label,stats:{},abilityScores:{},abilityMods:{},saveBonuses:{},
    skillBonuses:{},spellSlots:{},usedSlots:{},resources:[],attacks:[],details:{},
    coverage:{visibleFields:0,sections:[],names:[]},signature:text.slice(0,35000)};
  if(!text.trim())return result;
  const count=(group,name)=>{result.coverage.visibleFields++;if(!result.coverage.sections.includes(group))result.coverage.sections.push(group);result.coverage.names.push(name);};
  const num=(value,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:null;};
  const lines=text.split('\n').map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean);
  if(/^(?:Open character sheet|Character Sheet)$/i.test(result.name)){
    const top=lines.slice(0,12).find(x=>/^[A-Za-z][\w '’.-]{1,55}(?:\s+He\/Him|\s+She\/Her|\s+They\/Them)?$/i.test(x)
      && !/^(?:pencil|Public|Whisper|Advantage|Disadvantage|Automatic|Query|Combat|Spells|Sheet Settings|Character Sheet)$/i.test(x));
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
function mergeBeaconSnapshot(named,visible){
  for(const section of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','spellSlots','usedSlots']){
    for(const [k,v] of Object.entries(visible[section]||{})){
      if(named[section]?.[k]===undefined)named[section][k]=v;
    }
  }
  named.details={...visible.details,...named.details};
  for(const section of ['resources','attacks']){
    const existing=new Set(named[section].map(x=>x.name.toLowerCase()));
    for(const x of visible[section]){
      if(!existing.has(x.name.toLowerCase())){named[section].push(x);existing.add(x.name.toLowerCase());}
    }
  }
  if((!named.name||/^(?:Open character sheet|Character Sheet)$/i.test(named.name))&&visible.name)named.name=visible.name;
  named.coverage.visibleFields=visible.coverage.visibleFields;
  named.coverage.visibleSections=visible.coverage.sections;
  named.coverage.visibleNames=visible.coverage.names;
  if(!named.coverage.attributes&&visible.coverage.visibleFields)named.edition='2024 / visible sheet';
  return named;
}
