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
  for(const key of ['attacks','resources','spells','inventory','features','proficiencies','tools']){
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
async function sheetTourStart() {
  if(RB.sheetTourBusy)return;
  const sheets=sheetCandidates(document);
  if(!sheets.length){sheetTourPromptOpen();return;}
  if(RB.sheetTourWaiting)sheetTourCancel();
  RB.openSheets=sheets;
  const preferred=profile().sheetLink?.source;
  const selected=RB.openSheets.findIndex(s=>s.id===preferred);
  RB.selectedSheet=selected>=0?selected:Math.min(RB.selectedSheet||0,sheets.length-1);
  const candidate=RB.openSheets[RB.selectedSheet],profileId=RB.state.current;
  RB.sheetTourBusy=true;
  sheetTourStatus('Importing '+candidate.name+' — reading all available tabs…');
  if(RB.visible&&RB.tab==='Sheet')render();
  const acc=sheetTourAccumulator(),dialog=candidate.root;
  const tabs=sheetTourTabs(dialog,RBE_SHEET_TOUR_MAIN,'.asv__header__nav__tabs_link');
  const original=tabs.find(sheetTourActive)||tabs[0]||null;
  try{
    // Read the active tab before changing it.
    await sheetTourCollect(dialog,acc,'Current Roll20 view',false);
    const main=tabs.find(x=>sheetTourLabel(x)==='Character Sheet');
    if(main && !sheetTourActive(main)){main.click?.();await sheetTourDelay(250);}
    if(beaconRemoteCandidate(candidate)){
      sheetTourStatus(candidate.popoutWindow?'Reading official popout tabs…':'Reading Combat, Spells, Inventory and Features…');
      const scan=await requestBeaconFrame(candidate,true,{tour:true});
      sheetTourAdd(acc,scan,candidate.popoutWindow?'Official sheet popout':'Character Sheet');
    }else{
      await sheetTourCollect(dialog,acc,'Character Sheet',true);
    }
    for(const label of ['Bio & Info','Advanced Tools']){
      const tab=tabs.find(x=>sheetTourLabel(x)===label);
      if(!tab)continue;
      if(!sheetTourActive(tab)){tab.click?.();await sheetTourDelay(280);}
      sheetTourStatus('Reading '+label+'…');
      if(label==='Advanced Tools'){
        const attrs=Array.from(dialog.querySelectorAll?.('button,[role="tab"]')||[])
          .find(el=>/^Attributes(?:\s+\d+)?$/i.test(sheetTourLabel(el)) &&
            !el.disabled);
        if(attrs){attrs.click?.();await sheetTourDelay(300);}
      }
      await sheetTourCollect(dialog,acc,label,true);
    }
    if(RB.state.current!==profileId||dialog?.isConnected===false)
      throw new Error('Character sheet or local profile changed during import.');
    // One transaction: no intermediate partial tab results overwrite the profile.
    const didImport=beaconRemoteCandidate(candidate)?beaconFrameSnapshot(candidate,acc):
      applySheetSnapshot(profile(),mergeBeaconSnapshot(snapshotSheet(acc.fields,candidate.name),acc.visible));
    if(!didImport)throw new Error('No accessible values were found in the opened sheet.');
    if(!beaconRemoteCandidate(candidate)){profile().sheetLink.source=candidate.id;save();}
    profile().sheetLink.tabsVisited=acc.tabs;
    RB.sheetWarm={frame:candidate.frame||null,popoutSession:candidate.popoutSession||null,endpoint:candidate.frame?.contentWindow||candidate.popoutWindow||null,root:dialog||null,scan:acc,at:Date.now(),promise:null};
    save();
    sheetTourStatus('Imported '+Object.keys(acc.fields).length+' named attributes and '+
      acc.visible.coverage.visibleFields+' visible values from '+acc.tabs.length+' views.');
    toast('Character import complete: '+candidate.name+' ('+acc.tabs.length+' views).');
  }catch(err){
    sheetTourStatus('Import incomplete: '+String(err.message||err).slice(0,150));
    toast(RB.sheetTourStatus);
    console.warn('[roll20 Embetterment] Full sheet tour',err);
  }finally{
    if(original&&original.isConnected!==false&&!sheetTourActive(original)){
      original.click?.();await sheetTourDelay(180);
    }
    RB.sheetTourBusy=false;
    if(RB.visible&&RB.tab==='Sheet')render();
  }
}
