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
  // Native action requests never navigate tabs or search the whole page for
  // matching buttons. Only the currently visible Combat tab is eligible.
  if(!/^combat$/i.test(r3CurrentTabLabel()))return {error:'Open the Combat tab on the official character sheet.'};
  const rows=Array.from(document.querySelectorAll(
    R3_CATEGORIES.attacks+',.item-row'
  )||[]).slice(0,220).filter(r3Shown);
  const wanted=r3String(name,125).toLowerCase();
  if(!wanted||wanted.length>125)return {error:'A named attack is required.'};
  const matches=rows.filter(row=>r3Name(row,'attacks').toLowerCase()===wanted);
  // Nested duplicate selectors may point to the same row; avoid counting
  // shared parent/child rows as independent attack candidates.
  const distinct=matches.filter(row=>!matches.some(other=>other!==row&&
    other.contains?.(row)));
  if(distinct.length!==1)return {error:distinct.length?
    'Several matching visible attack rows; no action was triggered.':
    'No unique visible matching attack row. Open that attack on the Combat tab.'};
  const row=distinct[0];
  const buttons=Array.from(row.querySelectorAll?.('button,[role="button"]')||[])
    .slice(0,30).filter(r3Shown);
  const rolls=buttons.map(button=>({
    button,
    label:r3String(r3Attr(button,'aria-label')||r3Attr(button,'title')||r3Text(button,70),70)
  })).filter(x=>/^(?:roll\s+(?:attack|to\s+hit|attack\s+roll)|attack\s+roll|roll\s+to\s+hit)$/i.test(x.label));
  if(rolls.length!==1)return {error:rolls.length?
    'Several matching roll controls; no action was triggered.':
    'No explicitly labeled Roll Attack control in that row. No action was triggered.'};
  return {button:rolls[0].button,label:rolls[0].label};
}
function r3NativeReaderHandle(peer,data){
  if(!['native-probe','native-invoke'].includes(data?.type)||
      typeof data.id!=='string'||!/^r3-[\w.-]{4,100}$/.test(data.id))return;
  const respond=(status,message,extras={})=>{
    peer.postMessage(r3Msg('native-result',{id:data.id,status,
      message:r3String(message,240),session:R3_SESSION,...extras}),R3_EDITOR);
  };
  const name=r3String(data.name,125);
  if(data.kind!=='attacks'||!name||
    name.toLowerCase()!==r3NameFromDocument(document).toLowerCase()){
    respond('blocked','The requested attack does not belong to this open sheet.');return;
  }
  if(data.type==='native-probe'){
    const found=r3NativeAttackControl(name);
    if(!found.button){respond('blocked',found.error);return;}
    if(R3_NATIVE.tokens.size>=8)R3_NATIVE.tokens.clear();
    const token=(crypto.randomUUID?.()||('native-'+Date.now()+'-'+Math.random())).slice(0,100);
    R3_NATIVE.tokens.set(token,{name,label:found.label,peer,until:Date.now()+15000});
    respond('ready','A single native roll control was found. Confirm to click it once.',
      {token,label:found.label});return;
  }
  const token=r3String(data.token,100),record=R3_NATIVE.tokens.get(token);
  if(!record||record.peer!==peer||record.until<Date.now()||
     record.name.toLowerCase()!==name.toLowerCase()){
    respond('blocked','Native action confirmation expired. Inspect the roll again.');return;
  }
  R3_NATIVE.tokens.delete(token);
  const found=r3NativeAttackControl(name);
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
  const eligible=r3Candidates().filter(c=>c.visible&&c.window&&
    r3String(c.name,120).toLowerCase()===normalized&&
    (!R3_AUTO.characterId||!r3AutoId(c)||r3AutoId(c)===R3_AUTO.characterId));
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
  const match=R3_UI.snapshot?.attacks?.filter(x=>x.name===name)||[];
  if(match.length!==1){r3NativeStatus('Choose a unique imported attack.');return;}
  const candidate=r3NativeCandidate(R3_UI.snapshot.name);
  if(!candidate){r3NativeStatus('Open the matching official 2024 character sheet, then try again.');return;}
  R3_NATIVE.busy=true;r3NativeStatus('Checking the native roll control…');
  try{
    const result=await r3NativeRequest(candidate,'native-probe',{name});
    if(result.status==='ready'&&typeof result.token==='string'){
      R3_NATIVE.preview={name,token:result.token,window:candidate.window,label:result.label};
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
  const candidate=r3NativeCandidate(R3_UI.snapshot?.name);
  if(!candidate||candidate.window!==preview.window){
    r3NativeStatus('The official sheet changed. Inspect the roll again.');return;
  }
  R3_NATIVE.busy=true;r3NativeStatus('Requesting one native Roll20 click…');
  try{
    const response=await r3NativeRequest(candidate,'native-invoke',
      {name:preview.name,token:preview.token});
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
