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
  if(!SHEET_ATTRIBUTE_KEY.test(key)||/^(NAME|DESCRIPTION|VALUE|CURRENT|MAX|LOCK|LOCKED|ATTRIBUTES)$/i.test(key))return '';
  return loose||key.includes('_')||key.includes('-')||SHEET_COMMON_KEYS.has(key.toLowerCase())?key:'';
}
function sheetAttributeRow(row,loose=false) {
  if(!row)return null;
  const pieces=Array.from(row.children||[]).map(c=>sheetVisibleText(c)).filter(Boolean);
  if(pieces.length<2||pieces.length>9)return null;
  const pos=pieces.findIndex(t=>!!sheetAttributeKey(t,loose));
  if(pos<0 || pos>1)return null;
  const key=sheetAttributeKey(pieces[pos],loose);
  const rest=pieces.slice(pos+1).filter(t=>!/^(?:locked|unlocked|edit|delete|save|cancel|🔒|🔓)$/i.test(t));
  if(rest.length===0)return null;
  // Name | Description | Value | (lock icon); the last readable column is value.
  let value=rest[rest.length-1];
  if(value==='-'&&rest.length===1)value='';
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
    const name=sheetAttributeKey(sheetVisibleText(el));
    if(!name)continue;
    if(Array.from(el.children||[]).some(child=>sheetVisibleText(child)===name))continue;
    let parent=el.parentElement;
    for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement){
      if(sheetVisibleText(parent).length>650)break;
      const found=sheetAttributeRow(parent);
      if(found&&found.key===name){out[name]={current:found.value,max:''};break;}
    }
  }
  return out;
}
function sheetScrollableAttributeContainer(scope) {
  if(!scope?.querySelectorAll)return null;
  const leaves=Array.from(scope.querySelectorAll('span,div,td,[role="cell"]')||[]).slice(0,14000);
  for(const el of leaves){
    const name=sheetAttributeKey(sheetVisibleText(el));
    if(!name || Array.from(el.children||[]).some(child=>sheetVisibleText(child)===name))continue;
    let p=el.parentElement;
    for(let depth=0;p&&depth<11;depth++,p=p.parentElement){
      if(typeof p.scrollHeight!=='number'||typeof p.clientHeight!=='number')continue;
      if(p.clientHeight>=120 && p.scrollHeight>p.clientHeight+32 && p.scrollHeight<1500000)return p;
    }
  }
  return null;
}
async function sheetHarvestBeaconRows(scope,notify) {
  const result=readSheetFields(scope);
  const scroll=sheetScrollableAttributeContainer(scope);
  if(!scroll)return {fields:result,scannedPages:1,full:false};
  const original=scroll.scrollTop,step=Math.max(65,Math.floor(scroll.clientHeight*0.67));
  let steps=0,hitBottom=false;
  const pause=()=>new Promise(resolve=>setTimeout(resolve,55));
  try {
    scroll.scrollTop=0;await pause();
    for(let i=0;i<160;i++){
      Object.assign(result,readSheetFields(scope));
      steps++;
      if(notify&&i%15===0)notify(Object.keys(result).length);
      if(scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-3){hitBottom=true;break;}
      const before=scroll.scrollTop;
      scroll.scrollTop=Math.min(scroll.scrollHeight-scroll.clientHeight,before+step);
      await pause();
      if(scroll.scrollTop<=before)break;
    }
  }finally {
    scroll.scrollTop=original;
  }
  return {fields:result,scannedPages:steps,full:hitBottom};
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
