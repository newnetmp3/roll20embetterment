// DM sheet-view mode: display and read one explicitly opened Roll20 sheet
// without granting token control or changing tabs in that visible sheet.
// A DM can create/open a 2024 PC sheet before placing a controllable token.
// Follow ONLY one visibly opened official sheet that resolves to a unique
// current-campaign character model (or an exact character ID). This is a
// read-only display/import mode, not a claim of token ownership; never use it
// to issue token-bound native actions or open a private sheet automatically.
function r3TokenFollowVisibleSheet(){
  if(typeof r3Candidates!=='function')return false;
  const collection=r3TokenCampaign()?.characters||null;
  const choices=r3Candidates().filter(c=>c?.visible&&c.window&&
    (c.type==='iframe'||c.type==='popout')&&
    typeof c.name==='string'&&c.name.length>0&&c.name.length<=120&&
    !/^(?:2024 character sheet|unnamed sheet|official sheet popout)/i.test(c.name)&&
    !(typeof r3NativeIsOwned==='function'&&r3NativeIsOwned(c)));
  const resolved=[];
  for(const candidate of choices.slice(0,20)){
    const exactId=typeof r3AutoId==='function'?r3AutoId(candidate):'';
    const dialog=candidate.type==='iframe'?
      candidate.frame?.closest?.('.characterdialog[data-characterid]'):null;
    const dialogId=r3String(dialog?.getAttribute?.('data-characterid'),110);
    // A visible Roll20 2024 dialog is an authoritative *display* identity:
    // the character ID and the sheet's title/header are rendered by Roll20.
    // A DM need not be listed in "Controlled By" or even have a hydrated
    // Campaign.characters collection. Only a frame in a real, open dialog
    // may use the DOM-only path. This NEVER proves token control.
    const domIdentity=dialogId&&exactId===dialogId&&
      /^[\w-]{5,110}$/.test(dialogId);
    let model=null;
    if(exactId)model=r3TokenCharacter(exactId);
    else if(Array.isArray(collection?.models)){
      const matches=collection.models.filter(m=>
        r3String(r3TokenModelGet(m,'name'),120).toLowerCase()===candidate.name.toLowerCase());
      if(matches.length===1)model=matches[0];
    }
    if(model&&r3String(r3TokenModelGet(model,'name'),120).toLowerCase()!==
       candidate.name.toLowerCase())continue;
    if(exactId&&model&&r3String(model.id||r3TokenModelGet(model,'_id'),110)!==exactId)
      continue;
    if(!model&&!domIdentity)continue;
    const id=r3String(model?.id||r3TokenModelGet(model,'_id')||
      (domIdentity?dialogId:''),110);
    const name=model?r3String(r3TokenModelGet(model,'name'),120):candidate.name;
    if(id&&name)resolved.push({candidate,id,name});
  }
  if(resolved.length!==1){
    // An opened sheet can temporarily unmount during a Vue tab transition.
    // Wait four polls before clearing its display; never keep an unrelated
    // profile displayed indefinitely after the actual dialog closes.
    if(R3_TOKEN.visibleSheetId&&++R3_TOKEN.visibleSheetMissing>=4){
      R3_TOKEN.visibleSheetId='';R3_TOKEN.visibleSheetSeen='';
      R3_TOKEN.visibleSheetMissing=0;
      if(typeof R3_AUTO==='object'&&R3_AUTO.origin==='visible'){
        R3_AUTO.generation++;R3_AUTO.enabled=false;R3_AUTO.name='';
        R3_AUTO.characterId='';R3_AUTO.origin='manual';
      }
      R3_UI.snapshot=null;R3_UI.renderedSnapshot=null;
      if(typeof r3HudLoad==='function')r3HudLoad();
      if(typeof r3UIRefresh==='function')r3UIRefresh();
    }
    if(!choices.length)R3_TOKEN.visibleSheetSeen='';
    return false;
  }
  R3_TOKEN.visibleSheetMissing=0;
  const {candidate,id,name}=resolved[0],seen=candidate.key+':'+id;
  // A newly opened sheet wins over a stale token; a subsequent explicit
  // map-token selection can win back without the same sheet stealing focus
  // on every 400ms poll.
  if(R3_TOKEN.visibleSheetSeen===seen)return false;
  R3_TOKEN.visibleSheetSeen=seen;
  if(R3_TOKEN.active?.characterId===id)return false;
  if(R3_TOKEN.active&&typeof r3HudSave==='function')r3HudSave();
  R3_TOKEN.active=null;R3_TOKEN.visibleSheetId=id;
  const snap=r3Empty();snap.name=name;
  snap.diagnostics.notes.push('Viewing a manually opened official Roll20 sheet in this campaign; map-token ownership is not inferred.');
  R3_UI.snapshot=r3Coverage(snap);
  R3_UI.view='summary';R3_UI.selected=candidate.key;
  R3_UI.renderedSnapshot=null;R3_HUD.flyout='';R3_HUD.chooser=null;
  if(typeof r3HudLoad==='function')r3HudLoad();
  if(typeof R3_AUTO==='object'){
    R3_AUTO.generation++;
    R3_AUTO.enabled=true;R3_AUTO.origin='visible';
    R3_AUTO.name=name;R3_AUTO.characterId=id;
    R3_AUTO.lastScan=0;R3_AUTO.lastFull=0;R3_AUTO.lastOpenAttempt=0;
  }
  if(typeof r3UIStatus==='function')
    r3UIStatus('Following open Roll20 sheet: '+name+'; importing its visible tab.');
  if(typeof r3UIRefresh==='function')r3UIRefresh();
  if(typeof r3AutoTick==='function')r3AutoTick();
  return true;
}

function r3DmAutoAllowed(){
  return R3_AUTO.origin==='visible'&&R3_AUTO.enabled&&
    !R3_TOKEN.active&&!!R3_TOKEN.visibleSheetId&&
    R3_TOKEN.visibleSheetId===R3_AUTO.characterId;
}
function r3DmAutoCandidate(){
  if(!r3DmAutoAllowed())return null;
  const id=R3_TOKEN.visibleSheetId,name=R3_AUTO.name.toLowerCase();
  // DM mode cannot borrow the player's privately opened reader. Require
  // the *currently visible* official sheet, its exact character ID for
  // embedded dialogs and a stable name; never navigate or hide this window.
  const candidates=r3Candidates().filter(c=>c?.visible&&c.window&&
    (c.type==='iframe'||c.type==='popout')&&
    r3String(c.name,120).toLowerCase()===name&&
    !(typeof r3NativeIsOwned==='function'&&r3NativeIsOwned(c))&&
    (c.type==='popout'||r3AutoId(c)===id));
  return candidates.length===1?candidates[0]:null;
}
