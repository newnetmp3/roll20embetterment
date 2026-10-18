// Firefox reference layout: compact battlefield-first overlay, no tutorial popups.
// Only this renderer changes; Roll20's map, sheet and chat remain authoritative.
const R3_BF={notes:'',sidebar:true,options:false,statusOpen:false,revision:0};
function r3BattlefieldKey(){return r3TokenSettingsKey()+':battlefield';}
function r3BattlefieldLoad(){
  R3_BF.notes='';R3_BF.sidebar=true;R3_BF.options=false;R3_BF.statusOpen=false;
  try{
    const saved=JSON.parse(localStorage.getItem(r3BattlefieldKey())||'null');
    if(saved?.schema===1){
      if(typeof saved.notes==='string')R3_BF.notes=saved.notes.slice(0,320);
      if(typeof saved.sidebar==='boolean')R3_BF.sidebar=saved.sidebar;
    }
  }catch{}
  R3_BF.revision++;
}
function r3BattlefieldSave(){
  try{localStorage.setItem(r3BattlefieldKey(),JSON.stringify({
    schema:1,notes:R3_BF.notes,sidebar:R3_BF.sidebar
  }));}catch{}
}
function r3BattlefieldInput(el){
  if(el?.id!=='r3-bf-notes')return false;
  R3_BF.notes=String(el.value||'').slice(0,320);
  r3BattlefieldSave();
  // Do not rerender while a user types or reset caret / selection.
  return true;
}
function r3BattlefieldClick(target){
  const action=target?.dataset?.bfAction??
    target?.closest?.('[data-bf-action]')?.dataset?.bfAction;
  if(typeof action!=='string')return false;
  switch(action){
    case 'sidebar':
      R3_BF.sidebar=!R3_BF.sidebar;r3BattlefieldSave();break;
    case 'options':
      R3_BF.options=!R3_BF.options;break;
    case 'status':
      R3_BF.statusOpen=!R3_BF.statusOpen;break;
    case 'show-roll20-sheet':
      if(typeof r3SheetRevealAll==='function')r3SheetRevealAll();
      return true;
    case 'allow-background':
      if(typeof r3SheetAllowPrivateReaders==='function')r3SheetAllowPrivateReaders();
      return true;
    case 'reset-layout':
      if(typeof r3BattlefieldResetPositions==='function')r3BattlefieldResetPositions();
      return true;
    case 'disengage':
    case 'hide':
      // A local action-economy mark only. Do not claim Roll20 executed it.
      R3_TURN.actionSpent=Math.min(8,R3_TURN.actionSpent+1);
      r3TurnChange((action==='hide'?'Hide':'Disengage')+
        ' marked as an action locally. Nothing was sent to Roll20.');
      return true;
    default:return false;
  }
  R3_BF.revision++;r3HudRender();
  return true;
}
function r3BattlefieldControl(icon,title,flyout){
  const active=R3_HUD.flyout===flyout;
  return '<button type="button" class="r3-bf-category'+(active?' selected':'')+
    '" data-hud-flyout="'+r3Escape(flyout)+'" aria-pressed="'+active+
    '" title="Open '+r3Escape(title)+' (does not take an action)">'+
    r3HudIcon(icon)+'<span>'+r3Escape(title)+'</span><b aria-hidden="true">⌃</b></button>';
}
function r3BattlefieldRing(kind,icon,label,value,sub,tip){
  const spent=kind==='action'?R3_HUD.used.action:kind==='bonus'?R3_HUD.used.bonus:
    kind==='reaction'?R3_HUD.used.reaction:false;
  const action=kind==='move'?'move-plus':kind;
  return '<button type="button" data-turn-action="'+action+
    '" class="r3-bf-ring r3-bf-'+kind+(spent?' is-spent':'')+
    '" aria-label="'+r3Escape(label+': '+value+'. '+tip)+'"'+
    ' aria-pressed="'+(spent?'true':'false')+'" title="'+r3Escape(tip)+'">'+
    r3HudIcon(icon)+'<span class="r3-bf-ring-name">'+r3Escape(label)+'</span>'+
    '<strong>'+r3Escape(value)+'</strong>'+
    '<span class="r3-bf-ring-sub">'+r3Escape(sub)+'</span></button>';
}
function r3BattlefieldNotes(){
  return '<section class="r3-bf-section r3-bf-notes" data-bf-panel="notes" aria-label="Personal turn notes">'+
    ''+
    '<header><strong>Turn Notes</strong><span>Private to this browser</span></header>'+
    '<textarea id="r3-bf-notes" rows="2" maxlength="320" '+
    'aria-label="Notes for the selected character" placeholder="Notes for this turn…">'+
    r3Escape(R3_BF.notes)+'</textarea></section>';
}
function r3BattlefieldSidebar(snapshot){
  const name=r3String(snapshot?.name,80)||'Select your character';
  const stats=snapshot?.stats||{};
  const portrait=r3HudPortraitUrl(snapshot);
  const passive=r3HudPassive(snapshot);
  const focus=R3_TURN.concentration===true?'Active (manual)':
    R3_TURN.concentration===false?'None (manual)':'Not tracked';
  const resources=r3HudResourceBar(snapshot);
  return '<aside class="r3-bf-sidebar" aria-label="Character quick overview">'+
    '<section class="r3-bf-profile r3-bf-section" data-bf-panel="profile">'+
    ''+
    '<div class="r3-bf-character">'+
    '<div class="r3-bf-avatar">'+
    (portrait?'<img src="'+r3Escape(portrait)+'" alt="">':
      '<span>'+r3Escape(name.charAt(0).toUpperCase())+'</span>')+
    '</div><div class="r3-bf-character-text"><strong>'+r3Escape(name)+'</strong>'+
    (r3HudHasValue(stats.level)?'<small>Level '+r3HudValue(stats.level)+'</small>':
      '<small>Selected Roll20 character</small>')+
    '</div><button type="button" class="r3-bf-panel-button" data-bf-action="sidebar" '+
    'aria-label="Hide character overview" title="Hide character overview">×</button>'+
    '</div><div class="r3-bf-profile-hp">'+r3HudHp(snapshot)+'</div>'+
    '<div class="r3-bf-stats">'+
    r3HudStat('AC',stats.ac)+r3HudStat('Speed',stats.speed,' ft')+
    r3HudStat('Init',stats.initiative)+
    '<div title="'+r3Escape(passive.source)+'">'+r3HudStat(passive.label,passive.value)+'</div>'+
    '</div></section>'+
    '<section class="r3-bf-section r3-bf-concentration" data-bf-panel="concentration">'+
    ''+
    '<span>'+r3HudIcon('target')+'</span><div><strong>Concentration</strong>'+
    '<small>'+r3Escape(focus)+'</small></div>'+
    '<button type="button" data-turn-action="focus" '+
    'title="Cycle manual concentration state; the sheet is authoritative">±</button></section>'+
    '<section class="r3-bf-section r3-bf-resource-panel" data-bf-panel="resources" aria-label="Observed character resources">'+
    ''+
    '<header><strong>Resources</strong>'+
    '<button type="button" data-hud-flyout="resources" title="Browse imported resources">⌃</button></header>'+
    (resources||'<small>No official slots or resources imported yet.</small>')+
    '</section>'+r3BattlefieldNotes()+
    (R3_BF.options?'<section class="r3-bf-section r3-bf-advanced" data-bf-panel="advanced">'+
      ''+
      '<header><strong>Turn corrections</strong>'+
      '<button type="button" data-bf-action="options">×</button></header>'+
      r3TurnMarkup(snapshot)+'</section>':'')+
    '</aside>';
}
function r3BattlefieldMarkup(snapshot){
  const name=r3String(snapshot?.name,80)||'No character selected';
  if(R3_HUD.collapsed)return '<section class="r3-bf-shell collapsed">'+
    '<button type="button" id="r3-hud-collapse" class="r3-bf-restore">'+
    '⚔ Show R20eb HUD</button></section>';
  const t=R3_TURN,remaining=Math.max(0,1+t.extraActions-t.actionSpent);
  const speed=r3TurnSpeed(snapshot);
  const total=speed===null?null:speed*(1+t.dashes);
  const left=total===null?'Unknown':r3TurnDistance(total-t.movementUsed)+' / '+r3TurnDistance(total)+' ft';
  const fill=total>0?Math.min(100,Math.round(100*t.movementUsed/total)):0;
  const phase=t.phase==='active'?'Your Turn':t.phase==='ended'?'Turn Ended':'Turn Tracking';
  const status=t.noteSource==='observed'?'Initiative observed':'Local markers';
  const ring=[
    r3BattlefieldRing('action','blade','Action',remaining>0?'Ready':'Spent',
      remaining+'/'+(1+t.extraActions),'Toggle action spent; manual correction'),
    r3BattlefieldRing('bonus','lightning','Bonus',t.bonusSpent?'Spent':'Ready',
      t.bonusSpent?'● ○ ○':'● ○ ○','Toggle bonus action spent; manual correction'),
    r3BattlefieldRing('reaction','shield','Reaction',t.reactionSpent?'Spent':'Ready',
      t.reactionSpent?'● ○ ○':'● ○ ○','Reaction persists outside turn until next start'),
    '<div class="r3-bf-movement">'+r3BattlefieldRing('move','move','Move',left,
      'Used '+r3TurnDistance(t.movementUsed)+' ft','Auto-tracked token movement; click to correct by +5 ft')+
      '<span class="r3-bf-movement-meter" role="progressbar" aria-label="Movement used" '+
      'aria-valuemin="0" aria-valuenow="'+t.movementUsed+'"'+
      (total!==null?' aria-valuemax="'+total+'"':'')+'>'+
      '<span style="width:'+fill+'%"></span></span></div>'
  ].join('');
  return '<section class="r3-bf-shell" aria-label="R20eb battlefield HUD">'+
    '<div class="r3-bf-turnstrip" data-bf-panel="turn" aria-label="Turn state">'+
    ''+
    '<span class="r3-bf-turn-icon">'+r3HudIcon('clock')+'</span>'+
    '<span><strong>'+r3Escape(phase)+'</strong><small>'+r3Escape(status)+'</small></span>'+
    '<button type="button" data-turn-action="start" title="Reset local turn counters; keep concentration">↻</button>'+
    '<button type="button" data-turn-action="end" title="Mark end of turn locally; does not advance Roll20">⏭</button>'+
    '</div>'+
    (R3_BF.sidebar&&!R3_UI.shown?r3BattlefieldSidebar(snapshot):
      '<div class="r3-bf-show-profile-wrap" data-bf-panel="show-profile">'+
        ''+
        '<button type="button" class="r3-bf-show-profile" data-bf-action="sidebar" '+
        'title="Show character overview">☷ '+r3Escape(name)+'</button></div>')+
    '<nav class="r3-bf-actions" data-bf-panel="actions" aria-label="Action economy quick dock">'+
    ''+
    '<div class="r3-bf-rings">'+ring+'</div>'+
    '<div class="r3-bf-quick">'+
    '<button type="button" data-turn-action="dash-action" title="Mark Action Dash locally and add one speed allowance">'+
    r3HudIcon('move')+'<span>Dash</span></button>'+
    '<button type="button" data-bf-action="disengage" title="Mark Disengage as a local action; no Roll20 execution">'+
    r3HudIcon('shield')+'<span>Disengage</span></button>'+
    '<button type="button" data-bf-action="hide" title="Mark Hide as a local action; no Roll20 execution">'+
    r3HudIcon('eye')+'<span>Hide</span></button></div></nav>'+
    '<nav class="r3-bf-category-dock" data-bf-panel="categories" aria-label="Character ability menus">'+
    ''+
    r3BattlefieldControl('blade','Attacks','actions')+
    r3BattlefieldControl('star','Features','features')+
    r3BattlefieldControl('flame','Spells','spells')+
    r3BattlefieldControl('bag','Inventory','inventory')+
    r3BattlefieldControl('book','Skills','skills')+
    '</nav>'+
    '<div class="r3-bf-mini-tools" data-bf-panel="tools">'+
    ''+
    '<button type="button" data-bf-action="options" title="Manual turn corrections and detailed counters">'+
    (R3_BF.options?'Hide options':'More options')+'</button>'+
    '<button type="button" id="r3-hud-debug" title="Open developer diagnostics and tooltip history">⚙ Debug</button>'+
    '<button type="button" data-bf-action="show-roll20-sheet" title="Restore all original character sheets and stop hiding them while you play">Show Sheet</button>'+
    (typeof R3_SHEET_VIS==='object'&&R3_SHEET_VIS.manualPriority?
      '<button type="button" data-bf-action="allow-background" title="Allow optional background readers again">Allow private reader</button>':'')+
    '<button type="button" data-bf-action="reset-layout" title="Reset all panel positions for this game">Reset layout</button>'+ 
    '<button type="button" id="r3-hud-collapse" title="Hide HUD (Shift+A)">−</button></div>'+
    (R3_HUD.flyout||R3_HUD.chooser!==null?
      r3BattlefieldDraggableFlyout(r3HudFlyoutMarkup(snapshot)):'')+
    (R3_NATIVE.preview?
        '<div class="r3-bf-native" data-bf-panel="native">'+
        ''+
        '<button type="button" class="r3-bf-dismiss-status" data-bf-action="status" '+
        'title="Dismiss roll confirmation details">×</button>'+r3NativeMarkup()+'</div>':'')+
    (typeof r3DebugMarkup==='function'?r3DebugMarkup():'')+
    '</section>';
}
function r3BattlefieldStyles(){
  return [
    '#r3-hud{position:absolute!important;inset:0!important;bottom:auto!important;left:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;overflow:visible!important}',
    '#r3-hud .r3-bf-shell{position:relative;width:100%;height:100%;pointer-events:none;color:#f1f1ed;font:12px/1.25 system-ui,sans-serif}',
    '.r3-bf-shell button,.r3-bf-shell textarea{box-sizing:border-box;font:inherit;color:inherit}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-sidebar,.r3-bf-turnstrip,.r3-bf-mini-tools,.r3-bf-restore,.r3-bf-show-profile,.r3-bf-shell>.hud-flyout,.r3-bf-shell>.hud-native-status{pointer-events:auto}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-section,.r3-bf-turnstrip{background:linear-gradient(145deg,#101b2aF7,#080f1df5);border:1px solid #475e78;border-radius:13px;box-shadow:0 5px 20px #000a}',
    '.r3-bf-actions{position:absolute;bottom:12px;left:14px;width:min(530px,calc(50vw - 24px));height:102px;display:flex;align-items:stretch;gap:5px;padding:5px}',
    '.r3-bf-rings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;min-width:0;flex:1}',
    '.r3-bf-ring{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:84px;padding:3px!important;border-radius:46%!important;border:2px solid var(--ring)!important;background:radial-gradient(ellipse at center,#1c2939,#090e19 80%)!important;box-shadow:inset 0 0 9px var(--glow),0 0 7px var(--glow);text-align:center}',
    '.r3-bf-ring:hover{filter:brightness(1.18)}.r3-bf-ring.is-spent{opacity:.56;filter:saturate(.6)}',
    '.r3-bf-ring svg{width:23px;height:23px;color:var(--ring)}.r3-bf-ring-name{font-size:10px}.r3-bf-ring strong{font-size:11px;color:#d8f2d8}.r3-bf-ring-sub{font-size:9px;color:#aabbcf}',
    '.r3-bf-action{--ring:#40ee86;--glow:#24b96080}.r3-bf-bonus{--ring:#ffc34e;--glow:#ca882e80}.r3-bf-reaction{--ring:#b476ff;--glow:#7c42c980}.r3-bf-move{--ring:#61adff;--glow:#3279d880}',
    '.r3-bf-movement{position:relative;min-width:0}.r3-bf-movement .r3-bf-ring{height:100%;width:100%}.r3-bf-movement-meter{position:absolute;bottom:7px;left:19%;right:19%;height:5px;background:#16314a;border-radius:5px;overflow:hidden;pointer-events:none}.r3-bf-movement-meter>span{display:block;height:100%;background:#29b7ff}',
    '.r3-bf-quick{flex:0 0 108px;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.r3-bf-quick button{min-height:27px;padding:2px 4px!important;background:#131e2e!important;border:1px solid #304960!important;border-radius:5px!important;display:flex;align-items:center;gap:5px;justify-content:flex-start;font-size:10px!important}',
    '.r3-bf-quick button svg{height:17px;width:17px;flex:none}.r3-bf-quick button:hover{background:#263e54!important}',
    '.r3-bf-category-dock{position:absolute;right:14px;bottom:12px;width:min(470px,calc(50vw - 24px));height:88px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;padding:6px}',
    '.r3-bf-category{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:3px 1px!important;background:#152335!important;border:1px solid #253950!important;border-radius:8px!important;font-size:10px!important}',
    '.r3-bf-category svg{width:25px;height:25px;color:#f5f4f1}.r3-bf-category span{font-size:10px}.r3-bf-category b{display:none}',
    '.r3-bf-category:hover,.r3-bf-category.selected{background:#2c4666!important;border-color:#6e9ed1!important}',
    '.r3-bf-sidebar{position:absolute;right:14px;top:32px;width:258px;max-height:calc(100vh - 160px);overflow-y:auto;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin;border:0;background:transparent;box-shadow:none}',
    '.r3-bf-section{padding:8px}.r3-bf-section header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px}.r3-bf-section header strong{font:600 13px Georgia,serif}.r3-bf-section header span{color:#8fa3bb;font-size:8px}',
    '.r3-bf-character{display:flex;align-items:center;gap:8px}.r3-bf-avatar{flex:0 0 61px;width:61px;height:61px;border:1px solid #3878b9;border-radius:6px;display:grid;place-items:center;background:#223447;color:#e7dbbb;font:600 26px Georgia,serif;overflow:hidden}',
    '.r3-bf-avatar img{height:100%;width:100%;object-fit:cover}.r3-bf-character-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}',
    '.r3-bf-character-text strong{font:600 15px Georgia,serif;overflow-wrap:anywhere}.r3-bf-character-text small{color:#bcc6d1}',
    '.r3-bf-panel-button{align-self:flex-start;padding:0 4px!important;border:0!important;background:none!important;color:#bcc7d6!important}',
    '.r3-bf-profile-hp{margin-top:6px}.r3-bf-profile-hp .hud-hp-track{height:9px;border-radius:8px;overflow:hidden;background:#27212d}.r3-bf-profile-hp .hud-hp-fill{background:#ec1649}',
    '.r3-bf-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-top:6px}.r3-bf-stats .hud-stat{border:1px solid #23334b;background:#14243a;display:flex;justify-content:space-between;gap:4px;padding:4px;min-width:0}',
    '.r3-bf-stats .hud-stat span{font-size:9px}.r3-bf-stats .hud-stat strong{font-size:11px}',
    '.r3-bf-concentration{display:flex;align-items:center;gap:8px}.r3-bf-concentration>span svg{width:22px;height:22px}.r3-bf-concentration>div{display:flex;flex:1;flex-direction:column;gap:2px}',
    '.r3-bf-concentration strong{font:600 13px Georgia,serif}.r3-bf-concentration small{color:#afc0cf}.r3-bf-concentration button,.r3-bf-section header button{background:#24374d!important;border:1px solid #4d6884!important;border-radius:6px!important;padding:3px 9px!important}',
    '.r3-bf-resource-panel{min-height:55px}.r3-bf-resource-panel .hud-resources{display:flex;flex-wrap:wrap;gap:4px;overflow:visible;white-space:normal}',
    '.r3-bf-resource-panel .hud-res-chip{flex:1 1 45%;white-space:normal;min-width:0;font-size:10px;border:1px solid #283b54;border-radius:5px;background:#15243a;padding:5px}',
    '.r3-bf-resource-panel small{color:#9babbc}.r3-bf-notes textarea{width:100%;resize:vertical;min-height:42px;max-height:130px;background:#0d1828;border:1px solid #2d4866;border-radius:6px;padding:6px;outline-offset:1px;color:#edf1f7;font-size:11px}',
    '.r3-bf-turnstrip{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;min-width:165px;max-width:min(250px,calc(100vw - 330px));padding:5px 7px;border-radius:9px}',
    '.r3-bf-turn-icon svg{height:21px;width:21px;color:#72affd}.r3-bf-turnstrip>span:nth-child(2){flex:1;display:flex;flex-direction:column;gap:2px;white-space:nowrap}',
    '.r3-bf-turnstrip strong{color:#c7e7ff}.r3-bf-turnstrip small{color:#8fa9c7;font-size:9px}',
    '.r3-bf-turnstrip button{background:#1e324b!important;border:1px solid #355476!important;border-radius:4px!important;padding:3px 6px!important}',
    '.r3-bf-mini-tools{position:absolute;bottom:111px;right:16px;display:flex;gap:4px}',
    '.r3-bf-mini-tools button{background:#101b2aee!important;color:#c2d8eb!important;border:1px solid #405672!important;border-radius:5px!important;padding:3px 6px!important;font-size:10px!important}',
    '.r3-bf-show-profile{position:absolute;right:14px;top:20px;background:#17273bdd!important;border:1px solid #436080!important;padding:6px 9px!important;border-radius:7px!important}',
    '.r3-bf-shell>.hud-flyout{position:absolute!important;right:14px!important;left:auto!important;bottom:107px!important;width:min(510px,calc(100vw - 32px))!important;max-height:min(54vh,530px)!important;pointer-events:auto;border-radius:10px;background:linear-gradient(145deg,#15273d,#0b1421);border:1px solid #56789a}',
    '.r3-bf-shell>.hud-native-status{position:absolute;bottom:118px;right:14px;width:min(480px,calc(100vw - 32px));max-height:24vh;overflow:auto;border-radius:7px}',
    '.r3-bf-dismiss-status{position:absolute;top:2px;right:3px;z-index:4;background:#142b41!important;border:1px solid #678aa9!important;border-radius:5px!important;cursor:pointer!important}',
    '.r3-bf-advanced{max-height:37vh;overflow:auto}.r3-bf-advanced .hud-turn-flow{font-size:10px}.r3-bf-advanced .hud-turn-cards{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.r3-bf-restore{position:absolute;bottom:14px;left:14px;background:#14263dec!important;border:1px solid #6383a7!important;border-radius:8px!important;padding:9px!important}',
    '@media(max-width:1150px){.r3-bf-sidebar{width:216px;top:12px}.r3-bf-actions{width:min(490px,calc(50vw - 20px))}.r3-bf-category-dock{width:min(390px,calc(50vw - 20px))}.r3-bf-quick{flex-basis:91px}.r3-bf-quick button{font-size:9px!important}}',
    '@media(max-width:760px){.r3-bf-sidebar{top:12px;width:196px;max-height:38vh}.r3-bf-turnstrip{top:8px;left:12px;transform:none;max-width:calc(100vw - 226px)}.r3-bf-actions{height:79px;width:calc(54vw - 14px);left:7px;bottom:7px}.r3-bf-category-dock{height:76px;width:calc(46vw - 14px);right:7px;bottom:7px;gap:2px;padding:4px}.r3-bf-ring{min-height:66px}.r3-bf-ring svg{width:17px;height:17px}.r3-bf-ring strong,.r3-bf-ring-name{font-size:8px}.r3-bf-ring-sub{display:none}.r3-bf-quick{display:none}.r3-bf-category span{font-size:8px}.r3-bf-category svg{width:19px;height:19px}.r3-bf-mini-tools{bottom:87px;right:7px}}',
    '@media(max-height:650px){.r3-bf-sidebar{top:8px;max-height:calc(100vh - 135px)}.r3-bf-turnstrip{top:5px}.r3-bf-section{padding:5px}.r3-bf-category-dock,.r3-bf-actions{bottom:5px}}',
    '@media(prefers-reduced-motion:reduce){.r3-bf-shell *{transition:none!important}}'
  ].join('');
}
