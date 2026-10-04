// Character-sheet importer. Reads ONLY the currently open player-accessible DOM.
const sheetFull={str:'strength',dex:'dexterity',con:'constitution',int:'intelligence',wis:'wisdom',cha:'charisma'};
const sheetSlug=value=>String(value??'').replace(/[^A-Za-z0-9_$-]/g,'').slice(0,100);
const sheetText=(value,n=3000)=>String(value??'').trim().slice(0,n);
const sheetNum=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);
const sheetOn=v=>['1','on','true','yes','checked','✓'].includes(String(v??'').trim().toLowerCase());
function sheetAttributes(input){
  const out={};
  if(Array.isArray(input)){
    for(const obj of input.slice(0,6000))if(obj&&typeof obj.name==='string'&&obj.name.length<160)
      out[obj.name.replace(/^attr_/,'')]={current:sheetText(obj.current??obj.value,10000),max:sheetText(obj.max,1000)};
  }else if(input&&typeof input==='object'){
    for(const [name,val] of Object.entries(input).slice(0,6000))if(name.length<160)
      out[name.replace(/^attr_/,'')]=val&&typeof val==='object'&&!Array.isArray(val)
        ?{current:sheetText(val.current??val.value,10000),max:sheetText(val.max,1000)}:{current:sheetText(val,10000),max:''};
  }
  return out;
}
function readSheetFields(scope){
  const result={};
  if(!scope?.querySelectorAll)return result;
  for(const el of Array.from(scope.querySelectorAll('input,textarea,select,[data-attribute]')).slice(0,6000)){
    const name=el.getAttribute?.('name')||el.getAttribute?.('data-attribute')||'';
    const alias=sheetText(el.getAttribute?.('aria-label')||el.getAttribute?.('data-testid'),100).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const known=/^(?:character_name|hp|hit_points|hit_points_current|hit_points_max|temporary_hit_points|ac|armor_class|speed|movement_speed|walking_speed|initiative_bonus|proficiency_bonus|level|class|race|species|background|alignment|spell_save_dc|spell_attack_bonus|passive_perception|(?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:_score|_bonus|_mod|_save_bonus)?|(?:acrobatics|animal_handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight_of_hand|stealth|survival)_bonus)$/;
    if(!name.startsWith('attr_')&&!el.hasAttribute?.('data-attribute')&&!known.test(alias))continue;
    if(el.type==='radio'&&!el.checked)continue;
    let key=(name.startsWith('attr_')||el.hasAttribute?.('data-attribute')?name:alias).replace(/^attr_/,'');
    if(!key.startsWith('repeating_')){
      const row=el.closest?.('.repitem,[data-reprowid],[data-rowid]');
      const section=row?.closest?.('fieldset[class*="repeating_"],.repcontainer[class*="repeating_"]');
      const sec=String(section?.className||'').match(/(?:^|\s)repeating_([\w-]+)/)?.[1];
      if(row&&sec){
        const siblings=Array.from(row.parentElement?.querySelectorAll?.(':scope > .repitem')||[]);
        const id=sheetSlug(row.getAttribute?.('data-reprowid')||row.getAttribute?.('data-rowid')||row.id||('$'+Math.max(0,siblings.indexOf(row))));
        if(id)key='repeating_'+sec+'_'+id+'_'+key;
      }
    }
    if(!key||key.length>160)continue;
    const v=el.type==='checkbox'?(el.checked?'1':'0'):('value'in el?el.value:el.textContent);
    result[key]={current:sheetText(v,10000),max:result[key]?.max||''};
  }
  // 2024/Beacon Advanced Tools displays text rows, not attr_* controls.
  // Keep explicit 2014 fields authoritative when both adapters see a key.
  for(const [key,entry] of Object.entries(sheetReadBeaconAttributeRows(scope)))if(!(key in result))result[key]=entry;
  return result;
}
// Prefer an actual character-name label rather than generic dialog titles. 2024
// Beacon layouts can place the title outside the sheet's inner form.
function readVisibleSheetName(node,parent){
  const usable=value=>{
    const name=sheetText(value,120).replace(/\s+/g,' ').trim();
    return name.length>0 && name.length<=100 &&
      !/^(open character sheet|character sheet|character|sheet|bio & info|advanced tools|attributes|actions|combat|spells|pencil|edit|settings|character macros|new attribute)$/i.test(name);
  };
  const selectors=[
    '.asv__header__name','[name="attr_character_name"]','[name="attr_charactername"]',
    '[data-testid="character-name"]','[data-testid*="characterName"]',
    '[data-testid*="character-name"]','.charactername',
    '[class*="character-name"]','[class*="characterName"]',
    '.ui-dialog-title','[role="dialog"] header h1','[role="dialog"] header h2'
  ];
  const contexts=[node,parent,parent?.parentElement,parent?.parentElement?.parentElement];
  try {
    const frame=node?.ownerDocument?.defaultView?.frameElement;
    if(frame)contexts.push(frame.closest?.('.ui-dialog,[role="dialog"]')||frame.parentElement);
  }catch{/* cross-origin frame labels are not available */}
  for(const selector of selectors){
    for(const root of contexts){
      const el=root?.matches?.(selector)?root:root?.querySelector?.(selector);
      const value=el?.value||el?.textContent||el?.getAttribute?.('title');
      if(usable(value))return sheetText(value,100).replace(/\s+/g,' ').trim();
    }
  }
  const accessibleName=parent?.getAttribute?.('aria-label')||node?.getAttribute?.('aria-label');
  return usable(accessibleName)?sheetText(accessibleName,100):'Open character sheet';
}
function findSheetForms(doc=document){
  const options=[],used=new Set();
  // Real Jumpgate / Beacon markup: the character name is in
  // .asv__header__name and the 2024 React sheet is cross-origin in
  // iframe#advanced-charsheet-dialog__charsheet, not the VTT document.
  for(const dialog of Array.from(doc.querySelectorAll?.('.characterdialog')||[])){
    if(dialog.closest?.('#roll20-embetterment-host'))continue;
    const frame=dialog.querySelector?.('iframe#advanced-charsheet-dialog__charsheet,iframe[src*="/dnd2024byroll20/"]');
    if(!frame)continue;
    let url;
    try{url=new URL(frame.src||frame.getAttribute('src'),location.href);}catch{continue;}
    if(url.origin!==RBE_BEACON_ORIGIN||!/^\/dnd2024byroll20(?:\/|$)/.test(url.pathname))continue;
    const title=String(dialog.querySelector?.('.asv__header__name')?.textContent||'').trim()||
      String(frame.getAttribute?.('title')||'').replace(/^Character sheet for\s+/i,'').trim();
    const name=sheetMeaningfulName(title)?sheetText(title,100):'Open character sheet';
    const id=dialog.querySelector?.('#advanced-printsheet')?.getAttribute?.('data-charid') ||
      frame.getAttribute?.('name')||'beacon-'+(options.length+1);
    options.push({id,name,root:dialog,frame,readableFields:0,
      visibleFields:0,kind:'D&D 2024 sheet iframe',score:2000});
    used.add(dialog);
  }
  const seen=new Set();
  function inspect(root,level=0){
    if(!root||level>2||seen.has(root))return;
    seen.add(root);
    for(const node of sheetFormCandidates(root)){
      if(node.closest?.('#roll20-embetterment-host'))continue;
      if(level===0&&node===root.body)continue;
      // Avoid reading icon/tool controls as the data of a 2024 sheet:
      // the cross-origin iframe reader handles these separately.
      if(Array.from(used).some(d=>d===node||d.contains?.(node)))continue;
      const parent=node.closest?.('.ui-dialog,.characterdialog,[data-character-id]')||node;
      const fields=readSheetFields(node),visible=beaconImportVisible(node,readVisibleSheetName(node,parent));
      const text=sheetVisibleText(node).slice(0,40000);
      const count=Object.keys(fields).length;
      // Two incidental attributes cannot establish the presence of a sheet.
      if(count<3 && visible.coverage.visibleFields<2 && !(count>=2&&/\bAdvanced Tools\b/i.test(text)&&/\bAttributes\b/i.test(text)))continue;
      const name=readVisibleSheetName(node,parent);
      const score=sheetCandidateScore(fields,visible,text,name,node);
      if(score<0)continue;
      options.push({id:parent.getAttribute?.('data-character-id')||'open-'+(options.length+1),
        name:sheetMeaningfulName(name)?name:visible.name,root:node,readableFields:count,
        visibleFields:visible.coverage.visibleFields,kind:'Visible Roll20 sheet',score});
    }
    for(const frame of Array.from(root.querySelectorAll?.('iframe')||[]).slice(0,30)){
      try{if(frame.contentDocument?.body)inspect(frame.contentDocument,level+1);}catch{/* cross-origin */}
    }
  }
  inspect(doc);
  options.sort((a,b)=>b.score-a.score);
  return options.filter((x,i)=>!options.slice(0,i).some(y=>
    x.root===y.root||x.root.contains?.(y.root)||y.root.contains?.(x.root))).slice(0,25);
}
function snapshotSheet(input,label='Character'){
  const attrs=sheetAttributes(input),values=Object.fromEntries(Object.entries(attrs).map(([key,val])=>[key.toLowerCase(),val]));
  const pick=(...names)=>names.map(k=>values[k.toLowerCase()]?.current).find(v=>v!==undefined&&v!=='');
  const number=(...names)=>sheetNum(pick(...names));
  const snap={name:sheetText(pick('character_name','charactername','name')||label,100),attrs,edition:'Named/visible attributes',
    stats:{},abilityMods:{},abilityScores:{},saveBonuses:{},skillBonuses:{},spellSlots:{},usedSlots:{},currency:{},details:{},
    spells:[],attacks:[],inventory:[],features:[],resources:[],proficiencies:[],tools:[],
    coverage:{attributes:Object.keys(attrs).length,mapped:0,unmapped:[]}};
  const fields={hp:['hp','hit_points','hit_points_current','current_hp'],maxHp:['hp_max','hit_points_max','max_hp'],
    tempHp:['hp_temp','temporary_hit_points','temp_hp'],ac:['ac','armor_class'],speed:['speed','walking_speed','movement_speed'],
    init:['initiative_bonus','init_bonus'],proficiency:['pb','proficiency_bonus'],level:['level','character_level','base_level']};
  for(const [k,names] of Object.entries(fields)){const n=number(...names);if(n!==null)snap.stats[k]=n;}
  if(snap.stats.maxHp===undefined){const max=sheetNum(values.hp?.max||values.hit_points?.max);if(max!==null)snap.stats.maxHp=max;}
  for(const [abbr,long] of Object.entries(sheetFull)){
    const s=number(long,long+'_score',abbr+'_score');
    const m=number(long+'_mod',long+'_bonus',abbr+'_mod');
    const sv=number(long+'_save_bonus',long+'_saving_throw_bonus',abbr+'_save_bonus');
    if(s!==null)snap.abilityScores[abbr]=s;
    if(m!==null)snap.abilityMods[abbr]=m;
    if(sv!==null)snap.saveBonuses[abbr]=sv;
  }
  for(const skill of skillNames){
    const slug=skill.toLowerCase().replaceAll(' ','_');
    const v=number(slug+'_bonus',slug+'_mod');
    if(v!==null)snap.skillBonuses[skill]=v;
  }
  for(const k of ['cp','sp','ep','gp','pp']){const v=number(k,k+'_coins');if(v!==null)snap.currency[k]=v;}
  const details={class:['class','class_name','classes'],subclass:['subclass'],race:['race','species','ancestry'],
    background:['background'],alignment:['alignment'],experience:['experience','xp'],
    hitDice:['hit_dice'],hitDieType:['hitdietype'],spellSaveDC:['spell_save_dc','spell_dc'],
    spellAttack:['spell_attack_bonus','spell_attack_mod'],passivePerception:['passive_wisdom','passive_perception'],
    passiveInsight:['passive_insight'],passiveInvestigation:['passive_investigation'],size:['size'],languages:['languages'],
    personality:['personality_traits'],ideals:['ideals'],bonds:['bonds'],flaws:['flaws']};
  for(const [k,names] of Object.entries(details)){const val=pick(...names);if(val!==undefined)snap.details[k]=sheetText(val);}
  const insp=pick('inspiration','heroic_inspiration');if(insp!==undefined)snap.inspiration=sheetOn(insp);
  for(let n=1;n<=9;n++){
    const max=number('lvl'+n+'_slots_total','level_'+n+'_spell_slots_total','spell_slots_'+n+'_max');
    const left=number('lvl'+n+'_slots_expended','level_'+n+'_spell_slots_remaining','spell_slots_'+n+'_remaining');
    if(max!==null){snap.spellSlots[n]=max;if(left!==null)snap.usedSlots[n]=Math.max(0,max-left);}
  }
  const rows=new Map();
  for(const [key,record] of Object.entries(attrs)){
    const m=key.match(/^repeating_(spell-cantrip|spell-[1-9]|spell-npc|inventory|attack|traits|proficiencies|tool|resource|npcaction|npcbonusaction|npcreaction)_([^_]+)_(.+)$/i);
    if(!m)continue;
    const section=m[1].toLowerCase(),id=m[2],field=m[3].toLowerCase(),rowkey=section+'/'+id;
    if(!rows.has(rowkey))rows.set(rowkey,{section,id,fields:{},maxes:{}});
    rows.get(rowkey).fields[field]=record.current;
    if(record.max)rows.get(rowkey).maxes[field]=record.max;
  }
  for(const row of rows.values()){
    const f=row.fields,base={id:'sheet:'+row.section+'/'+row.id,origin:'sheet'},valid=/^[A-Za-z0-9_$-]{1,100}$/.test(row.id);
    if(row.section.startsWith('spell')){
      const name=sheetText(f.spellname||f.spellname_base||f.name,120);if(!name)continue;
      const level=row.section==='spell-cantrip'?0:Number(row.section.match(/\d+/)?.[0]||0);
      const notes=[f.spelldescription,f.spellathigherlevels].filter(Boolean).map(x=>sheetText(x,1500)).join('\n');
      snap.spells.push({...base,name,level,range:sheetText(f.spellrange,100),notes,
        concentration:sheetOn(f.spellconcentration||f.spellconcentrationflag),
        prepared:sheetOn(f.spellprepared||f.prep),ritual:sheetOn(f.spellritual||f.spellritualflag),
        school:sheetText(f.spellschool,80),castTime:sheetText(f.spellcastingtime,80),duration:sheetText(f.spellduration,100),
        materials:sheetText(f.spellcomp_materials,400),
        components:['v','s','m'].filter(x=>sheetOn(f['spellcomp_'+x])).join(',').toUpperCase(),
        command:valid&&row.section!=='spell-npc'?'%{selected|repeating_'+row.section+'_'+row.id+'_spell}':''});
    }else if(row.section==='inventory'){
      const name=sheetText(f.itemname,120);if(!name)continue;
      snap.inventory.push({...base,name,qty:Math.max(0,sheetNum(f.itemcount)??1),weight:Math.max(0,sheetNum(f.itemweight)??0),
        equipped:sheetOn(f.equipped),description:sheetText(f.itemcontent,2000),properties:sheetText(f.itemproperties,800),category:'Sheet'});
    }else if(['attack','npcaction','npcbonusaction','npcreaction'].includes(row.section)){
      const name=sheetText(f.atkname||f.name,120);if(!name)continue;
      snap.attacks.push({...base,name,toHit:sheetText(f.atkbonus||f.attack_tohit,80),
        damage:sheetText(f.dmgbase||f.attack_damage||f.dmg1base,160),damageType:sheetText(f.dmgtype||f.attack_damagetype,120),
        range:sheetText(f.atkrange||f.attack_range,100),description:sheetText(f.description,1600),
        command:valid?'%{selected|repeating_'+row.section+'_'+row.id+'_'+(row.section==='attack'?'attack':'npc_action')+'}':''});
    }else if(row.section==='traits'){
      const name=sheetText(f.name,120);
      if(name)snap.features.push({...base,name,description:sheetText(f.description,4000),source:sheetText(f.source,120)});
    }else if(['proficiencies','tool'].includes(row.section)){
      const name=sheetText(f.name||f.prof_name||f.toolname,120);
      if(name)snap[row.section==='tool'?'tools':'proficiencies'].push({...base,name,description:sheetText(f.description,1200)});
    }else if(row.section==='resource'){
      for(const side of ['left','right']){
        const name=sheetText(f['resource_'+side+'_name'],120);if(!name)continue;
        snap.resources.push({...base,id:base.id+':'+side,name,current:sheetNum(f['resource_'+side])??0,
          max:sheetNum(row.maxes['resource_'+side]||f['resource_'+side+'_max'])??0,reset:'manual'});
      }
    }
  }
  for(const key of ['class_resource','other_resource']){
    const name=sheetText(pick(key+'_name'),120);
    if(name)snap.resources.push({id:'sheet:'+key,origin:'sheet',name,current:number(key)??0,max:number(key+'_max')??sheetNum(values[key]?.max)??0,reset:'manual'});
  }
  snap.edition=Object.keys(attrs).some(k=>k.startsWith('repeating_spell-')||k==='pb')?'2014 / legacy':'2024 / visible attributes';
  const known=new Set(Object.values(fields).flat().concat(Object.values(details).flat(),['inspiration','heroic_inspiration','hp_max','hp','cp','sp','ep','gp','pp'],
    ...Object.values(sheetFull).map(long=>[long,long+'_score',long+'_mod',long+'_bonus',long+'_save_bonus',long+'_saving_throw_bonus']),
    ...skillNames.map(n=>[n.toLowerCase().replaceAll(' ','_')+'_bonus',n.toLowerCase().replaceAll(' ','_')+'_mod'])));
  const unknown=Object.keys(attrs).filter(k=>!known.has(k.toLowerCase())&&!k.startsWith('repeating_')&&!/^lvl[1-9]_slots_/.test(k));
  snap.coverage.unmapped=unknown.slice(0,250);
  snap.coverage.mapped=Object.keys(attrs).length-unknown.length;
  return snap;
}
function mergeSheetList(previous,incoming){
  const map=new Map((Array.isArray(previous)?previous:[]).map(item=>[item.id,item]));
  for(const item of incoming.slice(0,200))map.set(item.id,item);
  return Array.from(map.values()).slice(0,300);
}
function applySheetSnapshot(p,s){
  if(!s||(s.coverage.attributes<1&&!(s.coverage.visibleFields>0)))return false;
  if(['Adventurer','New Adventurer','pencil','Open character sheet'].includes(p.name)&&s.name&&sheetMeaningfulName(s.name))p.name=s.name;
  for(const k of ['stats','abilityMods','skillBonuses','saveBonuses','currency'])Object.assign(p[k],s[k]);
  p.abilityScores={...(p.abilityScores||{}),...s.abilityScores};
  p.sheetDetails={...(p.sheetDetails||{}),...s.details};
  if(s.inspiration!==undefined)p.inspiration=s.inspiration;
  for(const [n,v] of Object.entries(s.spellSlots))p.spellSlots[+n]=clamp(v,0,99);
  for(const [n,v] of Object.entries(s.usedSlots))p.usedSlots[+n]=clamp(v,0,p.spellSlots[+n]);
  for(const k of ['spells','inventory','resources','attacks','features','proficiencies','tools']){
    if(s[k].length||(p[k]||[]).some(x=>x.origin==='sheet'))p[k]=mergeSheetList(p[k],s[k]);
  }
  p.sheetLink={...(p.sheetLink||{}),name:s.name,edition:s.edition,lastSync:new Date().toISOString(),
    coverage:s.coverage,counts:Object.fromEntries(['spells','inventory','resources','attacks','features','proficiencies','tools'].map(k=>[k,s[k].length]))};
  return true;
}
function scanSheets(){
  RB.openSheets=findSheetForms(document);
  if(!RB.openSheets.length){toast('Open your sheet inside Roll20 (disable pop-out), then Scan again.');return;}
  const current=profile().sheetLink?.name,idx=RB.openSheets.findIndex(x=>x.name===current);
  RB.selectedSheet=idx>=0?idx:0;RB.sheetSignature=null;
  render();toast('Found '+RB.openSheets.length+' open sheet(s).');
  sheetPrefetchAttributes(RB.openSheets[RB.selectedSheet||0]);
}
function syncSheet({quiet=false,fieldsOverride=null}={}){
  const candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!candidate){if(!quiet)toast('Scan for an open sheet first.');return false;}
  if(candidate.root?.isConnected===false){if(!quiet)toast('Sheet closed; reopen and scan.');return false;}
  if(candidate.frame){if(!quiet)toast('Importing 2024 iframe sheet…');return false;}
  const live=readSheetFields(candidate.root);
  const cached=RB.sheetWarm?.root===candidate.root?RB.sheetWarm?.scan?.fields:null;
  const fields=fieldsOverride || (cached?{...cached,...live}:live);
  const visual=beaconImportVisible(candidate.root,candidate.name);
  const data=mergeBeaconSnapshot(snapshotSheet(fields,candidate.name),visual);
  if(!data.coverage.attributes&&!data.coverage.visibleFields){
    if(!quiet)toast('No readable fields. Open Character Sheet or Advanced Tools / Attributes, then scan again.');
    return false;
  }
  const signature=JSON.stringify(fields)+'|'+visual.signature;
  if(quiet&&signature===RB.sheetSignature)return true;
  if(!applySheetSnapshot(profile(),data))return false;
  candidate.name=data.name;candidate.readableFields=data.coverage.attributes;
  candidate.visibleFields=data.coverage.visibleFields;profile().sheetLink.source=candidate.id;
  RB.sheetSignature=signature;save();
  if(!quiet){render();toast('Imported '+data.coverage.attributes+' named and '+data.coverage.visibleFields+' visible fields.');}
  else if(RB.visible&&['Sheet','Home','Spells','Inventory','Rolls'].includes(RB.tab)){
    const active=RB.shadow?.activeElement;
    if(!active?.matches?.('input,textarea,select'))render();
  }
  return true;
}
// Warm the virtualized attribute list without changing player data. The
// explicit Import action uses the collected fields and can retry if needed.
function sheetPrefetchAttributes(candidate){
  if(!candidate?.root)return;
  if(candidate.frame){
    const existing=RB.sheetWarm;
    if(existing?.frame===candidate.frame&&(existing.promise||Date.now()-(existing.at||0)<20000))return;
    const cache={frame:candidate.frame,root:candidate.root,at:0,promise:null,scan:null};
    RB.sheetWarm=cache;
    cache.promise=requestBeaconFrame(candidate,true).then(scan=>{
      cache.scan=scan;cache.at=Date.now();
      candidate.readableFields=Object.keys(scan.fields).length;
      candidate.visibleFields=scan.visible?.coverage?.visibleFields||0;
      if(RB.sheetWarm===cache&&RB.visible&&RB.tab==='Sheet')render();
      return scan;
    }).catch(err=>{
      console.warn('[roll20 Embetterment] Sheet iframe not accessible',err);
      if(RB.sheetWarm===cache)RB.sheetWarm=null;
      toast(err.message);
      return null;
    }).finally(()=>{cache.promise=null;});
    return;
  }
  if(!sheetScrollableAttributeContainer(candidate.root))return;
  if(RB.sheetWarm?.root===candidate.root &&
     (RB.sheetWarm.promise || Date.now()-(RB.sheetWarm.at||0)<20000))return;
  const cache={root:candidate.root,at:0,promise:null,scan:null};
  RB.sheetWarm=cache;
  cache.promise=sheetHarvestBeaconRows(candidate.root).then(scan=>{
    cache.scan=scan;cache.at=Date.now();
    if(RB.sheetWarm!==cache)return scan;
    candidate.readableFields=Math.max(candidate.readableFields||0,Object.keys(scan.fields).length);
    if(RB.visible&&RB.tab==='Sheet'&&
      !RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
    return scan;
  }).catch(err=>{
    console.warn('[roll20 Embetterment] Background attribute scan',err);
    if(RB.sheetWarm===cache)RB.sheetWarm=null;
    return null;
  }).finally(()=>{cache.promise=null;});
}
async function syncSheetDeep(){
  if(RB.sheetDeepSync)return;
  let candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!candidate||candidate.root?.isConnected===false||(!candidate.readableFields&&!candidate.visibleFields)){
    scanSheets();
    candidate=RB.openSheets?.[RB.selectedSheet||0];
  }
  if(!candidate)return;
  const originalProfile=RB.state.current;
  RB.sheetDeepSync=true;
  try{
    if(candidate.frame){
      const cache=RB.sheetWarm?.frame===candidate.frame?RB.sheetWarm:null;
      let scan=cache?.promise?await cache.promise:cache?.scan;
      if(!scan||Date.now()-(cache?.at||0)>30000)scan=await requestBeaconFrame(candidate,true);
      if(!RB.openSheets?.includes(candidate)||RB.state.current!==originalProfile)return;
      if(beaconFrameSnapshot(candidate,scan)){
        RB.sheetWarm={root:candidate.root,frame:candidate.frame,scan,at:Date.now(),promise:null};
        toast('Imported '+Object.keys(scan.fields).length+' 2024 attributes and '+
          (scan.visible?.coverage?.visibleFields||0)+' visible values from '+candidate.name+'.');
      }else toast('The iframe replied, but its current tab contains no readable character data.');
      return;
    }
    // If background preloading is in progress, share it rather than visibly
    // traversing the same list a second time.
    const warmed=RB.sheetWarm?.root===candidate.root?RB.sheetWarm:null;
    let scan=warmed?.promise?await warmed.promise:warmed?.scan;
    if(!scan || Date.now()-(warmed?.at||0)>30000)
      scan=await sheetHarvestBeaconRows(candidate.root);
    if(!scan||!RB.openSheets?.includes(candidate)||RB.state.current!==originalProfile)return;
    // Preserve cached rows hidden by virtualization while preferring fresh DOM
    // values for any attributes currently rendered on the character sheet.
    const fields={...scan.fields,...readSheetFields(candidate.root)};
    const ok=syncSheet({fieldsOverride:fields});
    if(ok){
      RB.sheetWarm={root:candidate.root,scan:{...scan,fields},at:Date.now(),promise:null};
      toast('Imported '+Object.keys(fields).length+' attributes'+
        (scan.expected?' of '+scan.expected:'')+(scan.full?' (list complete).':' (available rows).'));
    }else toast('No readable values yet. Keep Advanced Tools → Attributes open.');
  }catch(err){
    console.warn('[roll20 Embetterment] Advanced sheet sync failed',err);
    toast('Character scan failed: '+String(err.message||err).slice(0,160));
  }finally{RB.sheetDeepSync=false;}
}
function sheetAutoTick(){
  // Do not overwrite a multi-tab snapshot with a single-tab auto-refresh.
  if(RB.sheetTourBusy)return;
  const link=profile().sheetLink,candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!link?.auto||!link.lastSync||!candidate)return;
  if(link.source!==candidate.id&&link.name!==candidate.name)return;
  if(candidate.frame){
    if(RB.frameRefreshBusy)return;
    RB.frameRefreshBusy=true;
    requestBeaconFrame(candidate,false).then(scan=>{
      if(RB.openSheets?.includes(candidate) && (profile().sheetLink?.source===candidate.id||
        profile().sheetLink?.name===candidate.name))beaconFrameSnapshot(candidate,scan,{quiet:true});
    }).catch(()=>{}).finally(()=>{RB.frameRefreshBusy=false;});
    return;
  }
  syncSheet({quiet:true});
}
function parseSheetPaste(text){
  const obj=JSON.parse(text);
  return snapshotSheet(obj.attributes||obj,obj.characterName||obj.name||'Imported sheet');
}
