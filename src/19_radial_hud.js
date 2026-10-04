// Concentric combat wheel. Roll20 data remains read-only; chat commands remain user initiated.
 const RADIAL_STYLE=String.raw`
 #rbe-radial-layer{position:fixed;inset:0;pointer-events:none;z-index:4;--gold:#e9c88d;--iron:#241c19}
 #rbe-radial-wheel{position:fixed;width:520px;height:520px;transform:translate(-50%,-50%) scale(var(--wheel-scale,1));transform-origin:center;pointer-events:none;filter:drop-shadow(0 12px 24px #000b)}
 #rbe-radial-wheel svg.rbe-wheel{width:520px;height:520px;overflow:visible;pointer-events:none}
 #rbe-radial-wheel .rbe-wedge{pointer-events:visiblePainted;cursor:pointer;outline:none;transition:opacity .17s,filter .17s}
 #rbe-radial-wheel .rbe-wedge path{fill:url(#rbe-wedge-metal);stroke:#947b53;stroke-width:1.4;transition:fill .18s,stroke .18s}
 #rbe-radial-wheel .rbe-wedge:hover path,#rbe-radial-wheel .rbe-wedge:focus-visible path{fill:#685239;stroke:#ffe5a7;stroke-width:2.5}
 #rbe-radial-wheel .rbe-wedge.is-selected path{fill:url(#rbe-wedge-selected);stroke:#ffe6a7;stroke-width:2.3}
 #rbe-radial-wheel .rbe-wedge.is-muted{opacity:.18}
 #rbe-radial-wheel .rbe-wedge.is-muted:hover,#rbe-radial-wheel .rbe-wedge.is-muted:focus-visible{opacity:.76}
 #rbe-radial-wheel .rbe-wedge text{fill:#f0d6a0;font:600 10px Georgia,'Times New Roman',serif;letter-spacing:.05px;paint-order:stroke;stroke:#1a1410;stroke-width:2px;stroke-linejoin:round;pointer-events:none}
 #rbe-radial-wheel .rbe-wedge .rbe-option-name{font-weight:700}
 #rbe-radial-wheel .rbe-wedge .rbe-option-meta{font-size:8.5px;fill:#dbbd86;stroke-width:1.6px}
 #rbe-radial-wheel .rbe-wedge .rbe-glyph{font:24px Georgia,serif;stroke-width:1px;fill:#ffe2a4}
 #rbe-radial-wheel .rbe-wedge.is-muted text{fill:#9c876c}
 #rbe-radial-wheel .rbe-ring{animation:rbe-ring-bloom .21s ease-out both;transform-origin:center}
 #rbe-radial-wheel .rbe-core{fill:#10101723;stroke:#d2aa6c;stroke-width:2;stroke-dasharray:4 6;pointer-events:none}
 #rbe-radial-wheel .rbe-center{fill:#f7d999;stroke:#241916;stroke-width:1;font:600 12px Georgia,serif;pointer-events:none}
 #rbe-radial-wheel .rbe-tether-hub{fill:none;stroke:#ad9164;stroke-width:2;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-title{position:absolute;left:50%;top:calc(50% - var(--rbe-outer-radius,112px) - 22px);transform:translate(-50%,-50%);font:700 14px Georgia,serif;color:#f5d8a8;letter-spacing:1.8px;text-shadow:0 2px 8px black;white-space:nowrap}
 #rbe-radial-layer .rbe-wheel-footer{position:absolute;left:50%;top:calc(50% + var(--rbe-outer-radius,112px) + 12px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:7px;max-width:520px;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-info{position:static;transform:none;white-space:nowrap;max-width:500px;overflow:hidden;text-overflow:ellipsis;padding:5px 12px;background:#151115dc;border:1px solid #8d754b;border-radius:20px;color:#f0d6a7;font:12px Georgia,serif;pointer-events:none}
 #rbe-radial-layer .rbe-wheel-toolbar{pointer-events:auto;position:static;transform:none;display:flex;align-items:center;gap:4px;background:#19131be6;padding:5px;border:1px solid #91764b;border-radius:30px;white-space:nowrap}
 #rbe-radial-layer .rbe-wheel-toolbar button{border:0;background:transparent;color:#e6cb9d;font:600 12px system-ui;padding:4px 7px}
 #rbe-radial-layer .rbe-wheel-toolbar button:hover{background:#614a32}
 #rbe-radial-layer #rbe-radial-dock{position:fixed;bottom:15px;left:15px;display:flex;gap:6px;align-items:center;pointer-events:auto;background:#1c1720ec;border:2px ridge #a98956;border-radius:25px;box-shadow:0 4px 25px #000b;padding:6px}
 #rbe-radial-layer #rbe-radial-dock button{color:#f9dfa8;background:#3a2b28;border-color:#977951;border-radius:24px;font:600 12px Georgia,serif}
 #rbe-radial-layer #rbe-radial-dock .rbe-dock-caption{font:11px system-ui;color:#d3bf9e;max-width:220px;padding:0 6px}
 #rbe-radial-layer #rbe-token-tether{position:fixed;inset:0;width:100vw;height:100vh;overflow:visible;pointer-events:none}
 #rbe-radial-layer #rbe-tether-path{stroke:#c7a46c;stroke-width:2;stroke-dasharray:3 6;fill:none;opacity:.75}
 @keyframes rbe-ring-bloom{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
 :host([data-reduced-motion="true"]) #rbe-radial-wheel .rbe-ring{animation:none!important}
 @media(max-width:600px){#rbe-radial-layer .rbe-wheel-info{max-width:330px;font-size:10px}#rbe-radial-layer .rbe-wheel-toolbar button{font-size:11px;padding:4px 5px}}
 `;
 RB.radial={open:true,pin:false,path:[],pages:{},anchor:null,manual:null,source:'none',lastPosition:'',lastPresence:false};
 const radialNode=(id,label,glyph,children=[],kind='',value='',detail='',subtitle='')=>({id,label,glyph,children,kind,value,detail,subtitle});
 function radialAttackLeaves(attacks){
   return attacks.slice(0,32).map(a=>radialNode('a:'+a.id,a.name,'⚔',[
     radialNode('roll','Roll','⚄',[],'attack',a.id),
     radialNode('details','Details','⌕',[],'detail',a.id),
     radialNode('sheet','Sheet','▤',[],'panel','Sheet')
   ],'', '',[a.toHit,a.damage,a.damageType,a.range].filter(Boolean).join(' · '),
   [a.toHit,a.range||a.damage].filter(Boolean).join(' · ')));
 }
 function radialSpellLeaves(spells){
   return spells.slice(0,38).map(s=>radialNode('s:'+s.id,s.name,'✧',[
     radialNode('cast','Cast','✧',[],'spell',s.id),
     radialNode('info','Info','⌕',[],'spellInfo',s.id),
     ...(Number(s.level)>0?[radialNode('slot','Use slot','◈',[],'spendSlot',String(s.level))]:[])
   ],'','',[s.castTime,s.range,s.duration].filter(Boolean).join(' · '),
   [Number(s.level)?'L'+s.level:'Cantrip',s.concentration?'Conc.':null,s.castTime].filter(Boolean).join(' · ')));
 }
 function radialItemLeaves(items){
   return items.slice(0,40).map(i=>radialNode('i:'+i.id,i.name,'◆',[
     radialNode('use','Announce','◈',[],'announceItem',i.id),
     radialNode('subtract','Use one','−',[],'consume',i.id),
     radialNode('inspect','Details','⌕',[],'itemInfo',i.id)
   ],'','',String(i.qty??1)+' carried',
   '×'+String(i.qty??1)+(i.category?' · '+String(i.category):'')));
 }
 function radialCategories(){
   const p=profile(),attacks=p.attacks||[],spells=p.spells||[],items=p.inventory||[],features=p.features||[];
   const group=(id,name,glyph,children)=>radialNode(id,name,glyph,children.length?children:[radialNode('empty','Open sheet','▤',[],'panel','Sheet')]);
   const ranged=a=>/range|bow|crossbow|sling|gun|thrown|javelin/i.test([a.range,a.name,a.description].join(' '));
   const reaction=features.filter(f=>/reaction|counterspell|shield/i.test([f.name,f.description].join(' ')));
   const bonusSpells=spells.filter(s=>/bonus/i.test(s.castTime||''));
   return [
     radialNode('attack','ATTACK','⚔',[
       group('melee','Melee','⚔',radialAttackLeaves(attacks.filter(a=>!ranged(a)))),
       group('ranged','Ranged','➶',radialAttackLeaves(attacks.filter(ranged))),
       group('all','Arsenal','✥',radialAttackLeaves(attacks))
     ]),
     radialNode('spells','SPELLS','✧',[
       ...Array.from({length:10},(_,n)=>n).filter(n=>spells.some(s=>Number(s.level)===n))
         .map(n=>group('lvl'+n,n?'Level '+n:'Cantrips',n?'✦':'❋',radialSpellLeaves(spells.filter(s=>Number(s.level)===n)))),
       group('all','All Magic','✧',radialSpellLeaves(spells))
     ]),
     radialNode('bonus','BONUS','✦',[
       group('bonusSpells','Bonus Spells','✧',radialSpellLeaves(bonusSpells)),
       group('bonusAbilities','Features','✥',features.filter(f=>/bonus action/i.test([f.name,f.description].join(' '))).slice(0,14).map(f=>radialNode('f:'+f.id,f.name,'✦',[],'feature',f.id))),
       radialNode('offhand','Off-hand','⚔',[],'declare','bonus'),
       radialNode('hide','Hide','◈',[],'declare','bonus')
     ]),
     radialNode('items','ITEMS','◆',[
       group('consumable','Consumable','✚',radialItemLeaves(items.filter(i=>/potion|scroll|consum|food|drink|healing/i.test([i.name,i.category].join(' '))))),
       group('all','Backpack','◆',radialItemLeaves(items))
     ]),
     radialNode('defense','DEFEND','⛨',[
       ...['Dodge','Disengage','Help','Ready','Search','Hide'].map(a=>radialNode(a.toLowerCase(),a,'⛨',[],'declare','action')),
       radialNode('conditions','Conditions','◉',conditions.map(c=>radialNode(c.toLowerCase(),c,'◉',[],'condition',c)))
     ]),
     radialNode('movement','MOVE','➤',[
       radialNode('move5','Move 5 ft','➤',[],'move','5'),radialNode('move10','Move 10 ft','➤',[],'move','10'),
       radialNode('move30','Move 30 ft','➤',[],'move','30'),
       radialNode('stand','Stand Up','↑',[],'stand',''),
       radialNode('dash','Dash','➤',[],'declare','action'),
       radialNode('clear','Reset move','↺',[],'resetMove','')
     ]),
     radialNode('reactions','REACT','↯',[
       radialNode('opportunity','Opportunity','⚔',[],'declare','reaction'),
       group('class','Features','✥',reaction.slice(0,16).map(f=>radialNode('r:'+f.id,f.name,'↯',[],'feature',f.id))),
       radialNode('used','Mark spent','✓',[],'toggle','reactionUsed')
     ]),
     radialNode('checks','ROLLS','⚄',[
       group('skills','Skills','⚄',skillNames.map(n=>radialNode(n.toLowerCase(),n,'⚄',[],'skill',n))),
       group('saves','Saves','⛨',abilities.map(a=>radialNode(a,a.toUpperCase(),'⛨',[],'save',a))),
       group('abilities','Abilities','◆',abilities.map(a=>radialNode(a,a.toUpperCase(),'◆',[],'ability',a))),
       radialNode('initiative','Initiative','⚑',[],'initiative','')
     ]),
     radialNode('more','MORE','⚙',[
       radialNode('newTurn','New turn','↻',[],'newTurn',''),
       radialNode('sheet','Sheet import','▤',[],'panel','Sheet'),
       radialNode('macros','Macros','⚙',[],'panel','Macros'),
       group('favorites','Favorites','★',RB.state.macros.filter(m=>m.favorite).map(m=>radialNode('m:'+m.id,m.name,'★',[],'macro',m.id))),
       radialNode('settings','Settings','⚙',[],'panel','Settings'),
       radialNode('reanchor','Re-anchor','◎',[],'pin','')
     ])
   ];
 }
 function radialRadii(count){
   const presets={
     1:[[42,112]],2:[[33,75],[84,157]],
     3:[[28,61],[68,119],[127,201]],
     4:[[25,49],[54,91],[99,156],[164,238]]
   };
   return presets[Math.max(1,Math.min(4,count))];
 }
 function radialOuterRadius(count){
   const radii=radialRadii(count);
   return radii[radii.length-1][1];
 }
 function radialPoint(radius,deg){const a=deg*Math.PI/180;return {x:radius*Math.cos(a),y:radius*Math.sin(a)};}
 function radialSector(inner,outer,start,end){
   const p=radialPoint(outer,start),q=radialPoint(outer,end),r=radialPoint(inner,end),s=radialPoint(inner,start);
   const large=end-start>180?1:0;
   return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} A ${outer} ${outer} 0 ${large} 1 ${q.x.toFixed(2)} ${q.y.toFixed(2)} L ${r.x.toFixed(2)} ${r.y.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${s.x.toFixed(2)} ${s.y.toFixed(2)} Z`;
 }
 // More than a dozen wedges would force weapon names down to six letters.
 // Page large lists instead, keeping the same selection path and ring depth.
 const RADIAL_PAGE_SIZE=10;
 function radialVisiblePage(items,key){
   if(items.length<=12)return items;
   const total=Math.ceil(items.length/RADIAL_PAGE_SIZE);
   const page=Math.max(0,Math.min(total-1,Math.trunc(RB.radial.pages?.[key]||0)));
   const result=items.slice(page*RADIAL_PAGE_SIZE,(page+1)*RADIAL_PAGE_SIZE);
   const controls=[];
   if(page>0)controls.push(radialNode('page:prev','Previous','‹',[],'page',key+':'+(page-1)));
   if(page<total-1)controls.push(radialNode('page:next','Next','›',[],'page',key+':'+(page+1)));
   return [...result,...controls];
 }
 function radialTreeRings(){
   const root=radialCategories(),rings=[],path=RB.radial.path.slice(0,3);
   let branch=root;
   for(let depth=0;depth<=path.length;depth++){
     rings.push(radialVisiblePage(branch,path.slice(0,depth).join('/')));
     const node=branch.find(x=>x.id===path[depth]);
     if(!node?.children?.length)break;
     branch=node.children;
   }
   return rings;
 }
 // Word-aware wrapping for SVG text: never trim a weapon name to six
 // characters just because its parent ring contains many actions.
 function radialLabelLines(raw,width,limit){
   const words=String(raw??'').trim().replace(/\\s+/g,' ').split(' ').filter(Boolean);
   if(!words.length)return [''];
   const lines=[];
   for(let word of words){
     while(word.length>width){
       if(lines.length && lines[lines.length-1].length<width){
         const free=width-lines[lines.length-1].length-1;
         if(free>0){lines[lines.length-1]+=' '+word.slice(0,free);word=word.slice(free);}
       }
       if(word.length>width){lines.push(word.slice(0,width));word=word.slice(width);}
     }
     if(!word)continue;
     if(lines.length&&lines[lines.length-1].length+1+word.length<=width)
       lines[lines.length-1]+=' '+word;
     else lines.push(word);
   }
   if(lines.length<=limit)return lines;
   // Very long imports still retain the full text in SVG title and aria-label.
   const result=lines.slice(0,limit);
   result[limit-1]=result[limit-1].slice(0,Math.max(1,width-1))+'…';
   return result;
 }
 function radialLabelRotation(angle){
   const deg=((angle+90)%360+360)%360;
   return deg>=90&&deg<=270?deg-180:deg;
 }
 function radialLabelMarkup(node,step,inner,outer,angle){
   const thickness=outer-inner,midRadius=(inner+outer)/2;
   const width=Math.max(6,Math.min(22,Math.floor((2*midRadius*Math.sin(step*Math.PI/360)-12)/5.6)));
   const glyph=html(node.glyph||'✦');
   // Contracted rings cannot hold text and an icon simultaneously.
   if(thickness<34)return `<text x="0" y="5" text-anchor="middle"><tspan class="rbe-glyph" style="font-size:17px">${glyph}</tspan></text>`;
   const lines=radialLabelLines(node.label,width,thickness<43?1:thickness<60?2:3);
   const meta=thickness>=63&&lines.length<=2?String(node.subtitle||'').trim():'';
   const wrappedMeta=meta?radialLabelLines(meta,width,1)[0]:'';
   // Center the glyph + name lines + optional stat line within the band.
   const gap=11,iconHeight=thickness<47?15:20,metaHeight=wrappedMeta?10:0;
   const blockHeight=iconHeight+lines.length*gap+metaHeight;
   const top=-blockHeight/2;
   const fontSize=width<9?8.3:width<12?9:10;
   const iconY=top+iconHeight-3;
   const nameBase=top+iconHeight+8;
   const names=lines.map((line,i)=>
     `<text class="rbe-option-name" x="0" y="${(nameBase+i*gap).toFixed(1)}" style="font-size:${fontSize}px" text-anchor="middle">${html(line)}</text>`).join('');
   const subtitle=wrappedMeta?`<text class="rbe-option-meta" x="0" y="${(nameBase+lines.length*gap-1).toFixed(1)}" text-anchor="middle">${html(wrappedMeta)}</text>`:'';
   return `<text x="0" y="${iconY.toFixed(1)}" text-anchor="middle"><tspan class="rbe-glyph" style="font-size:${thickness<47?15:20}px">${glyph}</tspan></text>${names}${subtitle}`;
 }
 function radialWheelSVG(){
   const rings=radialTreeRings(),radius=radialRadii(rings.length);
   const content=rings.map((items,d)=>{
     const [inner,outer]=radius[d],step=360/Math.max(items.length,1);
     const nodes=items.map((node,i)=>{
       const chosen=RB.radial.path[d]===node.id,muted=RB.radial.path[d]&&!chosen,angle=-90+step*(i+.5);
       const gap=Math.min(2.4,step*.12),start=-90+i*step+gap,end=-90+(i+1)*step-gap;
       const mid=radialPoint((inner+outer)*.5,angle),rotation=radialLabelRotation(angle);
       const detail=[node.label,node.subtitle,node.detail].filter(Boolean).join(' · ');
       return `<g class="rbe-wedge ${chosen?'is-selected':''} ${muted?'is-muted':''}" data-action="radialPick" data-depth="${d}" data-index="${i}" role="button" tabindex="0" aria-label="${html(detail)}" aria-selected="${!!chosen}"><title>${html(detail)}</title><path d="${radialSector(inner,outer,start,end)}"></path><g transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${rotation.toFixed(1)})">${radialLabelMarkup(node,step,inner,outer,angle)}</g></g>`;
     }).join('');
     return `<g class="rbe-ring" data-ring="${d}" style="animation-delay:${d*35}ms">${nodes}</g>`;
   }).join('');
   const p=profile(),hp=Number(p.stats.hp)||0,max=Number(p.stats.maxHp)||0;
   return `<svg class="rbe-wheel" viewBox="-260 -260 520 520" aria-label="Concentric combat action menu" role="group">
     <defs><radialGradient id="rbe-wedge-metal"><stop stop-color="#53402b" offset="0"/><stop stop-color="#211a22" offset=".75"/><stop stop-color="#130f17" offset="1"/></radialGradient>
     <linearGradient id="rbe-wedge-selected"><stop stop-color="#b9914f"/><stop stop-color="#5c3a21" offset=".53"/><stop stop-color="#332332" offset="1"/></linearGradient></defs>
     <circle r="23" class="rbe-core"/><text class="rbe-center" x="0" y="4" text-anchor="middle">${Math.max(0,hp)}/${Math.max(0,max)}</text>
     ${content}</svg>`;
 }
 function radialHTML(){
   const r=RB.radial,active=r.anchor&&r.open,p=profile();
   const trail=radialTreeRings(),parts=r.path.map((id,i)=>trail[i]?.find(x=>x.id===id)?.label||id);
   const outerRadius=radialOuterRadius(trail.length);
   return `<div id="rbe-radial-layer"><svg id="rbe-token-tether" aria-hidden="true"><path id="rbe-tether-path" d=""></path></svg>
    ${active?`<div id="rbe-radial-wheel" style="left:${Math.round(r.anchor.x)}px;top:${Math.round(r.anchor.y)}px;--rbe-outer-radius:${outerRadius}px">
      <div class="rbe-wheel-title">${html(short(p.name,27))} · COMBAT</div>${radialWheelSVG()}
      <div class="rbe-wheel-footer"><div class="rbe-wheel-toolbar"><button data-action="radialBack" ${r.path.length?'':'disabled'} title="One ring back">← Back</button>
      <button data-action="radialHome" title="Reset all choices">⌂ Root</button><button data-action="radialPin" title="Click your token to anchor">◎ Pin</button>
      <button data-action="radialPanel" title="Open character sheet importer">▤ Sheet</button><button data-action="radialToggle" title="Collapse radial menu">✕</button></div>
      <div class="rbe-wheel-info">${html(parts.join(' / ')||'Choose an action')}${r.source==='manual'?' · screen-pinned':' · selected token'}</div></div>
     </div>`:''}
    ${!active?`<div id="rbe-radial-dock"><button data-action="radialToggle">⚔ ${r.open?'Combat wheel':'Open wheel'}</button><button data-action="radialPin">${r.pin?'Click token…':'◎ Pin to token'}</button><span class="rbe-dock-caption">${r.pin?'Click the center of your token on the tabletop':r.anchor?'HUD minimized':'Select a token or pin the HUD'}</span></div>`:''}
   </div>`;
 }
 function radialPick(depth,index){
   const rings=radialTreeRings(),node=rings[depth]?.[index];if(!node)return;
   if(node.kind==='page'){
     const pos=node.value.lastIndexOf(':');
     const key=node.value.slice(0,pos),page=Number(node.value.slice(pos+1));
     RB.radial.pages[key]=page;
     render();radialPosition();return;
   }
   if(node.children?.length){
     RB.radial.path=[...RB.radial.path.slice(0,depth),node.id];
     render();radialPosition();return;
   }
   radialExecute(node);
 }
 function radialExecute(node){
   const p=profile(),item=p.inventory.find(x=>x.id===node.value),attack=(p.attacks||[]).find(x=>x.id===node.value);
   const spell=p.spells.find(x=>x.id===node.value),feature=p.features.find(x=>x.id===node.value);
   let success=false;
   switch(node.kind){
     case 'attack':
       if(!attack?.command){toast('No safe Roll20 action for this weapon. Use its character sheet button.');break;}
       success=sendToRoll20(attack.command);if(success){p.actionUsed=true;record('Attacked: '+attack.name);}break;
     case 'spell':
       if(!spell?.command){toast('No Roll20 command for '+(spell?.name||'this spell')+'. Set it on the Spells tab.');break;}
       success=sendToRoll20(spell.command);
       if(success){if(/bonus/i.test(spell.castTime||''))p.bonusUsed=true;else p.actionUsed=true;
         if(spell.concentration)p.concentration=spell.name;record('Cast '+spell.name);}
       break;
     case 'macro':{const m=RB.state.macros.find(m=>m.id===node.value);if(m){success=sendToRoll20(m.command);if(success)record('Macro '+m.name);}break;}
     case 'initiative':quickRoll('initiative','');success=true;break;
     case 'skill':case 'save':case 'ability':quickRoll(node.kind,node.value);success=true;break;
     case 'declare':
       success=sendToRoll20('/em '+p.name+' declares '+node.label+'.');
       if(success){p[node.value==='bonus'?'bonusUsed':node.value==='reaction'?'reactionUsed':'actionUsed']=true;record('Combat action: '+node.label);}
       break;
     case 'move':p.movementUsed=clamp(int(p.movementUsed)+int(node.value),0,9999);save();success=true;break;
     case 'stand':p.movementUsed=clamp(int(p.movementUsed)+Math.floor(int(p.stats.speed)/2),0,9999);save();success=true;break;
     case 'resetMove':p.movementUsed=0;save();success=true;break;
     case 'toggle':p[node.value]=!p[node.value];save();success=true;break;
     case 'condition':p.conditions=p.conditions.includes(node.value)?p.conditions.filter(x=>x!==node.value):[...p.conditions,node.value];save();success=true;break;
     case 'newTurn':p.actionUsed=p.bonusUsed=p.reactionUsed=false;p.movementUsed=0;record('New turn started');success=true;break;
     case 'spendSlot':{const lv=int(node.value);if(lv>0&&lv<10&&p.usedSlots[lv]<p.spellSlots[lv]){p.usedSlots[lv]++;save();success=true;}else toast('No remaining spell slot at this level.');break;}
     case 'consume':if(item&&int(item.qty)>0){item.qty=int(item.qty)-1;record('Used 1 '+item.name);success=true;}else toast('Nothing left to use.');break;
     case 'announceItem':if(item){success=sendToRoll20('/em '+p.name+' uses '+item.name+'.');if(success)record('Used item '+item.name);}break;
     case 'detail':toast(attack?`${attack.name}: ${[attack.toHit,attack.damage,attack.damageType,attack.range].filter(Boolean).join(' · ')}`:'No attack details imported.');break;
     case 'spellInfo':toast(spell?`${spell.name}: ${[spell.castTime,spell.range,spell.duration,spell.notes].filter(Boolean).join(' · ').slice(0,300)}`:'No spell details imported.');break;
     case 'itemInfo':toast(item?`${item.name} · ${item.qty??1} carried · ${short(item.description||item.properties||'',220)}`:'No details imported.');break;
     case 'feature':toast(feature?`${feature.name}: ${short(feature.description||'Open your character sheet to activate this ability.',300)}`:'Feature unavailable.');break;
     case 'panel':RB.tab=node.value;RB.state.ui.lastTab=node.value;RB.visible=true;success=true;break;
     case 'pin':RB.radial.pin=true;toast('Click the center of your token on the tabletop.');success=true;break;
     default:toast('No usable command for this selection.');break;
   }
   if(success){RB.radial.path=[];save();render();radialPosition();}
 }
 function radialDomToken(){
   // Modern VTT may expose a selected token as an accessible DOM element.
   const el=document.querySelector('[data-token-id][aria-selected="true"],[data-token-id][data-selected="true"],.token.selected[data-token-id]');
   if(!el)return null;
   const b=el.getBoundingClientRect();
   return b.width>12&&b.width<500&&b.height>12&&b.height<500?{x:b.left+b.width/2,y:b.top+b.height/2}:null;
 }
 function radialCanvasToken(){
   // Legacy Fabric adapter; explicitly optional because modern Roll20 need not expose it.
   try{
     const canvas=window.d20?.engine?.canvas;
     if(!canvas)return null;
     const objects=canvas.getActiveObjects?.()||[canvas.getActiveObject?.()];
     const o=objects.find(x=>x&&(x.type==='image'||x.model?.get?.('type')==='image'));
     const viewport=canvas.viewportTransform||canvas.getViewportTransform?.()||[1,0,0,1,0,0];
     const base=canvas.upperCanvasEl||document.querySelector('canvas.upper-canvas');
     const center=o?.getCenterPoint?.()||((Number.isFinite(o?.left)&&Number.isFinite(o?.top))?{x:o.left,y:o.top}:null);
     if(!center||!base)return null;
     const rect=base.getBoundingClientRect(),w=canvas.getWidth?.()||base.width,h=canvas.getHeight?.()||base.height;
     const x=rect.left+(center.x*viewport[0]+center.y*viewport[2]+viewport[4])*rect.width/w;
     const y=rect.top+(center.x*viewport[1]+center.y*viewport[3]+viewport[5])*rect.height/h;
     return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
   }catch{return null;}
 }
 function radialPosition(){
   if(!RB.shadow||!RB.state)return;
   const r=RB.radial,auto=radialDomToken()||radialCanvasToken();
   if(auto){r.anchor=auto;r.source='selected';}
   else if(r.manual){r.anchor=r.manual;r.source='manual';}
   else{r.anchor=null;r.source='none';}
   const present=!!r.anchor;
   if(present!==r.lastPresence){r.lastPresence=present;render();}
   const wheel=RB.shadow.querySelector('#rbe-radial-wheel'),tether=RB.shadow.querySelector('#rbe-tether-path');
   if(!wheel||!r.anchor)return;
   // Clamp the full wheel including its footer, not just the SVG.
   const outer=radialOuterRadius(radialTreeRings().length);
   const above=outer+45,below=outer+95;
   const scale=Math.max(.4,Math.min(1,(innerWidth-16)/545,(innerHeight-16)/(above+below)));
   const marginX=260*scale+5;
   const cx=innerWidth<marginX*2?innerWidth/2:Math.max(marginX,Math.min(innerWidth-marginX,r.anchor.x));
   const topLimit=above*scale+7,bottomLimit=below*scale+7;
   const cy=innerHeight<topLimit+bottomLimit?innerHeight/2:
     Math.max(topLimit,Math.min(innerHeight-bottomLimit,r.anchor.y));
   wheel.style.left=cx+'px';wheel.style.top=cy+'px';wheel.style.setProperty('--wheel-scale',String(scale));
   if(tether)tether.setAttribute('d',Math.hypot(cx-r.anchor.x,cy-r.anchor.y)>25?`M ${r.anchor.x} ${r.anchor.y} L ${cx} ${cy}`:'');
 }
 function radialCapturePin(e){
   if(!RB.radial.pin||e.composedPath().includes(RB.root))return;
   const canvas=e.target.closest?.('canvas,.canvas-container,#editor-wrapper,#finalcanvas,.canvas-wrapper');
   if(!canvas)return;
   e.preventDefault();e.stopImmediatePropagation();
   RB.radial.manual={x:e.clientX,y:e.clientY};RB.radial.anchor=RB.radial.manual;
   RB.radial.source='manual';RB.radial.pin=false;RB.radial.open=true;RB.radial.path=[];
   RB.radial.lastPresence=true;render();radialPosition();toast('HUD pinned. Re-pin after panning if the token cannot be tracked.');
 }
 function startRadialTracking(){
   document.addEventListener('pointerdown',radialCapturePin,true);
   window.addEventListener('resize',radialPosition);
   setInterval(()=>{if(document.visibilityState==='visible')radialPosition();},160);
   radialPosition();
 }
