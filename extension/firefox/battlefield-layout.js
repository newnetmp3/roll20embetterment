// Firefox reference layout: compact battlefield-first overlay, no tutorial popups.
// Only this renderer changes; Roll20's map, sheet and chat remain authoritative.
const R3_BF_VISIBILITY=Object.freeze({
  profile:'Character',concentration:'Concentration',resources:'Resources',
  notes:'Turn notes',turn:'Turn controls',actions:'Action indicators',
  quick:'Quick actions',categories:'Category buttons',status:'Status bar'
});
const R3_BF_DOCKS=['bottom','top','left','right'];
const R3_BF={notes:'',sidebar:true,options:false,statusOpen:false,
  orientation:'bottom',visible:{},menuPane:'',contextOpen:false,contextX:12,contextY:12,revision:0};
function r3BattlefieldKey(){return r3TokenSettingsKey()+':battlefield';}
function r3BattlefieldLoad(){
  R3_BF.notes='';R3_BF.sidebar=true;R3_BF.options=false;R3_BF.statusOpen=false;
  R3_BF.orientation='bottom';R3_BF.contextOpen=false;R3_BF.menuPane='';
  R3_BF.visible=Object.fromEntries(Object.keys(R3_BF_VISIBILITY).map(k=>[k,true]));
  try{
    const saved=JSON.parse(localStorage.getItem(r3BattlefieldKey())||'null');
    if(saved?.schema===1||saved?.schema===2){
      if(typeof saved.notes==='string')R3_BF.notes=saved.notes.slice(0,320);
      if(typeof saved.sidebar==='boolean')R3_BF.sidebar=saved.sidebar;
      if(R3_BF_DOCKS.includes(saved.orientation))R3_BF.orientation=saved.orientation;
      for(const key of Object.keys(R3_BF_VISIBILITY))
        if(typeof saved.visible?.[key]==='boolean')R3_BF.visible[key]=saved.visible[key];
    }
  }catch{}
  R3_BF.revision++;
}
function r3BattlefieldSave(){
  try{localStorage.setItem(r3BattlefieldKey(),JSON.stringify({
    schema:2,notes:R3_BF.notes,sidebar:R3_BF.sidebar,
    orientation:R3_BF.orientation,visible:R3_BF.visible
  }));}catch{}
}
function r3BattlefieldDockOrientation(value){
  if(!R3_BF_DOCKS.includes(value))return false;
  if(R3_BF.orientation===value){R3_BF.contextOpen=false;r3HudRender();return true;}
  R3_BF.orientation=value;R3_BF.contextOpen=false;
  // A manually dragged former dock position must not override the newly
  // selected edge. Independent profile, flyout and Debug positions survive.
  if(typeof R3_BF_DRAG==='object'){
    delete R3_BF_DRAG.positions.taskbar;
    r3BattlefieldLayoutSave();
  }
  r3BattlefieldSave();R3_BF.revision++;r3HudRender();
  return true;
}
function r3BattlefieldTogglePart(name){
  if(!Object.prototype.hasOwnProperty.call(R3_BF_VISIBILITY,name))return false;
  R3_BF.visible[name]=!R3_BF.visible[name];
  r3BattlefieldSave();R3_BF.revision++;r3HudRender();return true;
}
function r3BattlefieldContextOpen(x,y){
  const width=Math.max(320,Number(window.innerWidth)||1280);
  const height=Math.max(300,Number(window.innerHeight)||800);
  const inset=typeof r3BattlefieldChatInset==='function'?r3BattlefieldChatInset():0;
  R3_BF.contextX=Math.max(5,Math.min(Math.round(Number(x)||8),Math.max(5,width-inset-242)));
  R3_BF.contextY=Math.max(5,Math.min(Math.round(Number(y)||8),Math.max(5,height-Math.min(465,Math.floor(height*.75)+8))));
  R3_BF.contextOpen=true;R3_BF.menuPane='';
  R3_HUD.flyout='';R3_HUD.chooser=null;
  if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
  R3_BF.revision++;r3HudRender();
  return true;
}
function r3BattlefieldContextClose(){
  if(!R3_BF.contextOpen)return false;
  R3_BF.contextOpen=false;R3_BF.revision++;r3HudRender();return true;
}
function r3BattlefieldContextMarkup(){
  if(!R3_BF.contextOpen)return '';
  const orientation=R3_BF_DOCKS.map(dock=>
    '<button type="button" role="menuitemradio" aria-checked="'+(R3_BF.orientation===dock)+
    '" data-bf-action="dock-orientation" data-bf-value="'+dock+'">'+
    (R3_BF.orientation===dock?'● ':'○ ')+dock[0].toUpperCase()+dock.slice(1)+'</button>').join('');
  const visibility=Object.entries(R3_BF_VISIBILITY).map(([key,label])=>
    '<button type="button" role="menuitemcheckbox" aria-checked="'+R3_BF.visible[key]+
    '" data-bf-action="dock-toggle" data-bf-item="'+key+'">'+
    (R3_BF.visible[key]?'☑ ':'☐ ')+r3Escape(label)+'</button>').join('');
  return '<div class="r3-bf-context" data-bf-no-drag role="menu" aria-label="R20eb taskbar options" '+
    'style="left:'+R3_BF.contextX+'px;top:'+R3_BF.contextY+'px">'+
    '<strong>Dock orientation</strong>'+orientation+
    '<strong>Show / hide</strong>'+visibility+
    '<button type="button" role="menuitem" data-bf-action="reset-layout">Reset panel positions</button>'+
    '<button type="button" role="menuitem" data-bf-action="dock-close">Close menu</button></div>';
}
function r3BattlefieldContextEvent(event){
  const within=event?.target?.closest?.('[data-bf-panel="taskbar"]');
  if(!within)return false;
  event.preventDefault?.();event.stopPropagation?.();
  return r3BattlefieldContextOpen(event.clientX,event.clientY);
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
    case 'taskbar-menu':
      if(R3_BF.contextOpen)return r3BattlefieldContextClose();
      return r3BattlefieldContextOpen(
        Math.max(10,(Number(window.innerWidth)||1280)-
          (typeof r3BattlefieldChatInset==='function'?r3BattlefieldChatInset():0)-258),
        (Number(window.innerHeight)||800)-410);
    case 'dock-orientation':
      return r3BattlefieldDockOrientation(target?.dataset?.bfValue||
        target?.closest?.('[data-bf-value]')?.dataset?.bfValue);
    case 'dock-toggle':
      return r3BattlefieldTogglePart(target?.dataset?.bfItem||
        target?.closest?.('[data-bf-item]')?.dataset?.bfItem);
    case 'dock-close':return r3BattlefieldContextClose();
    case 'cascade-pane': {
      const pane=target?.dataset?.bfItem||
        target?.closest?.('[data-bf-item]')?.dataset?.bfItem;
      if(!['profile','concentration','resources','notes','status','importer'].includes(pane))
        return false;
      R3_BF.menuPane=R3_BF.menuPane===pane?'':pane;
      R3_HUD.flyout='';R3_HUD.chooser=null;R3_BF.contextOpen=false;
      if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
      if(pane==='importer'){
        R3_UI.shown=R3_BF.menuPane==='importer';
        if(typeof r3UIRefresh==='function')r3UIRefresh();
      }else if(R3_UI.shown){R3_UI.shown=false;if(typeof r3UIRefresh==='function')r3UIRefresh();}
      R3_BF.revision++;r3HudRender();return true;
    }
    case 'cascade-debug':
      if(typeof r3DebugToggle==='function')r3DebugToggle();
      return true;
    case 'cascade-close':
      R3_BF.menuPane='';R3_BF.contextOpen=false;
      R3_HUD.flyout='';R3_HUD.chooser=null;
      if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
      if(R3_UI.shown){R3_UI.shown=false;if(typeof r3UIRefresh==='function')r3UIRefresh();}
      R3_BF.revision++;r3HudRender();return true;
    case 'vertical-status':
      R3_BF.menuPane=R3_BF.menuPane==='status'?'':'status';
      R3_BF.contextOpen=false;R3_HUD.flyout='';R3_HUD.chooser=null;
      if(typeof R3_DEBUG==='object')R3_DEBUG.open=false;
      R3_BF.statusOpen=false;
      R3_BF.revision++;r3HudRender();return true;
    case 'sidebar':
      R3_BF.menuPane=R3_BF.menuPane==='profile'?'':'profile';
      R3_BF.revision++;r3HudRender();return true;
    case 'options':
      R3_BF.options=!R3_BF.options;break;
    case 'status':
      R3_BF.statusOpen=!R3_BF.statusOpen;break;
    case 'show-roll20-sheet':
      if(typeof r3SheetRevealAll==='function')r3SheetRevealAll();
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
  const tracked=kind==='action'||kind==='bonus'||kind==='reaction';
  const spent=kind==='action'?R3_HUD.used.action:kind==='bonus'?R3_HUD.used.bonus:
    kind==='reaction'?R3_HUD.used.reaction:false;
  const action=kind==='move'?'move-plus':kind;
  if(tracked)return '<button type="button" data-turn-action="'+action+
    '" role="checkbox" aria-checked="'+spent+
    '" class="r3-bf-ring r3-bf-'+kind+(spent?' is-spent':'')+
    '" aria-label="'+r3Escape(label+': '+(spent?'Used':'Available')+
      '. '+tip)+'" title="'+r3Escape(tip)+'">'+
    r3HudIcon(icon)+'<span class="r3-bf-ring-name">'+r3Escape(label)+'</span>'+
    '<span class="r3-bf-used-checkbox" aria-hidden="true">'+(spent?'✓':'')+'</span></button>';
  return '<button type="button" data-turn-action="'+action+
    '" class="r3-bf-ring r3-bf-'+kind+
    '" aria-label="'+r3Escape(label+': '+value+'. '+tip)+'"'+
    ' title="'+r3Escape(tip)+'">'+
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
function r3BattlefieldSidebar(snapshot,only=''){
  const name=r3String(snapshot?.name,80)||'Select your character';
  const stats=snapshot?.stats||{};
  const portrait=r3HudPortraitUrl(snapshot);
  const passive=r3HudPassive(snapshot);
  const focus=R3_TURN.concentration===true?'Active (manual)':
    R3_TURN.concentration===false?'None (manual)':'Not tracked';
  const resources=r3HudResourceBar(snapshot);
  return '<aside class="r3-bf-sidebar" aria-label="Character quick overview">'+
    (R3_BF.visible.profile&&(!only||only==='profile')?'<section class="r3-bf-profile r3-bf-section" data-bf-panel="profile">'+
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
    '</div></section>':'')+
    (R3_BF.visible.concentration&&(!only||only==='concentration')?'<section class="r3-bf-section r3-bf-concentration" data-bf-panel="concentration">'+
    ''+
    '<span>'+r3HudIcon('target')+'</span><div><strong>Concentration</strong>'+
    '<small>'+r3Escape(focus)+'</small></div>'+
    '<button type="button" data-turn-action="focus" '+
    'title="Cycle manual concentration state; the sheet is authoritative">±</button></section>':'')+
    (R3_BF.visible.resources&&(!only||only==='resources')?'<section class="r3-bf-section r3-bf-resource-panel" data-bf-panel="resources" aria-label="Observed character resources">'+
    ''+
    '<header><strong>Resources</strong>'+
    '<button type="button" data-hud-flyout="resources" title="Browse imported resources">⌃</button></header>'+
    (resources||'<small>No official slots or resources imported yet.</small>')+
    '</section>':'')+(R3_BF.visible.notes&&(!only||only==='notes')?r3BattlefieldNotes():'')+
    '</aside>';
}
// All R20eb popups share one anchored, cascading menu tree. Roll20's
// manually opened sheet and its own windows are never changed or owned.
function r3BattlefieldCascadeMarkup(snapshot){
  const opened=R3_HUD.flyout||R3_HUD.chooser!==null||
    R3_BF.menuPane||R3_BF.contextOpen||R3_DEBUG.open||R3_NATIVE.preview;
  if(!opened)return '';
  const pages=[
    ['actions','Attacks'],['features','Features'],['spells','Spells'],
    ['inventory','Inventory'],['skills','Skills'],['misc','MISC'],
    ['resources','Resources']
  ];
  const root=pages.map(([id,label])=>{
    const active=R3_HUD.flyout===id&&!R3_BF.contextOpen&&!R3_DEBUG.open;
    return '<button type="button" role="menuitem" class="r3-cascade-entry'+
      (active?' selected':'')+'" data-hud-flyout="'+id+'" aria-haspopup="true" aria-expanded="'+active+'">'+
      r3Escape(label)+'<span aria-hidden="true">▸</span></button>';
  }).join('');
  const parts=[['profile','Character'],['concentration','Concentration'],
    ['notes','Turn notes'],['status','Status'],['importer','Importer']];
  const extra=parts.filter(([id])=>id==='status'||id==='importer'||R3_BF.visible[id]).map(([id,label])=>
    '<button type="button" role="menuitem" class="r3-cascade-entry'+
      (R3_BF.menuPane===id?' selected':'')+'" data-bf-action="cascade-pane" data-bf-item="'+id+
      '" aria-haspopup="true" aria-expanded="'+(R3_BF.menuPane===id)+'">'+
      label+'<span aria-hidden="true">▸</span></button>').join('');
  const settings='<button type="button" role="menuitem" class="r3-cascade-entry'+
    (R3_BF.contextOpen?' selected':'')+'" data-bf-action="taskbar-menu" aria-haspopup="true" '+
    'aria-expanded="'+R3_BF.contextOpen+'">Settings<span aria-hidden="true">▸</span></button>';
  const debug='<button type="button" role="menuitem" class="r3-cascade-entry'+
    (R3_DEBUG.open?' selected':'')+'" data-bf-action="cascade-debug" aria-haspopup="true" '+
    'aria-expanded="'+R3_DEBUG.open+'">Debug<span aria-hidden="true">▸</span></button>';
  let detail='';
  if(R3_BF.contextOpen)detail=r3BattlefieldContextMarkup();
  else if(R3_DEBUG.open)detail=r3DebugMarkup();
  else if(R3_HUD.flyout||R3_HUD.chooser!==null)
    detail=r3HudFlyoutMarkup(snapshot);
  else if(R3_BF.menuPane==='status'){
    const stats=snapshot?.stats||{};
    detail='<section class="r3-cascade-info" role="group" aria-label="Character status">'+
      '<strong>'+r3Escape(snapshot?.name||'No character')+'</strong>'+
      '<div>HP '+r3HudValue(stats.hp)+' / '+r3HudValue(stats.maxHp)+'</div>'+
      '<div>AC '+r3HudValue(stats.ac)+'</div>'+
      '<div>Speed '+r3HudValue(stats.speed)+' ft</div>'+
      '<div>'+r3Escape(R3_TURN.phase||'Turn unknown')+'</div>'+
      (R3_NATIVE.status?'<div>'+r3Escape(R3_NATIVE.status)+'</div>':'')+'</section>';
  }else if(['profile','concentration','resources','notes'].includes(R3_BF.menuPane))
    detail='<div class="r3-cascade-info">'+r3BattlefieldSidebar(snapshot,R3_BF.menuPane)+'</div>';
  else if(R3_BF.menuPane==='importer')
    detail='<div class="r3-cascade-importer-slot" role="region" aria-label="Importer tools"></div>';
  else if(R3_NATIVE.preview)detail='<section class="r3-cascade-info">'+r3NativeMarkup()+'</section>';
  return '<section class="r3-bf-cascade" data-bf-no-drag role="group" '+
    'aria-label="R20eb cascading menus" data-cascade-side="'+
    (R3_BF.orientation==='right'?'left':'right')+'">'+
    '<nav class="r3-cascade-rail" role="menu" aria-label="R20eb categories">'+
    root+extra+debug+settings+
    '<button type="button" role="menuitem" class="r3-cascade-entry" '+
    'data-bf-action="cascade-close">Close menu<span aria-hidden="true">×</span></button>'+
    '</nav><div class="r3-cascade-branch">'+detail+'</div></section>';
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
  const vertical=R3_BF.orientation==='left'||R3_BF.orientation==='right';
  const hp=r3HudValue(snapshot?.stats?.hp),maxHp=r3HudValue(snapshot?.stats?.maxHp);
  const ac=r3HudValue(snapshot?.stats?.ac);
  const statusTitle=name+' · HP '+hp+' / '+maxHp+' · AC '+ac+
    ' · Move '+left+' · '+phase+
    (R3_NATIVE.status?' · '+r3String(R3_NATIVE.status,110):'');
  const ring=[
    r3BattlefieldRing('action','blade','Action','',remaining+'/'+(1+t.extraActions),
      'Check when the Action is used; local only'),
    r3BattlefieldRing('bonus','lightning','Bonus','',
      t.bonusSpent?'Spent':'Available','Check when the Bonus Action is used; local only'),
    r3BattlefieldRing('reaction','shield','Reaction','',
      t.reactionSpent?'Spent':'Available','Check when the Reaction is used; local only'),
    '<div class="r3-bf-movement">'+r3BattlefieldRing('move','move','Move',
      vertical&&total!==null?r3TurnDistance(total-t.movementUsed)+' ft':left,
      'Used '+r3TurnDistance(t.movementUsed)+' ft',
      'Auto-tracked token movement; click to correct by +5 ft')+
      '<span class="r3-bf-movement-meter" role="progressbar" aria-label="Movement used" '+
      'aria-valuemin="0" aria-valuenow="'+t.movementUsed+'"'+
      (total!==null?' aria-valuemax="'+total+'"':'')+'>'+
      '<span style="width:'+fill+'%"></span></span></div>'
  ].join('');
  return '<section class="r3-bf-shell" aria-label="R20eb battlefield HUD">'+
    (R3_BF.visible.turn?'<div class="r3-bf-turnstrip" data-bf-panel="turn" aria-label="Turn state">'+
    ''+
    '<span class="r3-bf-turn-icon">'+r3HudIcon('clock')+'</span>'+
    '<span><strong>'+r3Escape(phase)+'</strong><small>'+r3Escape(status)+'</small></span>'+
    '<button type="button" data-turn-action="start" title="Reset local turn counters; keep concentration">↻</button>'+
    '<button type="button" data-turn-action="end" title="Mark end of turn locally; does not advance Roll20">⏭</button>'+
    '<button type="button" id="r3-hud-debug" class="r3-bf-debug-trigger" title="Debug, advanced controls and layout settings" aria-label="Open Debug window">⚙ Debug</button>'+
    '</div>':'')+
    '<div class="r3-bf-show-profile-wrap" data-bf-no-drag>'+
        '<button type="button" class="r3-bf-show-profile" data-bf-action="cascade-pane" data-bf-item="profile" '+
        'title="Open Character submenu">☷ '+r3Escape(name)+'</button></div>'+
    '<div class="r3-bf-taskbar" data-bf-panel="taskbar" data-r3-orientation="'+R3_BF.orientation+
    '" aria-label="R20eb taskbar" title="Right-click for dock and visibility settings">'+
    (R3_BF.visible.actions?'<nav class="r3-bf-actions" data-bf-panel="actions" aria-label="Action economy quick dock">'+
      '<div class="r3-bf-rings">'+ring+'</div>'+
      (R3_BF.visible.quick?'<div class="r3-bf-quick">'+
        '<button type="button" data-turn-action="dash-action" title="Mark Action Dash locally and add one speed allowance">'+
        r3HudIcon('move')+'<span>Dash</span></button>'+
        '<button type="button" data-bf-action="disengage" title="Mark Disengage as a local action; no Roll20 execution">'+
        r3HudIcon('shield')+'<span>Disengage</span></button>'+
        '<button type="button" data-bf-action="hide" title="Mark Hide as a local action; no Roll20 execution">'+
        r3HudIcon('eye')+'<span>Hide</span></button></div>':'')+
      '</nav>':'')+
    (R3_BF.visible.categories?'<nav class="r3-bf-category-dock" data-bf-panel="categories" aria-label="Character ability menus">'+
    ''+
    r3BattlefieldControl('blade','Attacks','actions')+
    r3BattlefieldControl('star','Features','features')+
    r3BattlefieldControl('flame','Spells','spells')+
    r3BattlefieldControl('bag','Inventory','inventory')+
    r3BattlefieldControl('book','Skills','skills')+
    r3BattlefieldControl('star','MISC','misc')+
    '</nav>':'')+
    (R3_BF.visible.status?(vertical?
      '<button type="button" class="r3-bf-vertical-status" data-bf-action="vertical-status" '+
      'aria-label="'+r3Escape('Character status: '+statusTitle)+
      '" aria-expanded="'+(R3_BF.menuPane==='status')+'" title="'+r3Escape(statusTitle)+'">'+
      '<span aria-hidden="true">HP</span><strong aria-hidden="true">'+r3Escape(hp)+'</strong></button>':
      '<div class="r3-bf-taskbar-status" role="status" aria-live="off">'+
      '<span class="r3-bf-status-character">'+r3Escape(name)+'</span>'+
      '<span>HP '+r3Escape(hp)+' / '+r3Escape(maxHp)+'</span>'+
      '<span>AC '+r3Escape(ac)+'</span>'+
      '<span>Move '+r3Escape(left)+'</span>'+
      '<span class="r3-bf-status-phase">'+r3Escape(phase)+'</span>'+
      (R3_NATIVE.status?'<span class="r3-bf-status-native" title="'+r3Escape(R3_NATIVE.status)+'">'+
        r3Escape(R3_NATIVE.status)+'</span>':'')+'</div>'):'')+
    '<button type="button" class="r3-bf-menu-button" data-bf-action="taskbar-menu" '+
    'aria-label="Taskbar settings" title="Taskbar settings · right-click anywhere on the taskbar">⋯</button>'+
    '</div>'+

    r3BattlefieldCascadeMarkup(snapshot)+
    '</section>';
}
function r3BattlefieldStyles(){
  return [
    '#r3-hud{position:absolute!important;inset:0!important;bottom:auto!important;left:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;overflow:visible!important}',
    '#r3-hud .r3-bf-shell{position:relative;width:100%;height:100%;pointer-events:none;color:#f1f1ed;font:12px/1.25 system-ui,sans-serif}',
    '.r3-bf-shell button,.r3-bf-shell textarea{box-sizing:border-box;font:inherit;color:inherit}',
    '.r3-bf-shell{font-size:calc(12px * var(--r3-bf-scale,1))!important}.r3-bf-shell button:focus-visible{outline:2px solid #e5bd6e!important;outline-offset:2px}',
    '.r3-bf-debug-trigger{white-space:nowrap;color:#cfe6ff!important;font-weight:650!important;letter-spacing:.01em}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-sidebar,.r3-bf-turnstrip,.r3-bf-mini-tools,.r3-bf-restore,.r3-bf-show-profile,.r3-bf-shell>.hud-flyout,.r3-bf-shell>.hud-native-status{pointer-events:auto}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-section,.r3-bf-turnstrip{background:linear-gradient(145deg,#101b2aF7,#080f1df5);border:1px solid #475e78;border-radius:13px;box-shadow:0 5px 20px #000a}',
    '.r3-bf-actions{position:absolute;bottom:12px;left:14px;width:min(calc(570px * var(--r3-bf-scale,1)),calc((100vw - var(--r3-bf-chat-inset,0px) - 32px) * .52));height:calc(102px * var(--r3-bf-scale,1));display:flex;align-items:stretch;gap:5px;padding:5px}',
    '.r3-bf-rings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;min-width:0;flex:1}',
    '.r3-bf-ring{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:84px;padding:3px!important;border-radius:46%!important;border:2px solid var(--ring)!important;background:radial-gradient(ellipse at center,#1c2939,#090e19 80%)!important;box-shadow:inset 0 0 9px var(--glow),0 0 7px var(--glow);text-align:center}',
    '.r3-bf-ring:hover{filter:brightness(1.18)}.r3-bf-ring.is-spent{opacity:.56;filter:saturate(.6)}',
    '.r3-bf-ring svg{width:23px;height:23px;color:var(--ring)}.r3-bf-ring-name{font-size:10px}.r3-bf-ring strong{font-size:11px;color:#d8f2d8}.r3-bf-ring-sub{font-size:9px;color:#aabbcf}',
    '.r3-bf-action{--ring:#40ee86;--glow:#24b96080}.r3-bf-bonus{--ring:#ffc34e;--glow:#ca882e80}.r3-bf-reaction{--ring:#b476ff;--glow:#7c42c980}.r3-bf-move{--ring:#61adff;--glow:#3279d880}',
    '.r3-bf-movement{position:relative;min-width:0}.r3-bf-movement .r3-bf-ring{height:100%;width:100%}.r3-bf-movement-meter{position:absolute;bottom:7px;left:19%;right:19%;height:5px;background:#16314a;border-radius:5px;overflow:hidden;pointer-events:none}.r3-bf-movement-meter>span{display:block;height:100%;background:#29b7ff}',
    '.r3-bf-quick{flex:0 0 108px;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.r3-bf-quick button{min-height:27px;padding:2px 4px!important;background:#131e2e!important;border:1px solid #304960!important;border-radius:5px!important;display:flex;align-items:center;gap:5px;justify-content:flex-start;font-size:10px!important}',
    '.r3-bf-quick button svg{height:17px;width:17px;flex:none}.r3-bf-quick button:hover{background:#263e54!important}',
    '.r3-bf-category-dock{position:absolute;right:14px;bottom:12px;width:min(calc(555px * var(--r3-bf-scale,1)),calc((100vw - var(--r3-bf-chat-inset,0px) - 32px) * .47));height:calc(88px * var(--r3-bf-scale,1));display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;padding:6px}',
    '.r3-bf-category{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:3px 1px!important;background:#152335!important;border:1px solid #253950!important;border-radius:8px!important;font-size:10px!important}',
    '.r3-bf-category svg{width:25px;height:25px;color:#f5f4f1}.r3-bf-category span{font-size:10px}.r3-bf-category b{display:none}',
    '.r3-bf-category:hover,.r3-bf-category.selected{background:#2c4666!important;border-color:#6e9ed1!important;box-shadow:inset 0 0 0 1px #5b8fba}',
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
    '.r3-bf-shell .r3-bf-turnstrip{max-width:min(360px,calc(100vw - var(--r3-bf-chat-inset,0px) - 30px))}',
    '.r3-bf-show-profile{position:absolute;right:14px;top:20px;background:#17273bdd!important;border:1px solid #436080!important;padding:6px 9px!important;border-radius:7px!important}',
    '.r3-bf-shell>.hud-flyout{position:absolute!important;right:14px!important;left:auto!important;bottom:107px!important;width:min(calc(600px * var(--r3-bf-scale,1)),calc(100vw - var(--r3-bf-chat-inset,0px) - 32px))!important;max-height:min(65dvh,690px)!important;pointer-events:auto;border-radius:12px;background:linear-gradient(145deg,#15273d,#0b1421);border:1px solid #56789a;box-shadow:0 18px 40px #000b}',
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


// Taskbar/status bar geometry is independent of the selected color theme.
// Unlike the old two oversized bottom HUD blocks, the actions, menus, and
// character status share a single dock that can occupy any screen edge.
function r3BattlefieldTaskbarStyles(){
  return [
    '.r3-bf-taskbar{position:absolute;left:8px;bottom:8px;right:auto;top:auto;width:min(1260px,calc(100vw - var(--r3-bf-chat-inset,330px) - 24px));min-width:100px;max-height:calc(100vh - 16px);display:flex;flex-direction:row;flex-wrap:wrap;align-items:stretch;gap:3px;padding:4px 31px 4px 5px;pointer-events:auto;z-index:10;border:1px solid var(--r3-border,#475e78);border-radius:7px;background:var(--r3-panel,#182234f2);color:var(--r3-text,#f1f1ed);box-shadow:0 4px 18px #000a;overflow:visible}',
    '.r3-bf-taskbar>.r3-bf-actions,.r3-bf-taskbar>.r3-bf-category-dock{position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;transform:none!important;min-width:0;max-width:none!important;height:auto!important;min-height:44px;width:auto!important;margin:0!important;padding:2px!important;box-shadow:none!important;border:0!important;border-radius:4px!important}',
    '.r3-bf-taskbar>.r3-bf-actions{flex:1 1 48%;gap:3px!important}',
    '.r3-bf-taskbar>.r3-bf-category-dock{flex:1 1 48%;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:2px!important}',
    '.r3-bf-taskbar .r3-bf-rings{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2px!important;min-width:0}',
    '.r3-bf-taskbar .r3-bf-ring{min-height:37px!important;height:100%;padding:3px!important;flex-direction:row!important;gap:4px!important;border-radius:5px!important;border-width:1px!important;box-shadow:none!important;justify-content:center}',
    '.r3-bf-taskbar .r3-bf-ring svg{width:15px!important;height:15px!important;flex:none}',
    '.r3-bf-taskbar .r3-bf-ring-name{font-size:10px!important;white-space:nowrap}',
    '.r3-bf-taskbar .r3-bf-ring strong{font-size:10px!important;white-space:nowrap}',
    '.r3-bf-taskbar .r3-bf-ring-sub{display:none!important}',
    '.r3-bf-taskbar .r3-bf-movement-meter{bottom:1px;left:14%;right:14%;height:2px}',
    '.r3-bf-taskbar .r3-bf-quick{flex:0 0 58px!important;flex-direction:row;flex-wrap:wrap;gap:2px}',
    '.r3-bf-taskbar .r3-bf-quick button{flex:1 1 100%;min-height:12px!important;height:12px;font-size:8px!important;padding:0 2px!important;line-height:1!important}',
    '.r3-bf-taskbar .r3-bf-quick button svg{height:10px!important;width:10px!important}',
    '.r3-bf-taskbar .r3-bf-category{flex-direction:row!important;gap:3px!important;min-height:38px!important;padding:3px 4px!important;border-radius:4px!important;justify-content:center}',
    '.r3-bf-taskbar .r3-bf-category svg{width:16px!important;height:16px!important;flex:none}',
    '.r3-bf-taskbar .r3-bf-category span{font-size:10px!important;white-space:nowrap}',
    '.r3-bf-taskbar-status{flex:1 1 100%;min-width:0;display:flex;gap:8px;align-items:center;border-top:1px solid var(--r3-border,#475e78);padding:2px 4px;min-height:19px;font-size:10px;color:inherit;overflow:hidden}',
    '.r3-bf-taskbar-status>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}',
    '.r3-bf-status-character{font-weight:700;max-width:130px}',
    '.r3-bf-status-native{min-width:0!important;flex:1 1 auto!important;opacity:.85}',
    '.r3-bf-menu-button{position:absolute!important;top:4px;right:4px;width:24px!important;min-width:24px!important;height:25px!important;padding:0!important;font-size:18px!important;line-height:1!important;z-index:2}',
    '.r3-bf-context{position:absolute;z-index:3000;width:232px;max-height:min(75vh,460px);overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:2px;padding:6px;background:var(--r3-panel,#202a39);color:var(--r3-text,#f4f5fa);border:1px solid var(--r3-border,#8294ad);border-radius:7px;box-shadow:0 8px 24px #000c;pointer-events:auto}',
    '.r3-bf-context strong{font:700 11px system-ui,sans-serif;margin:5px 4px 2px}',
    '.r3-bf-context button{display:block!important;text-align:left!important;padding:4px 7px!important;min-height:24px!important;border-radius:3px!important;font-size:11px!important;white-space:nowrap}',
    '.r3-bf-context button[aria-checked=true]{font-weight:700!important}',
    '.r3-bf-context button:focus-visible{outline:2px solid #f9d486!important;outline-offset:1px}',
    '.r3-bf-taskbar[data-r3-orientation=top]{top:8px!important;bottom:auto!important}',
    // Vertical dock = one button per row, the same density as Roll20's
    // native left toolbar. No two-column grids or wrapped three-line cards.
    '.r3-bf-taskbar[data-r3-orientation=left],.r3-bf-taskbar[data-r3-orientation=right]{top:8px!important;bottom:auto!important;width:66px!important;min-width:66px!important;max-width:66px!important;max-height:calc(100vh - 16px)!important;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;align-items:stretch!important;align-content:stretch!important;gap:3px!important;padding:5px 4px!important;box-sizing:border-box!important}',
    '.r3-bf-taskbar[data-r3-orientation=left]{left:8px!important;right:auto!important}',
    '.r3-bf-taskbar[data-r3-orientation=right]{left:auto!important;right:calc(var(--r3-bf-chat-inset,330px) + 8px)!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right])>.r3-bf-actions,.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right])>.r3-bf-category-dock{flex:0 0 auto!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;align-items:stretch!important;gap:3px!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-rings{display:flex!important;flex:0 0 auto!important;flex-direction:column!important;flex-wrap:nowrap!important;align-items:stretch!important;gap:3px!important;width:100%!important;min-width:0!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-ring{box-sizing:border-box!important;flex:0 0 auto!important;display:flex!important;flex-direction:column!important;gap:1px!important;width:100%!important;min-width:0!important;min-height:42px!important;height:42px!important;padding:3px 1px!important;justify-content:center!important;align-items:center!important;border-radius:5px!important;overflow:hidden!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-ring svg{width:16px!important;height:16px!important;flex:0 0 16px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-ring-name{display:block!important;font-size:9px!important;line-height:11px!important;white-space:nowrap!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-ring strong{font-size:9px!important;line-height:11px!important;white-space:nowrap!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-movement{display:block!important;flex:none!important;width:100%!important;min-width:0!important;height:47px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-movement .r3-bf-ring{height:47px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-movement-meter{left:5px!important;right:5px!important;bottom:1px!important;height:3px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-quick{display:flex!important;flex:0 0 auto!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:3px!important;width:100%!important;min-width:0!important;margin-top:2px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-quick button{display:flex!important;flex:0 0 auto!important;flex-direction:column!important;gap:1px!important;align-items:center!important;justify-content:center!important;width:100%!important;height:37px!important;min-height:37px!important;padding:2px 0!important;line-height:11px!important;font-size:9px!important;white-space:nowrap!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-quick button svg{width:15px!important;height:15px!important;flex:none!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right])>.r3-bf-category-dock{border-top:1px solid var(--r3-border,#475e78)!important;padding-top:4px!important;margin-top:3px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-category{box-sizing:border-box!important;flex:0 0 auto!important;display:flex!important;flex-direction:column!important;gap:2px!important;align-items:center!important;justify-content:center!important;min-height:42px!important;height:42px!important;width:100%!important;min-width:0!important;padding:2px 1px!important;border-radius:5px!important;overflow:hidden!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-category svg{width:18px!important;height:18px!important;flex:0 0 18px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-category span{font-size:9px!important;line-height:11px!important;white-space:nowrap!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-menu-button{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;flex:0 0 auto!important;width:100%!important;height:27px!important;min-height:27px!important;margin:0!important;padding:0!important;font-size:18px!important;order:99!important}',
    '.r3-bf-used-checkbox{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:13px;height:13px;min-width:13px;border:1px solid currentColor;border-radius:2px;background:transparent;color:inherit;font:bold 12px/12px system-ui,sans-serif}',
    '.r3-bf-ring[role=checkbox]{position:relative;gap:4px!important;opacity:1!important;filter:none!important}',
    '.r3-bf-ring[role=checkbox][aria-checked=true]{border-color:var(--r3-positive,#9ece6a)!important}',
    '.r3-bf-ring[role=checkbox][aria-checked=true] .r3-bf-used-checkbox{background:var(--r3-positive,#9ece6a);color:var(--r3-inset,#111)!important;border-color:var(--r3-positive,#9ece6a)}',
    '.r3-bf-ring[role=checkbox].is-spent{opacity:1!important;filter:none!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-ring[role=checkbox]{padding-right:13px!important}',
    '.r3-bf-taskbar:is([data-r3-orientation=left],[data-r3-orientation=right]) .r3-bf-used-checkbox{position:absolute;right:2px;top:3px;width:12px;height:12px;min-width:12px;font-size:10px}',
    '.r3-bf-vertical-status{flex:0 0 auto!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:0!important;width:100%!important;min-height:35px!important;height:35px!important;padding:2px!important;font-size:9px!important;line-height:12px!important}',
    '.r3-bf-vertical-status strong{font-size:11px!important;line-height:12px!important}',
    '.r3-bf-vertical-status-detail{position:absolute;top:50%;left:calc(100% + 6px);min-width:175px;max-width:250px;padding:9px;display:flex;flex-direction:column;gap:4px;border:1px solid var(--r3-border,#475e78);border-radius:6px;background:var(--r3-panel,#202a39);color:var(--r3-text,#fff);box-shadow:0 6px 22px #000a;z-index:400;pointer-events:auto}',
    '.r3-bf-taskbar[data-r3-orientation=right]~.r3-bf-vertical-status-detail{left:auto;right:calc(var(--r3-bf-chat-inset,330px) + 81px)}',
    '@media(max-width:1000px){.r3-bf-taskbar:not([data-r3-orientation=left]):not([data-r3-orientation=right])>.r3-bf-actions,.r3-bf-taskbar:not([data-r3-orientation=left]):not([data-r3-orientation=right])>.r3-bf-category-dock{flex:1 1 100%!important}.r3-bf-taskbar-status{gap:5px}.r3-bf-status-phase{display:none}}',
    '@media(max-width:540px){.r3-bf-taskbar .r3-bf-ring-name{display:none}.r3-bf-taskbar .r3-bf-category span{font-size:9px!important}.r3-bf-taskbar-status>span:nth-child(n+4){display:none}}'
  ].join('');
}

// Windows 95/98 visual system. All selectors remain inside R20eb's Shadow DOM;
// nothing changes Roll20's own editor, sheet, chat or controls.
function r3BattlefieldCascadeStyles(){
  return [
    // The category rail is the first menu level; the selected category is the
    // branch. No separate draggable HUD windows or unsolicited map overlays.
    '.r3-bf-cascade{position:absolute;z-index:2800;display:flex;align-items:stretch;gap:0;max-width:calc(100vw - var(--r3-bf-chat-inset,0px) - 14px);max-height:min(76dvh,650px);min-height:80px;pointer-events:auto;background:var(--r3-panel,#202a39);color:var(--r3-text,#f4f5fa);border:1px solid var(--r3-border,#8294ad);box-shadow:0 10px 32px #000a;border-radius:6px;overflow:visible}',
    '.r3-cascade-rail{box-sizing:border-box;flex:0 0 150px;max-width:150px;min-width:120px;max-height:inherit;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:4px;border-right:1px solid var(--r3-border,#8294ad);scrollbar-width:thin}',
    '.r3-cascade-entry{display:flex!important;align-items:center;justify-content:space-between;gap:9px;width:100%!important;min-height:26px!important;text-align:left!important;padding:5px 6px!important;white-space:nowrap;font-size:11px!important;border:0!important;border-radius:3px!important;background:transparent!important;color:inherit!important}',
    '.r3-cascade-entry:hover,.r3-cascade-entry:focus-visible,.r3-cascade-entry.selected{background:var(--r3-selected,#405272)!important}',
    '.r3-cascade-entry>span{opacity:.72}',
    '.r3-cascade-branch{flex:1 1 365px;min-width:0;max-height:inherit;overflow:visible;position:relative}',
    '.r3-bf-cascade .hud-flyout,.r3-bf-cascade .r3-debug-window,.r3-bf-cascade .r3-bf-context{position:relative!important;inset:auto!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;display:block;width:100%!important;min-width:0!important;max-width:none!important;max-height:inherit!important;box-sizing:border-box;box-shadow:none!important;border:0!important;border-radius:0!important;background:var(--r3-panel,#202a39)!important;overflow-y:auto;overflow-x:visible;overscroll-behavior:contain;pointer-events:auto}',
    '.r3-bf-cascade .hud-flyout>header,.r3-bf-cascade .r3-debug-header{min-height:29px;position:sticky;top:0;z-index:2}',
    '.r3-bf-cascade .hud-attack-categories{display:flex;flex-direction:column;align-items:stretch;gap:2px;min-width:105px}',
    '.r3-bf-cascade .hud-attack-list{display:grid;grid-template-columns:105px minmax(0,1fr);gap:4px;align-items:start}',
    '.r3-bf-cascade .hud-attack-count{grid-column:1/-1}',
    '.r3-bf-cascade .hud-weapon-list{min-width:0}',
    '.r3-bf-cascade .hud-weapon-group{position:relative;overflow:visible}',
    '.r3-bf-cascade .hud-weapon-submenu{position:relative;width:100%;max-height:40vh;overflow:auto;display:flex;flex-direction:column;gap:3px;border-left:2px solid var(--r3-accent,#7aa2f7);padding-left:5px}',
    '.r3-bf-cascade .hud-spell-levels{display:flex;flex-direction:column;align-items:stretch;gap:2px;margin:0;padding:5px;overflow-y:auto;grid-row:1/3;min-width:95px}',
    '.r3-bf-cascade .hud-spell-levels button{text-align:left!important;white-space:nowrap}',
    '.r3-bf-cascade .hud-flyout:has(.hud-spell-levels){display:grid!important;grid-template-columns:105px minmax(0,1fr);align-content:start}',
    '.r3-bf-cascade .hud-flyout:has(.hud-spell-levels)>header{grid-column:1/-1}',
    '.r3-bf-cascade .hud-flyout:has(.hud-spell-levels) .hud-spell-levels{grid-row:2/5;grid-column:1}',
    '.r3-bf-cascade .hud-flyout:has(.hud-spell-levels) .hud-flyout-caption,.r3-bf-cascade .hud-flyout:has(.hud-spell-levels) .hud-flyout-cards{grid-column:2}',
    '.r3-bf-cascade .hud-flyout:has(.hud-spell-levels)>.hud-native-status{grid-column:1/-1}',
    '.r3-bf-cascade .hud-flyout-cards.hud-list{width:100%;max-height:min(60vh,520px);overflow-y:auto;scrollbar-width:thin}',
    '.r3-bf-cascade .r3-cascade-info{padding:9px;min-width:240px;max-height:inherit;overflow:auto;box-sizing:border-box}',
    '.r3-bf-cascade .r3-cascade-importer-slot{min-width:350px;min-height:220px;max-width:100%;pointer-events:none}',
    '#r3-wrap[data-bf-panel=importer]:has(#r3-content[style*="block"]){box-shadow:0 8px 26px #000b!important;border:1px solid var(--r3-border,#8294ad)!important;border-radius:0 6px 6px 0!important;max-height:min(76dvh,650px)!important;overflow:auto!important}',
    '#r3-wrap[data-bf-panel=importer] #r3-toggle{padding:6px 10px!important;font-size:12px!important}',
    '#r3-wrap[data-bf-panel=importer] #r3-content{max-height:min(70dvh,570px)!important}',
    '.r3-bf-cascade .r3-bf-sidebar{display:block!important;position:static!important;inset:auto!important;width:100%!important;max-height:none!important;overflow:visible!important}',
    '.r3-bf-cascade .r3-bf-sidebar>.r3-bf-section{position:static!important;inset:auto!important;width:100%!important;max-height:none!important;overflow:visible!important;margin:0!important}',
    '.r3-bf-cascade .r3-debug-window{width:min(560px,100%)!important}',
    '.r3-bf-cascade .r3-debug-body{max-height:min(68vh,580px);overflow:auto}',
    '.r3-bf-cascade .r3-bf-context{display:flex!important;flex-direction:column!important;min-width:210px!important;max-height:inherit!important}',
    '.r3-bf-cascade .r3-bf-context button{width:100%}',
    '.r3-bf-cascade .hud-flyout .hud-list-card[open] .hud-card-body{border-left:2px solid var(--r3-accent,#7aa2f7)}',
    '.r3-bf-cascade button:focus-visible,.r3-bf-cascade summary:focus-visible{outline:2px solid var(--r3-accent,#7aa2f7)!important;outline-offset:-2px!important}',
    '@media(max-width:750px){.r3-cascade-rail{flex-basis:112px;min-width:102px}.r3-bf-cascade .hud-attack-list{grid-template-columns:1fr}.r3-bf-cascade .hud-spell-levels{min-width:70px}.r3-bf-cascade .hud-flyout:has(.hud-spell-levels){grid-template-columns:80px minmax(0,1fr)}.r3-bf-cascade .hud-attack-categories{flex-direction:row;flex-wrap:wrap}}'
  ].join('');
}
function r3Win9xStyles(){
  return [
    ':host{color-scheme:light!important;font-family:Tahoma,"MS Sans Serif",Arial,sans-serif!important}',
    '#r3-hud .r3-bf-shell,#r3-wrap,.hud-shell,.r3-debug-window{font-family:Tahoma,"MS Sans Serif",Arial,sans-serif!important;color:#111!important;text-shadow:none!important}',
    '#r3-hud .r3-bf-shell{font-size:calc(11px * var(--r3-bf-scale,1))!important}',
    // Silver desktop windows with raised 3D edges and no translucent glow.
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-sidebar .r3-bf-section,.r3-bf-turnstrip,.hud-flyout,.r3-debug-window,.hud-native-status,#r3-wrap{background:#c0c0c0!important;color:#111!important;border:2px solid!important;border-color:#fff #404040 #404040 #fff!important;border-radius:0!important;box-shadow:inset 1px 1px #dfdfdf,inset -1px -1px #808080,2px 2px 0 #0008!important;backdrop-filter:none!important}',
    '.r3-bf-sidebar{border:0!important;box-shadow:none!important;background:transparent!important}',
    '.hud-flyout{color:#111!important;background:#c0c0c0!important;max-height:min(68vh,630px)!important;min-width:275px;scrollbar-color:#808080 #dfdfdf}',
    // Classic non-resizable blue titlebars: the panels remain freely draggable.
    '.hud-flyout>header,.r3-debug-header,#r3-toggle,.r3-bf-turnstrip,.hud-toolbar{background:linear-gradient(90deg,#000080,#1084bd)!important;color:#fff!important;border-radius:0!important;border-bottom:1px solid #808080!important;box-shadow:none!important}',
    '.hud-flyout>header{min-height:29px;padding:3px 5px!important}',
    '.hud-flyout>header strong,.r3-debug-header strong{font-size:12px!important;letter-spacing:0!important;color:#fff!important;font-weight:700!important}',
    '.hud-flyout>header small,.r3-debug-header span{color:#f5f5f5!important;opacity:1!important}',
    '.r3-bf-turnstrip strong,.r3-bf-turnstrip small,.hud-toolbar>span,.hud-toolbar small{color:#fff!important;letter-spacing:0!important}',
    '.hud-weapon-heading,.hud-segment-caption,.hud-flyout-caption{background:#d4d0c8!important;color:#111!important;border-radius:0!important}',
    // Raised button bevel; pressed and selected controls use sunken bevel.
    '#r3-wrap button,.r3-bf-shell button,.r3-debug-window button,.hud-shell button{background:#c0c0c0!important;background-image:none!important;color:#111!important;border:2px solid!important;border-color:#fff #404040 #404040 #fff!important;border-radius:0!important;box-shadow:inset 1px 1px #dfdfdf,inset -1px -1px #808080!important;text-shadow:none!important;filter:none!important;letter-spacing:0!important}',
    '#r3-wrap button:hover:not(:disabled),.r3-bf-shell button:hover:not(:disabled),.r3-debug-window button:hover:not(:disabled){background:#d4d0c8!important;filter:none!important}',
    '#r3-wrap button:active:not(:disabled),.r3-bf-shell button:active:not(:disabled),.r3-bf-shell button.selected,.r3-bf-shell button.active,.r3-bf-shell button[aria-pressed=true],.r3-debug-window button:active:not(:disabled){border-color:#404040 #fff #fff #404040!important;box-shadow:inset 1px 1px #808080!important;background:#b2b2b2!important}',
    '.r3-bf-shell button:disabled,.hud-shell button:disabled{color:#808080!important;text-shadow:1px 1px #fff!important;opacity:1!important}',
    '#r3-wrap button:focus-visible,.r3-bf-shell button:focus-visible,.r3-debug-window button:focus-visible{outline:1px dotted #111!important;outline-offset:-5px!important}',
    // Titlebar X and debug restore should look like 95-era caption buttons.
    '.hud-flyout>header button,.r3-debug-header button{flex:0 0 auto;min-height:19px!important;min-width:21px!important;padding:0 4px!important;line-height:16px!important;font-size:14px!important}',
    '.r3-bf-debug-trigger{font-size:11px!important;min-height:24px!important;color:#111!important}',
    '.r3-bf-ring{border-radius:0!important;background:#c0c0c0!important;box-shadow:inset 1px 1px #fff,inset -1px -1px #808080!important;gap:2px!important}',
    '.r3-bf-ring svg,.r3-bf-category svg,.hud-bar-art svg{color:#000080!important;filter:none!important}',
    '.r3-bf-ring-name,.r3-bf-ring-sub,.r3-bf-ring strong{color:#111!important;font-weight:700!important}',
    '.r3-bf-movement-meter{border:1px solid #808080!important;border-radius:0!important;background:#fff!important;height:8px!important}',
    '.r3-bf-movement-meter>span{background:#000080!important}',
    '.r3-bf-actions{gap:3px!important;padding:4px!important}',
    '.r3-bf-category-dock{gap:3px!important;padding:4px!important}',
    '.r3-bf-quick button,.r3-bf-category{border-radius:0!important}',
    '.r3-bf-category.selected{background:#000080!important;color:#fff!important}',
    '.r3-bf-category.selected svg,.r3-bf-category.selected span{color:#fff!important}',
    '.r3-bf-section{padding:6px!important}',
    '.r3-bf-section header strong,.r3-bf-profile strong{font-family:Tahoma,Arial,sans-serif!important;color:#111!important}',
    '.r3-bf-section header span,.r3-bf-character-text small,.hud-card-note{color:#505050!important}',
    '.r3-bf-section textarea,.r3-debug-window select,#r3-wrap select,#r3-wrap input,#r3-wrap textarea{background:#fff!important;color:#111!important;border:2px solid!important;border-color:#808080 #fff #fff #808080!important;border-radius:0!important;box-shadow:inset 1px 1px #404040!important}',
    // Explorer-style inset content panes, row highlights and tree details.
    '.hud-flyout-cards,.hud-weapon-submenu,.hud-choice-list,.r3-debug-entries,.r3-debug-movement dl,#r3-results{background:#fff!important;color:#111!important;border:2px solid!important;border-color:#808080 #fff #fff #808080!important;border-radius:0!important;box-shadow:inset 1px 1px #404040!important}',
    '.hud-card,.hud-weapon-group,.hud-skill-group,.r3-debug-operations,.r3-debug-movement{background:#c0c0c0!important;color:#111!important;border-radius:0!important;border:1px solid #808080!important;box-shadow:none!important}',
    '.hud-card summary,.hud-weapon-heading,.hud-skill-row{color:#111!important;background:#d4d0c8!important}',
    '.hud-weapon-option,.hud-card-body,.hud-skill-row{color:#111!important;border-color:#b7b7b7!important}',
    '.hud-weapon-option-label small,.hud-card-tags span,.hud-flyout .hud-hint,.hud-card-field{color:#333!important}',
    '.hud-weapon-native,.hud-native-linked{color:#006600!important;font-weight:700!important}',
    '.hud-weapon-unmapped,.hud-native-unmapped{color:#7c3030!important}',
    '.hud-attack-button,.hud-native-action,.hud-dice-button{min-height:28px!important;min-width:66px!important;font-weight:700!important}',
    '.hud-spell-levels button.active,.hud-attack-categories button.selected{background:#000080!important;color:#fff!important}',
    '.hud-spell-levels button.active small,.hud-attack-categories button.selected small{color:#fff!important}',
    '.hud-flyout-caption{font-weight:700!important;padding:5px 7px!important}',
    '.hud-native-status,.hud-empty{color:#111!important;background:#e0e0e0!important}',
    '.hud-native-status span{color:#111!important}',
    '.r3-debug-window{font-size:11px!important;box-shadow:2px 2px 0 #0008!important}',
    '.r3-debug-header{padding:3px 5px!important;min-height:29px!important}',
    '.r3-debug-body{background:#c0c0c0!important;color:#111!important;padding:7px!important}',
    '.r3-debug-operations p,.r3-debug-movement small,.r3-debug-note,.r3-debug-empty{color:#333!important}',
    '.r3-debug-entry,.r3-debug-entry:nth-child(even){background:#fff!important;color:#111!important;border-bottom:1px dotted #aaa!important}',
    '.r3-debug-entry strong,.r3-debug-entry time{color:#000080!important}',
    '.r3-debug-entry.warning span{color:#804000!important}.r3-debug-entry.error span{color:#a00000!important}',
    '.r3-debug-movement dt,.r3-debug-movement dd{color:#111!important}',
    '.r3-bf-taskbar,.r3-bf-context,.r3-bf-cascade{background:#c0c0c0!important;color:#111!important;border:2px solid!important;border-color:#fff #404040 #404040 #fff!important;border-radius:0!important;box-shadow:inset 1px 1px #dfdfdf,inset -1px -1px #808080!important}',
    '.r3-bf-cascade .r3-cascade-rail,.r3-bf-cascade .r3-cascade-branch{background:#c0c0c0!important;color:#111!important}',
    '.r3-bf-cascade .r3-cascade-entry.selected,.r3-bf-cascade .r3-cascade-entry:hover,.r3-bf-cascade .r3-cascade-entry:focus-visible{background:#000080!important;color:#fff!important;border-radius:0!important}',
    '.r3-bf-cascade .hud-flyout,.r3-bf-cascade .r3-debug-window,.r3-bf-cascade .r3-cascade-info{background:#c0c0c0!important;color:#111!important}',
    '.r3-bf-taskbar-status{border-top:1px solid #808080!important;color:#111!important}',
    '#r3-wrap{background:#c0c0c0!important;color:#111!important}',
    '#r3-toggle{font-size:12px!important;font-weight:700!important;padding:5px 9px!important}',
    '#r3-content{background:#c0c0c0!important;color:#111!important}',
    '#r3-content .notice,#r3-content .muted,#r3-status{color:#222!important}',
    '#r3-content .entry,#r3-content .kv{color:#111!important;border-color:#808080!important}',
    '#r3-content .entrybody{color:#111!important}',
    '.hud-hp-track{background:#fff!important;border:1px solid #808080!important;border-radius:0!important}',
    '.hud-hp-fill{background:#008000!important}',
    // Expanded bodies and compact stat/shortcut areas inherited several
    // dark 2024 HUD backgrounds. Always pair black text with an opaque
    // light surface, including high contrast in open cards.
    '.hud-card-body,.hud-card[open] .hud-card-body,.hud-card-tags span,.hud-skill-group b,.hud-skill-row,.hud-weapon-option,.hud-weapon-direct{background:#fff!important;color:#111!important}',
    '.hud-card-body{border-top:1px solid #808080!important}',
    '.hud-card-tags span{border:1px solid #808080!important;background:#eee!important}',
    '.hud-card-mark{background:#000080!important;color:#fff!important;font-family:Tahoma,Arial,sans-serif!important}',
    '.hud-card-title,.hud-card-title small,.hud-card-count,.hud-card-caret,.hud-skill-row strong,.hud-skill-value,.hud-weapon-heading small,.hud-weapon-single{color:#111!important}',
    '.hud-skill-group b{background:#d4d0c8!important;color:#111!important;border-bottom:1px solid #808080!important}',
    '.hud-hp-label,.hud-hp-label span,.hud-hp-label strong{color:#111!important}',
    '.r3-bf-stats .hud-stat,.hud-portrait-stats .hud-stat,.hud-res-chip,.r3-bf-resource-panel .hud-res-chip{background:#fff!important;color:#111!important;border:1px solid #808080!important;border-radius:0!important}',
    '.r3-bf-stats .hud-stat strong,.r3-bf-stats .hud-stat span,.hud-portrait-stats .hud-stat span,.hud-portrait-stats .hud-stat strong{color:#111!important}',
    '.r3-bf-resource-panel small,.r3-bf-concentration small,.hud-portrait-name{color:#111!important}',
    '.r3-bf-avatar,.hud-avatar,.hud-avatar-pane{background:#d4d0c8!important;color:#111!important;border-radius:0!important}',
    '.hud-bar-art,.hud-color-spells .hud-bar-art,.hud-color-bonus .hud-bar-art,.hud-color-free .hud-bar-art,.hud-color-reaction .hud-bar-art,.hud-color-pass .hud-bar-art{background:#dfdfdf!important;color:#000080!important}',
    '.hud-bar-label,.hud-portrait-shortcuts,.hud-segment-caption{background:#c0c0c0!important;color:#111!important}',
    '.hud-weapon-option-label strong,.hud-weapon-option-label small{color:#111!important}',
    '.r3-bf-turn-icon svg{color:#fff!important}',
    '#r3-content .kv strong,#r3-content .entry small{color:#111!important}',
    // Keep the compact layout useful at laptop widths.
    '@media(max-width:780px){.hud-flyout{min-width:0!important;max-width:calc(100vw - 18px)!important}.r3-debug-window{max-width:calc(100vw - 24px)!important}.r3-bf-ring{padding:2px!important}}',
    '@media(prefers-reduced-motion:reduce){.r3-bf-shell *,.hud-flyout *{transition:none!important;animation:none!important}}'
  ].join('');
}
