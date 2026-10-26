// Firefox-only visual themes. These palettes style R20eb's Shadow DOM,
// not Roll20 itself. Inspired by Oh My Posh themes; no runtime network,
// user-supplied CSS, font downloads or external theme execution.
const R3_THEME_OPTIONS=Object.freeze([
  {id:'bg3',name:"Baldur's Gate 3",source:'R20eb fantasy palette',swatches:['#171713','#bd9a5b','#dfd2b7'],
   bg:'#12130f',panel:'#252620',surface:'#30332b',inset:'#171a16',header:'#43372c',
   button:'#3d4136',text:'#f1e9d4',muted:'#c7bba1',accent:'#d5b779',border:'#8b7755',
   positive:'#b5ce8e',danger:'#de9c89',selected:'#4b4431',shadow:'#080905'},
  {id:'tokyonight',name:'Tokyo Night Storm',source:'Oh My Posh · tokyonight_storm',swatches:['#24283b','#7aa2f7','#bb9af7'],
   bg:'#1a1b26',panel:'#24283b',surface:'#292e42',inset:'#161a28',header:'#414868',
   button:'#343c58',text:'#c0caf5',muted:'#a9b1d6',accent:'#7aa2f7',border:'#565f89',
   positive:'#9ece6a',danger:'#f7768e',selected:'#3b4263',shadow:'#10121b'},
  {id:'catppuccin',name:'Catppuccin Mocha',source:'Oh My Posh · catppuccin_mocha',swatches:['#1e1e2e','#cba6f7','#a6e3a1'],
   bg:'#181825',panel:'#1e1e2e',surface:'#313244',inset:'#11111b',header:'#45475a',
   button:'#45475a',text:'#cdd6f4',muted:'#bac2de',accent:'#cba6f7',border:'#6c7086',
   positive:'#a6e3a1',danger:'#f38ba8',selected:'#585b70',shadow:'#11111b'},
  {id:'dracula',name:'Dracula',source:'Oh My Posh · dracula',swatches:['#282a36','#bd93f9','#ff79c6'],
   bg:'#21222c',panel:'#282a36',surface:'#343746',inset:'#191a21',header:'#44475a',
   button:'#44475a',text:'#f8f8f2',muted:'#c6c6d1',accent:'#bd93f9',border:'#6272a4',
   positive:'#50fa7b',danger:'#ff5555',selected:'#4a435f',shadow:'#191a21'},
  {id:'gruvbox',name:'Gruvbox Dark',source:'Oh My Posh · gruvbox',swatches:['#282828','#fabd2f','#b8bb26'],
   bg:'#1d2021',panel:'#282828',surface:'#3c3836',inset:'#1b1b1b',header:'#504945',
   button:'#504945',text:'#ebdbb2',muted:'#d5c4a1',accent:'#fabd2f',border:'#7c6f64',
   positive:'#b8bb26',danger:'#fb4934',selected:'#665c54',shadow:'#141414'},
  {id:'nord',name:'Nord Frost',source:'Oh My Posh · nordtron',swatches:['#2e3440','#88c0d0','#a3be8c'],
   bg:'#242933',panel:'#2e3440',surface:'#3b4252',inset:'#202630',header:'#434c5e',
   button:'#434c5e',text:'#eceff4',muted:'#d8dee9',accent:'#88c0d0',border:'#617185',
   positive:'#a3be8c',danger:'#bf616a',selected:'#4c566a',shadow:'#1b2028'},
  {id:'win9x',name:'Windows 95 / 98',source:'R20eb classic desktop',swatches:['#c0c0c0','#000080','#ffffff']}
]);
const R3_THEME={current:'bg3',managerOpen:false};
function r3ThemeKey(){return 'r20eb:ui-theme:v1';}
function r3ThemeOption(id){
  return R3_THEME_OPTIONS.find(item=>item.id===id)||R3_THEME_OPTIONS[0];
}
function r3ThemeLoad(){
  let saved=null;
  try{saved=localStorage.getItem(r3ThemeKey());}catch{}
  R3_THEME.current=r3ThemeOption(saved).id;
  return R3_THEME.current;
}
function r3ThemeSave(){
  try{localStorage.setItem(r3ThemeKey(),R3_THEME.current);}catch{}
}
function r3ThemeStyles(){
  const p=r3ThemeOption(R3_THEME.current);
  if(p.id==='win9x')
    return typeof r3Win9xStyles==='function'?r3Win9xStyles():'';
  // All values are constant, checked-in palettes; never interpolate arbitrary
  // localStorage or input values as CSS. The visual-only sheet lives last.
  const vars=[
    ['bg',p.bg],['panel',p.panel],['surface',p.surface],['inset',p.inset],
    ['header',p.header],['button',p.button],['text',p.text],['muted',p.muted],
    ['accent',p.accent],['border',p.border],['positive',p.positive],
    ['danger',p.danger],['selected',p.selected],['shadow',p.shadow]
  ].map(([name,value])=>'--r3-'+name+':'+value+';').join('');
  return [
    ':host{'+vars+'color-scheme:dark!important;font-family:system-ui,Segoe UI,Tahoma,sans-serif!important}',
    '#r3-hud .r3-bf-shell,.hud-shell,.r3-debug-window,#r3-wrap{color:var(--r3-text)!important;font-family:system-ui,Segoe UI,Tahoma,sans-serif!important;text-shadow:none!important}',
    '.r3-bf-actions,.r3-bf-category-dock,.r3-bf-sidebar .r3-bf-section,.r3-bf-turnstrip,.hud-flyout,.hud-native-status,.r3-debug-window,#r3-wrap{background:var(--r3-panel)!important;background-image:none!important;color:var(--r3-text)!important;border:1px solid var(--r3-border)!important;border-radius:7px!important;box-shadow:0 5px 22px var(--r3-shadow)!important;backdrop-filter:none!important}',
    '.r3-bf-sidebar{background:transparent!important;box-shadow:none!important;border:0!important}',
    '.hud-flyout{max-height:min(69vh,720px)!important;scrollbar-color:var(--r3-border) var(--r3-inset)!important}',
    '.hud-flyout>header,.r3-debug-header,#r3-toggle,.r3-bf-turnstrip,.hud-toolbar{background:var(--r3-header)!important;background-image:none!important;color:var(--r3-text)!important;border-radius:5px 5px 0 0!important;border-bottom:1px solid var(--r3-border)!important}',
    '.hud-flyout>header strong,.r3-debug-header strong,.r3-bf-turnstrip strong,.r3-bf-turnstrip small,.hud-toolbar>span,.hud-toolbar small{color:var(--r3-text)!important}',
    '.hud-flyout>header small,.r3-debug-header span{color:var(--r3-muted)!important}',
    '.hud-weapon-heading,.hud-segment-caption,.hud-flyout-caption{background:var(--r3-surface)!important;color:var(--r3-text)!important}',
    '#r3-wrap button,.r3-bf-shell button,.r3-debug-window button,.hud-shell button{background:var(--r3-button)!important;background-image:none!important;border:1px solid var(--r3-border)!important;border-radius:5px!important;box-shadow:none!important;color:var(--r3-text)!important;text-shadow:none!important;filter:none!important}',
    '#r3-wrap button:hover:not(:disabled),.r3-bf-shell button:hover:not(:disabled),.r3-debug-window button:hover:not(:disabled){background:var(--r3-selected)!important;border-color:var(--r3-accent)!important;filter:none!important}',
    '#r3-wrap button:active:not(:disabled),.r3-bf-shell button:active:not(:disabled),.r3-bf-shell button.selected,.r3-bf-shell button.active,.r3-bf-shell button[aria-pressed=true],.r3-debug-window button:active:not(:disabled){background:var(--r3-selected)!important;border-color:var(--r3-accent)!important;box-shadow:inset 0 1px 5px var(--r3-shadow)!important}',
    '#r3-wrap button:focus-visible,.r3-bf-shell button:focus-visible,.r3-debug-window button:focus-visible{outline:2px solid var(--r3-accent)!important;outline-offset:1px!important}',
    '.r3-bf-debug-trigger{color:var(--r3-text)!important}',
    '.r3-bf-ring{border:2px solid var(--r3-border)!important;border-radius:11px!important;background:var(--r3-surface)!important;background-image:none!important;box-shadow:none!important}',
    '.r3-bf-ring svg,.r3-bf-category svg,.hud-bar-art svg{color:var(--r3-accent)!important}',
    '.r3-bf-ring-name,.r3-bf-ring strong,.r3-bf-ring-sub{color:var(--r3-text)!important}',
    '.r3-bf-movement-meter{background:var(--r3-inset)!important;border:1px solid var(--r3-border)!important}',
    '.r3-bf-movement-meter>span{background:var(--r3-accent)!important}',
    '.r3-bf-category-dock,.r3-bf-actions{gap:4px!important;padding:5px!important}',
    '.r3-bf-category,.r3-bf-quick button{background:var(--r3-button)!important;color:var(--r3-text)!important;border-color:var(--r3-border)!important}',
    '.r3-bf-category.selected{background:var(--r3-selected)!important;border-color:var(--r3-accent)!important}',
    '.r3-bf-section header strong,.r3-bf-character-text strong,.r3-bf-concentration strong{color:var(--r3-text)!important;font-family:inherit!important}',
    '.r3-bf-section header span,.r3-bf-character-text small,.r3-bf-concentration small,.hud-card-note{color:var(--r3-muted)!important}',
    '.r3-bf-section textarea,.r3-debug-window select,#r3-wrap select,#r3-wrap input,#r3-wrap textarea{background:var(--r3-inset)!important;color:var(--r3-text)!important;border:1px solid var(--r3-border)!important;border-radius:4px!important}',
    '.hud-flyout-cards,.hud-weapon-submenu,.hud-choice-list,.r3-debug-entries,.r3-debug-movement dl,#r3-results{background:var(--r3-inset)!important;color:var(--r3-text)!important;border:1px solid var(--r3-border)!important;border-radius:4px!important}',
    '.hud-card,.hud-weapon-group,.hud-skill-group,.r3-debug-operations,.r3-debug-movement{background:var(--r3-panel)!important;border:1px solid var(--r3-border)!important;border-radius:5px!important;color:var(--r3-text)!important}',
    '.hud-card[open],.hud-card-body,.hud-skill-row,.hud-weapon-option,.hud-weapon-direct{background:var(--r3-surface)!important;color:var(--r3-text)!important}',
    '.hud-card summary,.hud-weapon-heading,.hud-skill-group b{background:var(--r3-panel)!important;color:var(--r3-text)!important}',
    '.hud-card-title,.hud-card-title small,.hud-card-count,.hud-card-caret,.hud-card-body p,.hud-skill-row strong,.hud-skill-value,.hud-weapon-heading small,.hud-weapon-single,.hud-weapon-option-label strong,.hud-weapon-option-label small{color:var(--r3-text)!important}',
    '.hud-card-field,.hud-weapon-option{border-color:var(--r3-border)!important}',
    '.hud-card-tags span,.hud-res-chip,.r3-bf-resource-panel .hud-res-chip{background:var(--r3-button)!important;color:var(--r3-text)!important;border:1px solid var(--r3-border)!important;border-radius:4px!important}',
    '.hud-card-mark{background:var(--r3-accent)!important;color:var(--r3-inset)!important}',
    '.hud-native-linked,.hud-weapon-native{color:var(--r3-positive)!important}.hud-native-unmapped,.hud-weapon-unmapped{color:var(--r3-danger)!important}',
    '.hud-attack-button,.hud-native-action,.hud-dice-button{min-height:29px!important;font-weight:700!important}',
    '.hud-flyout-caption{color:var(--r3-accent)!important}',
    '.hud-native-status,.hud-empty{color:var(--r3-text)!important;background:var(--r3-panel)!important}',
    '.hud-native-status span{color:var(--r3-text)!important}',
    '.r3-debug-window{background:var(--r3-panel)!important}.r3-debug-body{background:var(--r3-panel)!important;color:var(--r3-text)!important}',
    '.r3-debug-movement dt,.r3-debug-movement dd,.r3-debug-operations p{color:var(--r3-text)!important}',
    '.r3-debug-operations small,.r3-debug-movement small,.r3-debug-note,.r3-debug-empty{color:var(--r3-muted)!important}',
    '.r3-debug-entry,.r3-debug-entry:nth-child(even){background:var(--r3-inset)!important;border-color:var(--r3-border)!important;color:var(--r3-text)!important}',
    '.r3-debug-entry strong,.r3-debug-entry time{color:var(--r3-accent)!important}',
    '.r3-debug-entry.warning span{color:var(--r3-accent)!important}.r3-debug-entry.error span{color:var(--r3-danger)!important}',
    '#r3-wrap,#r3-content{background:var(--r3-panel)!important;color:var(--r3-text)!important}',
    '#r3-toggle{background:var(--r3-header)!important}',
    '#r3-content .entry,#r3-content .kv,.metric{border-color:var(--r3-border)!important}',
    '#r3-content .kv strong,#r3-content .results h3,#r3-status{color:var(--r3-accent)!important}',
    '#r3-content .entrybody,#r3-content .entry small,.muted,.stamp{color:var(--r3-muted)!important}',
    '.r3-bf-stats .hud-stat,.hud-portrait-stats .hud-stat{background:var(--r3-surface)!important;border:1px solid var(--r3-border)!important;color:var(--r3-text)!important}',
    '.r3-bf-stats .hud-stat span,.r3-bf-stats .hud-stat strong,.hud-portrait-stats .hud-stat span,.hud-portrait-stats .hud-stat strong{color:var(--r3-text)!important}',
    '.r3-bf-avatar,.hud-avatar,.hud-avatar-pane{background:var(--r3-surface)!important;border-color:var(--r3-border)!important;color:var(--r3-accent)!important}',
    '.hud-bar-art,.hud-bar-label,.hud-portrait-shortcuts,.hud-segment-caption{background:var(--r3-surface)!important;color:var(--r3-text)!important}',
    '.hud-hp-label,.hud-hp-label span,.hud-hp-label strong{color:var(--r3-text)!important}',
    '.hud-hp-track{background:var(--r3-inset)!important;border:1px solid var(--r3-border)!important}',
    '.hud-hp-fill{background:var(--r3-positive)!important}',
    '.r3-bf-turn-icon svg{color:var(--r3-accent)!important}',
    // Preview swatches are intentionally driven by static inline colors from
    // the other palettes; never repaint them to the currently selected color.
    '.r3-theme-choice.is-current{outline:2px solid var(--r3-accent)!important;outline-offset:1px}',
    '.r3-theme-choice:focus-visible{outline:2px solid var(--r3-accent)!important}',
    '@media(prefers-reduced-motion:reduce){.r3-bf-shell *,.hud-flyout *{transition:none!important;animation:none!important}}'
  ].join('')+(p.id==='bg3'?[
    // A restrained fantasy treatment inspired by BG3: engraved gold frame,
    // carved titlebar serif and parchment highlights, without blocking map.
    '.hud-flyout,.r3-debug-window,.r3-bf-actions,.r3-bf-category-dock,.r3-bf-sidebar .r3-bf-section{border:1px solid #8b7755!important;box-shadow:0 4px 18px #080905, inset 0 0 0 1px #584b34!important}',
    '.hud-flyout>header,.r3-debug-header{background:linear-gradient(90deg,#33291e,#554734,#2a2922)!important;border-bottom:2px solid #b39560!important}',
    '.hud-flyout>header strong,.r3-debug-header strong,.r3-bf-section header strong{font-family:Georgia,serif!important;letter-spacing:.035em!important;color:#e8d7aa!important}',
    '.r3-bf-category.selected,.r3-bf-ring[aria-pressed=true]{border-color:#d5b779!important;box-shadow:inset 0 0 0 1px #b39560!important}',
    '.hud-flyout-caption,.hud-skill-group b{border-bottom:1px solid #8b7755!important;color:#e8d7aa!important}',
    '.hud-weapon-group,.hud-card{box-shadow:inset 0 0 0 1px #3d3a2e!important}'
  ].join(''):'');
}
function r3ThemeApply(){
  // Theme changes mutate only this dedicated stylesheet and dataset.
  // They never rerender, hide or click the Roll20 native sheet/HUD actions.
  const root=typeof R3_UI==='object'?R3_UI.root:null;
  const sheet=root?.getElementById?.('r3-theme-style');
  if(!sheet)return false;
  sheet.textContent=r3ThemeStyles();
  const host=R3_UI.host;
  if(host?.dataset)host.dataset.r3Theme=R3_THEME.current;
  return true;
}
function r3ThemeSet(id){
  const matched=R3_THEME_OPTIONS.find(theme=>theme.id===id);
  if(!matched)return false;
  R3_THEME.current=matched.id;
  r3ThemeSave();
  r3ThemeApply();
  // Do not rebuild the entire draggable HUD or lose attack/feature focus.
  // Update the visible theme-choice state in place.
  const root=typeof R3_UI==='object'?R3_UI.root:null;
  for(const button of root?.querySelectorAll?.('[data-r3-theme]')||[]){
    const selected=button.dataset?.r3Theme===matched.id;
    button.setAttribute?.('aria-pressed',String(selected));
    button.classList?.toggle?.('is-current',selected);
  }
  const label=root?.getElementById?.('r3-theme-active');
  if(label)label.textContent='Active: '+matched.name;
  return true;
}
function r3ThemeAction(target){
  const value=target?.dataset?.r3Theme??
    target?.closest?.('[data-r3-theme]')?.dataset?.r3Theme;
  return typeof value==='string'&&R3_THEME_OPTIONS.some(x=>x.id===value)?
    r3ThemeSet(value):false;
}
function r3ThemeManagerMarkup(){
  const selected=r3ThemeOption(R3_THEME.current);
  return '<details class="r3-theme-manager"'+(R3_THEME.managerOpen?' open':'')+'>'+
    '<summary>Theme Manager · '+r3Escape(selected.name)+'</summary>'+
    '<div class="r3-theme-body"><p id="r3-theme-active">Active: '+r3Escape(selected.name)+'</p>'+
    '<div class="r3-theme-grid" role="group" aria-label="R20eb visual theme">'+
    R3_THEME_OPTIONS.map(theme=>{
      const active=selected.id===theme.id;
      return '<button type="button" class="r3-theme-choice'+(active?' is-current':'')+
        '" data-r3-theme="'+theme.id+'" aria-pressed="'+active+'" title="'+
        r3Escape(theme.source)+'">'+
        '<span class="r3-theme-preview" aria-hidden="true" style="background:'+theme.swatches[0]+';border-color:'+theme.swatches[1]+'">'+
        '<i style="background:'+theme.swatches[1]+'"></i><i style="background:'+theme.swatches[2]+'"></i></span>'+
        '<strong>'+r3Escape(theme.name)+'</strong><small>'+r3Escape(theme.source)+'</small></button>';
    }).join('')+
    '</div><small>Applies instantly and is remembered across games. Theme colors only; Roll20 and your character data are unchanged.</small></div></details>';
}
function r3ThemeManagerInput(event){
  if(event?.target?.classList?.contains?.('r3-theme-manager'))
    R3_THEME.managerOpen=!!event.target.open;
}
function r3ThemeManagerStyles(){
  return [
    '.r3-theme-manager{margin:8px 0;border:1px solid #67788a;border-radius:6px;padding:7px;background:transparent}',
    '.r3-theme-manager>summary{font-size:12px;font-weight:700;cursor:pointer}',
    '.r3-theme-body>p{margin:6px 0;font-weight:650}',
    '.r3-theme-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(136px,1fr));gap:6px}',
    '.r3-theme-choice{min-width:0;min-height:68px;padding:5px!important;display:flex;align-items:flex-start;flex-direction:column;gap:3px;text-align:left;white-space:normal}',
    '.r3-theme-choice strong{font-size:11px}.r3-theme-choice small{font-size:9px;line-height:1.25;opacity:.85}',
    '.r3-theme-preview{display:flex;align-items:end;gap:4px;width:100%;height:20px;padding:3px;border:1px solid #67788a;border-radius:2px}',
    '.r3-theme-preview i{height:9px;width:35%;display:block;border-radius:1px}',
    '.r3-theme-body>small{display:block;margin-top:6px;opacity:.85}',
    '@media(max-width:700px){.r3-theme-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  ].join('');
}
