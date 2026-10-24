// Roll20 2024 native-action bridge. Prefer verified controlled-character
// abilities; supported source-observed attacks and skills can instead use
// the authenticated official reader to recheck and click one real control.
const R3_NATIVE={pending:new Map(),tokens:new Map(),readers:new Map(),preview:null,busy:false,status:'',revision:0};
function r3NativeStatus(message){
  if(typeof r3DebugLog==='function'&&message!==R3_NATIVE.status)
    r3DebugLog('Native',message);
  R3_NATIVE.status=r3String(message,240);
  R3_NATIVE.revision++;
  r3HudRender?.();
}
// Attack name alone is NOT unique on an official sheet. A player may have
// multiple differently configured weapons all called "Dagger". The imported
// _key selects an item locally; explicit observed attack bonus/damage is used
// to disambiguate same-name native rows, never an arbitrary array index.
function r3NativeAttackMetric(raw){
  const text=r3String(raw,600).replace(/\u2212/g,'-');
  const bonus=text.match(/(?:^|\s)([+-]\d{1,3})\s*Attack\b/i);
  const damage=text.match(/\b\d{1,3}d\d{1,3}(?:[+-]\d{1,3})?\b/i);
  return {bonus:bonus?bonus[1]:'',damage:damage?damage[0].toLowerCase():''};
}
// Sheet-free standard attacks use the current Roll20 chat composer and
// the *observed* hit/damage formulas. They never open, hide or navigate any
// character sheet. This is a standard dice roll, not a D&D 2024 sheet macro:
// advanced sheet features (advantage, crit, effects, modifiers added later)
// cannot be assumed. Native official-sheet actions remain diagnostic opt-in.
function r3NativeChatCommand(item){
  const observed=r3NativeAttackMetric(item?.visible||'');
  // Without an unambiguous sheet-observed hit bonus, don't invent a roll.
  if(!/^[+-]\d{1,3}$/.test(observed.bonus))return null;
  const raw=r3String(item?.name,100);
  const label=raw.split(/[{}|]/,1)[0].split('[')[0].split(']')[0].replace(/[^\p{L}\p{N} .,'()+-]/gu,'').trim().slice(0,65);
  if(!label)return null;
  const dice='1d20'+observed.bonus;
  const damage=/^\d{1,3}d\d{1,3}(?:[+-]\d{1,3})?$/.test(observed.damage)?
    ' {{Damage=[['+observed.damage+']]}}':'';
  // Roll20's built-in default chat template is available independent of
  // character sheets. The attack bonus/damage are immutable captured data.
  return '&{template:default} {{name='+label+' Attack}} {{To Hit=[['+dice+']]}}'+damage;
}
function r3NativeChatSubmit(command){
  // Chat is the native editor's own interface. Never dispatch onto an
  // unrelated textbox, mutate private Jumpgate internals, or fake chat logs.
  const input=document.querySelector?.('#textchat-input textarea');
  const send=document.querySelector?.('#textchat-input .btn');
  if(!input||!send||typeof send.click!=='function'||input.disabled||send.disabled)
    return {ok:false,reason:'Roll20 chat controls are not available. Open the chat panel and retry; the character sheet can remain closed.'};
  // Do not overwrite something the player was already typing. Unlike a
  // hidden chat API, the DOM composer owns a real draft.
  if(String(input.value||'').length)
    return {ok:false,reason:'Your Roll20 chat has an unsent draft. Send or clear it before using Attack (the draft was not changed).'};
  try{
    const proto=Object.getPrototypeOf(input);
    const setter=proto&&Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if(typeof setter==='function')setter.call(input,command);
    else input.value=command;
    if(typeof Event==='function')input.dispatchEvent?.(new Event('input',{bubbles:true}));
    send.click();
    return {ok:true};
  }catch(error){
    return {ok:false,reason:'Roll20 chat did not accept the attack roll: '+
      r3String(error?.message||error,120)};
  }
}
// Shared native-action mapping. Roll20 2024's "Add Action to Token Bar"
 // creates an actual character action. Invoke that *existing* ability
 // instead of recreating the attack template. Never guess a repeating ID.
function r3NativeActionModels(character){
  const abilities=character?.abilities||r3TokenModelGet(character,'abilities');
  if(Array.isArray(abilities))return abilities.slice(0,300);
  return Array.isArray(abilities?.models)?abilities.models.slice(0,300):[];
}
function r3NativeMappedAbility(attack,character,snapshot){
  return r3NativeMapAbility('attacks',attack,character,snapshot);
}
// Shared read-only mapping registry for all player-facing 2024 sheet
// actions. A DOM button caption is an observation, NOT a callable macro ID.
// Map only pre-existing, uniquely named controlled-character abilities with
// a category-consistent Roll20 sheet-action reference; never guess row IDs.
const R3_NATIVE_CATEGORIES={
  attacks:{title:'Attack',pattern:/repeating_(?:attack|npcaction)\s*(?:\(|_)/i},
  spells:{title:'Cast',pattern:/(?:repeating_(?:spell|spellattack|spellcard)\s*(?:\(|_)|\bspell_(?:roll|cast|attack)\b)/i},
  features:{title:'Use',pattern:/(?:repeating_(?:feature|trait|action|classfeature|npcaction)\s*(?:\(|_)|\bfeature_(?:roll|use)\b)/i},
  inventory:{title:'Use',pattern:/(?:repeating_(?:inventory|equipment|item|consumable)\s*(?:\(|_)|\bitem_(?:roll|use)\b)/i},
  resources:{title:'Use',pattern:/repeating_(?:resource|feature|action)\s*(?:\(|_)/i},
  skills:{title:'Roll',pattern:/(?:\b(?:skill|check)[-_][a-z][\w-]*|[a-z][\w-]*[-_](?:skill|check)\b)/i},
  saves:{title:'Roll',pattern:/(?:\b(?:saving[_-]?throw|save)[-_][a-z][\w-]*|[a-z][\w-]*[-_](?:save|saving[_-]?throw)\b)/i},
  modifiers:{title:'Roll',pattern:/(?:\b(?:ability[_-]?check|check)[-_][a-z][\w-]*|[a-z][\w-]*[-_](?:ability[_-]?check|check)\b)/i},
  misc:{title:'Use',pattern:/^repeating_[A-Za-z0-9_-]{3,240}(?:_|\()/i}
};
// Read existing player-owned character abilities that have a real exact
// repeating sheet reference but do not belong to any known category. These
// do not need a sheet read, a first-run setup wizard, or a guessed row ID.
// Never surface an arbitrary macro, a duplicate or another player's action.
function r3NativeMiscCatalog(snapshot=R3_UI.snapshot){
  if(!snapshot?.name)return [];
  const identity=r3NativeBgResolve(snapshot.name);
  if(!identity.model||!r3TokenControls(identity.model))return [];
  const existing=Array.isArray(snapshot.misc)?snapshot.misc:[];
  const out=[],ids=new Set(),refs=new Set(existing.map(x=>x.nativeActionRef).filter(Boolean));
  for(const model of r3NativeActionModels(identity.model)){
    const id=r3String(model.id||r3TokenModelGet(model,'_id'),120);
    const name=r3String(r3TokenModelGet(model,'name'),125);
    const action=r3String(r3TokenModelGet(model,'action'),350);
    if(!id||!/^[A-Za-z0-9_-]{4,120}$/.test(id)||!name||/[{}|\r\n]/.test(name)||ids.has(id))continue;
    ids.add(id);
    const inspected=r3NativeSheetReference('misc',action,identity.model);
    if(!inspected.reference)continue;
    const reference=inspected.reference;
    if(Object.entries(R3_NATIVE_CATEGORIES).some(([kind,config])=>
      kind!=='misc'&&config.pattern.test(reference)))continue;
    if(refs.has(action))continue;
    refs.add(action);
    out.push({name,_key:'ability:'+id,nativeActionRef:action,tab:'Roll20 character abilities',
      visible:'Existing controlled-character native action'});
    if(out.length>=80)break;
  }
  return out;
}
function r3NativeMapSource(kind,key,snapshot=R3_UI.snapshot){
  if(!Object.prototype.hasOwnProperty.call(R3_NATIVE_CATEGORIES,kind)||!key||
    typeof key!=='string'||key.length>240)return {reason:'Unknown source category or action key.'};
  const source=snapshot?.[kind];
  if(['skills','saves','modifiers'].includes(kind)){
    if(!source||!Object.prototype.hasOwnProperty.call(source,key))
      return {reason:'The selected native check is no longer in this character snapshot.'};
    return {name:key,key,value:source[key]};
  }
  const rows=Array.isArray(source)?source:[];
  const candidates=kind==='misc'?[...rows,...r3NativeMiscCatalog(snapshot)]:rows;
  const found=candidates.filter(row=>row?._key===key&&typeof row._key==='string');
  if(found.length!==1)return {reason:'This imported action has no unique source identity.'};
  return found[0];
}
// Accept a single, character-bound Roll20 sheet-ability reference, never an
// arbitrary chat script containing the word "repeating". A selected-token
// macro is not safe to run with the sheet closed: it can target a different PC.
function r3NativeSheetReference(kind,action,character){
  const macro=String(action??'').trim();
  const match=macro.match(/^%\{([A-Za-z0-9_-]{4,120})\|([^{}|;!\r\n]{1,350})\}$/);
  if(!match)return {reason:'Roll20 ability does not contain one complete, safe sheet-action reference.'};
  const target=r3String(character?.id||r3TokenModelGet(character,'_id'),120);
  if(!target||match[1]!==target)
    return {reason:'Native ability references another or selection-dependent character.'};
  if(!R3_NATIVE_CATEGORIES[kind].pattern.test(match[2]))
    return {reason:'The matching ability is not an identified '+kind+' sheet action.'};
  return {reference:match[2]};
}
// Some official cards expose their *own* stable repeating row ID. When
// present it is stronger than a name and allows safe same-named variants.
// The ID must be present as one whole argument or delimited row token in
// the pre-existing ability reference; substrings and guessed indexes fail.
function r3NativeReferenceHasRow(reference,rowId){
  if(!/^[A-Za-z0-9_-]{4,120}$/.test(rowId||''))return false;
  return new RegExp('(?:_'
    +rowId+'_'
    +'|\\(\\s*["\\x27]'+rowId+'["\\x27]\\s*[,)]'
    +')').test(reference);
}
function r3NativeMapAbility(kind,entry,character,snapshot){
  if(!R3_NATIVE_CATEGORIES[kind])return {reason:'Unsupported native action category.'};
  const name=r3String(entry?.name,125).trim();
  if(!name||/[{}|\r\n]/.test(name))return {reason:'The source action name is invalid for Roll20 macros.'};
  const checks=['skills','saves','modifiers'].includes(kind);
  const rows=checks?[]:Array.isArray(snapshot?.[kind])?snapshot[kind]:[];
  const sameName=checks?1:rows.filter(x=>r3String(x?.name,125).toLowerCase()===name.toLowerCase()).length;
  const rowId=checks?'':r3String(entry?.nativeRowId,120);
  if(rowId&&!/^[A-Za-z0-9_-]{4,120}$/.test(rowId))
    return {reason:'Imported repeating row ID is invalid; no native action was linked.'};
  const directRef=typeof entry?.nativeActionRef==='string'?entry.nativeActionRef:'';
  const uniqueDirectRef=!!directRef&&rows.filter(x=>x?.nativeActionRef===directRef).length===1;
  if(!rowId&&sameName!==1&&!uniqueDirectRef&&kind!=='misc')return {reason:kind==='attacks'?
    'Multiple same-named native attacks; no verified repeating row identity.':
    'Several source entries have this name; their native actions are ambiguous.'};
  // The official authenticated sheet may explicitly expose an action macro
  // even if the player has not added it to the Roll20 token bar. This path
  // never guesses an ID and always revalidates ownership when clicked.
  // MISC cannot fall back to a name-only character ability.
  if(entry?.nativeActionRef){
    const direct=r3NativeSheetReference(kind,entry.nativeActionRef,character);
    if(!direct.reference)return {reason:direct.reason};
    return {abilityName:name,command:String(entry.nativeActionRef).trim(),
      source:'Exact authenticated official-sheet action reference'};
  }
  if(kind==='misc')return {reason:'No explicit native reference was observed for this MISC action.'};
  const matches=[];
  let rejectedReason='';
  for(const ability of r3NativeActionModels(character)){
    const abilityName=r3String(r3TokenModelGet(ability,'name'),125);
    if(!abilityName||/[{}|\r\n]/.test(abilityName))continue;
    if(!rowId&&abilityName.toLowerCase()!==name.toLowerCase())continue;
    const inspected=r3NativeSheetReference(kind,r3TokenModelGet(ability,'action'),character);
    if(!inspected.reference){
      if(abilityName.toLowerCase()===name.toLowerCase())rejectedReason=inspected.reason;
      continue;
    }
    if(rowId&&!r3NativeReferenceHasRow(inspected.reference,rowId))continue;
    matches.push({ability,abilityName,action:r3String(r3TokenModelGet(ability,'action'),4000)});
  }
  if(matches.length!==1)return {reason:matches.length>1?
    'Multiple Roll20 abilities match this source action; no native action was sent.':
    rowId?'No existing Roll20 ability references this exact imported repeating row.':
    rejectedReason||'No safe, character-bound '+kind+' ability matches '+name+'.'};
  const matched=matches[0];
  return {abilityName:matched.abilityName,
    abilityId:r3String(matched.ability.id||r3TokenModelGet(matched.ability,'_id'),120),
    source:rowId?'Verified repeating row ID':'Verified Roll20 '+kind+' ability',
    action:matched.action};
}
function r3NativeMapPreview(kind,key,snapshot=R3_UI.snapshot){
  const entry=r3NativeMapSource(kind,key,snapshot);
  if(!entry.name)return entry;
  const name=r3String(snapshot?.name,120),active=R3_TOKEN.active;
  const chars=r3TokenCampaign()?.characters;
  if(!chars)return {reason:'Jumpgate has no exposed character collection.'};
  let model=null;
  if(active){
    if(active.name?.toLowerCase()!==name.toLowerCase())
      return {reason:'Selected token and imported character differ.'};
    model=r3TokenCharacter(active.characterId);
  }else{
    const models=Array.isArray(chars.models)?chars.models.filter(c=>
      r3String(r3TokenModelGet(c,'name'),120).toLowerCase()===name.toLowerCase()):[];
    if(models.length===1)model=models[0];
    else return {reason:'Select a uniquely identified controllable character.'};
  }
  if(!model||!r3TokenControls(model))return {reason:'This character is not verified as controllable by the player.'};
  if(R3_AUTO.characterId&&R3_AUTO.name?.toLowerCase()===name.toLowerCase()&&
    R3_AUTO.characterId!==r3String(model.id||r3TokenModelGet(model,'_id'),120))
    return {reason:'Imported actions belong to another character ID.'};
  const mapped=r3NativeMapAbility(kind,entry,model,snapshot);
  return mapped.abilityName?mapped:(r3NativeDomEvidence(kind,entry,snapshot)||mapped);
}
function r3NativeInvoke(kind,key){
  if(R3_NATIVE.busy)return false;
  const snapshot=R3_UI.snapshot,entry=r3NativeMapSource(kind,key,snapshot);
  if(!entry.name){r3NativeStatus(entry.reason);return false;}
  const name=r3String(snapshot?.name,120);
  const identity=r3NativeBgResolve(name); // validates ownership; NO showDialog
  if(!identity.model){r3NativeStatus(identity.reason||'Character unavailable.');return false;}
  if(R3_TOKEN.active&&
    (R3_TOKEN.active.characterId!==identity.id||
     R3_TOKEN.active.name?.toLowerCase()!==name.toLowerCase())){
    r3NativeStatus('Selected token is not the source character.');return false;
  }
  if(R3_AUTO.characterId&&R3_AUTO.name?.toLowerCase()===name.toLowerCase()&&
    R3_AUTO.characterId!==identity.id){
    r3NativeStatus('Source character identity changed; no native action sent.');return false;
  }
  const mapped=r3NativeMapAbility(kind,entry,identity.model,snapshot);
  if(!mapped.abilityName){
    if(r3NativeDomEvidence(kind,entry,snapshot))return r3NativeDomInvoke(kind,key);
    r3NativeStatus(mapped.reason);return false;
  }
  if(!/^[\w-]{4,120}$/.test(identity.id)){
    r3NativeStatus('Character ID is not a valid native action reference.');return false;
  }
  R3_NATIVE.busy=true;
  try{
    const outcome=r3NativeChatSubmit(mapped.command||'%{'+identity.id+'|'+mapped.abilityName+'}');
    if(!outcome.ok){r3NativeStatus(outcome.reason);return false;}
    r3NativeStatus('Invoked mapped Roll20 '+kind+' action: '+r3String(entry.name,80)+
      '. Verify its native result in chat.');
    return true;
  }finally{R3_NATIVE.busy=false;}
}
function r3NativeMappedPreview(key,snapshot=R3_UI.snapshot){
  const attack=r3NativeSelectAttack(key,snapshot);
  if(!attack||r3String(attack._key,240)!==key)return {reason:'No unique imported attack.'};
  const name=r3String(snapshot?.name,120),active=R3_TOKEN.active;
  const chars=r3TokenCampaign()?.characters;
  if(!chars)return {reason:'Roll20 characters unavailable'};
  let model=null;
  if(active){
    if(active.name?.toLowerCase()!==name.toLowerCase())return {reason:'Different selected character'};
    model=r3TokenCharacter(active.characterId);
  }else{
    const named=Array.isArray(chars.models)?chars.models.filter(c=>
      r3String(r3TokenModelGet(c,'name'),120).toLowerCase()===name.toLowerCase()):[];
    if(named.length===1)model=named[0];
  }
  if(!model||!r3TokenControls(model))return {reason:'No verified controlled character'};
  const mapped=r3NativeMappedAbility(attack,model,snapshot);
  return mapped.abilityName?mapped:(r3NativeDomEvidence('attacks',attack,snapshot)||mapped);
}
function r3NativeMappedAttack(key){
  if(R3_NATIVE.busy)return false;
  const snapshot=R3_UI.snapshot,attack=r3NativeSelectAttack(key,snapshot);
  if(!attack||attack._key!==key){r3NativeStatus('No uniquely identified source attack.');return false;}
  const name=r3String(snapshot?.name,120);
  const identity=r3NativeBgResolve(name); // read-only identity; never showDialog
  if(!identity.model){r3NativeStatus(identity.reason);return false;}
  const active=R3_TOKEN.active;
  if(active&&(active.characterId!==identity.id||active.name?.toLowerCase()!==name.toLowerCase())){
    r3NativeStatus('Selected token differs from the imported attack.');return false;
  }
  if(R3_AUTO.characterId&&R3_AUTO.name?.toLowerCase()===name.toLowerCase()&&
     R3_AUTO.characterId!==identity.id){
    r3NativeStatus('Imported source character does not match this Roll20 character.');return false;
  }
  const mapping=r3NativeMappedAbility(attack,identity.model,snapshot);
  if(!mapping.abilityName){
    if(r3NativeDomEvidence('attacks',attack,snapshot))return r3NativeDomInvoke('attacks',key);
    r3NativeStatus(mapping.reason);return false;
  }
  // Official Roll20 character abilities can be called from text chat even
  // while the 2024 sheet is closed. The ability's original repeating macro
  // determines the correct native attack card, damage button and effects.
  if(!/^[\w-]{4,120}$/.test(identity.id)){
    r3NativeStatus('The native character ID is not a valid Roll20 reference.');return false;
  }
  const command=mapping.command||'%{'+identity.id+'|'+mapping.abilityName+'}';
  R3_NATIVE.busy=true;
  try{
    const result=r3NativeChatSubmit(command);
    if(!result.ok){r3NativeStatus(result.reason);return false;}
    r3NativeStatus('Invoked the mapped Roll20 '+r3String(attack.name,80)+
      ' native ability. Confirm the resulting attack card in chat.');
    return true;
  }finally{R3_NATIVE.busy=false;}
}
function r3NativeChatAttack(key){
  if(R3_NATIVE.busy){r3NativeStatus('Another attack is still processing.');return false;}
  const snapshot=R3_UI.snapshot;
  const attack=r3NativeSelectAttack(key,snapshot);
  const name=r3String(snapshot?.name,120);
  if(!attack||!name||!r3String(attack._key,240)||
     r3String(attack._key,240)!==key){
    r3NativeStatus('Choose an identified attack from the currently imported character.');return false;
  }
  const identity=r3NativeBgResolve(name); // read-only permission lookup; NO showDialog
  if(!identity.model){r3NativeStatus(identity.reason||'The selected character could not be verified.');return false;}
  const active=R3_TOKEN.active;
  if(active&&(active.characterId!==identity.id||active.name.toLowerCase()!==name.toLowerCase())){
    r3NativeStatus('The selected token belongs to another character. Select the matching token before attacking.');return false;
  }
  if(R3_AUTO.name.toLowerCase()===name.toLowerCase()&&R3_AUTO.characterId&&
     R3_AUTO.characterId!==identity.id){
    r3NativeStatus('The imported attacks belong to another character ID. No roll sent.');return false;
  }
  const command=r3NativeChatCommand(attack);
  if(!command){
    r3NativeStatus('No confirmed hit-roll modifier was imported for '+r3String(attack.name,55)+
      '. Nothing was rolled; refresh the source attack data.');return false;
  }
  R3_NATIVE.busy=true;
  try{
    const result=r3NativeChatSubmit(command);
    if(!result.ok){r3NativeStatus(result.reason);return false;}
    r3NativeStatus('Submitted '+r3String(attack.name,75)+
      ' using observed attack and damage dice. Verify its result in Roll20 chat; sheet not required.');
    return true;
  }finally{R3_NATIVE.busy=false;}
}
// This adapter invokes real sheet controls, not reconstructed chat commands.
// Imported evidence makes a button available; live DOM verification authorizes
// the single click. Only observed attack-hit and standard skill controls qualify.
function r3NativeDomEvidence(kind,entry,snapshot){
  if(kind==='attacks'){
    const metric=r3NativeAttackMetric(entry?.visible||'');
    const hits=(Array.isArray(entry?.actions)?entry.actions:[]).filter(action=>
      /^[+-]\d{1,3}\s+Attack$/i.test(r3String(action.label,70).replace(/\u2212/g,'-')));
    if(!metric.bonus||hits.length!==1||
      r3String(hits[0].label,70).replace(/\u2212/g,'-').split(/\s/)[0]!==metric.bonus)return null;
    const matches=(snapshot?.attacks||[]).filter(other=>{
      const m=r3NativeAttackMetric(other.visible||'');
      return r3String(other.name).toLowerCase()===r3String(entry.name).toLowerCase()&&
        m.bonus===metric.bonus&&m.damage===metric.damage;
    });
    if(matches.length!==1)return null;
    return {sheetAction:true,source:'Observed official attack-hit button'};
  }
  if(kind==='skills'&&R3_SKILLS.includes(entry?.name)){
    const label='Roll a '+entry.name+' check';
    if((snapshot?.controls||[]).some(c=>c.kind==='action'&&c.element==='button'&&c.label===label))
      return {sheetAction:true,source:'Observed official skill-check button'};
  }
  if(['spells','features','inventory'].includes(kind)){
    if(!r3NativeCardTab(kind).test(entry?.tab||''))return null;
    const items=Array.isArray(snapshot?.[kind])?snapshot[kind]:[];
    if(items.filter(item=>r3String(item.name,125).toLowerCase()===
      r3String(entry.name,125).toLowerCase()).length!==1)return null;
    const labels=(Array.isArray(entry.actions)?entry.actions:[])
      .map(action=>r3String(action.label,70))
      .filter(label=>r3NativeCardVerb(kind,label,entry.name));
    if(labels.length!==1||!r3String(entry.visible,550))return null;
    return {sheetAction:true,source:'Observed official '+kind+' '+labels[0]+' button'};
  }
  return null;
}
// Never treat Show More, damage, quantity adjustment, equip or detail buttons
// as an executable Cast/Use action. These exact labels are opt-in evidence
// from the source card, not fabricated Advanced Tools command identifiers.
function r3NativeCardVerb(kind,label,name){
  const value=r3String(label,70).toLowerCase();
  const item=r3String(name,125).toLowerCase();
  if(!item||!value)return false;
  const base={
    spells:['cast','cast spell'],
    features:['use','use feature','activate','activate feature'],
    inventory:['use','use item','activate','activate item']
  }[kind]||[];
  const prefix=kind==='spells'?'cast ':kind==='features'?'use ':'use ';
  return base.includes(value)||value===prefix+item||
    (kind!=='spells'&&value==='activate '+item);
}
function r3NativeCardTab(kind){
  return {spells:/^spells$/i,features:/^features\\s*(?:&|and)\\s*traits$/i,
    inventory:/^inventory$/i,attacks:/^combat$/i}[kind]||/^$/;
}
function r3NativeCardControl(kind,name,source={}){
  const target=r3NativeCardTab(kind),tab=r3CurrentTabLabel();
  if(!target.test(tab))return {error:'Open the '+kind+' tab on the official sheet (currently '+r3String(tab,35)+').'};
  const label=r3String(source.actionLabel,70),wanted=r3String(name,125).toLowerCase();
  if(!r3NativeCardVerb(kind,label,name)||!r3String(source.visible,550))
    return {error:'No exact, observed '+kind+' Cast/Use button was authorized.'};
  const selector=R3_CATEGORIES[kind]+(kind==='inventory'?',.item-row':'');
  const all=document.querySelectorAll(selector)||[];
  if(all.length>12000)return {error:'Too many source rows to verify a unique '+kind+' action.'};
  const rows=Array.from(all).filter(row=>r3Shown(row)&&
    r3Name(row,kind).toLowerCase()===wanted);
  // Reject nested copies and duplicates rather than choosing a first match.
  const matches=rows.filter(row=>!rows.some(other=>other!==row&&other.contains?.(row)));
  if(matches.length!==1)return {error:'No unique matching official '+kind+' row for '+r3String(name,60)+'.'};
  const row=matches[0],rowId=r3String(source.nativeRowId,120);
  if(rowId&&r3NativeObservedRowId(row)!==rowId)
    return {error:'Official repeating row identity changed since import.'};
  const actual=r3Text(row,550);
  if(actual!==r3String(source.visible,550))
    return {error:'Official '+kind+' card changed since import. Refresh before using it.'};
  const controls=row.querySelectorAll?.('button')||[];
  if(controls.length>200)return {error:'Too many card buttons to verify one native action.'};
  const found=Array.from(controls).filter(button=>r3Shown(button)&&
    r3String(r3Attr(button,'aria-label')||r3Attr(button,'title')||r3Text(button,70),70)===label);
  if(found.length!==1)return {error:found.length?
    'Multiple matching official '+kind+' action buttons; no click.':
    'No enabled, visible official '+kind+' button matching '+label+'.'};
  return {button:found[0],label,fingerprint:JSON.stringify(
    [kind,wanted,rowId,actual,label])};
}
function r3NativeSkillControl(name){
  if(!R3_SKILLS.includes(name))return {error:'No supported standard skill was selected.'};
  const label='Roll a '+name+' check';
  const nodes=document.querySelectorAll('button')||[];
  if(nodes.length>12000)return {error:'Too many sheet controls to verify a unique skill button.'};
  const matches=Array.from(nodes).filter(button=>r3Shown(button)&&
    (r3Attr(button,'aria-label')||r3Attr(button,'title')||r3Text(button,100))===label);
  if(matches.length!==1)return {error:matches.length?
    'Multiple matching skill controls; no native click.':'No visible official skill-check button for '+name+'.'};
  const button=matches[0];
  return {button,label,fingerprint:JSON.stringify(['skills',name,label,
    r3Text(button.closest?.('.skill'),180)])};
}
function r3NativeDomContext(kind,key){
  const snapshot=R3_UI.snapshot,entry=r3NativeMapSource(kind,key,snapshot);
  if(!entry.name||!r3NativeDomEvidence(kind,entry,snapshot))
    return {reason:'No supported source-observed sheet control. Refresh the character import.'};
  const name=r3String(snapshot.name,120),identity=r3NativeBgResolve(name);
  if(!identity.model)return {reason:identity.reason||'Character ownership is not available.'};
  const active=R3_TOKEN.active;
  if(active&&(active.characterId!==identity.id||active.name?.toLowerCase()!==name.toLowerCase()))
    return {reason:'Selected token differs from the source character.'};
  if(R3_AUTO.characterId&&R3_AUTO.name?.toLowerCase()===name.toLowerCase()&&R3_AUTO.characterId!==identity.id)
    return {reason:'Imported source character identity changed.'};
  return {name,id:identity.id,entry,signature:JSON.stringify([name,identity.id,kind,key,
    entry.name,entry.visible||'',entry.value,entry.actions||[]])};
}
async function r3NativeDomInvoke(kind,key){
  if(R3_NATIVE.busy)return false;
  const initial=r3NativeDomContext(kind,key);
  if(!initial.entry){r3NativeStatus(initial.reason);return false;}
  if(R3_AUTO.running||R3_UI.busy){r3NativeStatus('Character import is running. Retry the roll after it finishes.');return false;}
  const stillCurrent=()=>r3NativeDomContext(kind,key).signature===initial.signature;
  const matchesCharacter=candidate=>{
    const id=r3AutoId(candidate);
    return candidate?.window&&r3NativeCandidate(initial.name)?.window===candidate.window&&
      (id?id===initial.id:r3TokenUnambiguousName(initial.name));
  };
  R3_NATIVE.busy=true;R3_NATIVE.preview=null;
  r3NativeStatus('Checking the official '+kind+' control…');
  try{
    let candidate=r3NativeCandidate(initial.name);
    if(!candidate)candidate=await r3NativeBgEnsure(initial.name);
    if(!stillCurrent()||!matchesCharacter(candidate))throw new Error('Character identity changed while locating the sheet. No roll sent.');
    await r3NativeWaitReader(candidate,initial.name,stillCurrent);
    const readerSession=R3_NATIVE.readers.get(candidate.window)?.session;
    if(!readerSession)throw new Error('No authenticated official sheet reader session.');
    const background=r3NativeIsOwned(candidate);
    const observed=(initial.entry.actions||[]).map(action=>r3String(action.label,70))
      .filter(label=>r3NativeCardVerb(kind,label,initial.entry.name));
    const params={kind,characterName:initial.name,actionName:initial.entry.name,
      actionKey:key,actionText:r3String(initial.entry.visible,550),
      actionLabel:observed.length===1?observed[0]:'',
      actionRowId:r3String(initial.entry.nativeRowId,120),background,readerSession};
    const ready=await r3NativeRequest(candidate,'native-probe',params);
    if(ready.status!=='ready'||typeof ready.token!=='string'){
      r3NativeStatus(ready.message||'No unique official sheet control was found.');return false;
    }
    // Every await above can outlive a token selection, permission change,
    // sheet reload or manual opening. Recheck all before sending one invoke.
    if(!stillCurrent()||!matchesCharacter(candidate)||R3_AUTO.running||R3_UI.busy||
      R3_NATIVE.readers.get(candidate.window)?.session!==readerSession||
      (background&&!r3NativeIsOwned(candidate)))
      throw new Error('Character, source action or sheet ownership changed. No roll sent.');
    const result=await r3NativeRequest(candidate,'native-invoke',{...params,token:ready.token});
    // Invocation is never retried: a missing reply may follow a successful roll.
    r3NativeStatus(result.message||'Official sheet click was not acknowledged. Check chat before retrying.');
    return result.status==='clicked';
  }catch(error){
    r3NativeStatus(r3String(error?.message||error,190)+' Check chat before retrying.');
    return false;
  }finally{R3_NATIVE.busy=false;r3HudRender?.();}
}

function r3NativeAttackControl(name,source={}){
  const tab=r3CurrentTabLabel();
  if(!/^combat$/i.test(tab))
    return {error:'Open Combat on the official sheet (currently '+r3String(tab,35)+').'};
  const wanted=r3String(name,125).toLowerCase();
  if(!wanted)return {error:'A named attack is required.'};
  const rowNodes=document.querySelectorAll(
    R3_CATEGORIES.attacks+',.item-row,[data-testid*="item-row"]')||[];
  if(rowNodes.length>12000)return {error:'Too many rows to verify a unique native attack.'};
  const rows=Array.from(rowNodes).filter(r3Shown);
  const found=rows.filter(row=>r3Name(row,'attacks').toLowerCase()===wanted);
  const titleNodes=document.querySelectorAll(
    '.span--item-row-title,.attack-item__title-chat,.attack-item__title-col,'+
    '[data-testid*="attack-name"]')||[];
  if(titleNodes.length>12000)return {error:'Too many titles to verify a unique native attack.'};
  const titles=Array.from(titleNodes).filter(r3Shown)
    .filter(el=>r3Text(el,125).toLowerCase()===wanted);
  for(const el of titles){
    const row=r3InventoryRowFor(el);
    if(row&&r3Shown(row)&&!found.includes(row))found.push(row);
  }
  // Keep the highest complete single-title row, never a nested copy.
  let candidates=found.filter(row=>!found.some(other=>other!==row&&
    other.contains?.(row)));
  const expected=r3NativeAttackMetric(source.visible||'');
  if(candidates.length>1){
    // A same-name row without explicit differentiating evidence is unsafe.
    if(!expected.bonus&&!expected.damage)
      return {error:'Multiple "'+r3String(name,45)+
        '" attack rows. Re-import the official Combat tab to identify each variant.'};
    candidates=candidates.filter(row=>{
      const actual=r3NativeAttackMetric(r3Text(row,650));
      return (!expected.bonus||actual.bonus===expected.bonus)&&
        (!expected.damage||actual.damage===expected.damage);
    });
  }
  if(candidates.length!==1)return {error:candidates.length?
    'Multiple indistinguishable "'+r3String(name,45)+
      '" attack rows. No native click.':
    'No unique matching "'+r3String(name,45)+'" attack row on Combat. '+
      'Visible named rows: '+found.length+', matching name titles: '+titles.length+'.'};
  const row=candidates[0],actual=r3NativeAttackMetric(r3Text(row,650));
  // If a selected imported attack has specific metrics and the sole current
  // sheet row has different metrics, refuse rather than click the wrong build.
  if((expected.bonus&&actual.bonus!==expected.bonus)||
     (expected.damage&&actual.damage!==expected.damage))
    return {error:'The named attack changed since import. Refresh the Combat data before rolling.'};
  const buttonNodes=row.querySelectorAll?.(
    'button,[role="button"],[data-sheet-action="attack"],[data-action="attack"]')||[];
  if(buttonNodes.length>300)return {error:'Too many row controls to verify a unique native attack.'};
  const buttons=Array.from(buttonNodes).filter(r3Shown);
  const roll=buttons.map(button=>{
    const label=r3String(r3Attr(button,'aria-label')||
      r3Attr(button,'title')||r3Text(button,70),70).replace(/\u2212/g,'-');
    const action=r3Attr(button,'data-sheet-action')||
      r3Attr(button,'data-action');
    const testId=r3Attr(button,'data-testid');
    const rollName=r3Attr(button,'name');
    // Real D&D 2024 markup shows "+7 Attack" adjacent to "1d6+4".
    // The numeric Attack button is a hit roll. The die button is DAMAGE
    // and must never be used to satisfy the hit-roll probe.
    const numericAttack=/^[+-]\d{1,3}\s*Attack$/i.test(label);
    const explicitlyLabeled=/^(?:roll\s+(?:attack|to\s+hit|attack\s+roll)|attack\s+roll|roll\s+to\s+hit)$/i.test(label);
    const explicitAction=action==='attack'||/^(?:roll[-_]?attack|attack[-_]?roll)$/i.test(testId)||
      (r3Attr(button,'type')==='roll'&&/^roll_attack(?:_|$)/i.test(rollName));
    return {button,label,valid:numericAttack||explicitlyLabeled||explicitAction};
  }).filter(x=>x.valid);
  if(roll.length!==1){
    const labels=buttons.map(b=>r3String(
      r3Attr(b,'aria-label')||r3Attr(b,'title')||r3Text(b,30),30)).filter(Boolean).slice(0,5);
    return {error:roll.length?'Multiple attack-roll buttons; no click performed.':
      'Matched the attack row but found no verified attack-roll button. Labels: '+
      (labels.join(', ')||'(unlabeled)')+'.'};
  }
  const label=roll[0].label||'Native attack roll';
  // Use the row's observed metrics to bind probe and later confirmation,
  // preventing a same-name attack switching to a different roll mid-request.
  const fingerprint=wanted+'|'+actual.bonus+'|'+actual.damage+'|'+label;
  return {button:roll[0].button,label,fingerprint};
}
async function r3NativeReaderHandle(peer,data){
  if(!['native-probe','native-invoke'].includes(data?.type)||
      typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  const respond=(status,message,extras={})=>{
    peer.postMessage(r3Msg('native-result',{id:data.id,status,
      message:r3String(message,240),session:R3_SESSION,...extras}),R3_EDITOR);
  };
  const characterName=r3String(data.characterName,120);
  const kind=data.kind;
  const attackName=r3String(data.actionName??data.attackName,125);
  const attackKey=r3String(data.actionKey??data.attackKey,240);
  const attackText=r3String(data.actionText??data.attackText,550);
  const actionLabel=r3String(data.actionLabel,70),actionRowId=r3String(data.actionRowId,120);
  if(data.readerSession&&data.readerSession!==R3_SESSION){
    respond('blocked','Official reader session changed. Refresh the sheet connection.');return;
  }
  const findControl=()=>kind==='skills'?r3NativeSkillControl(attackName):
    kind==='attacks'?r3NativeAttackControl(attackName,{visible:attackText}):
    r3NativeCardControl(kind,attackName,{visible:attackText,
      actionLabel,nativeRowId:actionRowId});
  // The character identity and attack name are intentionally separate.
  // Characters across games do not share a fixed name or fixed attack list.
  if(!['attacks','skills','spells','features','inventory'].includes(kind)||!characterName||!attackName||
    characterName.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
    respond('blocked','This action does not belong to the open character sheet.');return;
  }
  // Only HUD-owned or Auto-sync-owned hidden sheets may have their tabs
  // switched automatically. A player-opened sheet is never navigated.
  const targetTab=kind==='skills'?null:r3NativeCardTab(kind);
  const targetName={attacks:'Combat',spells:'Spells',features:'Features & Traits',
    inventory:'Inventory'}[kind];
  if(targetTab&&data.type==='native-probe'&&data.background===true&&
      !targetTab.test(r3CurrentTabLabel())){
    // Only the privately owned reader may navigate. A player's open sheet
    // stays untouched even when it is on a different tab.
    let selected=null;
    for(let attempt=0;attempt<7&&!selected;attempt++){
      selected=r3Tabs().find(tab=>targetTab.test(r3TabLabel(tab)));
      if(!selected&&attempt<6)await r3Pause(200);
    }
    if(!selected||!r3Shown(selected)){
      respond('blocked','Background sheet did not expose '+targetName+' after rechecking.');return;
    }
    selected.click();
    for(let attempt=0;attempt<7&&!targetTab.test(r3CurrentTabLabel());attempt++)
      await r3Pause(200);
    if(!targetTab.test(r3CurrentTabLabel())){
      respond('blocked','Background '+targetName+' tab did not activate after rechecking.');return;
    }
  }
  if(characterName.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
    respond('blocked','Official character identity changed during preparation.');return;
  }
  if(data.type==='native-probe'){
    let found=findControl();
    // A named attack row can mount before the official +N Attack button.
    // Retry DOM inspection only for missing rows/controls in an owned sheet.
    if(data.background===true){
      for(let attempt=0;attempt<7&&!found.button&&
          /^(?:No unique matching |Matched the attack row but found no verified)/.test(found.error||'');attempt++){
        await r3Pause(250);
        if(characterName.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
          respond('blocked','Background character identity changed while checking the roll.');return;
        }
        found=findControl();
      }
    }
    if(!found.button){respond('blocked',found.error);return;}
    if(R3_NATIVE.tokens.size>=8)R3_NATIVE.tokens.clear();
    const token=(crypto.randomUUID?.()||('native-'+Date.now()+'-'+Math.random())).slice(0,100);
    R3_NATIVE.tokens.set(token,{kind,characterName,attackName,attackKey,attackText,
      actionLabel,actionRowId,label:found.label,fingerprint:found.fingerprint,
      peer,until:Date.now()+15000});
    respond('ready','A single native roll control was found. Confirm to click it once.',
      {token,label:found.label});return;
  }
  const token=r3String(data.token,100),record=R3_NATIVE.tokens.get(token);
  if(!record||record.kind!==kind||record.peer!==peer||record.until<Date.now()||
     record.characterName.toLowerCase()!==characterName.toLowerCase()||
     record.attackName.toLowerCase()!==attackName.toLowerCase()||
     record.attackKey!==attackKey||record.attackText!==attackText||
     record.actionLabel!==actionLabel||record.actionRowId!==actionRowId){
    respond('blocked','Native action confirmation expired. Inspect the roll again.');return;
  }
  R3_NATIVE.tokens.delete(token);
  const found=findControl();
  if(!found.button||found.label!==record.label||
     found.fingerprint!==record.fingerprint){
    respond('blocked','The native roll control changed. No click was performed.');return;
  }
  try{
    found.button.click();
    respond('clicked','Clicked the official Roll20 roll button once; check chat for the result.');
  }catch{
    respond('blocked','The official Roll20 roll control could not be clicked.');
  }
}

// Own a separate editor dialog only if it did not exist before our
// request. An already-open player/GM sheet is never hidden, repositioned,
// clicked through, reparented, closed or navigated by this helper.
const R3_NATIVE_BG={characterId:'',name:'',dialog:null,frame:null,moved:null,
  original:null,dialogOriginal:null,overlay:null,overlayOriginal:null,preOverlays:null,opening:null,sessions:new Map(),abortEpoch:0};
function r3NativeBgResolve(name){
  const wanted=r3String(name,120).trim().toLowerCase();
  if(!wanted)return {reason:'No imported character name is available in the HUD.'};
  const chars=r3TokenCampaign()?.characters;
  if(!chars)return {reason:'Jumpgate has not exposed window.Campaign.characters. Confirm the tabletop finished loading and select your character token.'};
  const player=r3TokenPlayerId();
  if(!player)return {reason:'Roll20 did not expose the logged-in player identity. Reload the editor and retry.'};
  const named=Array.isArray(chars.models)?chars.models.filter(model=>
    r3String(r3TokenModelGet(model,'name'),120).toLowerCase()===wanted):[];
  const selectedIds=r3TokenSelected().map(object=>{
    const model=object?.model||object;
    return r3String(r3TokenModelGet(model,'represents')||
      r3TokenModelGet(model,'_represents'),110);
  }).filter(Boolean);
  const selectedMatches=[...new Set(selectedIds)].map(id=>r3TokenCharacter(id))
    .filter(model=>r3String(r3TokenModelGet(model,'name'),120).toLowerCase()===wanted);
  // Prefer an explicitly selected matching character when available. The
  // HUD's previous active token is a fallback, never a permission bypass.
  const active=R3_TOKEN.active;
  const fromActive=active?.name.toLowerCase()===wanted?
    r3TokenCharacter(active.characterId):null;
  let model=null;
  if(selectedMatches.length===1)model=selectedMatches[0];
  else if(selectedMatches.length>1)
    return {reason:'Several selected tokens represent same-named characters. Select one token to choose its sheet.'};
  else if(fromActive&&r3String(r3TokenModelGet(fromActive,'name'),120).toLowerCase()===wanted)
    model=fromActive;
  else if(named.length===1)model=named[0];
  else if(named.length>1)
    return {reason:'Multiple Roll20 characters share this name. Select the linked token for the intended character.'};
  if(!model)return {reason:selectedIds.length?
    'The selected token is not linked to the imported HUD character. Select its matching linked token.':
    'Roll20 has no unique matching character model. Select a token linked to your imported sheet.'};
  const id=r3String(model.id||r3TokenModelGet(model,'_id'),110);
  if(!id)return {reason:'Roll20 character model has no stable character ID. No background sheet was opened.'};
  if(!r3TokenControls(model,player))
    return {reason:'Roll20 does not show this character as controlled by the logged-in player. Check Character > Edit > Controlled By.'};
  return {model,id,name:r3String(r3TokenModelGet(model,'name'),120)};
}
function r3NativeBgCharacter(name){
  const resolved=r3NativeBgResolve(name);
  return resolved?.model?resolved:null;
}
function r3NativeBgRemember(){
  const bg=R3_NATIVE_BG;
  if(bg.dialog&&bg.characterId)
    bg.sessions.set(bg.characterId,{characterId:bg.characterId,name:bg.name,
      dialog:bg.dialog,moved:bg.moved,original:bg.original,dialogOriginal:bg.dialogOriginal,
      overlay:bg.overlay,overlayOriginal:bg.overlayOriginal,preOverlays:bg.preOverlays});
}
function r3NativeBgActivate(record){Object.assign(R3_NATIVE_BG,record);}
function r3NativeBgClearActive(){
  const bg=R3_NATIVE_BG;
  bg.dialog=null;bg.moved=null;bg.original=null;bg.dialogOriginal=null;
  bg.overlay=null;bg.overlayOriginal=null;bg.preOverlays=null;bg.characterId='';bg.name='';
}
function r3NativeBgDialogId(dialog){
  return r3String(dialog?.getAttribute?.('data-characterid')||
    dialog?.closest?.('[data-characterid]')?.getAttribute?.('data-characterid'),110);
}
function r3NativeBgCandidate(){
  const owned=R3_NATIVE_BG.dialog;
  if(!owned||!owned.isConnected&&owned.isConnected!==undefined)return null;
  // Roll20 can append a modal overlay after the iframe mounts. Keep the
  // owned session's exclusive overlay shield current during reader polling.
  if(R3_NATIVE_BG.preOverlays)r3NativeBgShieldOverlay(R3_NATIVE_BG.preOverlays);
  return r3Candidates().find(c=>c.type==='iframe'&&c.visible&&c.window&&
    (c.frame?.closest?.('.characterdialog')===owned||
      owned.contains?.(c.frame))&&r3AutoId(c)===R3_NATIVE_BG.characterId)||null;
}
function r3NativeBgRestore(){
  const bg=R3_NATIVE_BG;
  if(bg.moved?.style&&bg.original){
    r3PrivateUnmark(bg.moved,'data-r3-private-reader');
    if(bg.dialog!==bg.moved)r3PrivateUnmark(bg.dialog,'data-r3-private-reader');
    for(const key of ['position','left','top','opacity','pointerEvents'])
      bg.moved.style[key]=bg.original[key];
    if(bg.dialog!==bg.moved&&bg.dialog?.style&&bg.dialogOriginal)
      for(const key of ['position','left','top','opacity'])
        bg.dialog.style[key]=bg.dialogOriginal[key];
  }
  if(bg.overlay?.style&&bg.overlayOriginal){
    r3PrivateUnmark(bg.overlay,'data-r3-private-overlay');
    bg.overlay.style.opacity=bg.overlayOriginal.opacity;
    bg.overlay.style.pointerEvents=bg.overlayOriginal.pointerEvents;
  }
  bg.sessions.delete(bg.characterId);
  r3NativeBgClearActive();
}
// A user can reopen any original sheet, not only the most recently selected
// HUD reader. Release all of our saved sessions and their modal shields.
function r3NativeBgRestoreAll(){
  const bg=R3_NATIVE_BG;
  // Invalidate a pending showDialog() before it can capture a player's sheet.
  bg.abortEpoch++;
  const records=[...bg.sessions.values()];
  if(bg.dialog&&!records.some(record=>record.dialog===bg.dialog))
    records.push({characterId:bg.characterId,name:bg.name,dialog:bg.dialog,
      moved:bg.moved,original:bg.original,dialogOriginal:bg.dialogOriginal,
      overlay:bg.overlay,overlayOriginal:bg.overlayOriginal,
      preOverlays:bg.preOverlays});
  for(const record of records){
    r3NativeBgActivate(record);
    r3NativeBgRestore();
  }
  bg.sessions.clear();
  r3NativeBgClearActive();
  R3_NATIVE.preview=null;
}
function r3NativeBgShieldOverlay(beforeOverlays){
  const bg=R3_NATIVE_BG;
  if(!bg.dialog||bg.overlay)return;
  const added=Array.from(document.querySelectorAll('.ui-widget-overlay')||[])
    .filter(el=>!beforeOverlays.has(el));
  // Never alter an overlay belonging to a player-opened dialog.
  if(added.length!==1)return;
  const overlay=added[0],style=overlay.style||{};
  bg.overlay=overlay;
  bg.overlayOriginal={opacity:style.opacity,pointerEvents:style.pointerEvents};
  r3PrivateMark(overlay,'data-r3-private-overlay');
  r3NativeBgRemember();
}
// Persistent, identity-scoped CSS resists Roll20 jQuery dialog recentering.
// Opacity preserves the official Vue DOM, unlike display:none.
function r3PrivateStyle(){
  if(!document.head?.appendChild||document.getElementById?.('r3-private-sheet-style'))return;
  const el=document.createElement('style');el.id='r3-private-sheet-style';
  el.textContent='[data-r3-private-reader]{position:fixed!important;left:-20000px!important;top:-20000px!important;transform:translate(-20000px,-20000px)!important;opacity:0!important;}'+
    '[data-r3-private-overlay]{opacity:0!important;pointer-events:none!important;}';
  document.head.appendChild(el);
}
function r3PrivateMark(el,attr){
  if(!el)return;
  r3PrivateStyle();
  el.setAttribute?.(attr,'');
  if(attr==='data-r3-private-reader'&&el.style){
    el.style.position='fixed';el.style.left='-20000px';
    el.style.top='-20000px';el.style.opacity='0';
  }
  if(attr==='data-r3-private-overlay'&&el.style){
    el.style.opacity='0';el.style.pointerEvents='none';
  }
}
function r3PrivateUnmark(el,attr){el?.removeAttribute?.(attr);}
function r3NativeBgClaim(before,beforeOverlays,identity){
  const added=Array.from(document.querySelectorAll('.characterdialog')||[])
    .filter(el=>!before.has(el)&&r3NativeBgDialogId(el)===identity.id);
  if(added.length!==1)return false;
  const dialog=added[0],container=dialog.closest?.('.ui-dialog')||dialog;
  R3_NATIVE_BG.characterId=identity.id;
  R3_NATIVE_BG.name=identity.name;
  R3_NATIVE_BG.dialog=dialog;R3_NATIVE_BG.moved=container;
  const style=container.style||{};
  R3_NATIVE_BG.original={position:style.position,left:style.left,top:style.top,
    opacity:style.opacity,pointerEvents:style.pointerEvents};
  R3_NATIVE_BG.dialogOriginal=dialog!==container?{
    position:dialog.style?.position,left:dialog.style?.left,
    top:dialog.style?.top,opacity:dialog.style?.opacity}:null;
  // Shield wrapper and inner dialog in case Roll20 reparents its modal.
  // Do not disable pointer events on the sheet: fallback close must work.
  r3PrivateMark(container,'data-r3-private-reader');
  if(dialog!==container)r3PrivateMark(dialog,'data-r3-private-reader');
  r3NativeBgShieldOverlay(beforeOverlays);
  r3NativeBgRemember();
  return true;
}
function r3NativeBgJournal(identity){
  const entries=Array.from(document.querySelectorAll(
    '#journal [data-characterid],#journal [data-itemid],'+
    '.journalitem[data-characterid],.journalitem[data-itemid]')||[]).slice(0,500);
  const exact=entries.filter(el=>[
    el.getAttribute?.('data-characterid'),el.getAttribute?.('data-itemid')
  ].includes(identity.id));
  return exact.length===1?exact[0]:null;
}
async function r3NativeBgOpen(name){
  const bg=R3_NATIVE_BG;
  if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())
    throw new Error('Your original Roll20 character sheet takes priority. Open it from the Journal or use its popout; R20eb will read it without hiding it.');
  const resolution=r3NativeBgResolve(name);
  if(!resolution.model)throw new Error(resolution.reason||
    'Unable to verify a player-controlled character for the background sheet.');
  const identity=resolution;
  if(bg.dialog&&bg.characterId===identity.id){
    const c=r3NativeBgCandidate();
    if(c)return c;
  }
  // Avoid launching a second sheet while Roll20 already has a dialog for
  // that character. showDialog() might focus a manual dialog instead.
  const existing=Array.from(document.querySelectorAll('.characterdialog')||[]);
  if(existing.some(el=>r3NativeBgDialogId(el)===identity.id&&
      el!==bg.dialog&&el!==bg.sessions.get(identity.id)?.dialog))
    throw new Error('That sheet is already open. Switch its Combat tab or close it before background mode.');
  if(bg.dialog&&bg.characterId!==identity.id){
    r3NativeBgRemember();
    r3NativeBgClearActive();
  }
  const prior=bg.sessions.get(identity.id);
  if(prior?.dialog){
    r3NativeBgActivate(prior);
    const candidate=r3NativeBgCandidate();
    if(candidate)return candidate;
    bg.sessions.delete(identity.id);r3NativeBgClearActive();
  }
  if(bg.sessions.size>=6)
    throw new Error('Too many HUD-owned background sheets. Reload Roll20 to clear old sessions.');
  const epoch=bg.abortEpoch;
  const before=new Set(existing),overlays=new Set(
    document.querySelectorAll('.ui-widget-overlay')||[]);
  bg.preOverlays=overlays;
  // Start observing BEFORE showDialog. Mutations are processed before paint,
  // including the common case where the character ID arrives after the shell.
  // Only a newly created dialog with this authorized character ID can be moved.
  const shield=()=>{
    if(bg.abortEpoch!==epoch)return;
    if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())return;
    if(!bg.dialog)r3NativeBgClaim(before,overlays,identity);
    if(bg.dialog&&bg.characterId===identity.id)r3NativeBgShieldOverlay(overlays);
  };
  const observer=typeof MutationObserver==='function'?new MutationObserver(shield):null;
  try{
    observer?.observe(document.documentElement||document,{
      childList:true,subtree:true,attributes:true,attributeFilter:['data-characterid']
    });
    const open=identity.model?.view?.showDialog;
    if(typeof open==='function')open.call(identity.model.view);
    else{
      const row=r3NativeBgJournal(identity);
      if(!row)throw new Error('Roll20 did not expose a background sheet opener. Open the Journal once to load the character.');
      row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
    }
    shield(); // synchronous opening can create the dialog immediately
    for(let i=0;i<36;i++){
      if(bg.abortEpoch!==epoch)
        throw new Error('Player opened the original sheet while private reader was loading.');
      if(typeof r3SheetAllowsBackground==='function'&&!r3SheetAllowsBackground())
        throw new Error('Player requested the original character sheet. The hidden reader was released.');
      shield(); // fallback for browsers without MutationObserver
      if(bg.dialog){
        const candidate=r3NativeBgCandidate();
        if(candidate)return candidate;
      }
      await r3Pause(150);
    }
    throw new Error('Roll20 did not create an authenticated sheet frame. No existing character sheet was changed.');
  }finally{
    observer?.disconnect();
  }
}
async function r3NativeBgEnsure(name){
  if(R3_NATIVE_BG.opening)return R3_NATIVE_BG.opening;
  const task=r3NativeBgOpen(name);
  R3_NATIVE_BG.opening=task;
  try{return await task;}
  finally{if(R3_NATIVE_BG.opening===task)R3_NATIVE_BG.opening=null;}
}

function r3NativeIsOwned(candidate){
  const owned=r3NativeBgCandidate();
  // Candidate descriptors are rebuilt on every DOM scan. Compare the
  // authenticated window reference rather than ephemeral object identity.
  return !!candidate&&!!(
    (owned&&candidate.window===owned.window)||
    (R3_AUTO.ownedDialog&&r3AutoDialogFor(candidate)===R3_AUTO.ownedDialog)
  );
}
function r3NativeCandidate(name){
  // Select exactly one authenticated official sheet with the same character
  // identity; prefer a unique popout. Disallow conflicting IDs.
  const normalized=r3String(name,120).toLowerCase();
  if(!normalized)return null;
  // Auto-sync's pinned ID applies only to the same character. Never lock
  // someone else's imported character to a previous character's ID.
  const pinned=R3_AUTO.name.toLowerCase()===normalized?R3_AUTO.characterId:'';
  const identity=r3NativeBgCharacter(name);
  if(identity&&R3_NATIVE_BG.characterId!==identity.id){
    const prior=R3_NATIVE_BG.sessions.get(identity.id);
    if(prior?.dialog){
      r3NativeBgRemember();
      r3NativeBgActivate(prior);
    }
  }
  const owned=r3NativeBgCandidate();
  if(owned&&R3_NATIVE_BG.name.toLowerCase()===normalized)return owned;
  const linked=R3_TOKEN.active?.name.toLowerCase()===normalized?R3_TOKEN.active:null;
  const selectedId=linked?.characterId||'';
  const ambiguous=!r3TokenUnambiguousName(name);
  const eligible=r3Candidates().filter(c=>{
    if(!c.visible||!c.window||
       r3String(c.name,120).toLowerCase()!==normalized)return false;
    const id=r3AutoId(c);
    if(pinned&&id&&id!==pinned)return false;
    if(selectedId&&id&&id!==selectedId)return false;
    // Two identically named campaign PCs cannot share a nameless popout.
    if(ambiguous&&(!selectedId||id!==selectedId))return false;
    return true;
  });
  const popouts=eligible.filter(c=>c.type==='popout');
  if(popouts.length>1)return null;
  if(popouts.length===1)return popouts[0];
  return eligible.length===1?eligible[0]:null;
}
// A new iframe exists before the official userscript starts listening.
// Do not send the first attack until it has answered an authenticated hello.
function r3NativeReaderAnnounce(event,data,candidate){
  if(!candidate||typeof data.session!=='string'||
      !/^[\w.:-]{6,100}$/.test(data.session))return;
  const name=r3String(data.name,120);
  if(name)R3_NATIVE.readers.set(event.source,{name,session:data.session});
}
async function r3NativeWaitReader(candidate,characterName,isCurrent=()=>true){
  if(!candidate?.window)throw new Error('No official character sheet reader exists.');
  const wanted=r3String(characterName,120).toLowerCase();
  for(let i=0;i<64;i++){
    if(!isCurrent())throw new Error('Selected character or attack changed while the sheet loaded.');
    if(r3NativeCandidate(characterName)?.window!==candidate.window)
      throw new Error('The official sheet window changed while loading.');
    const ready=R3_NATIVE.readers.get(candidate.window);
    if(ready?.name.toLowerCase()===wanted)return;
    if(ready?.name&&!/^(?:unnamed sheet|official sheet popout|2024 character sheet)/i.test(ready.name))
      throw new Error('Official reader identity does not match the selected character.');
    if(i%2===0){
      try{candidate.window.postMessage(r3Msg('hello'),R3_ORIGIN);}catch{}
    }
    await r3Pause(250);
  }
  throw new Error('Official character sheet did not finish initializing. Check Tampermonkey permissions for its domain.');
}
function r3NativeRequest(candidate,type,params={}){
  return new Promise((resolve,reject)=>{
    if(!candidate?.window){reject(new Error('No unique matching official sheet is open.'));return;}
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-native-'+(++r3Counter);
    const timeout=setTimeout(()=>{
      R3_NATIVE.pending.delete(id);
      reject(new Error('The official sheet did not answer the native action request.'));
    },type==='native-probe'&&params.background?10000:4000);
    R3_NATIVE.pending.set(id,{window:candidate.window,session:params.readerSession||'',resolve,reject,timeout});
    try{candidate.window.postMessage(r3Msg(type,{id,kind:'attacks',...params}),R3_ORIGIN);}
    catch(e){clearTimeout(timeout);R3_NATIVE.pending.delete(id);reject(e);}
  });
}
// An authenticated Vue reader can answer before its Combat items have
// finished mounting. Keep the same user's first Find action pending while
// the specific official attack row/button becomes available. Never roll here.
async function r3NativeProbeReady(candidate,params,stillCurrent=()=>true){
  let latest;
  for(let attempt=0;attempt<6;attempt++){
    if(!stillCurrent())throw new Error('Selected character or attack changed while waiting for Roll20.');
    try{
      latest=await r3NativeRequest(candidate,'native-probe',params);
    }catch(error){
      // Bridge startup race: retry a missing reply only on a proven
      // script-owned reader. Never silently retry a native-invoke click.
      if(!params.background||attempt>=2||
          !/did not answer the native action request/i.test(error?.message||''))throw error;
      await r3Pause(650);
      continue;
    }
    if(latest.status==='ready'||!params.background)return latest;
    if(!/^(?:No unique matching |Matched the attack row but found no verified|Background sheet did not expose Combat|Background Combat tab did not activate)/.test(latest.message||''))
      return latest;
    if(attempt<5){
      r3NativeStatus('Waiting for the official Combat attack button to mount…');
      await r3Pause(650);
    }
  }
  return latest||{status:'blocked',message:'The official attack control did not become available.'};
}
function r3NativeResult(event,data){
  const request=R3_NATIVE.pending.get(data?.id);
  if(!request||request.window!==event.source||
    (request.session&&request.session!==data.session))return;
  if(data.status!=='ready'&&data.status!=='blocked'&&data.status!=='clicked')return;
  clearTimeout(request.timeout);R3_NATIVE.pending.delete(data.id);
  request.resolve(data);
}
// Resolve the exact imported attack card by its captured identity. Legacy
// callers passing a name are accepted only when that name is unambiguous.
function r3NativeSelectAttack(input,snapshot=R3_UI.snapshot){
  const items=Array.isArray(snapshot?.attacks)?snapshot.attacks:[];
  const key=items.filter(x=>x._key===input&&x._key);
  if(key.length===1)return key[0];
  const named=items.filter(x=>x.name===input);
  return named.length===1?named[0]:null;
}
// The explicit Attack button may request a single verified Roll20 roll
// directly. The legacy Find/Confirm path remains for manual diagnostics.
async function r3NativeProbe(name,invokeOnVerified=false){
  if(R3_NATIVE.busy)return;
  R3_NATIVE.preview=null;
  const snap=R3_UI.snapshot;
  const chosen=r3NativeSelectAttack(name,snap);
  if(!chosen||!snap?.name){
    r3NativeStatus('Choose a unique attack from the imported character.');return;
  }
  const attackName=r3String(chosen.name,125);
  const attackKey=r3String(chosen._key,240);
  const attackText=r3String(chosen.visible,550);
  const characterName=r3String(snap.name,120);
  const characterId=R3_TOKEN.active?.name.toLowerCase()===characterName.toLowerCase()?
    R3_TOKEN.active.characterId:'';
  R3_NATIVE.busy=true;
  let verifiedForInvocation=false;
  r3NativeStatus('Locating a private character-sheet reader…');
  try{
    let candidate=r3NativeCandidate(characterName),openedNow=false;
    if(!candidate){
      r3NativeStatus('Opening a HUD-owned background sheet for '+characterName+'…');
      candidate=await r3NativeBgEnsure(characterName);
      openedNow=true;
    }
    const stillCurrent=()=>r3String(R3_UI.snapshot?.name,120)===characterName&&
      (!characterId||R3_TOKEN.active?.characterId===characterId)&&
      r3NativeSelectAttack(attackKey||attackName)?._key===chosen._key;
    if(!stillCurrent())
      throw new Error('Selected character or attack changed. No roll requested.');
    if(openedNow){
      r3NativeStatus('Waiting for '+characterName+' official sheet to initialize…');
      await r3NativeWaitReader(candidate,characterName,stillCurrent);
    }
    let background=r3NativeIsOwned(candidate);
    if(background&&R3_AUTO.running)
      throw new Error('Background import is using the character sheet. Retry the attack shortly.');
    let result=await r3NativeProbeReady(candidate,
      {characterName,attackName,attackKey,attackText,background},stillCurrent);
    // Never change a player-opened sheet's selected tab. If it is not on
    // Combat, try a separate script-created reader. Its tab may be changed.
    if(!background&&result.status==='blocked'&&
        /^Open Combat on the official sheet/i.test(result.message||'')){
      r3NativeStatus('Opening a separate background Combat sheet…');
      candidate=await r3NativeBgEnsure(characterName);
      background=r3NativeIsOwned(candidate);
      result=await r3NativeProbeReady(candidate,
        {characterName,attackName,attackKey,attackText,background},stillCurrent);
    }
    if(result.status==='ready'&&typeof result.token==='string'&&
       r3String(R3_UI.snapshot?.name,120)===characterName&&
       (!characterId||R3_TOKEN.active?.characterId===characterId)&&
       r3NativeSelectAttack(attackKey||attackName)?._key===chosen._key){
      R3_NATIVE.preview={characterName,characterId,attackName,attackKey,attackText,
        token:result.token,window:candidate.window,label:result.label,background};
      verifiedForInvocation=invokeOnVerified===true;
      r3NativeStatus('Roll20 shows '+r3String(result.label,65)+
        ' for '+attackName+(verifiedForInvocation?'. Sending your requested attack once…':
          '. Confirm to click once.'));
    }else r3NativeStatus(result.message||'No verified native roll button was found.');
  }catch(e){r3NativeStatus(e.message||'Background roll preparation failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
  // This is the continuation of the one explicit player click, not an
  // automatic game action. Revalidate identity and the one-time probe token
  // in r3NativeConfirm + the official-sheet native-invoke handler.
  if(verifiedForInvocation)await r3NativeConfirm();
}
async function r3NativeConfirm(){
  const preview=R3_NATIVE.preview;
  if(!preview||R3_NATIVE.busy)return;
  R3_NATIVE.preview=null; // one-time user confirmation, no double-click
  const characterName=r3String(R3_UI.snapshot?.name,120);
  const selected=r3NativeSelectAttack(preview.attackKey||preview.attackName);
  const candidate=r3NativeCandidate(characterName);
  if(characterName.toLowerCase()!==preview.characterName.toLowerCase()||
     (preview.characterId&&R3_TOKEN.active?.characterId!==preview.characterId)||
     !selected||selected.name!==preview.attackName||
     r3String(selected.visible,550)!==preview.attackText||
     !candidate||candidate.window!==preview.window){
    r3NativeStatus('The official sheet changed. Inspect the roll again.');return;
  }
  R3_NATIVE.busy=true;r3NativeStatus('Requesting one native Roll20 click…');
  try{
    const response=await r3NativeRequest(candidate,'native-invoke',
      {characterName,attackName:preview.attackName,attackKey:preview.attackKey,
        attackText:preview.attackText,token:preview.token,background:!!preview.background});
    r3NativeStatus(response.message||'No native action result returned.');
    if(response.status==='clicked'&&typeof r3TurnHint==='function')
      r3TurnHint('Roll20 attack button clicked; chat roll unverified. Mark action spent only when confirmed.');
  }catch(e){r3NativeStatus(e.message||'Native roll request failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
}
function r3NativeCancel(){R3_NATIVE.preview=null;r3NativeStatus('Native roll cancelled; nothing was clicked.');}
function r3NativeBgReveal(){
  if(typeof r3SheetRevealAll==='function')return r3SheetRevealAll();
  r3NativeBgRestoreAll();
  r3AutoRestoreDialog();
  r3NativeStatus('Your Roll20 character sheets are visible again and can be closed normally.');
}
function r3NativeMarkup(){
  if(!R3_NATIVE.status&&!R3_NATIVE.preview&&!R3_NATIVE_BG.dialog)return '';
  return '<section class="hud-native-status" role="status">'+
    '<span>'+r3Escape(R3_NATIVE.status)+'</span>'+
    (R3_NATIVE.preview?'<button type="button" id="r3-hud-native-confirm">Confirm native roll</button>'+
      '<button type="button" id="r3-hud-native-cancel">Cancel</button>':'')+
    (R3_NATIVE_BG.dialog?'<button type="button" id="r3-hud-native-reveal">Show original sheet</button>':'')+
    '</section>';
}

