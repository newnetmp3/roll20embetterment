// A small, independent progress surface. Counts authorized Journal sheets
// and reader-reported tab visits; no fake timer, no external requests.
// It disappears only after every discovered sheet finished successfully.
const R3_PROGRESS={lastPercent:-1,detailSignature:'',hidden:false};
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
function r3ProgressStyles(){
  return '#r3-loading-strip{position:fixed;top:0;left:0;right:0;z-index:2147483100;'+
    'padding:3px 9px 4px;background:#1c2535;color:#f4f6fc;'+
    'font:12px/1.3 Tahoma,Arial,sans-serif;pointer-events:auto;'+
    'border-bottom:1px solid #778dad;box-shadow:0 2px 9px #0009}'+
    '#r3-loading-strip[hidden]{display:none!important}'+
    '#r3-loading-header{display:flex;align-items:center;gap:10px}'+
    '#r3-loading-label{max-width:58%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'+
    '#r3-loading-percentage{font-variant-numeric:tabular-nums;font-weight:bold;margin-left:auto}'+
    '#r3-loading-meter{display:block;width:100%;height:7px;margin:3px 0 0;'+
    'accent-color:#d2ad68}'+
    '#r3-loading-details{margin-top:3px}'+
    '#r3-loading-details summary{cursor:pointer;user-select:none;font-size:11px;color:#e8d3ac}'+
    '#r3-loading-errors{max-height:180px;overflow:auto;margin-top:4px;font-size:11px;white-space:normal}'+
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
  r3ProgressRefresh();
}
function r3ProgressRefresh(){
  const root=R3_UI.root,host=root?.getElementById?.('r3-loading-strip');
  if(!host)return;
  const state=r3ProgressState();
  host.hidden=state.complete;
  if(state.complete){R3_PROGRESS.hidden=true;return;}
  R3_PROGRESS.hidden=false;
  const label=root.getElementById('r3-loading-label');
  const percent=root.getElementById('r3-loading-percentage');
  const meter=root.getElementById('r3-loading-meter');
  if(label&&label.textContent!==state.status)label.textContent=state.status;
  if(percent)percent.textContent=state.percent+'%';
  if(meter)meter.value=state.percent;
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
