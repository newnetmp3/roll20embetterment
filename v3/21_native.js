// Two-step Roll20-native attack pilot. No macros, fabricated dice,
// automatic spell casts, resource spends or token movement.
// Source scan must find one real visible official-sheet "Roll Attack"
// control before a user can explicitly confirm a single native click.
const R3_NATIVE={pending:new Map(),tokens:new Map(),preview:null,busy:false,status:'',revision:0};
function r3NativeStatus(message){
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
function r3NativeAttackControl(name,source={}){
  const tab=r3CurrentTabLabel();
  if(!/^combat$/i.test(tab))
    return {error:'Open Combat on the official sheet (currently '+r3String(tab,35)+').'};
  const wanted=r3String(name,125).toLowerCase();
  if(!wanted)return {error:'A named attack is required.'};
  const rows=Array.from(document.querySelectorAll(
    R3_CATEGORIES.attacks+',.item-row,[data-testid*="item-row"]'
  )||[]).slice(0,300).filter(r3Shown);
  const found=rows.filter(row=>r3Name(row,'attacks').toLowerCase()===wanted);
  const titles=Array.from(document.querySelectorAll(
    '.span--item-row-title,.attack-item__title-chat,.attack-item__title-col,'+
    '[data-testid*="attack-name"]'
  )||[]).slice(0,250).filter(r3Shown)
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
  if((expected.bonus&&actual.bonus&&actual.bonus!==expected.bonus)||
     (expected.damage&&actual.damage&&actual.damage!==expected.damage))
    return {error:'The named attack changed since import. Refresh the Combat data before rolling.'};
  const buttons=Array.from(row.querySelectorAll?.(
    'button,[role="button"],[data-sheet-action="attack"],[data-action="attack"]'
  )||[]).slice(0,45).filter(r3Shown);
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
  const attackName=r3String(data.attackName,125);
  const attackKey=r3String(data.attackKey,240);
  const attackText=r3String(data.attackText,550);
  // The character identity and attack name are intentionally separate.
  // Characters across games do not share a fixed name or fixed attack list.
  if(data.kind!=='attacks'||!characterName||!attackName||
    characterName.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
    respond('blocked','This action does not belong to the open character sheet.');return;
  }
  // Only HUD-owned or Auto-sync-owned hidden sheets may have their tabs
  // switched automatically. A player-opened sheet is never navigated.
  if(data.background===true&&!/^combat$/i.test(r3CurrentTabLabel())){
    const combat=r3Tabs().find(tab=>/^combat$/i.test(r3TabLabel(tab)));
    if(!combat||!r3Shown(combat)){
      respond('blocked','Background official sheet did not expose Combat.');return;
    }
    combat.click();
    await r3Pause(320);
    if(!/^combat$/i.test(r3CurrentTabLabel())){
      respond('blocked','Background sheet Combat tab did not become active.');return;
    }
  }
  if(data.type==='native-probe'){
    const found=r3NativeAttackControl(attackName,{visible:attackText});
    if(!found.button){respond('blocked',found.error);return;}
    if(R3_NATIVE.tokens.size>=8)R3_NATIVE.tokens.clear();
    const token=(crypto.randomUUID?.()||('native-'+Date.now()+'-'+Math.random())).slice(0,100);
    R3_NATIVE.tokens.set(token,{characterName,attackName,attackKey,attackText,
      label:found.label,fingerprint:found.fingerprint,peer,until:Date.now()+15000});
    respond('ready','A single native roll control was found. Confirm to click it once.',
      {token,label:found.label});return;
  }
  const token=r3String(data.token,100),record=R3_NATIVE.tokens.get(token);
  if(!record||record.peer!==peer||record.until<Date.now()||
     record.characterName.toLowerCase()!==characterName.toLowerCase()||
     record.attackName.toLowerCase()!==attackName.toLowerCase()||
     record.attackKey!==attackKey||record.attackText!==attackText){
    respond('blocked','Native action confirmation expired. Inspect the roll again.');return;
  }
  R3_NATIVE.tokens.delete(token);
  const found=r3NativeAttackControl(attackName,{visible:attackText});
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
  original:null,overlay:null,overlayOriginal:null,opening:null,sessions:new Map()};
function r3NativeBgResolve(name){
  const wanted=r3String(name,120).trim().toLowerCase();
  if(!wanted)return {reason:'No imported character name is available in the HUD.'};
  const chars=window.d20?.Campaign?.characters;
  if(!chars)return {reason:'Roll20 character models are not ready. Wait for the editor to finish loading, then retry.'};
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
      dialog:bg.dialog,moved:bg.moved,original:bg.original,
      overlay:bg.overlay,overlayOriginal:bg.overlayOriginal});
}
function r3NativeBgActivate(record){Object.assign(R3_NATIVE_BG,record);}
function r3NativeBgClearActive(){
  const bg=R3_NATIVE_BG;
  bg.dialog=null;bg.moved=null;bg.original=null;
  bg.overlay=null;bg.overlayOriginal=null;bg.characterId='';bg.name='';
}
function r3NativeBgDialogId(dialog){
  return r3String(dialog?.getAttribute?.('data-characterid')||
    dialog?.closest?.('[data-characterid]')?.getAttribute?.('data-characterid'),110);
}
function r3NativeBgCandidate(){
  const owned=R3_NATIVE_BG.dialog;
  if(!owned||!owned.isConnected&&owned.isConnected!==undefined)return null;
  return r3Candidates().find(c=>c.type==='iframe'&&c.visible&&c.window&&
    (c.frame?.closest?.('.characterdialog')===owned||
      owned.contains?.(c.frame))&&r3AutoId(c)===R3_NATIVE_BG.characterId)||null;
}
function r3NativeBgRestore(){
  const bg=R3_NATIVE_BG;
  if(bg.moved?.style&&bg.original){
    for(const key of ['position','left','top','pointerEvents'])
      bg.moved.style[key]=bg.original[key];
  }
  if(bg.overlay?.style&&bg.overlayOriginal){
    bg.overlay.style.opacity=bg.overlayOriginal.opacity;
    bg.overlay.style.pointerEvents=bg.overlayOriginal.pointerEvents;
  }
  bg.sessions.delete(bg.characterId);
  r3NativeBgClearActive();
}
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
    pointerEvents:style.pointerEvents};
  // Do NOT set display:none/visibility:hidden/inert: Vue and hit-roll
  // controls must stay mounted; simply move the script-owned container away.
  style.position='fixed';style.left='-20000px';style.top='-20000px';
  style.pointerEvents='none';
  const newOverlays=Array.from(document.querySelectorAll('.ui-widget-overlay')||[])
    .filter(el=>!beforeOverlays.has(el));
  if(newOverlays.length===1){
    const overlay=newOverlays[0],overStyle=overlay.style||{};
    R3_NATIVE_BG.overlay=overlay;
    R3_NATIVE_BG.overlayOriginal={opacity:overStyle.opacity,
      pointerEvents:overStyle.pointerEvents};
    overStyle.opacity='0';overStyle.pointerEvents='none';
  }
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
  const before=new Set(existing),overlays=new Set(
    document.querySelectorAll('.ui-widget-overlay')||[]);
  const open=identity.model?.view?.showDialog;
  if(typeof open==='function')open.call(identity.model.view);
  else{
    const row=r3NativeBgJournal(identity);
    if(!row)throw new Error('Roll20 did not expose a background sheet opener. Open the Journal once to load the character.');
    row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,view:window}));
  }
  for(let i=0;i<36;i++){
    if(!bg.dialog)r3NativeBgClaim(before,overlays,identity);
    if(bg.dialog){
      const candidate=r3NativeBgCandidate();
      if(candidate)return candidate;
    }
    await r3Pause(150);
  }
  throw new Error('Roll20 did not create an authenticated sheet frame. No existing character sheet was changed.');
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
function r3NativeRequest(candidate,type,params={}){
  return new Promise((resolve,reject)=>{
    if(!candidate?.window){reject(new Error('No unique matching official sheet is open.'));return;}
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-native-'+(++r3Counter);
    const timeout=setTimeout(()=>{
      R3_NATIVE.pending.delete(id);
      reject(new Error('The official sheet did not answer the native action request.'));
    },4000);
    R3_NATIVE.pending.set(id,{window:candidate.window,resolve,reject,timeout});
    try{candidate.window.postMessage(r3Msg(type,{id,kind:'attacks',...params}),R3_ORIGIN);}
    catch(e){clearTimeout(timeout);R3_NATIVE.pending.delete(id);reject(e);}
  });
}
function r3NativeResult(event,data){
  const request=R3_NATIVE.pending.get(data?.id);
  if(!request||request.window!==event.source)return;
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
async function r3NativeProbe(name){
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
  r3NativeStatus('Locating a private character-sheet reader…');
  try{
    let candidate=r3NativeCandidate(characterName);
    if(!candidate){
      r3NativeStatus('Opening a HUD-owned background sheet for '+characterName+'…');
      candidate=await r3NativeBgEnsure(characterName);
    }
    if(r3String(R3_UI.snapshot?.name,120)!==characterName||
       (characterId&&R3_TOKEN.active?.characterId!==characterId)||
       r3NativeSelectAttack(attackKey||attackName)?._key!==chosen._key)
      throw new Error('Selected character or attack changed. No roll requested.');
    let background=r3NativeIsOwned(candidate);
    if(background&&R3_AUTO.running)
      throw new Error('Background import is using the character sheet. Retry the attack shortly.');
    let result=await r3NativeRequest(candidate,'native-probe',
      {characterName,attackName,attackKey,attackText,background});
    // Never change a player-opened sheet's selected tab. If it is not on
    // Combat, try a separate script-created reader. Its tab may be changed.
    if(!background&&result.status==='blocked'&&
        /^Open Combat on the official sheet/i.test(result.message||'')){
      r3NativeStatus('Opening a separate background Combat sheet…');
      candidate=await r3NativeBgEnsure(characterName);
      background=r3NativeIsOwned(candidate);
      result=await r3NativeRequest(candidate,'native-probe',
        {characterName,attackName,attackKey,attackText,background});
    }
    if(result.status==='ready'&&typeof result.token==='string'&&
       r3String(R3_UI.snapshot?.name,120)===characterName&&
       (!characterId||R3_TOKEN.active?.characterId===characterId)&&
       r3NativeSelectAttack(attackKey||attackName)?._key===chosen._key){
      R3_NATIVE.preview={characterName,characterId,attackName,attackKey,attackText,
        token:result.token,window:candidate.window,label:result.label,background};
      r3NativeStatus('Roll20 shows '+r3String(result.label,65)+
        ' for '+attackName+'. Confirm to click once.');
    }else r3NativeStatus(result.message||'No verified native roll button was found.');
  }catch(e){r3NativeStatus(e.message||'Background roll preparation failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
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
  }catch(e){r3NativeStatus(e.message||'Native roll request failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
}
function r3NativeCancel(){R3_NATIVE.preview=null;r3NativeStatus('Native roll cancelled; nothing was clicked.');}
function r3NativeMarkup(){
  if(!R3_NATIVE.status&&!R3_NATIVE.preview)return '';
  return '<section class="hud-native-status" role="status">'+
    '<span>'+r3Escape(R3_NATIVE.status)+'</span>'+
    (R3_NATIVE.preview?'<button type="button" id="r3-hud-native-confirm">Confirm native roll</button>'+
      '<button type="button" id="r3-hud-native-cancel">Cancel</button>':'')+
    '</section>';
}
