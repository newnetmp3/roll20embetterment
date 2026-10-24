// Firefox-only action-economy dashboard. Reads official sheet data; never
// silently spends Roll20 actions or clicks gameplay controls.
const R3_TURN={
  phase:'unknown',actionSpent:0,extraActions:0,bonusSpent:false,reactionSpent:false,
  movementUsed:0,dashes:0,attackUsed:0,bonusAttackUsed:0,attackAllowance:1,advanced:false,
  freeSpent:false,concentration:null,revision:0,lastTop:null,
  note:'Tracking locally. Select Start turn when ready.',noteSource:'manual'
};
function r3TurnKey(){return r3TokenSettingsKey()+':turn-economy';}
function r3TurnInt(v,min,max,fallback){
  return Number.isInteger(v)&&v>=min&&v<=max?v:fallback;
}
function r3TurnSpeed(snapshot=R3_UI.snapshot){
  const raw=snapshot?.stats?.speed;
  if(typeof raw==='number'&&Number.isInteger(raw)&&raw>=0&&raw<=500)return raw;
  const match=String(raw??'').trim().match(/^(\d{1,3})(?:\s*(?:ft\.?|feet))?$/i);
  const n=match?Number(match[1]):null;
  return n!==null&&n<=500?n:null;
}
function r3TurnState(){
  return {
    phase:R3_TURN.phase,actionSpent:R3_TURN.actionSpent,
    extraActions:R3_TURN.extraActions,bonusSpent:R3_TURN.bonusSpent,
    reactionSpent:R3_TURN.reactionSpent,movementUsed:R3_TURN.movementUsed,
    dashes:R3_TURN.dashes,attackUsed:R3_TURN.attackUsed,bonusAttackUsed:R3_TURN.bonusAttackUsed,
    attackAllowance:R3_TURN.attackAllowance,freeSpent:R3_TURN.freeSpent,
    concentration:R3_TURN.concentration
  };
}
function r3TurnDistance(value){
  if(!Number.isFinite(value))return '?';
  const rounded=Math.round(value*10)/10;
  return String(Object.is(rounded,-0)?0:rounded);
}
function r3TurnSync(){
  R3_HUD.used={
    action:R3_TURN.actionSpent>=1+R3_TURN.extraActions,
    bonus:R3_TURN.bonusSpent,
    reaction:R3_TURN.reactionSpent
  };
}
function r3TurnLeader(){
  try{
    // Jumpgate's direct Campaign model is the initiative source; observe
    // turnorder only. Do not touch the obsolete d20.Campaign namespace.
    const c=typeof r3TokenCampaign==='function'?r3TokenCampaign():
      window.Campaign;
    const raw=c?.get?.('turnorder')??c?.attributes?.turnorder;
    if(typeof raw==='string'&&raw.length>50000)return null;
    const list=typeof raw==='string'?JSON.parse(raw):raw;
    if(!Array.isArray(list)||list.length>200)return null;
    const id=list[0]?.id;
    // Roll20 custom round entries are not player tokens.
    return typeof id==='string'&&id.length>0&&id.length<=110&&id!=='-1'?id:null;
  }catch{return null;}
}
function r3TurnLoad(){
  Object.assign(R3_TURN,{
    phase:'unknown',actionSpent:0,extraActions:0,bonusSpent:false,
    reactionSpent:false,movementUsed:0,dashes:0,attackUsed:0,
    bonusAttackUsed:0,attackAllowance:1,advanced:false,freeSpent:false,concentration:null,
    note:'Tracking locally. Select Start turn when ready.',noteSource:'manual'
  });
  try{
    const saved=JSON.parse(localStorage.getItem(r3TurnKey())||'null');
    if(saved?.schema===1){
      const state=saved.state||{};
      if(['unknown','active','ended'].includes(state.phase))R3_TURN.phase=state.phase;
      R3_TURN.extraActions=r3TurnInt(state.extraActions,0,4,0);
      R3_TURN.actionSpent=r3TurnInt(state.actionSpent,0,8,0);
      R3_TURN.bonusSpent=state.bonusSpent===true;
      R3_TURN.reactionSpent=state.reactionSpent===true;
      R3_TURN.movementUsed=Number.isFinite(state.movementUsed)&&state.movementUsed>=0&&state.movementUsed<=3000?state.movementUsed:0;
      R3_TURN.dashes=r3TurnInt(state.dashes,0,4,0);
      R3_TURN.attackUsed=r3TurnInt(state.attackUsed,0,12,0);
      R3_TURN.bonusAttackUsed=r3TurnInt(state.bonusAttackUsed,0,12,0);
      R3_TURN.attackAllowance=r3TurnInt(state.attackAllowance,1,12,1);
      R3_TURN.freeSpent=state.freeSpent===true;
      if(state.concentration===true||state.concentration===false)
        R3_TURN.concentration=state.concentration;
      R3_TURN.note='Restored local turn state · edit any marker if needed.';
    }
  }catch{}
  R3_TURN.lastTop=r3TurnLeader();
  if(typeof r3MoveRebase==='function')r3MoveRebase();
  r3TurnSync();
  R3_TURN.revision++;
}
function r3TurnSave(){
  try{localStorage.setItem(r3TurnKey(),JSON.stringify({
    schema:1,state:r3TurnState()
  }));}catch{}
}
function r3TurnChange(note,source='manual'){
  if(typeof r3DebugLog==='function')r3DebugLog('System','Turn: '+note);
  R3_TURN.note=note;R3_TURN.noteSource=source;
  r3TurnSync();R3_TURN.revision++;r3TurnSave();r3HudRender();
}
function r3TurnStart(source='manual'){
  Object.assign(R3_TURN,{
    phase:'active',actionSpent:0,extraActions:0,bonusSpent:false,
    reactionSpent:false,movementUsed:0,dashes:0,attackUsed:0,
    bonusAttackUsed:0,freeSpent:false
  });
  // Don't count repositioning before this turn; concentration can persist.
  if(typeof r3MoveRebase==='function')r3MoveRebase();
  r3TurnChange(source==='observed'?
    'New turn detected from Roll20 initiative order · markers reset.':
    'New turn started locally · no Roll20 turn-order change.',source);
}
function r3TurnObserveInitiative(){
  if(!R3_TOKEN.active?.tokenId)return;
  const next=r3TurnLeader();
  if(!next)return;
  if(R3_TURN.lastTop===null){R3_TURN.lastTop=next;return;}
  if(next===R3_TURN.lastTop)return;
  R3_TURN.lastTop=next;
  if(next===R3_TOKEN.active.tokenId)r3TurnStart('observed');
  else if(R3_TURN.phase==='active'){
    R3_TURN.phase='ended';
    r3TurnChange('Initiative passed to another token · reaction state kept.','observed');
  }
}
function r3TurnLegacyToggle(kind){
  if(kind==='action')R3_TURN.actionSpent=R3_TURN.actionSpent?0:1+R3_TURN.extraActions;
  else if(kind==='bonus')R3_TURN.bonusSpent=!R3_TURN.bonusSpent;
  else if(kind==='reaction')R3_TURN.reactionSpent=!R3_TURN.reactionSpent;
  r3TurnChange('Changed '+kind+' availability locally.');
}
function r3TurnHint(text){
  R3_TURN.note=String(text||'').slice(0,220);
  R3_TURN.noteSource='observed';
  R3_TURN.revision++;r3HudRender();
}
function r3TurnApply(action){
  const t=R3_TURN,speed=r3TurnSpeed();
  switch(action){
    case 'start':r3TurnStart('manual');return true;
    case 'end':
      t.phase='ended';r3TurnChange('Turn marked ended locally. Reaction stays spent until your next turn.');return true;
    case 'action':r3TurnLegacyToggle('action');return true;
    case 'bonus':r3TurnLegacyToggle('bonus');return true;
    case 'reaction':r3TurnLegacyToggle('reaction');return true;
    case 'move-plus':t.movementUsed=Math.min(3000,t.movementUsed+5);break;
    case 'move-minus':t.movementUsed=Math.max(0,t.movementUsed-5);break;
    case 'dash-action':
    case 'dash-bonus':
      t.dashes=Math.min(4,t.dashes+1);
      if(action==='dash-action')t.actionSpent=Math.min(8,t.actionSpent+1);
      else t.bonusSpent=true;
      r3TurnChange('Dash marked locally. Movement allowance increases by your observed speed; action cost is manual.');return true;
    case 'dash-undo':
      t.dashes=Math.max(0,t.dashes-1);break;
    case 'extra-plus':t.extraActions=Math.min(4,t.extraActions+1);break;
    case 'extra-minus':t.extraActions=Math.max(0,t.extraActions-1);break;
    case 'attacks-plus':t.attackAllowance=Math.min(12,t.attackAllowance+1);break;
    case 'attacks-minus':t.attackAllowance=Math.max(1,t.attackAllowance-1);break;
    case 'attack-used':
      t.attackUsed=Math.min(12,t.attackUsed+1);
      if(t.actionSpent===0)t.actionSpent=1;
      break;
    case 'attack-undo':
      t.attackUsed=Math.max(0,t.attackUsed-1);
      // A manual attack marker cannot prove whether this action was also
      // spent on something else. Correct its Action card separately.
      break;
    case 'bonus-attack':
      t.bonusAttackUsed=Math.min(12,t.bonusAttackUsed+1);
      t.bonusSpent=true;break;
    case 'bonus-attack-undo':
      t.bonusAttackUsed=Math.max(0,t.bonusAttackUsed-1);
      break;
    case 'advanced':
      t.advanced=!t.advanced;break;
    case 'free':t.freeSpent=!t.freeSpent;break;
    case 'focus':
      t.concentration=t.concentration===null?true:t.concentration===true?false:null;
      break;
    default:return false;
  }
  r3TurnChange('Updated '+action.replace(/-/g,' ')+' locally; no Roll20 action was dispatched.');
  return true;
}
function r3TurnClick(target){
  const action=target?.dataset?.turnAction??
    target?.closest?.('[data-turn-action]')?.dataset?.turnAction;
  return typeof action==='string'&&r3TurnApply(action);
}
function r3TurnCost(item){
  const raw=item?._hudSource==='Spell'?item.castingTime:
    item?._hudSource==='Feature'?item.actionType:null;
  const label=r3String(raw,80).trim().replace(/\s+/g,' ').toLowerCase();
  if(/^(?:1 )?action$/.test(label))return 'Action';
  if(/^(?:1 )?bonus action$/.test(label))return 'Bonus action';
  if(/^(?:1 )?reaction$/.test(label))return 'Reaction';
  if(/^(?:1 )?minute$/.test(label))return '1 minute';
  if(/^(?:1 )?hour$/.test(label))return '1 hour';
  return ''; // Do not guess from a spell/feature name or descriptive text.
}
function r3TurnBtn(label,action,title='Manual indicator, not a Roll20 action'){
  return '<button type="button" data-turn-action="'+action+'" title="'+r3Escape(title)+'">'+r3Escape(label)+'</button>';
}
function r3TurnMarkup(snapshot){
  const t=R3_TURN,speed=r3TurnSpeed(snapshot);
  const total=speed===null?null:speed*(1+t.dashes);
  const remaining=total===null?null:total-t.movementUsed;
  const pct=total>0?Math.min(100,Math.round(t.movementUsed/total*100)):0;
  const actionTotal=1+t.extraActions,actionsLeft=Math.max(0,actionTotal-t.actionSpent);
  const cards=[
    ['Action',actionsLeft+' / '+actionTotal,actionsLeft>0,'action',
      'Actions available; manually correct for special rules'],
    ['Bonus',t.bonusSpent?'Spent':'Ready',!t.bonusSpent,'bonus',
      'Bonus action state; manually adjustable'],
    ['Reaction',t.reactionSpent?'Spent':'Ready',!t.reactionSpent,'reaction',
      'Reaction persists outside your turn until your next turn begins'],
    ['Movement',remaining===null?'Unknown':r3TurnDistance(remaining)+' ft',remaining===null||remaining>0,'move-plus',
      'Movement from Roll20 ruler when readable; otherwise grid-based distance on completed moves. Click to add 5 feet manually']
  ];
  const states=cards.map(([label,value,ready,action,tip])=>
    '<button type="button" class="hud-turn-card '+(ready?'':'spent')+
    '" data-turn-action="'+action+'" title="'+r3Escape(tip)+'">'+
    '<span>'+label+'</span><strong>'+r3Escape(value)+'</strong>'+
    '<small>'+(label==='Movement'?'used '+r3TurnDistance(t.movementUsed)+' ft':ready?'Available':'Used')+
    '</small></button>').join('');
  const features=Array.isArray(snapshot?.features)?snapshot.features:[];
  const extraAttack=features.some(x=>/^extra attack$/i.test(r3String(x.name,90).trim()));
  const concentration=t.concentration===null?'Not tracked':
    t.concentration?'Active (manual)':'None (manual)';
  const phase=t.phase==='active'?'TURN ACTIVE':t.phase==='ended'?'TURN ENDED':'TURN NOT STARTED';
  return '<section class="hud-turn-flow" aria-label="Turn and action economy" aria-live="off">'+
    '<div class="hud-turn-head"><strong>'+phase+'</strong>'+
    '<span>'+r3Escape(t.noteSource==='observed'?'Initiative / source observed':'Local tracking')+'</span>'+
    r3TurnBtn('Start / reset turn','start','Resets usage on a new turn; keeps concentration')+
    '</div><div class="hud-turn-cards">'+states+'</div>'+
    '<div class="hud-turn-movement"><span>Movement '+r3TurnDistance(t.movementUsed)+' / '+
    (total===null?'?':total)+' ft</span>'+
    '<div class="hud-turn-meter" role="progressbar" aria-label="Movement used" aria-valuemin="0" '+
    'aria-valuenow="'+t.movementUsed+'"'+(total!==null?' aria-valuemax="'+total+'"':'')+'>'+
    '<div style="width:'+pct+'%"></div></div>'+
    r3TurnBtn('−5 ft','move-minus')+r3TurnBtn('+5 ft','move-plus')+
    r3TurnBtn('Dash · Action','dash-action','Marks action spent and adds one speed allowance')+
    r3TurnBtn('Dash · Bonus*','dash-bonus','Only if an ability or DM permits bonus-action Dash')+
    r3TurnBtn('Undo Dash','dash-undo')+'</div>'+
    '<div class="hud-turn-details"><span>Attacks '+t.attackUsed+' / '+t.attackAllowance+
    (extraAttack?' · Extra Attack on sheet':'')+'</span>'+
    r3TurnBtn('Mark main attack','attack-used')+r3TurnBtn('Undo count','attack-undo')+
    '<span>Free interaction '+(t.freeSpent?'noted':'open')+'</span>'+
    r3TurnBtn(t.freeSpent?'Undo':'Mark','free')+
    '<span>Concentration: '+concentration+'</span>'+r3TurnBtn('Toggle','focus')+
    r3TurnBtn(t.advanced?'Hide options':'More options','advanced')+
    '</div>'+
    (t.advanced?'<div class="hud-turn-details hud-turn-overrides">'+
    '<span>Attack allowance '+t.attackAllowance+'</span>'+
    r3TurnBtn('−','attacks-minus')+r3TurnBtn('+','attacks-plus')+
    '<span>Extra actions +'+t.extraActions+'</span>'+
    r3TurnBtn('−','extra-minus')+r3TurnBtn('+','extra-plus')+
    '<span>Bonus attacks '+t.bonusAttackUsed+'</span>'+
    r3TurnBtn('Mark bonus attack','bonus-attack')+
    r3TurnBtn('Undo count','bonus-attack-undo')+'</div>':'')+
    '<div class="hud-turn-note" role="status">'+r3Escape(t.note)+
    ' <small>Local markers · bonus Dash needs an eligible feature · sheet values are authoritative</small></div>'+
    '</section>';
}
function r3TurnStyles(){
  return [
    '.hud-turn-flow{background:#243645;border:1px solid #607889;padding:5px;display:flex;flex-direction:column;gap:4px;color:#e5ebf3}',
    '.hud-turn-head,.hud-turn-movement,.hud-turn-details{display:flex;flex-wrap:wrap;align-items:center;gap:4px}',
    '.hud-turn-head strong{color:#f0d49d;letter-spacing:.09em}.hud-turn-head span{flex:1;color:#aebdca;font-size:10px}',
    '.hud-turn-flow button{border:1px solid #61788a!important;background:#394d60!important;border-radius:4px!important;padding:3px 6px!important;font-size:10px!important;min-height:22px}',
    '.hud-turn-flow button:hover{background:#576c7f!important}',
    '.hud-turn-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}',
    '.hud-turn-card{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:#365e69!important;min-width:0}',
    '.hud-turn-card strong{font-size:13px;white-space:nowrap}.hud-turn-card span{font-size:9px;letter-spacing:.07em;text-transform:uppercase}',
    '.hud-turn-card small{font-size:9px;opacity:.75}.hud-turn-card.spent{background:#35404c!important;opacity:.62}',
    '.hud-turn-movement span,.hud-turn-details span{font-size:10px;color:#d3dfeb;white-space:nowrap}',
    '.hud-turn-meter{height:8px;background:#14222e;border:1px solid #60798b;border-radius:5px;min-width:60px;flex:1;overflow:hidden}',
    '.hud-turn-meter>div{height:100%;background:#7fc5da;transition:width .2s}',
    '.hud-turn-details{border-top:1px solid #465a6b;padding-top:3px}',
    '.hud-turn-overrides{background:#203342;padding:4px;border-radius:3px}',
    '.hud-turn-note{font-size:10px;color:#f3dcae}.hud-turn-note small{color:#b0bdc9;margin-left:4px}',
    '.hud-segment-spent{filter:saturate(.6);opacity:.72}',
    '.hud-economy-cost{background:#315b65!important;border:1px solid #6d9fac}',
    '@media(max-width:980px){.hud-turn-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  ].join('');
}
