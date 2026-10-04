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
  return result;
}
function findSheetForms(doc=document){
  const options=[],seen=new Set();
  function inspect(root,level=0){
    if(!root||level>2||seen.has(root))return;
    seen.add(root);
    const nodes=Array.from(root.querySelectorAll?.('form.charsheet,.charsheet,.sheetform,[data-testid*="character-sheet"],.characterdialog,[class*="character-sheet"],.ui-dialog:has(.sheetform),[data-sheet-id]')||[]);
    for(const node of nodes.slice(0,45)){
      if(node.closest?.('#roll20-embetterment-host'))continue;
      const fields=node.querySelectorAll?.('[name^="attr_"],[data-attribute]')||[];
      if(fields.length<3&&(node.querySelectorAll?.('[aria-label],[data-testid]')?.length||0)<5)continue;
      const parent=node.closest?.('.ui-dialog,.characterdialog,[data-character-id]')||node;
      const name=sheetText(parent.querySelector?.('.ui-dialog-title,.charactername,[data-testid="character-name"]')?.textContent||
        node.querySelector?.('[name="attr_character_name"],[name="attr_charactername"]')?.value||
        parent.getAttribute?.('aria-label')||'Open character sheet',120);
      options.push({id:parent.getAttribute?.('data-character-id')||'open-'+(options.length+1),name,root:node,kind:'Visible Roll20 sheet'});
    }
    for(const frame of Array.from(root.querySelectorAll?.('iframe')||[]).slice(0,30)){
      try{if(frame.contentDocument?.body)inspect(frame.contentDocument,level+1);}catch{/* cross-origin inaccessible */}
    }
  }
  inspect(doc);
  return options.filter((x,i)=>!options.some((y,j)=>i!==j&&x.root!==y.root&&x.root.contains?.(y.root))).slice(0,25);
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
  if(!s||s.coverage.attributes<1)return false;
  if(['Adventurer','New Adventurer'].includes(p.name)&&s.name)p.name=s.name;
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
}
function syncSheet({quiet=false}={}){
  const candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!candidate){if(!quiet)toast('Scan for an open sheet first.');return false;}
  if(candidate.root?.isConnected===false){if(!quiet)toast('Sheet closed; reopen and scan.');return false;}
  const fields=readSheetFields(candidate.root),data=snapshotSheet(fields,candidate.name);
  if(!data.coverage.attributes){if(!quiet)toast('No readable fields. Try Advanced Tools / Attributes.');return false;}
  const signature=JSON.stringify(fields);
  if(quiet&&signature===RB.sheetSignature)return true;
  if(!applySheetSnapshot(profile(),data))return false;
  candidate.name=data.name;profile().sheetLink.source=candidate.id;
  RB.sheetSignature=signature;save();
  if(!quiet){render();toast('Imported '+data.coverage.attributes+' accessible fields.');}
  else if(RB.visible&&['Sheet','Home','Spells','Inventory','Rolls'].includes(RB.tab)){
    const active=RB.shadow?.activeElement;
    if(!active?.matches?.('input,textarea,select'))render();
  }
  return true;
}
function sheetAutoTick(){
  const link=profile().sheetLink,candidate=RB.openSheets?.[RB.selectedSheet||0];
  if(!link?.auto||!link.lastSync||!candidate)return;
  if(link.source!==candidate.id&&link.name!==candidate.name)return;
  syncSheet({quiet:true});
}
function parseSheetPaste(text){
  const obj=JSON.parse(text);
  return snapshotSheet(obj.attributes||obj,obj.characterName||obj.name||'Imported sheet');
}
