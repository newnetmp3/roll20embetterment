// Roll20 character-sheet access and hidden-helper ownership.
// Do not report success for a native operation unless it was callable.
// Shield newly created Roll20 dialogs before opening an automatic helper.
// Existing player-owned dialogs are excluded to avoid hiding a real sheet.
function autoSheetOpeningShield(){
  const doc=document,root=doc.documentElement;
  if(!root?.setAttribute||!doc.createElement||!doc.head?.appendChild)return ()=>{};
  const existing=Array.from(doc.querySelectorAll?.('.ui-dialog,.characterdialog')||[])
    .filter(node=>{
      // A leftover closed jQuery dialog may be re-used for the new helper.
      // Exclude only truly visible, player-owned windows from the shield.
      const computed=window.getComputedStyle?.(node);
      if(computed?.display==='none'||computed?.visibility==='hidden')return false;
      return !node.getClientRects||node.getClientRects().length>0;
    });
  for(const node of existing)node.setAttribute?.('data-r20e-existing-dialog','true');
  const css=doc.createElement('style');
  css.textContent=`
html[data-r20e-opening-helper="true"] .ui-dialog:not([data-r20e-existing-dialog]):has(.characterdialog),
html[data-r20e-opening-helper="true"] .characterdialog:not([data-r20e-existing-dialog]){
  visibility:hidden!important;pointer-events:none!important;opacity:0!important;
  position:fixed!important;left:-20000px!important;top:0!important;
}`;
  doc.head.appendChild(css);
  root.setAttribute('data-r20e-opening-helper','true');
  return ()=>{
    root.removeAttribute?.('data-r20e-opening-helper');
    css.remove?.();
    for(const node of existing)node.removeAttribute?.('data-r20e-existing-dialog');
  };
}
function autoHideSheetDialog(candidate,record){
  const root=candidate?.root;if(!root)return null;
  const wrapper=root.closest?.('.ui-dialog')||root;
  if(!wrapper.style?.setProperty)return null;
  const hidden={wrapper,characterId:String(record?.characterId||candidate.characterId||''),
    priorStyle:wrapper.getAttribute?.('style')??null,
    priorMarker:wrapper.getAttribute?.('data-r20e-auto-import')??null,
    reclaimed:false,released:false};
  wrapper.setAttribute?.('data-r20e-auto-import','true');
  wrapper.style.setProperty('position','fixed','important');
  wrapper.style.setProperty('left','-20000px','important');
  wrapper.style.setProperty('top','0','important');
  wrapper.style.setProperty('visibility','hidden','important');
  wrapper.style.setProperty('pointer-events','none','important');
  RB.autoHelperActive=hidden;
  return hidden;
}
function autoReleaseSheetDialog(hidden){
  if(!hidden||hidden.released)return;
  hidden.released=true;
  const wrapper=hidden.wrapper;
  if(wrapper){
    if(hidden.priorStyle===null)wrapper.removeAttribute?.('style');
    else wrapper.setAttribute?.('style',hidden.priorStyle);
    if(hidden.priorMarker===null)wrapper.removeAttribute?.('data-r20e-auto-import');
    else wrapper.setAttribute?.('data-r20e-auto-import',hidden.priorMarker);
  }
  if(RB.autoHelperActive===hidden)RB.autoHelperActive=null;
}
function autoCloseSheetDialog(record,hidden){
  if(!hidden)return;
  // Restore inline positioning before closing. Otherwise Roll20 may reuse an
  // invisible, pointer-disabled dialog for its next manual Journal open.
  autoReleaseSheetDialog(hidden);
  if(hidden.reclaimed)return;
  try{
    if(typeof record.character?.view?.closeDialog==='function'){
      record.character.view.closeDialog();return;
    }
  }catch(err){console.warn('[R20eb] Could not close automatic helper sheet',err);}
  const close=hidden.wrapper?.querySelector?.('.ui-dialog-titlebar-close,button[aria-label="Close"],button[title="Close"]');
  if(close?.click)close.click();
  else console.warn('[R20eb] Automatic helper sheet could not be closed; styling restored for manual access.');
}
// Roll20's journal URL is an officially supported, player-initiated sheet link.
// The 2024/Jumpgate client does not always expose the old Backbone view API.
function roll20CharacterSheetUrl(characterId){
  const id=String(characterId||'').trim();
  return /^[A-Za-z0-9_-]{1,120}$/.test(id)?
    'https://journal.roll20.net/character/'+encodeURIComponent(id):'';
}
function roll20LinkedCharacterId(){
  const p=profile();
  const selected=autoSelectedTokenAssignment()?.characterId;
  const owned=Object.values(RB.state?.tokenAssignments||{})
    .filter(item=>item?.profileId===p.id&&roll20CharacterSheetUrl(item.characterId));
  // A linked profile is authoritative, even when there is no selected token.
  for(const id of [p.roll20CharacterId,p.sheetLink?.characterId,selected]){
    if(roll20CharacterSheetUrl(id))return String(id);
  }
  const unique=new Set(owned.map(item=>item.characterId));
  if(unique.size===1)return [...unique][0];
  // Some player sheets are visible only through controlled token models.
  // Match an exact, unique controlled character name; never open the first NPC.
  const records=autoDiscoverControlledTokens();
  const matching=new Set(records.filter(item=>
    String(item.characterName||'').toLocaleLowerCase()===String(p.name||'').toLocaleLowerCase()||
    String(item.tokenName||'').toLocaleLowerCase()===String(p.name||'').toLocaleLowerCase())
    .map(item=>item.characterId).filter(roll20CharacterSheetUrl));
  return matching.size===1?[...matching][0]:'';
}
function openRoll20CharacterSheet(){
  const characterId=roll20LinkedCharacterId(),url=roll20CharacterSheetUrl(characterId);
  if(!url){
    toast('No linked Roll20 character found. Open the Journal or select your token.');
    return false;
  }
  const character=autoCharacterById(characterId);
  const hidden=RB.autoHelperActive;
  if(hidden&&hidden.characterId===characterId){
    hidden.reclaimed=true;
    const tabs=sheetTourTabs(hidden.wrapper,RBE_SHEET_TOUR_MAIN,'.asv__header__nav__tabs_link');
    const main=tabs.find(tab=>sheetTourLabel(tab)==='Character Sheet');
    if(main&&!sheetTourActive(main))main.click?.();
    autoReleaseSheetDialog(hidden);
  }
  RB.autoCharacterRetryAfter=RB.autoCharacterRetryAfter||new Map();
  RB.autoCharacterRetryAfter.set(characterId,Date.now()+120000);
  const methods=[
    [character?.view?.showDialog,character?.view],
    [character?.showDialog,character]
  ];
  for(const [fn,owner] of methods){
    if(typeof fn!=='function')continue;
    try{fn.call(owner);return true;}
    catch(err){console.warn('[R20eb] Roll20 native sheet opening unavailable',err);}
  }
  // Journal URLs are special VTT-intercepted links. Their hostname does not
  // resolve as a standalone external sheet, so NEVER window.open this URL.
  // Dispatch a click from the light DOM where Roll20 delegates its handlers.
  const doc=document,body=doc.body;
  if(body?.appendChild&&doc.createElement){
    const link=doc.createElement('a');
    link.href=url;
    link.textContent='Open linked Roll20 sheet';
    link.style.display='none';
    link.addEventListener?.('click',event=>event.preventDefault());
    try{
      body.appendChild(link);
      link.click();
      return true;
    }catch(err){console.warn('[R20eb] Roll20 Journal link activation failed',err);}
    finally{link.remove?.();}
  }
  RB.tab='Sheet';RB.state.ui.lastTab='Sheet';RB.visible=true;render();
  toast('Unable to open the sheet automatically. Use the Roll20 Journal.');
  return false;
}
