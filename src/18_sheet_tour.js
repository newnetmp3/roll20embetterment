// Guided, read-only import across the visible Roll20 D&D 2024 sheet tabs.
// No private Roll20 models, endpoint calls, action rolls, or character writes.
const RBE_SHEET_TOUR_MAIN=['Character Sheet','Bio & Info','Advanced Tools'];
const RBE_SHEET_TOUR_INNER=[
  'Combat','Skills & Tools','Spells','Inventory','Features & Traits','Features and Traits','Notes','About',
  'Actions','Resources','Skills','Equipment','Character','Details','Background','Feats','Cantrips',
  ...Array.from({length:9},(_,i)=>'Level '+(i+1))
];
const sheetTourDelay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function sheetTourStatus(text) {
  RB.sheetTourStatus=text;
  const el=RB.shadow?.querySelector?.('#rbe-sheet-tour-status');
  if(el)el.textContent=text;
}
function sheetTourLabel(el) {
  return String(el?.innerText??el?.textContent??'').replace(/\s+/g,' ').trim();
}
function sheetTourTabs(scope,labels,selector) {
  if(!scope?.querySelectorAll)return [];
  const set=new Set(labels.map(s=>s.toLowerCase()));
  const found=[];
  for(const el of Array.from(scope.querySelectorAll(selector)||[]).slice(0,1200)){
    if(!set.has(sheetTourLabel(el).toLowerCase()) || el.disabled)continue;
    const rect=el.getBoundingClientRect?.();
    if(rect&&Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width===0&&rect.height===0)continue;
    // Never click an in-game action just because its text happens to match.
    const isTab=selector==='.asv__header__nav__tabs_link' ||
      el.getAttribute?.('role')==='tab' ||
      !!el.closest?.('nav,[role="tablist"],[class*="tabs"],[class*="tab-list"],[class*="navigation"]') ||
      /(?:^|[\s_-])tab(?:$|[\s_-])/i.test(String(el.className||''));
    if(isTab&&!found.some(x=>sheetTourLabel(x)===sheetTourLabel(el)))found.push(el);
  }
  return found;
}
function sheetTourActive(tab) {
  return tab?.getAttribute?.('aria-selected')==='true' ||
    tab?.getAttribute?.('data-state')==='active' ||
    /(?:^|\s)(active|selected|current)(?:\s|$)/i.test(String(tab?.className||'')) ||
    /(?:^|\s)(active|selected|current)(?:\s|$)/i.test(String(tab?.parentElement?.className||''));
}
function sheetTourMergeVisible(target,source) {
  if(!source)return target;
  for(const k of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','spellSlots','usedSlots','details']){
    Object.assign(target[k],source[k]||{});
  }
  for(const key of ['attacks','resources','spells','inventory','features','proficiencies','tools','sheetRolls']){
    const list=Array.isArray(source[key])?source[key]:[];
    if(!Array.isArray(target[key]))target[key]=[];
    const existing=new Set(target[key].map(x=>x.id||x.name));
    for(const entry of list){
      if(!entry||existing.has(entry.id||entry.name))continue;
      target[key].push(entry);existing.add(entry.id||entry.name);
    }
  }
  const names=target.coverage.names||[];
  for(const name of source.coverage?.names||[])if(!names.includes(name))names.push(name);
  target.coverage.names=names.slice(0,400);
  target.coverage.visibleFields=names.length;
  const sections=target.coverage.sections||[];
  for(const section of source.coverage?.sections||[])if(!sections.includes(section))sections.push(section);
  target.coverage.sections=sections;
  target.signature=(target.signature||'').slice(0,25000)+'|'+String(source.signature||'').slice(0,12000);
  return target;
}
function sheetTourAccumulator() {
  return {fields:{},visible:beaconImportVisible({innerText:''}),full:false,
    expected:0,scannedPages:0,tabs:[]};
}
function sheetTourAdd(acc,scan,label) {
  Object.assign(acc.fields,scan.fields||{});
  sheetTourMergeVisible(acc.visible,scan.visible);
  acc.scannedPages+=scan.scannedPages||1;
  acc.expected=Math.max(acc.expected,scan.expected||0);
  if(scan.full)acc.full=true;
  if(label&&!acc.tabs.includes(label))acc.tabs.push(label);
  for(const tab of scan.tabs||[])if(typeof tab==='string'&&!acc.tabs.includes(tab))acc.tabs.push(tab);
  return acc;
}
async function sheetTourCollect(scope,acc,label,deep=true) {
  if(!scope?.querySelectorAll)return;
  const scroll=deep&&sheetScrollableAttributeContainer(scope);
  const batch=scroll?await sheetHarvestBeaconRows(scope):
    {fields:readSheetFields(scope),full:false,expected:sheetExpectedAttributeCount(scope),scannedPages:1};
  batch.visible=beaconImportVisible(scope,'Open character sheet');
  sheetTourAdd(acc,batch,label);
}
async function sheetTourFrameScan() {
  const scope=document.body;
  const acc=sheetTourAccumulator();
  const tabs=sheetTourTabs(document,RBE_SHEET_TOUR_INNER,
    '.layout-tabbed-panel__tab-link[role="tab"],[role="tab"],nav a,[class*="tabs"] a,button');
  const original=tabs.find(sheetTourActive)||tabs[0]||null;
  let count=0;
  const gather=async label=>{
    if(++count>36)return;
    sheetTourStatus('Reading '+label+'…');
    await sheetTourCollect(scope,acc,label,true);
  };
  try{
    await gather('Current view');
    for(const tab of tabs.slice(0,14)){
      if(count>34)break;
      if(!tab.isConnected && tab.isConnected!==undefined)continue;
      if(!sheetTourActive(tab)){tab.click?.();await sheetTourDelay(230);}
      const label=sheetTourLabel(tab);
      await gather(label);
      // Some Roll20 sections expose further tabs only after opening them.
      if(/^(?:Spells|Inventory|Features & Traits|Features and Traits|Combat)$/i.test(label)){
        const secondary=sheetTourTabs(document,RBE_SHEET_TOUR_INNER,
          '[role="tab"],nav button,nav a,[class*="tabs"] button,[class*="tabs"] a')
          .filter(x=>!tabs.includes(x)).slice(0,16);
        const selected=secondary.find(sheetTourActive);
        try{
          for(const child of secondary){
            if(count>34)break;
            if(!child.isConnected && child.isConnected!==undefined)continue;
            if(!sheetTourActive(child)){child.click?.();await sheetTourDelay(160);}
            await gather(label+' / '+sheetTourLabel(child));
          }
        }finally{
          if(selected&&selected.isConnected!==false&&!sheetTourActive(selected)){
            selected.click?.();await sheetTourDelay(130);
          }
        }
      }
    }
  }finally{
    if(original&&original.isConnected!==false&&!sheetTourActive(original)){
      original.click?.();await sheetTourDelay(180);
    }
  }
  return acc;
}
function sheetTourPromptOpen() {
  RB.sheetTourWaiting=true;
  RB.sheetTourStatus='Open your character sheet in Roll20’s Journal. Import will begin automatically.';
  RB.visible=true;RB.tab='Sheet';RB.state.ui.lastTab='Sheet';
  render();
  if(RB.sheetTourWatch)return;
  const started=Date.now();
  RB.sheetTourWatch=setInterval(()=>{
    if(!RB.sheetTourWaiting || Date.now()-started>120000){
      sheetTourCancel();
      if(Date.now()-started>120000)sheetTourStatus('Waiting timed out. Click Import all tabs to try again.');
      return;
    }
    const options=sheetCandidates(document);
    if(!options.length)return;
    clearInterval(RB.sheetTourWatch);RB.sheetTourWatch=null;
    RB.sheetTourWaiting=false;
    RB.openSheets=options;
    const name=profile().sheetLink?.name||profile().name;
    RB.selectedSheet=Math.max(0,options.findIndex(x=>x.name?.toLowerCase()===name?.toLowerCase()));
    sheetTourStart().catch(err=>console.warn('[roll20 Embetterment] Auto sheet import',err));
  },650);
}
function sheetTourCancel(){
  RB.sheetTourWaiting=false;
  if(RB.sheetTourWatch)clearInterval(RB.sheetTourWatch);
  RB.sheetTourWatch=null;
  RB.sheetTourStatus='Import cancelled.';
  if(RB.visible&&RB.tab==='Sheet')render();
}
async function sheetTourImportCandidate(candidate,targetProfile,{quiet=false,characterId='',auto=false,seedFields=null,helper=null}={}){
  if(!candidate||!targetProfile)return null;
  const acc=sheetTourAccumulator(),dialog=candidate.root||null;
  if(seedFields&&typeof seedFields==='object')Object.assign(acc.fields,seedFields);
  const tabs=dialog?sheetTourTabs(dialog,RBE_SHEET_TOUR_MAIN,'.asv__header__nav__tabs_link'):[];
  const original=tabs.find(sheetTourActive)||tabs[0]||null;
  const status=text=>{if(!quiet)sheetTourStatus(text);};
  const assertPlayerNotReclaiming=()=>{
    if(auto&&helper?.reclaimed)throw new Error('Player opened the character sheet; helper import cancelled.');
  };
  try{
    assertPlayerNotReclaiming();
    if(dialog)await sheetTourCollect(dialog,acc,'Current Roll20 view',false);
    const main=tabs.find(x=>sheetTourLabel(x)==='Character Sheet');
    assertPlayerNotReclaiming();
    if(main&&!sheetTourActive(main)){main.click?.();await sheetTourDelay(250);}
    if(beaconRemoteCandidate(candidate)){
      status(candidate.popoutWindow?'Reading official popout tabs…':'Reading Combat, Spells, Inventory and Features…');
      let scan=null,lastError=null;
      for(let attempt=0;attempt<3&&!scan;attempt++){
        try{scan=await requestBeaconFrame(candidate,true,{tour:true});}
        catch(err){lastError=err;if(attempt<2)await sheetTourDelay(650);}
      }
      if(!scan)throw lastError||new Error('Official sheet reader did not respond.');
      sheetTourAdd(acc,scan,candidate.popoutWindow?'Official sheet popout':'Character Sheet');
    }else if(dialog){
      await sheetTourCollect(dialog,acc,'Character Sheet',true);
    }
    for(const label of ['Bio & Info','Advanced Tools']){
      const tab=tabs.find(x=>sheetTourLabel(x)===label);
      if(!tab)continue;
      assertPlayerNotReclaiming();
      if(!sheetTourActive(tab)){tab.click?.();await sheetTourDelay(280);}
      status('Reading '+label+'…');
      if(label==='Advanced Tools'){
        const attrs=Array.from(dialog.querySelectorAll?.('button,[role="tab"]')||[])
          .find(el=>/^Attributes(?:\s+\d+)?$/i.test(sheetTourLabel(el))&&!el.disabled);
        if(attrs){attrs.click?.();await sheetTourDelay(300);}
      }
      await sheetTourCollect(dialog,acc,label,true);
    }
    assertPlayerNotReclaiming();
    if(dialog?.isConnected===false)throw new Error('Character sheet closed during import.');
    const didImport=beaconRemoteCandidate(candidate)?
      beaconFrameSnapshot(candidate,acc,{quiet:true,targetProfile,characterId}):
      applySheetSnapshot(targetProfile,mergeBeaconSnapshot(snapshotSheet(acc.fields,candidate.name),acc.visible));
    if(!didImport)throw new Error('No accessible values were found in the opened sheet.');
    targetProfile.sheetLink=targetProfile.sheetLink||{};
    targetProfile.sheetLink.source=candidate.id;
    targetProfile.sheetLink.tabsVisited=acc.tabs;
    // A full tab import can be newer than the editor's cached attribute model.
    // Retain its mapped values until the model catches up or a visible scan
    // refreshes them, rather than snapping to stale defaults five seconds later.
    const imported=mergeBeaconSnapshot(snapshotSheet(acc.fields,candidate.name),acc.visible);
    targetProfile.sheetLink.visibleStatAt=Date.now();
    targetProfile.sheetLink.visibleStatKeys=Object.fromEntries(
      ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','details','currency']
        .map(section=>[section,Object.keys(imported[section]||{})]));
    if(characterId){
      targetProfile.roll20CharacterId=String(characterId).slice(0,120);
      targetProfile.sheetLink.characterId=targetProfile.roll20CharacterId;
    }
    if(auto)targetProfile.sheetLink.autoImportedAt=new Date().toISOString();
    RB.sheetWarm={frame:candidate.frame||null,popoutSession:candidate.popoutSession||null,
      endpoint:candidate.frame?.contentWindow||candidate.popoutWindow||null,root:dialog,
      scan:acc,at:Date.now(),promise:null};
    save();
    if(!quiet){
      sheetTourStatus('Imported '+Object.keys(acc.fields).length+' named attributes and '+
        acc.visible.coverage.visibleFields+' visible values from '+acc.tabs.length+' views.');
      toast('Character import complete: '+candidate.name+' ('+acc.tabs.length+' views).');
    }
    return {candidate,profile:targetProfile,acc};
  }finally{
    if(!helper?.reclaimed&&original&&original.isConnected!==false&&!sheetTourActive(original)){
      original.click?.();await sheetTourDelay(180);
    }
  }
}
async function sheetTourStart() {
  if(RB.sheetTourBusy)return;
  const sheets=sheetCandidates(document);
  if(!sheets.length){sheetTourPromptOpen();return;}
  if(RB.sheetTourWaiting)sheetTourCancel();
  RB.openSheets=sheets;
  const preferred=profile().sheetLink?.source;
  const selected=RB.openSheets.findIndex(s=>s.id===preferred);
  RB.selectedSheet=selected>=0?selected:Math.min(RB.selectedSheet||0,sheets.length-1);
  const candidate=RB.openSheets[RB.selectedSheet],target=profile();
  RB.sheetTourBusy=true;
  sheetTourStatus('Importing '+candidate.name+' — reading all available tabs…');
  if(RB.visible&&RB.tab==='Sheet')render();
  try{
    await sheetTourImportCandidate(candidate,target,{quiet:false,characterId:target.roll20CharacterId||candidate.characterId||''});
  }catch(err){
    sheetTourStatus('Import incomplete: '+String(err.message||err).slice(0,150));
    toast(RB.sheetTourStatus);
    console.warn('[roll20 Embetterment] Full sheet tour',err);
  }finally{
    RB.sheetTourBusy=false;
    if(RB.visible&&RB.tab==='Sheet')render();
  }
}

// Automatic controlled-character discovery/import. Roll20's own runtime
// relationships are authoritative: token -> represents -> character and
// token/character controlledby -> current player. Names are presentation only.
function autoCampaign(){
  return window.d20?.Campaign||window.Campaign||null;
}
function autoCurrentPlayerId(){
  return String(window.currentPlayer?.id||'');
}
function autoCsv(value){
  return String(value||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function autoListControlsPlayer(value,playerId){
  const list=autoCsv(value);
  return list.includes('all')||!!playerId&&list.includes(playerId);
}
function autoCharacterById(id){
  const campaign=autoCampaign();
  if(!id||!campaign)return null;
  return campaign.characters?.get?.(id)||
    campaign.activeCharacters?.()?.find?.(x=>String(x.id||x.get?.('id')||'')===String(id))||null;
}
function autoActiveTokenModels(){
  const campaign=autoCampaign(),page=campaign?.activePage?.();
  if(!page)return [];
  const collections=[page.thegraphics,page.graphics,page.tokens,
    page.get?.('thegraphics'),page.get?.('graphics')].filter(Boolean);
  for(const collection of collections){
    const models=Array.isArray(collection)?collection:collection.models;
    if(Array.isArray(models)&&models.length)return models;
  }
  return [];
}
function autoTokenRecord(model){
  if(!model?.get)return null;
  const characterId=String(model.get('represents')||'').trim();
  if(!characterId)return null;
  const type=String(model.get('type')||model.get('subtype')||'image');
  if(type&& !/^(?:image|token|graphic)$/i.test(type))return null;
  const playerId=autoCurrentPlayerId();
  if(!playerId)return null;
  const character=autoCharacterById(characterId);
  const tokenControlled=autoListControlsPlayer(model.get('controlledby'),playerId);
  const characterControlled=autoListControlsPlayer(character?.get?.('controlledby'),playerId);
  let controls=tokenControlled||characterControlled;
  // Roll20 exposes this on graphic models/views. Use it only as a player
  // fallback; a GM's universal control is not treated as a player assignment.
  if(!controls&&!window.is_gm&&typeof model.currentPlayerControls==='function'){
    try{controls=!!model.currentPlayerControls();}catch{}
  }
  if(!controls)return null;
  const tokenId=String(model.id||model.get('id')||'').slice(0,120);
  if(!tokenId)return null;
  const characterName=String(character?.get?.('name')||'').trim().slice(0,100);
  const tokenName=String(model.get('name')||characterName||'').trim().slice(0,100);
  return {tokenId,tokenName,characterId,characterName:characterName||tokenName||'Character',model,character};
}
function autoDiscoverControlledTokens(){
  const out=[],seen=new Set();
  for(const model of autoActiveTokenModels()){
    const record=autoTokenRecord(model);
    if(!record||seen.has(record.tokenId))continue;
    seen.add(record.tokenId);out.push(record);
  }
  return out;
}
function autoProfileLooksBlank(p){
  return !!p&&!p.roll20CharacterId&&!p.sheetLink&&
    ['Adventurer','New Adventurer'].includes(p.name)&&
    !(p.notes||'').trim()&&(p.inventory||[]).length===0&&(p.spells||[]).length===0;
}
function autoProfileForCharacter(record){
  const charId=String(record.characterId),name=record.characterName||record.tokenName||'Character';
  let p=RB.state.profiles.find(x=>x.roll20CharacterId===charId||x.sheetLink?.characterId===charId);
  if(!p){
    const old=Object.values(RB.state.tokenAssignments||{}).find(x=>x.characterId===charId);
    if(old)p=RB.state.profiles.find(x=>x.id===old.profileId);
  }
  if(!p)p=RB.state.profiles.find(x=>!x.roll20CharacterId&&!x.sheetLink&&
    String(x.name).toLocaleLowerCase()===String(name).toLocaleLowerCase());
  if(!p&&RB.state.profiles.length===1&&autoProfileLooksBlank(RB.state.profiles[0]))p=RB.state.profiles[0];
  if(!p){p=newProfile(name);RB.state.profiles.push(p);}
  p.roll20CharacterId=charId;
  if(['Adventurer','New Adventurer'].includes(p.name)&&name)p.name=name.slice(0,100);
  return p;
}
function autoAssignControlledTokens(records){
  RB.state.tokenAssignments=RB.state.tokenAssignments||{};
  const now=new Date().toISOString(),byCharacter=new Map();
  let dirty=false;
  for(const record of records){
    const beforeProfiles=RB.state.profiles.length,p=autoProfileForCharacter(record);
    if(RB.state.profiles.length!==beforeProfiles)dirty=true;
    const previous=RB.state.tokenAssignments[record.tokenId];
    const next={tokenId:record.tokenId,characterId:record.characterId,profileId:p.id,
      characterName:record.characterName,tokenName:record.tokenName,lastSeen:previous?.lastSeen||now};
    if(!previous||previous.characterId!==next.characterId||previous.profileId!==next.profileId||
       previous.characterName!==next.characterName||previous.tokenName!==next.tokenName){
      next.lastSeen=now;dirty=true;
    }
    RB.state.tokenAssignments[record.tokenId]=next;
    if(!byCharacter.has(record.characterId))byCharacter.set(record.characterId,{record,profile:p,tokens:[]});
    byCharacter.get(record.characterId).tokens.push(record.tokenId);
  }
  if(dirty)save();
  return byCharacter;
}
function autoCandidateForCharacter(record){
  const candidates=sheetCandidates(document);
  const exact=candidates.find(x=>String(x.characterId||x.id||'')===String(record.characterId));
  if(exact)return exact;
  const name=String(record.characterName||'').trim().toLocaleLowerCase();
  if(!name)return null;
  // The embedded official 2024 iframe frequently has no data-charid.
  // Accept a *unique* name-only candidate only if the character itself is
  // unique among player-controlled characters. A same-name NPC or another
  // player's sheet must never be mistaken for the selected player character.
  const controlled=new Set(autoDiscoverControlledTokens()
    .filter(x=>String(x.characterName||'').trim().toLocaleLowerCase()===name)
    .map(x=>String(x.characterId)));
  if(controlled.size!==1||!controlled.has(String(record.characterId)))return null;
  const named=candidates.filter(x=>!x.characterId&&
    (beaconRemoteCandidate(x)||x.kind==='Visible Roll20 sheet')&&
    String(x.name||'').trim().toLocaleLowerCase()===name);
  return named.length===1?named[0]:null;
}
async function autoEnsureSheetCandidate(record){
  const register=candidate=>{
    const live=sheetCandidates(document);
    RB.openSheets=live;
    return live.find(x=>x.id===candidate.id||
      (candidate.frame&&x.frame?.contentWindow===candidate.frame.contentWindow)||
      (candidate.popoutWindow&&x.popoutWindow===candidate.popoutWindow))||candidate;
  };
  let candidate=autoCandidateForCharacter(record);
  // Existing player-owned sheets must not be hidden or toured automatically.
  if(candidate)return {candidate:register(candidate),opened:false,hidden:null};
  const character=record.character||autoCharacterById(record.characterId);
  if(typeof character?.view?.showDialog!=='function')return null;
  const focused=document.activeElement,removeShield=autoSheetOpeningShield();
  let hidden=null,opened=false;
  try{
    character.view.showDialog();
    opened=true;
    // Hide synchronously whenever Roll20 creates the dialog immediately.
    for(let attempt=0;attempt<120;attempt++){
      candidate=autoCandidateForCharacter(record);
      if(candidate){
        candidate=register(candidate);
        hidden=autoHideSheetDialog(candidate,record);
        if(!hidden)break; // Never tour a helper that cannot be hidden.
        try{focused?.focus?.({preventScroll:true});}catch{try{focused?.focus?.();}catch{}}
        await sheetTourDelay(350);
        return {candidate,opened:true,hidden};
      }
      await sheetTourDelay(50);
    }
    try{character.view.closeDialog?.();}catch{}
    return null;
  }catch(err){
    console.warn('[R20eb] Could not open hidden character sheet',record.characterName,err);
    if(hidden)autoCloseSheetDialog({...record,character},hidden);
    else if(opened)try{character.view.closeDialog?.();}catch{}
    return null;
  }finally{
    removeShield();
    try{focused?.focus?.({preventScroll:true});}catch{try{focused?.focus?.();}catch{}}
  }
}
function autoSelectedTokenAssignment(){
  let selected=[];
  try{selected=window.d20?.engine?.selected?.()||[];}catch{}
  for(const item of selected){
    const tokenId=String(item?.model?.id||item?.model?.get?.('id')||item?.id||'');
    const assignment=RB.state.tokenAssignments?.[tokenId];
    if(assignment&&RB.state.profiles.some(p=>p.id===assignment.profileId))return assignment;
  }
  return null;
}
function autoActivateSelectedTokenProfile(){
  const assignment=autoSelectedTokenAssignment();
  if(!assignment||assignment.profileId===RB.state.current)return false;
  RB.state.current=assignment.profileId;save();
  setTimeout(()=>{if(RB.visible)render();},0);
  return true;
}
async function autoImportControlledCharacters(){
  if(!isRoll20Editor()||RB.autoCharacterImportBusy||RB.sheetTourBusy)return;
  const records=autoDiscoverControlledTokens();
  if(!records.length)return;
  const groups=autoAssignControlledTokens(records);
  // Unlike full imports, numeric stats keep refreshing from loaded Roll20
  // models every scan, even after a character has been fully imported.
  autoRefreshCharacterStats(groups);
  autoScheduleVisibleSheetStats(groups);
  RB.autoCharacterImportBusy=true;
  RB.autoCharacterImported=RB.autoCharacterImported||new Set();
  let imported=0;
  try{
    for(const [characterId,group] of groups){
      if(RB.autoCharacterImported.has(characterId))continue;
      RB.autoCharacterRetryAfter=RB.autoCharacterRetryAfter||new Map();
      if((RB.autoCharacterRetryAfter.get(characterId)||0)>Date.now())continue;
      const directFields=autoCharacterAttributeFields(group.record.character);
      const opened=await autoEnsureSheetCandidate(group.record);
      if(!opened||!opened.opened){
        // A user-opened sheet remains untouched by the background importer.
        // Seed from the model only; user-initiated Import all tabs is separate.
        // autoRefreshCharacterStats has already merged the available fields.
        // A partial read must never overwrite imported actions or sheet rolls.
        RB.autoCharacterRetryAfter.set(characterId,Date.now()+30000);
        console.warn('[R20eb] Full controlled character sheet could not be opened yet:',group.record.characterName);
        continue;
      }
      RB.sheetTourBusy=true;
      try{
        const result=await sheetTourImportCandidate(opened.candidate,group.profile,
          {quiet:true,characterId,auto:true,seedFields:directFields,helper:opened.hidden});
        if(result){
          group.profile.sheetLink.tokenIds=group.tokens.slice(0,50);
          group.profile.sheetLink.importMode='full-auto';
          for(const tokenId of group.tokens){
            if(RB.state.tokenAssignments[tokenId])RB.state.tokenAssignments[tokenId].profileId=group.profile.id;
          }
          RB.autoCharacterImported.add(characterId);
          RB.autoCharacterRetryAfter.delete(characterId);
          imported++;save();
        }
      }catch(err){
        RB.autoCharacterRetryAfter.set(characterId,Date.now()+30000);
        console.warn('[R20eb] Automatic controlled-character import failed:',group.record.characterName,err);
      }finally{
        RB.sheetTourBusy=false;
        if(opened.opened)autoCloseSheetDialog(group.record,opened.hidden);
      }
    }
  }finally{
    RB.autoCharacterImportBusy=false;
    RB.autoCharacterLastScan=new Date().toISOString();
    if(imported&&RB.visible)render();
    if(imported)toast('R20eb automatically imported '+imported+' controlled character'+(imported===1?'':'s')+'.');
  }
}
function startAutoControlledCharacterImport(){
  if(!isRoll20Editor()||RB.autoCharacterImportTimer)return;
  RB.autoCharacterImported=new Set();
  const scan=()=>autoImportControlledCharacters().catch(err=>
    console.warn('[R20eb] Controlled-character discovery failed',err));
  setTimeout(scan,1200);
  RB.autoCharacterImportTimer=setInterval(scan,5000);
}

