'use strict';
// DOM-only adapter for Roll20 Beacon (2024) Advanced Tools > Attributes.
// Never reads private React state, calls Roll20 endpoints, or edits sheet values.
const SHEET_ATTRIBUTE_KEY=/^[a-z][a-z0-9_$.-]{0,119}$/i;
const SHEET_COMMON_KEYS=new Set(['ac','hp','hp_max','speed','level','class','name','race','species','pb','gp','cp','sp','ep','pp','wtype','initiative','inspiration']);
function sheetVisibleText(el) {
  if(!el)return '';
  const value=typeof el.innerText==='string'?el.innerText:el.textContent;
  return String(value??'').replace(/\u00a0/g,' ').trim();
}
function sheetAttributeKey(value,loose=false) {
  const key=String(value??'').trim().replace(/^attr_/i,'');
  if(!SHEET_ATTRIBUTE_KEY.test(key)||/^(NAME|DESCRIPTION|VALUE|CURRENT|MAX|LOCK|LOCKED|ATTRIBUTES|EDIT|DELETE|CANCEL|SAVE|PENCIL|UNLOCK)$/i.test(key))return '';
  return loose||key.includes('_')||key.includes('-')||SHEET_COMMON_KEYS.has(key.toLowerCase())?key:'';
}
function sheetAttributeRow(row,loose=false) {
  if(!row)return null;
  // Preserve empty cells. 2024 Advanced Tools renders Name | Description |
  // Value | Lock, and filtering empties shifts descriptions into value slots.
  const cells=Array.from(row.children||[]).map(c=>sheetVisibleText(c));
  if(cells.length<3||cells.length>12)return null;
  const pos=cells.findIndex((v,i)=>i<2&&!!sheetAttributeKey(v,loose));
  if(pos<0||cells.length<=pos+2)return null;
  const key=sheetAttributeKey(cells[pos],loose),value=cells[pos+2];
  if(value.length>10000)return null;
  return {key,value};
}
function sheetReadBeaconAttributeRows(scope) {
  const out={};
  if(!scope?.querySelectorAll)return out;
  const read=(row,loose=false)=>{
    const found=sheetAttributeRow(row,loose);
    if(found&&!(found.key in out))out[found.key]={current:found.value,max:''};
  };
  const explicit=scope.querySelectorAll('tbody tr,[role="row"],[data-testid*="attribute-row"],[data-testid*="attributeRow"],[class*="attribute-row"],[class*="AttributeRow"]');
  for(const row of Array.from(explicit||[]).slice(0,7000))read(row,true);
  // Beacon's Advanced Tools can render rows as anonymous nested divs.
  const leaves=scope.querySelectorAll('span,div,p,td,label,[role="cell"]');
  for(const el of Array.from(leaves||[]).slice(0,16000)){
    const name=sheetAttributeKey(sheetVisibleText(el),true);
    if(!name)continue;
    if(Array.from(el.children||[]).some(child=>sheetVisibleText(child)===name))continue;
    let parent=el.parentElement;
    for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
      if(sheetVisibleText(parent).length>650)break;
      const found=sheetAttributeRow(parent,true);
      if(found&&found.key===name){out[name]={current:found.value,max:''};break;}
    }
  }
  return out;
}
function sheetScrollableAttributeContainer(scope) {
  if(!scope?.querySelectorAll)return null;
  // Some Beacon lists put the scrollbar on a parent of the visible row,
  // not on the element containing the values themselves.
  const sources=[
    ...Array.from(scope.querySelectorAll('tbody tr,[role="row"],[data-testid*="attribute-row"],[class*="attribute-row"]')||[]),
    ...Array.from(scope.querySelectorAll('span,div,td,label,[role="cell"]')||[])
  ].slice(0,16000);
  let best=null,highest=-Infinity;
  for(const source of sources){
    const label=sheetVisibleText(source);
    // Use visible attribute rows rather than a generic dialog's scroll area.
    if(!sheetAttributeKey(label,true) &&
       !sheetAttributeRow(source,true) &&
       !Array.from(source.children||[]).some(el=>sheetAttributeKey(sheetVisibleText(el),true)))continue;
    let node=source;
    for(let depth=0;node&&depth<13;depth++,node=node.parentElement){
      if(node===scope?.ownerDocument?.body)break;
      const height=Number(node.clientHeight),total=Number(node.scrollHeight);
      if(!(height>=65&&total>height+18&&total<2500000))continue;
      let overflow='';
      try{overflow=node.ownerDocument?.defaultView?.getComputedStyle?.(node)?.overflowY||'';}catch{}
      const isScroll=/auto|scroll|overlay/i.test(overflow);
      const score=(isScroll?100:0)+Math.min(25,Math.log2(total/height)*6)-depth*4;
      if(score>highest){highest=score;best=node;}
      // A close, explicitly scrollable ancestor is more reliable than a
      // distant modal containing multiple scrollable panels.
      if(isScroll)break;
    }
  }
  // Avoid touching Roll20's whole tabletop/page when no attribute scroller
  // can be reliably identified.
  return best;
}
function sheetExpectedAttributeCount(scope) {
  const text=sheetVisibleText(scope).slice(0,55000);
  const matches=[...text.matchAll(/\bAttributes\s*(?:\(|:)?\s*(\d{2,4})\b/gi)].map(m=>Number(m[1]));
  return matches.find(n=>n>0&&n<=6000)||0;
}
function sheetFrozenScrollCover(scroll) {
  // Clone only the user's already visible portion into a noninteractive
  // overlay. React can render virtual rows underneath without a visible
  // scroll animation. It is discarded immediately after the scan.
  const doc=scroll?.ownerDocument,rect=scroll?.getBoundingClientRect?.();
  if(!doc?.body?.appendChild||!doc.createElement||!scroll.cloneNode||!rect||rect.width<40||rect.height<50)return ()=>{};
  let cover=null,original='',priority='';
  try{
    const clone=scroll.cloneNode(true);
    clone.removeAttribute?.('id');
    clone.querySelectorAll?.('script,iframe,[id]')?.forEach(el=>{
      if(el.matches?.('script,iframe'))el.remove();
      else el.removeAttribute('id');
    });
    cover=doc.createElement('div');
    cover.setAttribute?.('aria-hidden','true');
    cover.style.cssText='position:fixed;z-index:2147483000;pointer-events:none;overflow:hidden;isolation:isolate;';
    Object.assign(cover.style,{left:rect.left+'px',top:rect.top+'px',
      width:rect.width+'px',height:rect.height+'px'});
    clone.style.width='100%';clone.style.height='100%';
    clone.style.maxWidth='none';clone.style.maxHeight='none';
    clone.style.pointerEvents='none';clone.style.overflow='hidden';
    cover.appendChild(clone);
    doc.body.appendChild(cover);
    if(Number.isFinite(scroll.scrollTop))clone.scrollTop=scroll.scrollTop;
    original=scroll.style?.getPropertyValue?.('visibility')||'';
    priority=scroll.style?.getPropertyPriority?.('visibility')||'';
    scroll.style?.setProperty?.('visibility','hidden','important');
    return ()=>{
      if(original)scroll.style?.setProperty?.('visibility',original,priority);
      else scroll.style?.removeProperty?.('visibility');
      cover.remove?.();
    };
  }catch(err){
    if(original)scroll.style?.setProperty?.('visibility',original,priority);
    else scroll.style?.removeProperty?.('visibility');
    cover?.remove?.();
    return ()=>{};
  }
}
function sheetSetScrollTop(element,value) {
  element.scrollTop=value;
  // Some virtual list implementations use explicit scroll listeners.
  // Assignment normally emits scroll, so avoid duplicate synthetic events.
}
async function sheetHarvestBeaconRows(scope,notify) {
  const result=readSheetFields(scope),scroll=sheetScrollableAttributeContainer(scope);
  if(!scroll)return {fields:result,scannedPages:1,full:false,expected:sheetExpectedAttributeCount(scope)};
  const expected=sheetExpectedAttributeCount(scope);
  const original=Number(scroll.scrollTop)||0;
  const freeze=sheetFrozenScrollCover(scroll);
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const collect=()=>Object.assign(result,readSheetFields(scope));
  const step=Math.max(45,Math.floor(scroll.clientHeight*.58));
  let scannedPages=0,full=false,atBottom=0;
  let previousNames='',still=0;
  const started=Date.now();
  try{
    sheetSetScrollTop(scroll,0);
    await pause(110);
    for(let i=0;i<320&&Date.now()-started<35000;i++){
      collect();
      scannedPages++;
      const names=Object.keys(result).sort().join('|');
      still=names===previousNames?still+1:0;
      previousNames=names;
      if(notify&&i%22===0)notify(Object.keys(result).length);
      const bottom=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
      if(expected&&Object.keys(result).length>=expected){full=true;break;}
      if(scroll.scrollTop>=bottom-3){
        // Lazy loading may increase scrollHeight only after a render/network
        // tick; wait and re-check instead of stopping at the first "bottom".
        atBottom++;
        await pause(atBottom===1?350:300);
        collect();
        const updatedBottom=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
        if(scroll.scrollTop>=updatedBottom-3&&atBottom>=5){
          full=!expected||Object.keys(result).length>=expected;
          break;
        }
        if(updatedBottom>scroll.scrollTop+3){atBottom=0;continue;}
      }else atBottom=0;
      const old=scroll.scrollTop;
      sheetSetScrollTop(scroll,Math.min(bottom,old+step));
      await pause(120);
      collect();
      if(scroll.scrollTop<=old&&bottom>old){
        // Frameworks can defer a scroll operation until the next frame.
        await pause(220);
        if(scroll.scrollTop<=old)break;
      }
      if(still>9){await pause(280);still=0;}
    }
  }finally{
    // Always restore Roll20's scroll position and unfreeze the visible list,
    // even if a scan throws or the user closes a sheet mid-import.
    try{sheetSetScrollTop(scroll,original);}finally{freeze();}
  }
  collect();
  return {fields:result,scannedPages,full,expected};
}
function sheetFormCandidates(root){
  if(!root?.querySelectorAll)return [];
  const selectors='form.charsheet,.charsheet,.sheetform,.characterdialog,[data-testid*="character-sheet"],[class*="character-sheet"],.ui-dialog,[role="dialog"],[aria-modal="true"],[data-sheet-id],[data-character-id]';
  let nodes=[];
  try{nodes=Array.from(root.querySelectorAll(selectors)||[]);}catch{return nodes;}
  if(root.nodeType===9&&root.body)nodes.push(root.body);
  return Array.from(new Set(nodes)).slice(0,160);
}
function sheetMeaningfulName(name){
  return name&&!/^(?:Open character sheet|Character Sheet|pencil|edit|settings|attributes|advanced tools|character|sheet)$/i.test(name.trim());
}
function sheetSheetHint(text){
  return /(?:\bCharacter Sheet\b|\bAdvanced Tools\b|\bHIT POINTS\b|\bABILITIES\b|\bSAVING THROWS\b|\bATTRIBUTES\b)/i.test(text);
}
function sheetCandidateScore(fields,visible,text,name,node) {
  const count=Object.keys(fields).length;
  if(count===0 && visible.coverage.visibleFields===0)return -1;
  let score=Math.min(count,400)*2+visible.coverage.visibleFields*9;
  if(sheetMeaningfulName(name))score+=55;
  if(sheetSheetHint(text))score+=30;
  if(/\bAdvanced Tools\b/i.test(text)&&/\bAttributes\b/i.test(text))score+=22;
  if(node.matches?.('.ui-dialog,[role="dialog"],[data-character-id]'))score+=10;
  return score;
}
