// Two-step Roll20-native attack pilot. No macros, fabricated dice,
// automatic spell casts, resource spends or token movement.
// Source scan must find one real visible official-sheet "Roll Attack"
// control before a user can explicitly confirm a single native click.
const R3_NATIVE={pending:new Map(),tokens:new Map(),preview:null,busy:false,status:'',revision:0};
function r3NativeStatus(message){
  R3_NATIVE.status=r3String(message,240);
  R3_NATIVE.revision++;
  r3HudRender?.();
}
function r3NativeAttackControl(name){
  const actualTab=r3CurrentTabLabel();
  if(!/^combat$/i.test(actualTab))
    return {error:'Open Combat on the official sheet (currently '+r3String(actualTab,35)+').'};
  const wanted=r3String(name,125).toLowerCase();
  if(!wanted)return {error:'A named attack is required.'};
  // The current importer recognizes both dedicated attack rows and generic
  // 2024 item titles. The native reader must use those SAME row families.
  const rows=Array.from(document.querySelectorAll(
    R3_CATEGORIES.attacks+',.item-row,[data-testid*="item-row"]'
  )||[]).slice(0,300).filter(r3Shown);
  const matches=rows.filter(row=>r3Name(row,'attacks').toLowerCase()===wanted);
  const titleElements=Array.from(document.querySelectorAll(
    '.span--item-row-title,.attack-item__title-chat,.attack-item__title-col,'+
    '[data-testid*="attack-name"]'
  )||[]).slice(0,250).filter(r3Shown)
    .filter(el=>r3Text(el,125).toLowerCase()===wanted);
  const found=[...matches];
  for(const el of titleElements){
    const row=r3InventoryRowFor(el);
    if(row&&r3Shown(row)&&!found.includes(row))found.push(row);
  }
  // Exclude overlapping nested candidates; a wrapper containing one matching
  // title is preferable to a child title alone.
  const distinct=found.filter(row=>!found.some(other=>other!==row&&
    other.contains?.(row)));
  if(distinct.length!==1)return {error:distinct.length?
    'Multiple visible rows for "'+r3String(name,45)+'" ('+distinct.length+
      '). No native click.':
    'No matching visible attack row for "'+r3String(name,45)+
      '" on Combat. Rows examined: '+rows.length+
      ', matching named titles: '+titleElements.length+'.'};
  const row=distinct[0];
  const buttons=Array.from(row.querySelectorAll?.(
    'button,[role="button"],[data-sheet-action="attack"],[data-action="attack"]'
  )||[]).slice(0,45).filter(r3Shown);
  const recognized=buttons.map(button=>{
    const label=r3String(r3Attr(button,'aria-label')||
      r3Attr(button,'title')||r3Text(button,70),70);
    const action=r3Attr(button,'data-sheet-action')||
      r3Attr(button,'data-action');
    const testId=r3Attr(button,'data-testid');
    const rollName=r3Attr(button,'name');
    const explicitlyLabeled=/^(?:roll\s+(?:attack|to\s+hit|attack\s+roll)|attack\s+roll|roll\s+to\s+hit)$/i.test(label);
    const explicitAction=action==='attack'||/^(?:roll[-_]?attack|attack[-_]?roll)$/i.test(testId)||
      (r3Attr(button,'type')==='roll'&&/^roll_attack(?:_|$)/i.test(rollName));
    return {button,label,explicitlyLabeled,explicitAction};
  }).filter(c=>c.explicitlyLabeled||c.explicitAction);
  if(recognized.length!==1){
    // Diagnostics deliberately contain only short public UI labels, never
    // private IDs, raw DOM, roll expressions, chat output or token secrets.
    const labels=buttons.map(button=>r3String(
      r3Attr(button,'aria-label')||r3Attr(button,'title')||
        r3Text(button,30),30)).filter(Boolean).slice(0,5);
    return {error:recognized.length?
      'Multiple possible attack roll controls; no click performed.':
      'Matched the attack row, but no verified roll control. '+
      'Visible button labels: '+(labels.join(', ')||'(unlabeled)')+'.'};
  }
  return {button:recognized[0].button,
    label:recognized[0].label||'Native attack roll'};
}
function r3NativeReaderHandle(peer,data){
  if(!['native-probe','native-invoke'].includes(data?.type)||
      typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  const respond=(status,message,extras={})=>{
    peer.postMessage(r3Msg('native-result',{id:data.id,status,
      message:r3String(message,240),session:R3_SESSION,...extras}),R3_EDITOR);
  };
  const characterName=r3String(data.characterName,120);
  const attackName=r3String(data.attackName,125);
  // The character identity and attack name are intentionally separate.
  // Characters across games do not share a fixed name or fixed attack list.
  if(data.kind!=='attacks'||!characterName||!attackName||
    characterName.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
    respond('blocked','This action does not belong to the open character sheet.');return;
  }
  if(data.type==='native-probe'){
    const found=r3NativeAttackControl(attackName);
    if(!found.button){respond('blocked',found.error);return;}
    if(R3_NATIVE.tokens.size>=8)R3_NATIVE.tokens.clear();
    const token=(crypto.randomUUID?.()||('native-'+Date.now()+'-'+Math.random())).slice(0,100);
    R3_NATIVE.tokens.set(token,{characterName,attackName,label:found.label,peer,
      until:Date.now()+15000});
    respond('ready','A single native roll control was found. Confirm to click it once.',
      {token,label:found.label});return;
  }
  const token=r3String(data.token,100),record=R3_NATIVE.tokens.get(token);
  if(!record||record.peer!==peer||record.until<Date.now()||
     record.characterName.toLowerCase()!==characterName.toLowerCase()||
     record.attackName.toLowerCase()!==attackName.toLowerCase()){
    respond('blocked','Native action confirmation expired. Inspect the roll again.');return;
  }
  R3_NATIVE.tokens.delete(token);
  const found=r3NativeAttackControl(attackName);
  if(!found.button||found.label!==record.label){
    respond('blocked','The native roll control changed. No click was performed.');return;
  }
  try{
    found.button.click();
    respond('clicked','Clicked the official Roll20 roll button once; check chat for the result.');
  }catch{
    respond('blocked','The official Roll20 roll control could not be clicked.');
  }
}
function r3NativeCandidate(name){
  // Select exactly one authenticated official sheet with the same character
  // identity; prefer a unique popout. Disallow conflicting IDs.
  const normalized=r3String(name,120).toLowerCase();
  if(!normalized)return null;
  // Auto-sync's pinned ID applies only to the same character. Never lock
  // someone else's imported character to a previous character's ID.
  const pinned=R3_AUTO.name.toLowerCase()===normalized?R3_AUTO.characterId:'';
  const eligible=r3Candidates().filter(c=>c.visible&&c.window&&
    r3String(c.name,120).toLowerCase()===normalized&&
    (!pinned||!r3AutoId(c)||r3AutoId(c)===pinned));
  const popouts=eligible.filter(c=>c.type==='popout');
  if(popouts.length>1)return null;
  if(popouts.length===1)return popouts[0];
  return eligible.length===1?eligible[0]:null;
}
function r3NativeRequest(candidate,type,params={}){
  return new Promise((resolve,reject)=>{
    if(!candidate?.window){reject(new Error('No unique matching official sheet is open.'));return;}
    const id='r3-'+R3_SESSION.replace(/[^a-z0-9.-]/gi,'').slice(0,40)+'-native-'+(++r3Counter);
    const timeout=setTimeout(()=>{
      R3_NATIVE.pending.delete(id);
      reject(new Error('The official sheet did not answer the native action request.'));
    },4000);
    R3_NATIVE.pending.set(id,{window:candidate.window,resolve,reject,timeout});
    try{candidate.window.postMessage(r3Msg(type,{id,kind:'attacks',...params}),R3_ORIGIN);}
    catch(e){clearTimeout(timeout);R3_NATIVE.pending.delete(id);reject(e);}
  });
}
function r3NativeResult(event,data){
  const request=R3_NATIVE.pending.get(data?.id);
  if(!request||request.window!==event.source)return;
  if(data.status!=='ready'&&data.status!=='blocked'&&data.status!=='clicked')return;
  clearTimeout(request.timeout);R3_NATIVE.pending.delete(data.id);
  request.resolve(data);
}
async function r3NativeProbe(name){
  if(R3_NATIVE.busy)return;
  R3_NATIVE.preview=null;
  const snap=R3_UI.snapshot;
  const match=snap?.attacks?.filter(x=>x.name===name)||[];
  if(match.length!==1||!snap?.name){
    r3NativeStatus('Choose a unique attack from the imported character.');return;
  }
  const characterName=r3String(snap.name,120);
  const candidate=r3NativeCandidate(characterName);
  if(!candidate){r3NativeStatus('Open the matching official 2024 character sheet, then try again.');return;}
  R3_NATIVE.busy=true;r3NativeStatus('Checking the native roll control…');
  try{
    const result=await r3NativeRequest(candidate,'native-probe',{characterName,attackName:name});
    if(result.status==='ready'&&typeof result.token==='string'){
      R3_NATIVE.preview={characterName,attackName:name,token:result.token,
        window:candidate.window,label:result.label};
      r3NativeStatus('Roll20 shows a native '+r3String(result.label,65)+
        ' control for '+name+'. Confirm to click once.');
    }else r3NativeStatus(result.message||'No verified native roll button was found.');
  }catch(e){r3NativeStatus(e.message||'Native action probe failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
}
async function r3NativeConfirm(){
  const preview=R3_NATIVE.preview;
  if(!preview||R3_NATIVE.busy)return;
  R3_NATIVE.preview=null; // one-time user confirmation, no double-click
  const characterName=r3String(R3_UI.snapshot?.name,120);
  const stillPresent=R3_UI.snapshot?.attacks?.filter(x=>x.name===preview.attackName)||[];
  const candidate=r3NativeCandidate(characterName);
  if(characterName.toLowerCase()!==preview.characterName.toLowerCase()||
     stillPresent.length!==1||!candidate||candidate.window!==preview.window){
    r3NativeStatus('The official sheet changed. Inspect the roll again.');return;
  }
  R3_NATIVE.busy=true;r3NativeStatus('Requesting one native Roll20 click…');
  try{
    const response=await r3NativeRequest(candidate,'native-invoke',
      {characterName,attackName:preview.attackName,token:preview.token});
    r3NativeStatus(response.message||'No native action result returned.');
  }catch(e){r3NativeStatus(e.message||'Native roll request failed.');}
  finally{R3_NATIVE.busy=false;r3HudRender();}
}
function r3NativeCancel(){R3_NATIVE.preview=null;r3NativeStatus('Native roll cancelled; nothing was clicked.');}
function r3NativeMarkup(){
  if(!R3_NATIVE.status&&!R3_NATIVE.preview)return '';
  return '<section class="hud-native-status" role="status">'+
    '<span>'+r3Escape(R3_NATIVE.status)+'</span>'+
    (R3_NATIVE.preview?'<button type="button" id="r3-hud-native-confirm">Confirm native roll</button>'+
      '<button type="button" id="r3-hud-native-cancel">Cancel</button>':'')+
    '</section>';
}
