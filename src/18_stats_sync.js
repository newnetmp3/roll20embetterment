// Read-only combat stat reconciliation from loaded attributes, token bars and visible sheets.
// Unknown or unlinked bars are not interpreted as health without explicit selection.
function autoCharacterAttributeFields(character){
  const collection=character?.attribs;
  const rows=collection?.toJSON?.()||
    collection?.models?.map?.(x=>x.toJSON?.()||x.attributes)||[];
  const fields={};
  for(const row of Array.isArray(rows)?rows:[]){
    const name=String(row?.name||'').trim();
    if(!name||name.length>180)continue;
    fields[name]={current:row.current??'',max:row.max??''};
  }
  return fields;
}
function autoTokenHealthSnapshot(record,profileRecord){
  const model=record?.model,character=record?.character;
  if(!model?.get)return null;
  const choice=String(profileRecord?.sheetLink?.hpSource||'auto');
  if(!['auto','bar1','bar2','bar3'].includes(choice))return null;
  const attributes=character?.attribs?.models||[];
  const normalized=name=>String(name||'').toLowerCase().replace(/[\s.-]+/g,'_');
  const names=new Set(['hp','hit_points','hit_points_current','current_hp','hp_current','current_hit_points']);
  const linkedName=id=>{
    for(const attr of attributes){
      const attrId=String(attr?.id||attr?.get?.('id')||attr?.attributes?.id||'');
      if(attrId&&attrId===String(id))
        return normalized(attr?.get?.('name')||attr?.attributes?.name);
    }
    return '';
  };
  for(const index of [1,2,3]){
    const bar='bar'+index,linked=String(model.get(bar+'_link')||'');
    const name=linked?linkedName(linked):'';
    const explicit=choice===bar;
    if(!explicit&&!(choice==='auto'&&names.has(name)))continue;
    const current=sheetNum(model.get(bar+'_value')),maximum=sheetNum(model.get(bar+'_max'));
    if(current===null||current<0||current>9999)continue;
    if(maximum!==null&&(maximum<1||maximum>9999))continue;
    return {stats:{hp:current,...(maximum!==null?{maxHp:maximum}:{})},
      source:'Token Bar '+index+(name?' (linked HP)':' (selected HP source)')};
  }
  return null;
}
function autoPresentStatsUpdated(){
  save();
  if(RB.visible&&!RB.shadow?.activeElement?.matches?.('input,textarea,select'))render();
  else if(RB.radial?.anchor)render();
  if(RB.shadow&&RB.radial?.anchor)radialPosition();
}
function autoRefreshCharacterStats(groups){
  let updated=0;
  for(const [characterId,group] of groups){
    const fields=autoCharacterAttributeFields(group.record.character);
    const snap=snapshotSheet(fields,group.record.characterName);
    const link=group.profile.sheetLink;
    if(link?.visibleStatAt&&Date.now()-link.visibleStatAt<45000){
      for(const section of ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','details','currency']){
        for(const key of link.visibleStatKeys?.[section]||[])delete snap[section]?.[key];
      }
    }
    const token=autoTokenHealthSnapshot(group.record,group.profile);
    if(token)Object.assign(snap.stats,token.stats);
    const overrides=token?Object.fromEntries(Object.keys(token.stats).map(k=>[k,token.source])):{};
    if(applyLiveCharacterValues(group.profile,snap,characterId,'Roll20 attributes',overrides))updated++;
  }
  if(updated)autoPresentStatsUpdated();
  return updated;
}
// Only scan a player-opened sheet. Never create a helper or visit other tabs.
async function autoRefreshVisibleSheetStats(record,profileRecord){
  const charId=String(record?.characterId||'');
  const candidate=autoCandidateForCharacter(record);
  if(!candidate)return false;
  try{
    RB.openSheets=sheetCandidates(document);
    const live=RB.openSheets.find(c=>c.id===candidate.id||
      (candidate.frame&&c.frame?.contentWindow===candidate.frame.contentWindow)||
      (candidate.popoutWindow&&c.popoutWindow===candidate.popoutWindow))||candidate;
    const scan=beaconRemoteCandidate(live)?await requestBeaconFrame(live,false):
      {fields:readSheetFields(live.root),visible:beaconImportVisible(live.root,live.name)};
    const visual=scan.visible||beaconImportVisible({innerText:''},live.name);
    const snap=mergeBeaconSnapshot(snapshotSheet(scan.fields||{},live.name),visual,
      {preferVisibleStats:true});
    const visibleSections=['stats','abilityScores','abilityMods','saveBonuses','skillBonuses'];
    const hasVisible=visibleSections.some(section=>Object.keys(visual[section]||{}).length);
    // A remote read that only returns cached attributes does not prove that
    // the 2024 sheet's current values were visible.
    if(!hasVisible)return false;
    const overrides={};
    for(const section of visibleSections){
      if(section!=='stats')continue;
      for(const key of Object.keys(visual.stats||{}))
        overrides[key]=beaconRemoteCandidate(live)?'Visible official sheet':'Visible Roll20 sheet';
    }
    const token=autoTokenHealthSnapshot(record,profileRecord);
    if(token){
      for(const [key,value] of Object.entries(token.stats)){
        // Always prefer the current value printed on the open sheet over the
        // token bar. Token bars can represent damage, temporary HP or be stale.
        if(visual.stats?.[key]!==undefined)continue;
        snap.stats[key]=value;overrides[key]=token.source;
      }
    }
    const changed=applyLiveCharacterValues(profileRecord,snap,charId,
      'Roll20 attributes',overrides);
    if(profileRecord.sheetLink){
      profileRecord.sheetLink.visibleStatAt=Date.now();
      profileRecord.sheetLink.visibleStatKeys=Object.fromEntries(
        ['stats','abilityScores','abilityMods','saveBonuses','skillBonuses','details','currency']
          .map(section=>[section,Object.keys(visual[section]||{})]));
    }
    if(changed)autoPresentStatsUpdated();
    return changed;
  }catch(err){
    console.warn('[R20eb] Nonintrusive live sheet stat read unavailable',String(err?.message||err).slice(0,160));
    return false;
  }
}
function autoScheduleVisibleSheetStats(groups){
  RB.autoStatProbeAt=RB.autoStatProbeAt||new Map();
  RB.autoStatProbeBusy=RB.autoStatProbeBusy||new Set();
  for(const [characterId,group] of groups){
    if(RB.autoStatProbeBusy.has(characterId))continue;
    if(Date.now()-(RB.autoStatProbeAt.get(characterId)||0)<15000)continue;
    if(!autoCandidateForCharacter(group.record))continue;
    RB.autoStatProbeAt.set(characterId,Date.now());
    RB.autoStatProbeBusy.add(characterId);
    autoRefreshVisibleSheetStats(group.record,group.profile)
      .catch(err=>console.warn('[R20eb] Live stat scan failed',err))
      .finally(()=>RB.autoStatProbeBusy.delete(characterId));
  }
}
