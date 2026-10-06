// Event delegation and state changes; no Roll20 internal models are accessed.
function getInput(id) {return RB.shadow.querySelector('#rbe-'+id);}
function getText(id) {return (getInput(id)?.value || '').trim();}
function changedProfile() {save();render();}
function runMacro(id) {
  const m=RB.state.macros.find(x=>x.id===id);
  if (m && sendToRoll20(m.command)) record('Macro: '+m.name);
}
function action(name, el) {
  const p=profile(), s=RB.state.settings;
  const id=el.dataset.id, v=el.dataset.value, ix=int(el.dataset.index);
  switch (name) {
    case 'radialPick':radialPick(int(el.dataset.depth),int(el.dataset.index));break;
    case 'radialBack':RB.radial.path.pop();render();radialPosition();break;
    case 'radialHome':RB.radial.path=[];render();radialPosition();break;
    case 'radialPin':RB.radial.pin=true;toast('Click the center of your token on the tabletop.');break;
    case 'radialPanel':RB.tab='Sheet';RB.state.ui.lastTab='Sheet';RB.visible=true;render();break;
    case 'radialToggle':RB.radial.open=!RB.radial.open;RB.radial.path=[];render();radialPosition();break;
    case 'open': case 'toggle': RB.visible=name==='open'?true:!RB.visible; render(); break;
    case 'close': RB.visible=false;render();break;
    case 'tab': RB.tab=v;RB.state.ui.lastTab=v;changedProfile();break;
    case 'profiles': RB.tab='Settings';RB.visible=true;changedProfile();break;
    case 'damage': applyDamage(getInput('hp-adjust')?.value||0);break;
    case 'heal': p.stats.hp=Math.min(Math.max(0,int(p.stats.maxHp)),p.stats.hp+clamp(getInput('hp-adjust')?.value,0,999999));record('Local healing');changedProfile();break;
    case 'addTemp': p.stats.tempHp=Math.max(0,int(p.stats.tempHp)+clamp(getInput('hp-adjust')?.value,0,999999));changedProfile();break;
    case 'turnToggle':if(['actionUsed','bonusUsed','reactionUsed'].includes(v)){p[v]=!p[v];changedProfile();}break;
    case 'newTurn':p.actionUsed=p.bonusUsed=p.reactionUsed=false;p.movementUsed=0;record('Started new turn');changedProfile();break;
    case 'inspiration':p.inspiration=!p.inspiration;changedProfile();break;
    case 'shortRest': if(confirm('Apply a short rest to local resources?'))rest('short');break;
    case 'longRest': if(confirm('Apply a long rest to local resources and spell slots?'))rest('long');break;
    case 'endConcentration':p.concentration='';changedProfile();break;
    case 'condition':p.conditions=p.conditions.includes(v)?p.conditions.filter(x=>x!==v):[...p.conditions,v];changedProfile();break;
    case 'clearDeath':p.death={success:0,fail:0};changedProfile();break;
    case 'rollInitiative':quickRoll('initiative','');break;
    case 'rollAbility':quickRoll('ability',v);break;
    case 'rollSave':quickRoll('save',v);break;
    case 'rollSkill':quickRoll('skill',v);break;
    case 'adv':RB.selectedAdv=v;render();break;
    case 'customRoll': case 'gmRoll': {
      const expression=getText('custom-dice');
      if(!/^\d{1,3}d\d{1,4}(?:\s*(?:k[hl]\d{1,2}|[+\-*/()]|\d|\s))*$/i.test(expression)) return toast('Enter a simple dice expression, such as 2d6+3.');
      sendToRoll20((name==='gmRoll'?'/gmroll ':'/roll ')+expression);break;
    }
    case 'scanSheets':scanSheets();if(!RB.openSheets?.length)sheetTourPromptOpen();break;
    case 'sheetTourAll':sheetTourStart();break;
    case 'sheetTourCancel':sheetTourCancel();break;
    case 'syncSheet':syncSheetDeep();break;
    case 'unlinkSheet':if(confirm('Stop syncing? Imported entries remain until deleted.')){p.sheetLink=null;RB.sheetSignature=null;changedProfile();}break;
    case 'pasteSheet':{
      try{const snap=parseSheetPaste(getText('sheet-json'));if(!snap.coverage.attributes)throw Error('No named attributes found');
        applySheetSnapshot(p,snap);p.sheetLink.auto=false;RB.sheetSignature=null;changedProfile();
        toast('Imported '+snap.coverage.attributes+' pasted attributes.');
      }catch(err){toast('Invalid sheet JSON: '+err.message);}break;
    }
    case 'exportSheetFields':{
      const found=RB.openSheets?.[RB.selectedSheet||0];
      if(!found){toast('Scan an open sheet first.');break;}
      downloadText('roll20-visible-sheet-attributes.json',JSON.stringify(found.frame?RB.sheetWarm?.scan?.fields||{}:readSheetFields(found.root),null,2),'application/json');break;
    }
    case 'exportSheetReport':{
      const found=RB.openSheets?.[RB.selectedSheet||0];
      if(!found){toast('Scan an open character sheet first.');break;}
      const named=found.frame?RB.sheetWarm?.scan?.fields||{}:readSheetFields(found.root),visible=found.frame?RB.sheetWarm?.scan?.visible||beaconImportVisible({innerText:''},found.name):beaconImportVisible(found.root,found.name);
      // User-triggered local file only; never upload or automatically transmit.
      downloadText('roll20-embetterment-local-sheet-scan.json',JSON.stringify({
        guide:'Contains sheet text visible to you, including character details. Review before sharing.',
        character:found.name,
        namedAttributeNames:Object.keys(named),
        visibleSections:visible.coverage.sections,
        visibleFieldNames:visible.coverage.names,
        extracted:{stats:visible.stats,abilityScores:visible.abilityScores,
          abilityMods:visible.abilityMods,saveBonuses:visible.saveBonuses,
          skillBonuses:visible.skillBonuses,resources:visible.resources,attacks:visible.attacks},
        renderedText:beaconVisibleText(found.root).slice(0,18000)
      },null,2),'application/json');break;
    }
    case 'runSheetAction':{
      const chosen=(p.attacks||[]).find(x=>x.id===id);
      if(chosen?.command)sendToRoll20(chosen.command);
      else toast('No accessible Roll20 attack button. Roll from the original character sheet.');break;
    }
    case 'slot':executeSlot(ix);break;
    case 'runMacro':runMacro(id);break;
    case 'editMacro':RB.editMacro=id;render();break;
    case 'cancelMacro':RB.editMacro=null;render();break;
    case 'favMacro': {const m=RB.state.macros.find(x=>x.id===id);if(m)m.favorite=!m.favorite;changedProfile();break;}
    case 'deleteMacro':if(confirm('Delete this local macro?')){RB.state.macros=RB.state.macros.filter(x=>x.id!==id);p.macrosSlots=p.macrosSlots.map(x=>x==='macro:'+id?'':x);changedProfile();}break;
    case 'saveMacro': {
      const macroName=getText('macro-name').slice(0,120), command=getText('macro-command').slice(0,3000);
      if(!macroName||!command)return toast('Macro needs a name and command.');
      const m=RB.state.macros.find(x=>x.id===RB.editMacro);
      const values={name:macroName,command,category:getText('macro-cat').slice(0,50)||'Custom'};
      if(m)Object.assign(m,values);else RB.state.macros.push({id:uid(),favorite:false,...values});
      RB.editMacro=null;changedProfile();break;
    }
    case 'saveSpell': {
      const spellName=getText('spell-name').slice(0,120);
      if(!spellName)return toast('Enter the spell name.');
      const spell={name:spellName,level:clamp(getInput('spell-level')?.value,0,9),range:getText('spell-range').slice(0,120),command:getText('spell-command').slice(0,3000),notes:getText('spell-notes').slice(0,2500),concentration:!!getInput('spell-conc')?.checked};
      const existing=p.spells.find(x=>x.id===RB.editSpell);
      if(existing)Object.assign(existing,spell);else p.spells.push({id:uid(),...spell});
      RB.editSpell=null;changedProfile();break;
    }
    case 'editSpell':RB.editSpell=id;render();break;
    case 'cancelSpell':RB.editSpell=null;render();break;
    case 'deleteSpell':if(confirm('Remove this local spell?')){p.spells=p.spells.filter(x=>x.id!==id);p.macrosSlots=p.macrosSlots.map(x=>x==='spell:'+id?'':x);changedProfile();}break;
    case 'castSpell':useSpell(id);break;
    case 'useSlot':if(ix>0&&ix<10&&p.usedSlots[ix]<p.spellSlots[ix]){p.usedSlots[ix]++;changedProfile();}else toast('No spell slots available at that level.');break;
    case 'restoreSlot':if(ix>0&&ix<10){p.usedSlots[ix]=Math.max(0,p.usedSlots[ix]-1);changedProfile();}break;
    case 'addResource':{const r=prompt('Resource name?','Lay on Hands');if(!r?.trim())break;const max=clamp(prompt('Maximum uses or points?','5'),0,99999);p.resources.push({id:uid(),name:r.trim().slice(0,120),max,current:max,reset:'long'});changedProfile();break;}
    case 'resourceDec':case 'resourceInc':{const r=p.resources.find(x=>x.id===id);if(r){r.current=clamp(r.current+(name==='resourceInc'?1:-1),0,r.max);changedProfile();}break;}
    case 'resourceEdit':{const r=p.resources.find(x=>x.id===id);if(!r)break;const title=prompt('Resource name',r.name);if(title===null)break;const max=prompt('Maximum',String(r.max));if(max===null)break;const reset=prompt('Reset on short or long rest?',r.reset||'long');if(reset===null)break;r.name=title.trim().slice(0,120)||r.name;r.max=clamp(max,0,99999);r.current=clamp(r.current,0,r.max);r.reset=reset==='short'?'short':'long';changedProfile();break;}
    case 'resourceDelete':if(confirm('Delete this local resource?')){p.resources=p.resources.filter(x=>x.id!==id);changedProfile();}break;
    case 'addItem': {
      const itemName=getText('item-name').slice(0,120);if(!itemName)return toast('Enter an item name.');
      p.inventory.push({id:uid(),name:itemName,qty:clamp(getInput('item-qty')?.value,1,99999),weight:Math.max(0,Math.min(100000,Number(getInput('item-weight')?.value)||0)),category:getText('item-cat').slice(0,70)||'Gear'});changedProfile();break;
    }
    case 'deleteItem':if(confirm('Remove this local item?')){p.inventory=p.inventory.filter(x=>x.id!==id);changedProfile();}break;
    case 'exportNotes':downloadText('roll20-journal-'+new Date().toISOString().slice(0,10)+'.md',notesMarkdown(),'text/markdown;charset=utf-8');break;
    case 'addQuest': {const q=getText('quest-text').slice(0,500);if(q){p.quests.push({id:uid(),text:q,done:false});changedProfile();}break;}
    case 'deleteQuest':p.quests=p.quests.filter(x=>x.id!==id);changedProfile();break;
    case 'timestamp':p.notes+='\n['+new Date().toLocaleString()+'] ';changedProfile();break;
    case 'addLog': {const entry=getText('log-entry');if(entry){record(entry);render();}break;}
    case 'applyChat':s.chatSearch=getText('chat-search');s.chatKind=getInput('chat-kind')?.value||'all';save();applyChatFilter();toast('Local chat filter applied.');break;
    case 'clearChat':clearChatFilter();render();break;
    case 'sendText':case 'sendEmote':case 'sendOOC':case 'sendWhisper': {
      const msg=getText('chat-message');if(!msg)return toast('Enter a message.');
      const prefix=({sendText:'',sendEmote:'/em ',sendOOC:'/ooc ',sendWhisper:'/w gm '})[name];
      if(sendToRoll20(prefix+msg))getInput('chat-message').value='';break;
    }
    case 'switchProfile':RB.state.current=getInput('profile-select').value;RB.editSpell=null;RB.editMacro=null;RB.openSheets=[];RB.sheetSignature=null;changedProfile();break;
    case 'newProfile':{const name=prompt('Name for new character profile?','New Adventurer');if(name?.trim()){const next=newProfile(name.trim().slice(0,100));RB.state.profiles.push(next);RB.state.current=next.id;changedProfile();}break;}
    case 'renameProfile':{const name=prompt('Rename current profile?',p.name);if(name?.trim()){p.name=name.trim().slice(0,100);changedProfile();}break;}
    case 'deleteProfile':if(RB.state.profiles.length===1)toast('Keep at least one profile.');else if(confirm('Delete '+p.name+' and all locally saved character data?')){RB.state.profiles=RB.state.profiles.filter(x=>x.id!==p.id);RB.state.current=RB.state.profiles[0].id;changedProfile();}break;
    case 'debugExport':{
      const current=profile(),link=current.sheetLink||null,scan=RB.sheetWarm?.scan||null;
      const report={
        generatedAt:new Date().toISOString(),
        r20ebVersion:RB.version,
        storageKey:RB.key,
        profile:{id:current.id,name:current.name,
          counts:{attacks:(current.attacks||[]).length,spells:(current.spells||[]).length,
            inventory:(current.inventory||[]).length,resources:(current.resources||[]).length,
            features:(current.features||[]).length,proficiencies:(current.proficiencies||[]).length,
            tools:(current.tools||[]).length}},
        sheetLink:link?{name:link.name||'',edition:link.edition||'',lastSync:link.lastSync||null,
          auto:!!link.auto,counts:link.counts||{},coverage:link.coverage?{
            attributes:link.coverage.attributes||0,visibleFields:link.coverage.visibleFields||0,
            mapped:link.coverage.mapped||0,unmappedCount:(link.coverage.unmapped||[]).length}:null}:null,
        runtime:{openSheets:(RB.openSheets||[]).length,cachedAttributes:Object.keys(scan?.fields||{}).length,
          sheetTourBusy:!!RB.sheetTourBusy,sheetTourWaiting:!!RB.sheetTourWaiting},
        controlledCharacters:{assignmentCount:Object.keys(RB.state.tokenAssignments||{}).length,
          assignments:Object.values(RB.state.tokenAssignments||{}).slice(0,100).map(a=>({tokenId:a.tokenId,tokenName:a.tokenName,characterId:a.characterId,characterName:a.characterName,profileId:a.profileId})),
          autoImportBusy:!!RB.autoCharacterImportBusy,lastScan:RB.autoCharacterLastScan||null},
        tokenTracking:{source:RB.radial?.source||'none',matchedName:RB.radial?.lastPlayerToken?.name||null,
          pinned:!!RB.radial?.manual},
        note:'Local diagnostics only. This report intentionally omits journal text and full character-sheet values.'
      };
      downloadText('r20eb-debug-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json',
        JSON.stringify(report,null,2),'application/json');break;
    }
    case 'debugClearSheetCache':
      clearSheetRuntimeState();save();render();toast('Cleared R20eb sheet scan/cache state. Roll20 was not changed.');break;
    case 'debugRedetectToken':
      if(typeof radialMarkPlayerOverlay==='function')radialMarkPlayerOverlay(null);
      if(RB.radial){RB.radial.manual=null;RB.radial.anchor=null;RB.radial.source='none';RB.radial.lastPlayerToken=null;RB.radial.lastPresence=false;}
      radialPosition();render();toast('R20eb player-token tracking reset. Roll20 token data was not changed.');break;
    case 'debugAutoImportControlled':
      RB.autoCharacterImported=new Set();
      autoImportControlledCharacters().then(()=>{render();toast('Controlled-character scan complete.');})
        .catch(err=>{console.warn('[R20eb] Manual controlled-character scan failed',err);toast('Controlled-character scan failed; see console.');});
      break;
    case 'debugClearImported':
      if(confirm('Clear imported sheet data for '+p.name+' from R20eb only? This does not modify the Roll20 character sheet. Local journal entries and locally-created spells/items/resources will be kept.')){
        clearImportedSheetData();
        if(RB.radial){RB.radial.path=[];RB.radial.pages={};}
        render();toast('Imported R20eb sheet data cleared. Roll20 was not changed.');
      }break;
    case 'debugResetCharacter':
      if(confirm('Clear ALL current R20eb character data for '+p.name+'? This resets this local R20eb profile but does not modify the Roll20 character sheet.')){
        resetCurrentProfileData();
        if(RB.radial){RB.radial.path=[];RB.radial.pages={};RB.radial.manual=null;RB.radial.anchor=null;}
        render();toast('Current R20eb character data cleared. Roll20 was not changed.');
      }break;
    case 'resetPosition':RB.state.ui.panelX=null;RB.state.ui.panelY=null;RB.state.ui.panelWidth=520;changedProfile();break;
    case 'exportBackup':exportBackup();break;
    case 'copyCommand':copyText(RB.pendingCommand||'');break;
    case 'closeModal':RB.modal=null;render();break;
    case 'openPalette':RB.paletteOpen=true;RB.paletteQuery='';RB.paletteSelection=0;render();getInput('palette-input')?.focus();break;
    case 'closePalette':RB.paletteOpen=false;render();break;
    case 'paletteGo':navigatePalette(el.dataset.value,el.dataset.id);break;
    default:console.warn('[roll20 Embetterment] Unknown action',name);
  }
}
function navigatePalette(kind,id) {
  RB.paletteOpen=false;
  if(kind==='tab'){RB.tab=id;RB.state.ui.lastTab=id;RB.visible=true;save();render();}
  else if(kind==='macro') {runMacro(id);render();}
  else if(kind==='spell')useSpell(id);
  else if(kind==='attack'){const a=(profile().attacks||[]).find(x=>x.id===id);if(a?.command)sendToRoll20(a.command);else toast('Sheet action button unavailable.');}
  else if(kind==='skill'||kind==='save') {quickRoll(kind,id);render();}
}
function onClick(e) {
  const control=e.target.closest('[data-action]');
  if(!control||!RB.shadow.contains(control))return;
  e.preventDefault();action(control.dataset.action,control);
}
function onChange(e) {
  const el=e.target,p=profile();
  if(el.matches('[data-field]')) {
    const field=el.dataset.field;
    if(field==='concentration') p.concentration=el.value.slice(0,300);
    else if(field==='movementUsed') p.movementUsed=clamp(el.value,0,9999);
    else setValue(field,el.value);
    save();render();
  } else if(el.matches('[data-toggle]')){p[el.dataset.toggle]=el.checked;save();render();}
  else if(el.matches('[data-death]')){p.death[el.dataset.death]=el.checked?int(el.dataset.count):int(el.dataset.count)-1;save();render();}
  else if(el.matches('[data-sheet-pick]')){RB.selectedSheet=clamp(el.value,0,Math.max(0,(RB.openSheets||[]).length-1));RB.sheetSignature=null;save();render();}
  else if(el.matches('[data-sheet-auto]')){p.sheetLink=p.sheetLink||{name:p.name};p.sheetLink.auto=el.checked;save();render();}
  else if(el.matches('[data-panel-width]')){RB.state.ui.panelWidth=clamp(el.value,360,920);save();render();}
  else if(el.matches('[data-slot]')){p.macrosSlots[clamp(el.dataset.slot,0,7)]=el.value;save();render();}
  else if(el.matches('[data-slot-max]')){const i=clamp(el.dataset.slotMax,1,9);p.spellSlots[i]=clamp(el.value,0,99);p.usedSlots[i]=Math.min(p.usedSlots[i],p.spellSlots[i]);save();render();}
  else if(el.matches('[data-slot-used]')){const i=clamp(el.dataset.slotUsed,1,9);p.usedSlots[i]=clamp(el.value,0,p.spellSlots[i]);save();render();}
  else if(el.matches('[data-item-qty]')){const item=p.inventory.find(x=>x.id===el.dataset.itemQty);if(item)item.qty=clamp(el.value,0,99999);save();render();}
  else if(el.matches('[data-quest]')){const q=p.quests.find(x=>x.id===el.dataset.quest);if(q)q.done=el.checked;save();render();}
  else if(el.id==='rbe-import') importBackup(el.files?.[0]);
}
function onSettingChange(e) {
  const el=e.target;
  if(!el.matches('[data-setting]'))return;
  const key=el.dataset.setting,s=RB.state.settings;
  if(!Object.hasOwn(s,key))return;
  s[key]=el.type==='checkbox'?el.checked:key==='scale'?Number(el.value):el.value;
  save();render();
}
function onInput(e) {
  const el=e.target;
  if(el.id==='rbe-notes'){profile().notes=el.value.slice(0,100000);clearTimeout(RB.noteTimer);RB.noteTimer=setTimeout(save,250);}
  if(el.id==='rbe-macro-search'){RB.macroSearch=el.value;const n=getInput('macro-results');if(n)n.innerHTML=macroListHTML(RB.state.macros);}
  if(el.id==='rbe-spell-search'){RB.spellSearch=el.value;const n=getInput('spell-results');if(n)n.innerHTML=spellListHTML();}
  if(el.id==='rbe-palette-input'){RB.paletteQuery=el.value;RB.paletteSelection=0; // defer to preserve focus and caret
    const choices=paletteEntries().filter(x=>x.name.toLowerCase().includes(el.value.toLowerCase())).slice(0,30);
    const n=getInput('palette-results');if(n)n.innerHTML=choices.map((x,i)=>`<button class="palette-choice ${i===0?'on':''}" data-action="paletteGo" data-value="${html(x.kind)}" data-id="${html(x.value)}">${html(x.name)}</button>`).join('')||'<p class="hint">Nothing found.</p>';
  }
}
// Roll20 shortcuts are registered outside this ShadowRoot. Stop keyboard
// events at the ShadowRoot, after inputs receive them, so Roll20 cannot treat
// B, V, Z and other typed keys as tabletop commands. Never preventDefault.
function keepEmbettermentKeysLocal(e) { e.stopPropagation(); }
function onKeyDown(e) {
  if(e.key==='Escape' && RB.radial?.path?.length){RB.radial.path.pop();render();radialPosition();return;}
  if(e.key==='Escape' && (RB.paletteOpen||RB.modal)){RB.paletteOpen=false;RB.modal=null;render();return;}
  const origin=e.composedPath?.()[0] || e.target;
  const editing=origin?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
  const insideEmbetterment=e.composedPath?.().includes(RB.root) || false;
  if(!editing&&e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyR'){e.preventDefault();RB.radial.open=!RB.radial.open;render();radialPosition();return;}
  if(insideEmbetterment&&['Enter',' '].includes(e.key)&&origin?.dataset?.action==='radialPick'){e.preventDefault();radialPick(int(origin.dataset.depth),int(origin.dataset.index));return;}
  if(!editing&&e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyE'){
    e.preventDefault();RB.visible=!RB.visible;render();return;
  }
  if(e.altKey&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyK'){
    e.preventDefault();RB.paletteOpen=!RB.paletteOpen;RB.paletteSelection=0;RB.paletteQuery='';render();getInput('palette-input')?.focus();return;
  }
  if(RB.paletteOpen && origin?.id==='rbe-palette-input'){
    const options=paletteEntries().filter(x=>x.name.toLowerCase().includes((RB.paletteQuery||'').toLowerCase())).slice(0,30);
    if(e.key==='ArrowDown'){e.preventDefault();RB.paletteSelection=Math.min(options.length-1,RB.paletteSelection+1);highlightPalette();}
    if(e.key==='ArrowUp'){e.preventDefault();RB.paletteSelection=Math.max(0,RB.paletteSelection-1);highlightPalette();}
    if(e.key==='Enter'){e.preventDefault();const selected=options[RB.paletteSelection];if(selected)navigatePalette(selected.kind,selected.value);}
    return;
  }
  if(!editing&&!insideEmbetterment&&RB.state.settings.hotkeys&&!e.altKey&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey && /^Digit[1-8]$/.test(e.code)){
    e.preventDefault();executeSlot(Number(e.code.slice(-1))-1);
  }
}
function highlightPalette() {RB.shadow.querySelectorAll('.palette-choice').forEach((e,i)=>e.classList.toggle('on',i===RB.paletteSelection));}
function onDragStart(e) {
  if(e.target.closest('button,input,select,textarea'))return;
  if(!e.target.closest('#rbe-header')||!RB.panel)return;
  e.preventDefault();const r=RB.panel.getBoundingClientRect();RB.drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};
}
function onPointerMove(e) {
  if(!RB.drag)return;
  RB.state.ui.panelX=clamp(RB.drag.left+e.clientX-RB.drag.x,0,Math.max(0,window.innerWidth-100));
  RB.state.ui.panelY=clamp(RB.drag.top+e.clientY-RB.drag.y,0,Math.max(0,window.innerHeight-70));
  RB.panel.style.left=RB.state.ui.panelX+'px';RB.panel.style.top=RB.state.ui.panelY+'px';RB.panel.style.right='auto';RB.panel.style.bottom='auto';
}
function onPointerUp() {if(RB.drag){RB.drag=null;save();}}
function boot() {
  if(document.getElementById('roll20-embetterment-host'))return;
  load();
  RB.root=document.createElement('div');RB.root.id='roll20-embetterment-host';
  RB.root.attachShadow({mode:'open'});RB.shadow=RB.root.shadowRoot;
  document.body.append(RB.root);
  const css=document.createElement('style');css.id='rbe-chat-filter-css';css.textContent='[data-rbe-hidden="1"]{display:none!important}';document.head.append(css);
  RB.shadow.addEventListener('click',onClick);
  RB.shadow.addEventListener('change',e=>{onSettingChange(e);if(!e.target.matches('[data-setting]'))onChange(e);});
  RB.shadow.addEventListener('input',onInput);
  for (const type of ['keydown','keypress','keyup']) RB.shadow.addEventListener(type,keepEmbettermentKeysLocal);
  RB.shadow.addEventListener('pointerdown',onDragStart);
  window.addEventListener('pointermove',onPointerMove);
  window.addEventListener('pointerup',onPointerUp);
  document.addEventListener('keydown',onKeyDown,true);
  window.addEventListener('beforeunload',save);
  startBeaconParentBridge();
  setInterval(sheetAutoTick,12000);
  RB.visible=!!RB.state.settings.alwaysOpen;render();startRadialTracking();startAutoControlledCharacterImport();
}
// Never install the combat HUD inside the external character-sheet iframe.
const rbeStartup=isBeaconSheetDocument()?startBeaconFrameReader:isRoll20Editor()?boot:null;
if(rbeStartup){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rbeStartup,{once:true});
  else rbeStartup();
}