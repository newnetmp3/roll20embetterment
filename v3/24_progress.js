// A small, independent progress surface. Counts authorized Journal sheets
// and reader-reported tab visits; no fake timer, no external requests.
// It disappears only after every discovered sheet finished successfully.
const R3_PROGRESS={lastPercent:-1,detailSignature:'',hidden:false,
  layoutObserver:null,layoutNodes:[]};
function r3ProgressState(){
  const roster=typeof R3_ROSTER==='object'?R3_ROSTER:null;
  const entries=roster?[...roster.entries.values()]:[];
  let done=0,total=0,finished=0;
  for(const entry of entries){
    const tabs=roster.tabProgress.get(entry.id)||{done:0,total:0};
    const tabTotal=Math.max(0,Math.min(32,tabs.total||0));
    const tabDone=Math.min(tabTotal,Math.max(0,tabs.done||0));
    total+=1+tabTotal;
    done+=tabDone+(entry.complete?1:0);
    if(entry.complete)finished++;
  }
  const errors=roster?[...roster.errors.values()].slice(0,24):[];
  const complete=entries.length>0&&finished===entries.length&&
    !roster.running&&errors.length===0;
  const percent=total?Math.min(100,Math.floor(done*100/total)):0;
  const current=roster?.entries.get(roster.currentId);
  const status=complete?'All available character sheets loaded':
    current?'Importing '+current.name+' · '+(finished+1)+' of '+entries.length:
    entries.length?('Preloading '+finished+' of '+entries.length+' character sheets'):
      'Discovering available Journal character sheets';
  return {total:entries.length,finished,percent,complete,errors,
    current:current?.name||'',status,mode:roster?.source||'unknown',
    details:entries.map(e=>{
      const tabs=roster.tabProgress.get(e.id)||{done:0,total:0};
      const error=roster.errors.get(e.id);
      return {name:e.name,loaded:e.complete,tabs:tabs.done||0,
        totalTabs:tabs.total||0,error:error||''};
    })};
}
// Constrain the status strip to the tabletop. Roll20's Journal/Chat tabs
// and native tools must never sit underneath an extension-owned full-width
// overlay. Use only DOM geometry; do not alter Roll20's layout.
function r3ProgressLayout(){
  const width=Number(window.innerWidth)||0;
  const height=Number(window.innerHeight)||0;
  if(width<360||height<180)return null;
  let left=width>=760?124:84;
  for(const selector of [
    '#floatingtoolbar','#toolbox','#tools','.floatingtoolbar',
    '#editingtoolbar','#main-toolbar','#actiontoolbar','#toolbar'
  ]){
    const rect=document.querySelector?.(selector)?.getBoundingClientRect?.();
    // Only recognize a slim, left-docked control: a horizontal header
    // spanning the top of the page must never be mistaken for a toolbar.
    if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.right)||
       rect.left< -10||rect.left>Math.min(180,width*.35)||
       rect.right<=0||rect.right>=width*.5||
       rect.width<12||rect.height<45)continue;
    left=Math.max(left,Math.ceil(rect.right)+14);
  }
  // Match the Firefox HUD's conservative chat reserve even when the
  // Journal panel is temporarily unmounted during Roll20 navigation.
  const fallback=width>=1150?330:width>=800?265:0;
  const inset=typeof r3BattlefieldChatInset==='function'?
    r3BattlefieldChatInset():fallback;
  let right=width-Math.max(0,Number(inset)||0)-14;
  for(const selector of [
    '#rightsidebar','#sidebar','#textchatcontainer','.rightsidebar','#textchat'
  ]){
    const rect=document.querySelector?.(selector)?.getBoundingClientRect?.();
    if(!rect||!Number.isFinite(rect.left)||!Number.isFinite(rect.right)||
       rect.width<130||rect.height<120||rect.left<width*.35||
       rect.left>=width-30||rect.right<width-90)continue;
    right=Math.min(right,Math.floor(rect.left)-14);
  }
  const available=Math.floor(right-left);
  // If Roll20 leaves no safe space, do not cover the toolbar or Journal to
  // force an indicator into view. The importer/debug status remains usable.
  if(available<160)return null;
  const barWidth=Math.min(420,available);
  return {left:Math.round(left+(available-barWidth)/2),
    top:Math.min(70,Math.max(52,Math.round(height*.075))),width:barWidth};
}
// Respond immediately to Roll20 resizing its native chat/sidebar or action
// toolbar, not just to the window resize and the regular preload refresh.
function r3ProgressWatchLayout(){
  if(typeof ResizeObserver!=='function')return;
  const nodes=[
    '#rightsidebar','#sidebar','#textchatcontainer','.rightsidebar',
    '#floatingtoolbar','#toolbox','#tools','#editingtoolbar','#main-toolbar','#toolbar'
  ].map(selector=>document.querySelector?.(selector)).filter(Boolean);
  const previous=R3_PROGRESS.layoutNodes;
  if(nodes.length===previous.length&&
     nodes.every((node,index)=>node===previous[index]))return;
  if(!R3_PROGRESS.layoutObserver)
    R3_PROGRESS.layoutObserver=new ResizeObserver(()=>r3ProgressRefresh());
  R3_PROGRESS.layoutObserver.disconnect();
  R3_PROGRESS.layoutNodes=nodes;
  for(const node of nodes)R3_PROGRESS.layoutObserver.observe(node);
}
function r3ProgressStyles(){
  return '#r3-loading-strip{position:fixed;top:60px;left:124px;right:auto;'+
    'width:360px;box-sizing:border-box;max-width:none;z-index:2147483100;'+
    'padding:4px 9px 5px;background:#1c2535;color:#f4f6fc;'+
    'font:12px/1.3 Tahoma,Arial,sans-serif;pointer-events:auto;'+
    'border:1px solid #778dad;border-radius:7px;box-shadow:0 2px 9px #0009}'+
    '#r3-loading-strip[hidden]{display:none!important}'+
    '#r3-loading-header{display:flex;align-items:center;gap:10px}'+
    '#r3-loading-label{max-width:58%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'+
    '#r3-loading-percentage{font-variant-numeric:tabular-nums;font-weight:bold;margin-left:auto}'+
    '#r3-loading-meter{display:block;width:100%;height:7px;margin:3px 0 0;'+
    'accent-color:#d2ad68}'+
    '#r3-loading-details{margin-top:3px}'+
    '#r3-loading-details summary{cursor:pointer;user-select:none;font-size:11px;color:#e8d3ac}'+
    '#r3-loading-errors{max-height:min(180px,35vh);overflow:auto;margin-top:4px;font-size:11px;white-space:normal;overflow-wrap:anywhere}'+
    '#r3-loading-errors>div{padding:2px 0;border-bottom:1px solid #3b4555}';
}
function r3ProgressMount(){
  const root=R3_UI.root;if(!root||root.getElementById('r3-loading-strip'))return;
  const host=document.createElement('div');host.id='r3-loading-strip';
  host.innerHTML='<div id="r3-loading-header">'+
    '<span id="r3-loading-label">Discovering Journal sheets…</span>'+
    '<strong id="r3-loading-percentage">0%</strong></div>'+
    '<progress id="r3-loading-meter" value="0" max="100" aria-label="Character sheet preload"></progress>'+
    '<details id="r3-loading-details"><summary>Details</summary>'+
    '<div id="r3-loading-errors"></div></details>';
  const style=document.createElement('style');
  style.textContent=r3ProgressStyles();
  root.appendChild(style);root.appendChild(host);
  window.addEventListener?.('resize',r3ProgressRefresh,{passive:true});
  r3ProgressRefresh();
}
function r3ProgressRefresh(){
  const root=R3_UI.root,host=root?.getElementById?.('r3-loading-strip');
  if(!host)return;
  r3ProgressWatchLayout();
  const state=r3ProgressState();
  const bounds=state.complete?null:r3ProgressLayout();
  host.hidden=state.complete||!bounds;
  R3_PROGRESS.hidden=host.hidden;
  if(bounds&&host.style){
    host.style.left=bounds.left+'px';
    host.style.top=bounds.top+'px';
    host.style.width=bounds.width+'px';
  }
  const label=root.getElementById('r3-loading-label');
  const percent=root.getElementById('r3-loading-percentage');
  const meter=root.getElementById('r3-loading-meter');
  if(label&&label.textContent!==state.status)label.textContent=state.status;
  if(percent)percent.textContent=state.percent+'%';
  if(meter)meter.value=state.percent;
  if(state.complete)return;
  const details=root.getElementById('r3-loading-details');
  const summary=details?.querySelector?.('summary');
  if(summary)summary.textContent=state.errors.length?
    'Details · '+state.errors.length+' error'+(state.errors.length===1?'':'s'):
    'Details · '+state.finished+'/'+state.total+' sheets';
  const errors=root.getElementById('r3-loading-errors');
  const signature=JSON.stringify(state.details);
  if(errors&&R3_PROGRESS.detailSignature!==signature){
    R3_PROGRESS.detailSignature=signature;
    errors.textContent='';
    for(const item of state.details.slice(0,80)){
      const row=document.createElement('div');
      row.textContent=item.name+' — '+(item.error||(
        item.loaded?'Ready ('+item.tabs+'/'+item.totalTabs+' tabs)':
          item.totalTabs?'Importing '+item.tabs+'/'+item.totalTabs+' tabs':'Pending'));
      errors.appendChild(row);
    }
    if(!state.total){
      const line=document.createElement('div');
      line.textContent='Waiting for visible Journal entries and authorized character models.';
      errors.appendChild(line);
    }
  }
}
