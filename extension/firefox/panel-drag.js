// Firefox-only HUD panel placement. Never intercept pointer events on the map.
// Panel locations belong to the game, not the selected character.
const R3_BF_PANELS=new Set([
  'actions','categories','turn','profile','concentration','resources',
  'notes','advanced','tools','flyout','native','importer','show-profile'
]);
const R3_BF_DRAG={scope:'',positions:{},active:null,suppressClick:null,enabled:false,root:null};
function r3BattlefieldLayoutKey(){
  return r3StorageKey()+':firefox-panel-layout:v1';
}
function r3BattlefieldLayoutLoad(){
  const key=r3BattlefieldLayoutKey();
  if(R3_BF_DRAG.scope===key)return;
  R3_BF_DRAG.scope=key;
  R3_BF_DRAG.positions={};
  try{
    const stored=JSON.parse(localStorage.getItem(key)||'null');
    if(stored?.schema!==1||!stored.positions||typeof stored.positions!=='object')return;
    for(const [name,position] of Object.entries(stored.positions)){
      if(!R3_BF_PANELS.has(name))continue;
      if(Number.isFinite(position?.x)&&Number.isFinite(position?.y)&&
        position.x>=0&&position.y>=0&&position.x<=10000&&position.y<=10000)
        R3_BF_DRAG.positions[name]={x:position.x,y:position.y};
    }
  }catch{/* Corrupt or unavailable storage must not block startup. */}
}
function r3BattlefieldLayoutSave(){
  try{localStorage.setItem(r3BattlefieldLayoutKey(),JSON.stringify({
    schema:1,positions:R3_BF_DRAG.positions
  }));}catch{/* Layout remains usable within this session. */}
}
function r3BattlefieldDraggableFlyout(markup){
  // The flyout is the drag surface, without an extra grab tab.
  return String(markup||'').replace(
    /^(<section\b[^>]*class="hud-flyout"[^>]*)(>)/,
    '$1 data-bf-panel="flyout"$2');
}
function r3BattlefieldChatInset(){
  // Roll20's sidebar is an ordinary page DOM element. Read geometry only:
  // never hide or move it, and never rely on a private Roll20 API.
  const width=Number(window.innerWidth)||1280;
  for(const selector of ['#rightsidebar','#sidebar','#textchatcontainer','.rightsidebar','#textchat']){
    const candidate=document.querySelector?.(selector);
    const rect=candidate?.getBoundingClientRect?.();
    if(!rect||rect.width<180||rect.width>550||rect.height<160||
       rect.left<width*.50||rect.right<width-90||rect.left>=width-30)continue;
    return Math.min(560,Math.max(0,Math.round(width-rect.left)+8));
  }
  // On a standard Roll20 desktop session the right chat occupies ~300px.
  // Reserve it even if its DOM class varies; all panels can be repositioned.
  return width>=1150?330:width>=800?265:0;
}
function r3BattlefieldBounds(panel){
  const width=Math.max(0,Number(window.innerWidth)||1280);
  const height=Math.max(0,Number(window.innerHeight)||800);
  const rect=panel.getBoundingClientRect();
  return {width:rect.width,height:rect.height,
    left:rect.left,top:rect.top,
    maxX:Math.max(4,width-rect.width-4),
    maxY:Math.max(4,height-rect.height-4)};
}
function r3BattlefieldClamp(panel,x,y){
  const b=r3BattlefieldBounds(panel);
  const normalized=(value,max)=>Math.min(max,Math.max(4,
    Number.isFinite(value)?Math.round(value):4));
  return {x:normalized(x,b.maxX),y:normalized(y,b.maxY)};
}
function r3BattlefieldSetPosition(panel,x,y){
  const at=r3BattlefieldClamp(panel,x,y);
  panel.style.setProperty('left',at.x+'px','important');
  panel.style.setProperty('top',at.y+'px','important');
  panel.style.setProperty('right','auto','important');
  panel.style.setProperty('bottom','auto','important');
  panel.style.setProperty('transform','none','important');
  return at;
}
function r3BattlefieldPanel(root,name){
  // Use only declared panel identifiers, not selector text from storage or DOM.
  if(!R3_BF_PANELS.has(name))return null;
  return root?.querySelector?.('[data-bf-panel="'+name+'"]')||null;
}
function r3BattlefieldPlacePanels(){
  r3BattlefieldLayoutLoad();
  const root=R3_UI.root;
  if(!root)return;
  const inset=r3BattlefieldChatInset();
  const host=R3_UI.host;
  host?.style?.setProperty?.('--r3-bf-chat-inset',inset+'px');
  root.querySelector?.('.r3-bf-shell')?.style?.setProperty?.('--r3-bf-chat-inset',inset+'px');
  // Importer is outside the HUD's root but should be as movable as everything
  // else, and should default next to the canvas rather than over chat.
  const importer=root.getElementById?.('r3-wrap');
  if(importer)importer.setAttribute?.('data-bf-panel','importer');
  for(const name of R3_BF_PANELS){
    const panel=r3BattlefieldPanel(root,name);
    if(!panel)continue;
    panel.setAttribute?.('tabindex','0');
    panel.setAttribute?.('title','Drag to move · Alt+Arrow to nudge, Alt+Shift+Arrow for 1px');
    const saved=R3_BF_DRAG.positions[name];
    if(saved){
      const at=r3BattlefieldSetPosition(panel,saved.x,saved.y);
      // Clamp persisted coordinates when screen dimensions changed.
      R3_BF_DRAG.positions[name]=at;
    }else if((name==='flyout'||name==='native')&&root.querySelector){
      // New menus appear next to the *current* ability dock, not near chat.
      const dock=r3BattlefieldPanel(root,'categories');
      if(!dock)continue;
      const anchor=dock.getBoundingClientRect?.();
      const menu=panel.getBoundingClientRect?.();
      if(anchor&&menu)r3BattlefieldSetPosition(panel,
        anchor.right-menu.width,anchor.top-menu.height-8);
    }
  }
}
function r3BattlefieldIsEditor(target){
  return !!target?.closest?.(
    'input,textarea,select,option,[contenteditable="true"],[data-bf-no-drag]');
}
function r3BattlefieldDragStart(event){
  if(R3_BF_DRAG.active)return;
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const panel=event.target?.closest?.('[data-bf-panel]');
  const name=panel?.getAttribute?.('data-bf-panel');
  if(!R3_BF_PANELS.has(name)||r3BattlefieldIsEditor(event.target))return;
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
  const b=r3BattlefieldBounds(panel);
  R3_BF_DRAG.active={
    name,id:event.pointerId,originX:event.clientX,originY:event.clientY,
    offsetX:event.clientX-b.left,offsetY:event.clientY-b.top,
    moved:false,panel
  };
  // No preventDefault: normal click still activates all buttons.
}
function r3BattlefieldDragMove(event){
  const drag=R3_BF_DRAG.active;
  if(!drag||drag.id!==event.pointerId)return;
  const panel=r3BattlefieldPanel(R3_BF_DRAG.root,drag.name);
  if(!panel)return;
  if(!drag.moved){
    if(Math.hypot(event.clientX-drag.originX,event.clientY-drag.originY)<8)return;
    drag.moved=true;
    try{panel.setPointerCapture?.(event.pointerId);}catch{}
  }
  const at=r3BattlefieldSetPosition(panel,
    event.clientX-drag.offsetX,event.clientY-drag.offsetY);
  R3_BF_DRAG.positions[drag.name]=at;
  event.preventDefault?.();
}
function r3BattlefieldDragEnd(event){
  const drag=R3_BF_DRAG.active;
  if(!drag||event.pointerId!==drag.id)return;
  R3_BF_DRAG.active=null;
  if(!drag.moved)return;
  R3_BF_DRAG.suppressClick={name:drag.name,until:Date.now()+900};
  r3BattlefieldLayoutSave();
  event.preventDefault?.();
}
function r3BattlefieldPreventDragClick(event){
  const block=R3_BF_DRAG.suppressClick;
  if(!block||Date.now()>block.until){
    R3_BF_DRAG.suppressClick=null;return;
  }
  // Don't consume a subsequent keyboard-originated activation.
  if(event.detail===0)return;
  const panel=event.target?.closest?.('[data-bf-panel]');
  if(panel?.getAttribute?.('data-bf-panel')!==block.name)return;
  R3_BF_DRAG.suppressClick=null;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
}
function r3BattlefieldDragKeyboard(event){
  if(!event.altKey||r3BattlefieldIsEditor(event.target))return;
  const panel=event.target?.closest?.('[data-bf-panel]');
  const name=panel?.getAttribute?.('data-bf-panel');
  if(!R3_BF_PANELS.has(name))return;
  const vectors={ArrowLeft:[-1,0],ArrowRight:[1,0],
    ArrowUp:[0,-1],ArrowDown:[0,1]};
  const direction=vectors[event.key];
  if(!direction)return;
  const rect=r3BattlefieldBounds(panel);
  const step=event.shiftKey?1:12;
  const at=r3BattlefieldSetPosition(panel,
    rect.left+direction[0]*step,rect.top+direction[1]*step);
  R3_BF_DRAG.positions[name]=at;
  r3BattlefieldLayoutSave();
  event.preventDefault?.();
  event.stopPropagation?.();
}
function r3BattlefieldResetPositions(){
  R3_BF_DRAG.positions={};
  try{localStorage.removeItem?.(r3BattlefieldLayoutKey());}catch{}
  for(const name of R3_BF_PANELS){
    const panel=r3BattlefieldPanel(R3_BF_DRAG.root,name);
    if(!panel)continue;
    for(const rule of ['left','top','right','bottom','transform'])
      panel.style.removeProperty?.(rule);
  }
  R3_BF.revision++;
  r3HudRender();
}
function r3BattlefieldEnableDragging(root){
  if(R3_BF_DRAG.enabled)return;
  R3_BF_DRAG.enabled=true;R3_BF_DRAG.root=root;
  r3BattlefieldLayoutLoad();
  root.addEventListener('pointerdown',r3BattlefieldDragStart,true);
  root.addEventListener('pointermove',r3BattlefieldDragMove,true);
  root.addEventListener('pointerup',r3BattlefieldDragEnd,true);
  root.addEventListener('pointercancel',r3BattlefieldDragEnd,true);
  root.addEventListener('click',r3BattlefieldPreventDragClick,true);
  root.addEventListener('keydown',r3BattlefieldDragKeyboard,true);
  window.addEventListener('resize',r3BattlefieldPlacePanels);
}
function r3BattlefieldDragStyles(){
  return [
    // Remove the old all-in-one sidebar layout; children become independent.
    '.r3-bf-sidebar{display:contents!important;pointer-events:none!important}',
    '.r3-bf-sidebar>.r3-bf-section{position:absolute;right:calc(var(--r3-bf-chat-inset,330px) + 14px);width:258px;pointer-events:auto;max-height:40vh;overflow-y:auto}',
    '.r3-bf-sidebar>.r3-bf-profile{top:60px}',
    '.r3-bf-sidebar>.r3-bf-concentration{top:272px}',
    '.r3-bf-sidebar>.r3-bf-resource-panel{top:345px;max-height:27vh}',
    '.r3-bf-sidebar>.r3-bf-notes{top:481px}',
    '.r3-bf-sidebar>.r3-bf-advanced{top:604px;max-height:35vh}',
    // All right-hand panels initially avoid the chat/sidebar area.
    '.r3-bf-category-dock{right:calc(var(--r3-bf-chat-inset,330px) + 14px)}',
    '.r3-bf-mini-tools{right:calc(var(--r3-bf-chat-inset,330px) + 16px)}',
    '.r3-bf-show-profile-wrap{position:absolute;right:calc(var(--r3-bf-chat-inset,330px) + 14px);top:20px;pointer-events:auto}',
    '.r3-bf-show-profile-wrap>.r3-bf-show-profile{position:static!important;right:auto!important;top:auto!important}',
    '.r3-bf-shell>.hud-flyout{right:calc(var(--r3-bf-chat-inset,330px) + 14px)!important}',
    '.r3-bf-shell>.r3-bf-native{position:absolute;right:calc(var(--r3-bf-chat-inset,330px) + 14px);bottom:118px;width:min(480px,calc(100vw - 32px));max-height:36vh;pointer-events:auto;overflow:auto}',
    '.r3-bf-native>.hud-native-status{position:static!important;max-height:none!important}',
    '#r3-wrap{right:calc(var(--r3-bf-chat-inset,330px) + 14px)!important}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-turnstrip,.r3-bf-mini-tools,#r3-wrap[data-bf-panel]{overflow:visible}',
    '.r3-bf-shell [data-bf-panel],#r3-wrap[data-bf-panel]{cursor:grab;touch-action:none}',
    '.r3-bf-shell [data-bf-panel]:active,#r3-wrap[data-bf-panel]:active{cursor:grabbing}',
    '.r3-bf-shell button,#r3-wrap button{cursor:pointer}',
    '.r3-bf-shell textarea,.r3-bf-shell input,.r3-bf-shell select,#r3-wrap input,#r3-wrap textarea{cursor:text;touch-action:auto}',
    '.r3-bf-sidebar>.r3-bf-section,.r3-bf-shell>.hud-flyout,.r3-bf-native{touch-action:pan-y}',
    '.r3-bf-shell [data-bf-panel]:focus-visible{outline:2px solid #ffe19a;outline-offset:2px}',
    // The importer has its own tab and retains its existing usable toggle.
    '#r3-wrap[data-bf-panel]{overflow:visible!important}',
    '.r3-bf-category-dock,.r3-bf-actions,.r3-bf-turnstrip,.r3-bf-mini-tools,.r3-bf-shell>.hud-flyout,.r3-bf-native{isolation:isolate}',
    '@media(max-width:1380px){.r3-bf-category-dock{bottom:125px!important}.r3-bf-mini-tools{bottom:224px!important}}',
    '@media(max-width:1150px){.r3-bf-sidebar>.r3-bf-section{width:216px}}',
    '@media(max-width:760px){.r3-bf-category-dock{bottom:92px!important}.r3-bf-mini-tools{bottom:178px!important}.r3-bf-sidebar>.r3-bf-section{width:196px}.r3-bf-sidebar>.r3-bf-profile{top:58px}.r3-bf-sidebar>.r3-bf-concentration{top:241px}.r3-bf-sidebar>.r3-bf-resource-panel{top:300px}.r3-bf-sidebar>.r3-bf-notes{top:408px}.r3-bf-sidebar>.r3-bf-advanced{top:510px}}'
  ].join('');
}
