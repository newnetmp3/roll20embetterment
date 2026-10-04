// Isolated player UI — all markup is inside a ShadowRoot.
const STYLE = `
:host{all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:14px/1.45 system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:var(--text,#ebf0fa);--bg:#17202d;--panel:#1e2938;--raised:#28374b;--border:#405066;--text:#ebf0fa;--muted:#a7b7ca;--accent:#d1a869;--green:#65c891;--red:#ef8582;--shadow:0 16px 52px #060a13bf}
:host([data-theme="parchment"]){--bg:#f6f1e4;--panel:#fffaf0;--raised:#efe3cb;--border:#b8a78a;--text:#2d251d;--muted:#695c4a;--accent:#79511f;--green:#326643;--red:#a13b38;--shadow:0 12px 35px #2b211855}
:host([data-reduced-motion="true"]) *{scroll-behavior:auto!important;animation:none!important;transition:none!important}
:host([data-theme="violet"]){--bg:#1e182a;--panel:#2b2039;--raised:#3b2b4e;--border:#705682;--text:#f5eafb;--muted:#ccb9d7;--accent:#e3adff;--green:#85d4ae;--red:#ff94aa;--shadow:0 16px 52px #15091fcc}
*{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.45}input,textarea,select{color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px;min-width:0}input[type="checkbox"]{width:auto}input:focus,textarea:focus,select:focus,button:focus-visible{outline:2px solid var(--accent);outline-offset:1px}textarea{width:100%;min-height:80px;resize:vertical}select{max-width:100%}label{color:var(--muted);font-size:.85em}button{background:var(--raised);border:1px solid var(--border);border-radius:7px;color:var(--text);padding:7px 11px;white-space:nowrap}button:hover{border-color:var(--accent);filter:brightness(1.13)}button.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:700}button.small{padding:3px 7px;font-size:.87em}button.warn{color:var(--red)}button.on{background:#466d5f;border-color:var(--green);color:white}h2,h3{margin:0 0 9px;line-height:1.3;font-weight:650}h2{font-size:1.18em}h3{font-size:1em;color:var(--accent)}p{margin:0 0 10px}.muted,.hint{color:var(--muted)}.hint{font-size:.86em}.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.between{justify-content:space-between}.grow{flex:1;min-width:0}.stack{display:flex;flex-direction:column;gap:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}.card{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:11px;min-width:0}.pill{padding:2px 8px;border-radius:30px;font-size:.79em;background:var(--raised);border:1px solid var(--border)}.stat{font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}.field{display:flex;flex-direction:column;gap:3px;flex:1 1 95px;min-width:86px}.field input{width:100%}.field.narrow{flex:0 0 88px}.mini{width:68px;text-align:center}.wide{width:100%}.sep{height:1px;background:var(--border);margin:10px 0}.scroll{max-height:190px;overflow:auto}.list-entry{padding:8px 0;border-top:1px solid var(--border)}.list-entry:first-child{border-top:none}.barslot{min-width:63px;max-width:113px;flex:1;padding:7px 5px;text-align:center;overflow:hidden;text-overflow:ellipsis}.barslot .index{font-size:.75em;color:var(--muted)}
#rbe-fab,#rbe-bar,#rbe-hud,#rbe-panel,#rbe-palette,#rbe-toast,#rbe-copy-modal{pointer-events:auto;color:var(--text);font-size:calc(14px * var(--scale,1))}
#rbe-fab{position:fixed;bottom:14px;left:14px;padding:12px;border:1px solid var(--accent);border-radius:15px;background:var(--bg);color:var(--accent);box-shadow:var(--shadow);font-weight:800}
#rbe-hud{position:fixed;left:14px;bottom:78px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 12px;box-shadow:var(--shadow);max-width:min(380px,calc(100vw - 24px));min-width:195px}
#rbe-hud .hpbar{height:7px;background:var(--raised);border-radius:8px;overflow:hidden;margin:6px 0}#rbe-hud .hpbar>span{display:block;height:100%;background:var(--red)}
#rbe-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:11px;display:flex;gap:4px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:12px;max-width:calc(100vw - 155px);box-shadow:var(--shadow);overflow-x:auto}
#rbe-panel{position:fixed;right:16px;bottom:108px;width:min(var(--panel-width,520px),calc(100vw - 20px));max-height:min(77vh,790px);display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--border);border-radius:13px;box-shadow:var(--shadow);overflow:hidden}
#rbe-header{background:var(--panel);padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:7px;cursor:grab;touch-action:none;user-select:none}
#rbe-header strong{color:var(--accent);font-size:1.06em}#rbe-tabs{display:flex;overflow-x:auto;gap:2px;padding:7px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0}
#rbe-tabs button{padding:6px 10px;border-radius:5px;font-size:.89em}#rbe-tabs button.active{border-color:var(--accent);color:var(--accent);background:var(--raised)}
#rbe-body{overflow-y:auto;min-height:140px;padding:13px;scrollbar-color:var(--border) transparent;overscroll-behavior:contain}
#rbe-toast{position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--accent);color:var(--text);padding:11px 17px;border-radius:10px;max-width:min(430px,90vw);box-shadow:var(--shadow);text-align:center}#rbe-toast[hidden]{display:none}
#rbe-palette,#rbe-copy-modal{position:fixed;inset:0;background:#070b10ad;display:flex;align-items:flex-start;justify-content:center;padding-top:12vh}
#rbe-palette .dialog,#rbe-copy-modal .dialog{background:var(--bg);border:1px solid var(--accent);padding:15px;border-radius:12px;box-shadow:var(--shadow);width:min(540px,90vw);max-height:70vh;overflow-y:auto}
#rbe-palette input{width:100%;font-size:1.1em;padding:12px}.palette-choice{display:block;text-align:left;width:100%;margin:4px 0;white-space:normal}.table-scroll{overflow-x:auto}.table-scroll table{width:100%;border-collapse:collapse}.table-scroll td,.table-scroll th{padding:6px 3px;text-align:left;border-bottom:1px solid var(--border);font-size:.89em}.table-scroll th{color:var(--muted)}.tabs-inline{display:flex;gap:4px;flex-wrap:wrap}.key{color:var(--accent);font-weight:650}.note{border-left:3px solid var(--accent);padding:8px 10px;background:var(--panel);font-size:.88em}
@media(max-width:680px){#rbe-panel{bottom:75px!important;right:5px!important;left:5px!important;top:auto!important;width:calc(100vw - 10px)!important;max-height:76vh}#rbe-hud{display:none}#rbe-bar{left:76px;right:4px;transform:none;max-width:calc(100vw - 80px)}#rbe-fab{bottom:12px;left:5px;padding:10px}}
`;
const field = (label,path,value,opts={}) => `<label class="field ${opts.cls||''}">${html(label)}<input data-field="${html(path)}" type="${opts.type||'number'}" value="${html(value)}" ${opts.min!==undefined?'min="'+opts.min+'"':''} ${opts.max!==undefined?'max="'+opts.max+'"':''}></label>`;
const button = (label,action,extra='',cls='') => `<button data-action="${html(action)}" ${extra} class="${cls}">${label}</button>`;
const progress = (cur,max) => `<div class="hpbar"><span style="width:${max?Math.max(0,Math.min(100,cur/max*100)):0}%"></span></div>`;
function sheetUI() {
  const p=profile(),link=p.sheetLink,options=RB.openSheets||[];
  const section=(title,items,description,withRoll=false)=>
    '<div class="card"><h3>'+title+' ('+items.length+')</h3>'+
    (items.length?'<div class="scroll">'+items.map(item=>
      '<div class="list-entry"><div class="row"><strong class="grow">'+html(item.name)+'</strong>'+
      (withRoll&&item.command?button('Roll','runSheetAction','data-id="'+html(item.id)+'"','small primary'):'')+
      '</div><p class="hint">'+html(short(description(item),450))+'</p></div>').join('')+'</div>':
      '<p class="hint">Nothing accessible in the last scan.</p>')+'</div>';
  return '<div class="stack"><div class="card"><h2>Link character sheet</h2>'+
    '<p class="hint">Open your Roll20 sheet inside the tabletop (disable separate pop-out windows), then scan it. Import is read-only: Embetterment never modifies Roll20 attributes. Some 2024/Beacon fields are not exposed.</p>'+
    '<div class="row">'+button('① Scan open sheets','scanSheets','','primary')+button('② Sync selected','syncSheet')+'</div>'+
    (options.length?'<label class="field">Open sheet<select data-sheet-pick>'+options.map((sheet,i)=>
      '<option value="'+i+'" '+(i===(RB.selectedSheet||0)?'selected':'')+'>'+html(sheet.name)+' · '+int(sheet.readableFields)+' named / '+int(sheet.visibleFields)+' visible</option>').join('')+'</select></label>'+
      '<p class="hint">Found '+options.length+' candidate sheet(s). <strong>'+int(options[RB.selectedSheet||0]?.readableFields)+' named attributes</strong> and <strong>'+int(options[RB.selectedSheet||0]?.visibleFields)+' visible values</strong> detected. Click <strong>Sync selected</strong> to import. Switch between Combat, Spells and Inventory on the original sheet to reveal additional information, then sync again. If both counts are zero, try Advanced Tools &rarr; Attributes.</p>':
      '<p class="hint">No sheets scanned yet. Start by opening your character sheet and clicking Scan open sheets.</p>')+
    '<label><input type="checkbox" data-sheet-auto '+(link?.auto?'checked':'')+'> Refresh while the linked sheet is open (every 12 seconds)</label>'+
    '<p class="hint">Local notes, macros, equipment, and custom spells are preserved. Imports are read-only local copies. Beacon fields only import when their values can be identified confidently.</p></div>'+
    '<div class="card"><h3>Import coverage</h3>'+
    (link?'<strong>'+html(link.name||p.name)+'</strong> <span class="pill">'+html(link.edition||'Sheet')+'</span>'+
      '<p class="hint">Last sync: '+html(link.lastSync?new Date(link.lastSync).toLocaleString():'Never')+
      ' · '+int(link.coverage?.attributes)+' named attributes · '+int(link.coverage?.visibleFields)+' visible values · '+int(link.coverage?.unmapped?.length)+' not mapped</p>'+
      '<div class="row">'+Object.entries(link.counts||{}).map(([k,v])=>'<span class="pill">'+html(k)+' '+int(v)+'</span>').join('')+'</div>'+
      '<p class="hint">Unmapped names: '+html(short((link.coverage?.unmapped||[]).join(', '),700)||'None')+'</p>':
      '<p class="hint">Nothing linked yet.</p>')+
    '<div class="row">'+button('Export named attributes','exportSheetFields')+button('Export scan report','exportSheetReport')+button('Unlink','unlinkSheet')+'</div></div>'+
    '<div class="card"><h3>Attribute JSON fallback</h3><p class="hint">For fields hidden by the 2024 sheet, paste a JSON object of named attributes or an array with name/current/max entries.</p>'+
    '<textarea id="rbe-sheet-json" rows="3" placeholder="Paste sheet attribute JSON here"></textarea>'+
    button('Import pasted attributes','pasteSheet')+'</div>'+
    section('Attacks and actions',p.attacks||[],x=>[x.toHit&&'To hit '+x.toHit,x.damage&&'Damage '+x.damage,x.damageType,x.range,x.description].filter(Boolean).join(' · '),true)+
    section('Class features and feats',p.features||[],x=>[x.source,x.description].filter(Boolean).join(' · '))+
    section('Proficiencies',p.proficiencies||[],x=>x.description||'')+
    section('Tools',p.tools||[],x=>x.description||'')+
    '<div class="card"><h3>Character details</h3>'+
    Object.entries(p.sheetDetails||{}).map(([k,v])=>'<div class="list-entry"><strong>'+html(k.replace(/([A-Z])/g,' $1'))+
      '</strong><p class="hint">'+html(short(v,1200))+'</p></div>').join('')+
    '</div><p class="hint">Spells and slots appear under Spells, equipment under Inventory, HP/resources under Home, and skills/saves under Rolls.</p></div>';
}

function homeUI() {
  const p=profile(),s=p.stats;
  return `<div class="stack"><div class="row between"><h2>${html(p.name)} — Player HUD <span class="pill">${p.sheetLink?'sheet-linked · local copy':'local tracking'}</span></h2>${button('⚙ Profiles','profiles')}</div>
  <div class="card"><div class="row between"><strong>Character-sheet import</strong>${button(p.sheetLink?'View linked sheet':'Import character sheet','tab','data-value="Sheet"','primary')}</div><p class="hint">Open your D&amp;D 5E sheet inside Roll20, then scan and sync from the Sheet tab.</p></div>
  ${RB.state.settings.theme==='bg3'? `<div class="rbe-hero" role="group" aria-label="Adventurer profile"><div class="rbe-hero-seal" aria-hidden="true">✦</div><div class="rbe-hero-copy"><div class="rbe-eyebrow">THE ADVENTURER</div><div class="rbe-hero-name">${html(p.name)}</div><div class="rbe-hero-meta">Level ${int(s.level)} ${html(p.sheetDetails?.class||'Adventurer')}${p.sheetDetails?.race?' · '+html(p.sheetDetails.race):''}</div><span class="pill">${p.sheetLink?'Sheet-linked · read only':'Local character record'}</span></div></div>` : ''}
  <div class="card"><div class="row between"><strong>Hit Points <span class="stat">${int(s.hp)} / ${int(s.maxHp)}</span></strong><span class="hint">Temp: ${int(s.tempHp)} • AC ${int(s.ac)} • Speed ${int(s.speed)} ft</span></div>${progress(s.hp,s.maxHp)}
   <div class="row">${field('Current HP','stats.hp',s.hp,{cls:'narrow'})}${field('Max HP','stats.maxHp',s.maxHp,{cls:'narrow'})}${field('Temp HP','stats.tempHp',s.tempHp,{cls:'narrow'})}${field('AC','stats.ac',s.ac,{cls:'narrow'})}${field('Speed','stats.speed',s.speed,{cls:'narrow'})}</div>
   <div class="row"><input id="rbe-hp-adjust" type="number" value="5" class="mini" min="1" aria-label="HP adjustment">${button('− Damage','damage')} ${button('+ Heal','heal')} ${button('+ Temp HP','addTemp')}</div>
   <p class="hint">HUD HP is a local copy. The Sheet tab can refresh it from Roll20; edits here never write back.</p></div>
  <div class="card"><h3>Turn assistant</h3><div class="row">${toggle('Action','actionUsed',p.actionUsed)}${toggle('Bonus action','bonusUsed',p.bonusUsed)}${toggle('Reaction','reactionUsed',p.reactionUsed)}${button('New turn ↻','newTurn')}</div>
   <div class="row">${field('Movement used (ft)','movementUsed',p.movementUsed,{cls:'narrow'})}<span class="muted">Remaining: <strong>${Math.max(0,int(s.speed)-int(p.movementUsed))} ft</strong></span></div>
   <div class="row">${button(p.inspiration?'★ Inspiration ON':'☆ Inspiration OFF','inspiration','',p.inspiration?'on':'')}${button('Short rest','shortRest')}${button('Long rest','longRest')}</div></div>
  <div class="card"><h3>Concentration & conditions</h3><div class="row">${field('Concentrating on','concentration',p.concentration,{type:'text'})}${button('End','endConcentration')}</div>
   <div class="row">${conditions.map(c=>`<button class="small ${p.conditions.includes(c)?'on':''}" data-action="condition" data-value="${html(c)}">${html(c)}</button>`).join('')}</div>
   <p class="hint">Conditions are local reminders, not shared status markers.</p></div>
  <div class="grid"><div class="card"><h3>Death saves</h3><div class="row">Success ${[0,1,2].map(i=>`<input type="checkbox" data-death="success" data-count="${i+1}" ${p.death.success>i?'checked':''} aria-label="Success ${i+1}">`).join('')}</div><div class="row">Failure ${[0,1,2].map(i=>`<input type="checkbox" data-death="fail" data-count="${i+1}" ${p.death.fail>i?'checked':''} aria-label="Failure ${i+1}">`).join('')}</div>${button('Clear','clearDeath')}</div>
  <div class="card"><h3>Spell slots remaining</h3><div class="row">${p.spellSlots.map((n,i)=>i&&n?`<span class="pill">L${i}: ${Math.max(0,n-p.usedSlots[i])}/${n}</span>`:'').join('')||'<span class="muted">Set spell slots on Spells tab</span>'}</div></div></div>
  <div class="card"><div class="row between"><h3>Class resources</h3>${button('+ Resource','addResource')}</div>
   ${p.resources.map(r=>`<div class="row list-entry"><strong class="grow">${html(r.name)}</strong>${button('−','resourceDec',`data-id="${html(r.id)}"`,'small')}<span>${int(r.current)} / ${int(r.max)}</span>${button('+','resourceInc',`data-id="${html(r.id)}"`,'small')}${button('Edit','resourceEdit',`data-id="${html(r.id)}"`,'small')}${button('✕','resourceDelete',`data-id="${html(r.id)}"`,'small warn')}</div>`).join('')}</div></div>`;
}
function toggle(label,key,val) {return `<button class="${val?'on':''}" data-action="turnToggle" data-value="${key}">${val?'✓':'○'} ${label}</button>`;}
function rollsUI() {
  const p=profile();
  return `<div class="stack"><div class="card"><h2>Quick rolls <span class="pill">Roll20 dice</span></h2><div class="row"><span class="muted">Roll mode:</span>${['normal','adv','dis'].map(v=>`<button class="${RB.selectedAdv===v?'on':''}" data-action="adv" data-value="${v}">${v==='normal'?'Normal':v==='adv'?'Advantage':'Disadvantage'}</button>`).join('')}
  ${button('Initiative (select token)','rollInitiative')}</div><p class="hint">Bonuses are local values. Rolls go through Roll20 chat; initiative requires a selected token.</p></div>
  <div class="card"><h3>Ability checks & saves</h3><div class="table-scroll"><table><thead><tr><th>Ability</th><th>Check mod</th><th>Check</th><th>Save mod</th><th>Save</th></tr></thead><tbody>${abilities.map(a=>`<tr><td>${a.toUpperCase()}</td><td><input class="mini" type="number" data-field="abilityMods.${a}" value="${int(p.abilityMods[a])}"></td><td>${button('Roll','rollAbility',`data-value="${a}"`,'small')}</td><td><input class="mini" type="number" data-field="saveBonuses.${a}" value="${int(p.saveBonuses[a]??p.abilityMods[a])}"></td><td>${button('Save','rollSave',`data-value="${a}"`,'small')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Skill checks</h3><div class="table-scroll"><table><thead><tr><th>Skill</th><th>Ability</th><th>Total bonus</th><th>Roll</th></tr></thead><tbody>${skillNames.map(n=>`<tr><td>${html(n)}</td><td class="muted">${skillsByAbility[n].toUpperCase()}</td><td><input class="mini" type="number" data-field="skillBonuses.${html(n)}" value="${int(p.skillBonuses[n]??p.abilityMods[skillsByAbility[n]])}"></td><td>${button('Roll','rollSkill',`data-value="${html(n)}"`,'small')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Custom dice</h3><div class="row"><input id="rbe-custom-dice" class="grow" placeholder="2d6+3" value="1d20">${button('Public roll','customRoll')}${button('GM roll','gmRoll')}</div><p class="hint">Supports Roll20 dice notation. Rolls are made by Roll20, not by this script.</p></div></div>`;
}
function macroUI() {
  const macros=[...RB.state.macros].sort((a,b)=>Number(!!b.favorite)-Number(!!a.favorite)||a.name.localeCompare(b.name));
  const p=profile(), edit=RB.editMacro && RB.state.macros.find(m=>m.id===RB.editMacro);
  const slotOptions = [`<option value="">— Unassigned —</option>`, ...RB.state.macros.map(m=>`<option value="macro:${html(m.id)}">${html(m.name)}</option>`), ...p.spells.map(s=>`<option value="spell:${html(s.id)}">Spell: ${html(s.name)}</option>`), ...((p.attacks||[]).filter(x=>x.command).map(a=>`<option value="attack:${html(a.id)}">Attack: ${html(a.name)}</option>`))].join('');
  return `<div class="stack"><div class="card"><h2>${edit?'Edit macro':'Add player macro'}</h2><div class="row"><label class="field">Name<input id="rbe-macro-name" maxlength="120" value="${html(edit?.name||'')}"></label><label class="field">Category<input id="rbe-macro-cat" maxlength="50" value="${html(edit?.category||'Custom')}"></label></div><label class="field">Roll20 chat command<textarea id="rbe-macro-command" rows="2" placeholder="/roll 1d20+5">${html(edit?.command||'')}</textarea></label><div class="row">${button(edit?'Save changes':'Add macro','saveMacro','', 'primary')}${edit?button('Cancel edit','cancelMacro'):''}</div>
  <p class="hint">Commands beginning with # call existing Roll20 macros, while %{selected|...} references character-sheet buttons. Commands run with your Roll20 chat permissions.</p></div>
  <div class="card"><h3>Action bar configuration</h3><div class="grid">${p.macrosSlots.map((v,i)=>`<label class="field">Slot ${i+1}<select data-slot="${i}">${slotOptions.replace(`value="${html(v)}"`,`value="${html(v)}" selected`)}</select></label>`).join('')}</div><p class="hint">Action-bar numbers 1–8 can be enabled under Settings (off by default so they won't conflict with Roll20 shortcuts).</p></div>
  <div class="card"><h3>Macro library (${macros.length})</h3><input id="rbe-macro-search" class="wide" placeholder="Filter macros" value="${html(RB.macroSearch||'')}">
  <div id="rbe-macro-results">${macroListHTML(macros)}</div></div></div>`;
}
function macroListHTML(macros) {
  const q=(RB.macroSearch||'').toLowerCase();
  return macros.filter(m=>m.name.toLowerCase().includes(q)||m.category.toLowerCase().includes(q)).map(m=>`<div class="list-entry"><div class="row"><strong class="grow">${m.favorite?'★ ':''}${html(m.name)}</strong><span class="pill">${html(m.category)}</span>${button('Run','runMacro',`data-id="${html(m.id)}"`,'small primary')}${button(m.favorite?'★':'☆','favMacro',`data-id="${html(m.id)}"`,'small')}${button('Edit','editMacro',`data-id="${html(m.id)}"`,'small')}${button('✕','deleteMacro',`data-id="${html(m.id)}"`,'small warn')}</div><div class="hint">${html(short(m.command,100))}</div></div>`).join('') || '<p class="hint">No matching macros.</p>';
}
function spellsUI() {
  const p=profile(), editing=p.spells.find(s=>s.id===RB.editSpell);
  return `<div class="stack"><div class="card"><h2>Spell slots (local)</h2><div class="grid">${Array.from({length:9},(_,i)=>i+1).map(i=>`<div class="stack"><label>Level ${i}</label><div class="row"><input class="mini" type="number" min="0" max="99" data-slot-max="${i}" value="${p.spellSlots[i]}"><input class="mini" type="number" min="0" max="99" data-slot-used="${i}" value="${p.usedSlots[i]}"></div><span class="hint">Total / used</span>${button('Use','useSlot',`data-index="${i}"`,'small')}${button('Restore','restoreSlot',`data-index="${i}"`,'small')}</div>`).join('')}</div><p class="hint">Tracking is local. Casting does not automatically use a spell slot (rituals, free casts, etc.). Use the slot buttons when appropriate.</p></div>
  <div class="card"><h3>${editing?'Edit spell':'Add spell / feature'}</h3><div class="row"><label class="field">Name<input id="rbe-spell-name" value="${html(editing?.name||'')}"></label><label class="field narrow">Level (0–9)<input id="rbe-spell-level" type="number" min="0" max="9" value="${editing?.level??0}"></label><label class="field">Range / target<input id="rbe-spell-range" value="${html(editing?.range||'')}"></label></div>
  <label class="field">Roll20 cast command (optional)<input id="rbe-spell-command" placeholder="%{selected|repeating_spell-...}" value="${html(editing?.command||'')}"></label><label class="field">Notes / components<textarea id="rbe-spell-notes" rows="2">${html(editing?.notes||'')}</textarea></label><div class="row"><label><input type="checkbox" id="rbe-spell-conc" ${editing?.concentration?'checked':''}> Concentration</label>${button(editing?'Save spell':'Add spell','saveSpell','', 'primary')}${editing?button('Cancel edit','cancelSpell'):''}</div></div>
  <div class="card"><h3>Spellbook (${p.spells.length})</h3><input class="wide" id="rbe-spell-search" placeholder="Search spells and notes" value="${html(RB.spellSearch||'')}"><div id="rbe-spell-results">${spellListHTML()}</div></div></div>`;
}
function spellListHTML() {
  const p=profile(), q=(RB.spellSearch||'').toLowerCase();
  return p.spells.filter(s=>(s.name+' '+(s.notes||'')).toLowerCase().includes(q)).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name)).map(s=>`<div class="list-entry"><div class="row"><strong class="grow">${html(s.name)}</strong><span class="pill">${s.level?'Level '+s.level:'Cantrip'}</span>${s.concentration?'<span class="pill">Concentration</span>':''}${s.origin==='sheet'?'<span class="pill">Sheet</span>':''}${s.prepared?'<span class="pill">Prepared</span>':''}${button('Cast','castSpell',`data-id="${html(s.id)}"`,'small primary')}${button('Edit','editSpell',`data-id="${html(s.id)}"`,'small')}${button('✕','deleteSpell',`data-id="${html(s.id)}"`,'small warn')}</div><p class="hint">${html([s.range,s.castTime,s.duration,s.components,s.school].filter(Boolean).join(' · '))}${s.notes?' • '+html(short(s.notes,140)):''}</p></div>`).join('')||'<p class="hint">No spells yet. Add spells and optionally link their sheet macros.</p>';
}
function inventoryUI() {
  const p=profile(), weight=p.inventory.reduce((acc,x)=>acc+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.weight)||0),0);
  return `<div class="stack"><div class="card"><h2>Inventory <span class="pill">${weight.toFixed(1)} lb</span></h2><div class="row"><label class="field">Item<input id="rbe-item-name" placeholder="Potion of Healing"></label><label class="field narrow">Quantity<input id="rbe-item-qty" type="number" value="1" min="1"></label><label class="field narrow">Weight each (lb)<input id="rbe-item-weight" type="number" value="0" min="0" step="0.1"></label></div><div class="row"><label class="field">Category<input id="rbe-item-cat" value="Gear"></label>${button('+ Add item','addItem','', 'primary')}</div>
   <div class="table-scroll"><table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Wt</th><th></th></tr></thead><tbody>${p.inventory.map(x=>`<tr><td>${html(x.name)} ${x.equipped?'✓':''}</td><td>${html(x.category||'Gear')}</td><td><input class="mini" type="number" min="0" data-item-qty="${html(x.id)}" value="${x.qty}"></td><td>${Number(x.weight||0).toFixed(1)}</td><td>${button('✕','deleteItem',`data-id="${html(x.id)}"`,'small warn')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Coins</h3><div class="row">${['cp','sp','ep','gp','pp'].map(k=>field(k.toUpperCase(),'currency.'+k,p.currency[k],{cls:'narrow'})).join('')}</div></div></div>`;
}
function journalUI() {
  const p=profile();
  return `<div class="stack"><div class="card"><div class="row between"><h2>Personal journal</h2>${button('Export Markdown','exportNotes')}</div><textarea id="rbe-notes" rows="10" placeholder="NPCs, places, clues, session summaries, important details...">${html(p.notes)}</textarea><p class="hint">Auto-saved locally as you type, per character and campaign. Not shared with other players.</p></div>
  <div class="card"><h3>Quest tracker</h3><div class="row"><input id="rbe-quest-text" class="grow" placeholder="Find the missing cartographer">${button('+ Add quest','addQuest')}</div>${p.quests.map(q=>`<div class="row list-entry"><input type="checkbox" data-quest="${html(q.id)}" ${q.done?'checked':''}><span class="grow" style="${q.done?'text-decoration:line-through;opacity:.6':''}">${html(q.text)}</span>${button('✕','deleteQuest',`data-id="${html(q.id)}"`,'small warn')}</div>`).join('')}</div>
  <div class="card"><div class="row between"><h3>Personal activity log</h3>${button('Add timestamp','timestamp')}</div><input id="rbe-log-entry" class="wide" placeholder="A clue, event or note"><div class="row">${button('Add log entry','addLog')}</div><div class="scroll">${p.sessionLog.slice(0,80).map(e=>`<div class="list-entry"><span class="hint">${html(new Date(e.at).toLocaleString())}</span><br>${html(e.text)}</div>`).join('')}</div></div></div>`;
}
function chatUI() {
  return `<div class="stack"><div class="card"><h2>Chat visibility filters</h2><label class="field">Search visible chat<input id="rbe-chat-search" placeholder="Character, phrase, or roll" value="${html(RB.state.settings.chatSearch)}"></label><div class="row"><select id="rbe-chat-kind"><option value="all">All chat</option><option value="rolls" ${RB.state.settings.chatKind==='rolls'?'selected':''}>Likely rolls</option><option value="chat" ${RB.state.settings.chatKind==='chat'?'selected':''}>Non-roll messages</option><option value="whispers" ${RB.state.settings.chatKind==='whispers'?'selected':''}>Visible whispers</option></select>${button('Apply','applyChat','', 'primary')}${button('Clear filters','clearChat')}</div><p class="hint">Only hides messages in your browser; never deletes Roll20 history. Category detection is approximate and depends on Roll20's markup.</p></div>
  <div class="card"><h3>Quick chat commands</h3><label class="field">Message<textarea id="rbe-chat-message" rows="3" placeholder="Your message..."></textarea></label><div class="row">${button('Speak','sendText')}${button('Emote','sendEmote')}${button('OOC','sendOOC')}${button('Whisper GM','sendWhisper')}</div></div></div>`;
}
function settingsUI() {
  const s=RB.state.settings,p=profile();
  return `<div class="stack"><div class="card"><h2>Settings</h2><div class="row"><label class="field">Theme<select data-setting="theme"><option value="bg3" ${s.theme==='bg3'?'selected':''}>Baldurian • Dark Fantasy (default)</option><option value="midnight" ${s.theme==='midnight'?'selected':''}>Midnight</option><option value="violet" ${s.theme==='violet'?'selected':''}>Arcane Violet</option><option value="parchment" ${s.theme==='parchment'?'selected':''}>Parchment</option></select></label><label class="field">UI size<select data-setting="scale"><option value="0.85" ${s.scale==.85?'selected':''}>Compact</option><option value="1" ${s.scale==1?'selected':''}>Normal</option><option value="1.15" ${s.scale==1.15?'selected':''}>Large</option></select></label></div>
  ${[['showBar','Show the bottom action bar'],['showHud','Show compact HP HUD'],['showFab','Show Embetterment launcher'],['hotkeys','Enable 1–8 keyboard action slots'],['reducedMotion','Reduced animation']].map(([key,label])=>`<div><label><input type="checkbox" data-setting="${key}" ${s[key]?'checked':''}> ${label}</label></div>`).join('')}
  <p class="hint">Shortcuts: Alt+Shift+E opens the panel; Alt+Shift+K opens the command palette. Both are ignored while typing except the palette shortcut.</p></div>
  <div class="card"><h3>Panel width</h3><label class="field">Width <input data-panel-width type="range" min="360" max="920" step="20" value="${RB.state.ui.panelWidth||520}"></label><p class="hint">You can also drag the panel by its title bar.</p></div>
  <div class="card"><h3>Character profiles</h3><div class="row"><select id="rbe-profile-select" class="grow">${RB.state.profiles.map(x=>`<option value="${html(x.id)}" ${x.id===p.id?'selected':''}>${html(x.name)}</option>`).join('')}</select>${button('Switch','switchProfile')}${button('New','newProfile')}${button('Rename','renameProfile')}${button('Delete','deleteProfile','', 'warn')}</div><p class="hint">Every character has separate HP, spells, inventory, notes, slots, and action bar assignments.</p></div>
  <div class="card"><h3>Backup & privacy</h3><div class="row">${button('Export JSON backup','exportBackup','', 'primary')}<label class="field">Import backup<input type="file" id="rbe-import" accept=".json,application/json"></label>${button('Reset panel position','resetPosition')}</div><p class="hint">Everything stays in this browser's localStorage. This script makes no external requests and has no analytics. Export backups before clearing browser data.</p></div>
  <div class="note">Roll20 Embetterment v${RB.version}. Sheet-independent 5E tools work with both 2014 and 2024 sheets. Local trackers do not change authoritative Roll20 attributes or provide GM-only information.</div></div>`;
}
function referenceUI() {
  return `<div class="stack"><h2>5E quick reference</h2><div class="card"><h3>Action economy</h3><p>Generally on your turn: movement up to speed, one action, and a bonus action if a feature permits. Reactions are triggered separately and normally recharge at the start of your turn. Extra Attack and class features modify this.</p></div>
  <div class="card"><h3>Common combat actions</h3><p>Attack • Dash • Disengage • Dodge • Help • Hide • Ready • Search • Use an Object (2014). Some actions differ in 2024; use your campaign's rules.</p></div>
  <div class="card"><h3>Concentration</h3><p>When you take damage while concentrating, make a Constitution saving throw. DC is the higher of 10 or half the damage (rounded down). A new concentration spell ends the prior one.</p></div>
  <div class="card"><h3>Advantage and disadvantage</h3><p>Roll two d20s and use the higher result for advantage or the lower for disadvantage; if both apply, they cancel.</p></div>
  <div class="card"><h3>Roll20 syntax</h3><p><code>/roll 1d20+5</code> • <code>/roll 2d20kh1+5</code> • <code>/roll 2d20kl1+5</code> • <code>/roll 1d20+3 &amp;{tracker}</code> (select token) • <code>#MacroName</code></p></div>
  <p class="hint">Convenience summary only. Your table's official rules edition and DM rulings take precedence.</p></div>`;
}
function paletteEntries() {
  const tabs=['Home','Sheet','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  return [...tabs.map(t=>({name:'Open '+t,kind:'tab',value:t})),
    ...RB.state.macros.map(m=>({name:'Macro: '+m.name,kind:'macro',value:m.id})),
    ...profile().spells.map(s=>({name:'Spell: '+s.name,kind:'spell',value:s.id})),
    ...(profile().attacks||[]).map(a=>({name:'Attack: '+a.name,kind:'attack',value:a.id})),
    ...skillNames.map(n=>({name:'Skill: '+n,kind:'skill',value:n})),
    ...abilities.map(n=>({name:'Save: '+n.toUpperCase(),kind:'save',value:n}))];
}
function paletteUI() {
  if (!RB.paletteOpen) return '';
  const q=(RB.paletteQuery||'').toLowerCase(), choices=paletteEntries().filter(x=>x.name.toLowerCase().includes(q)).slice(0,30);
  return `<div id="rbe-palette"><div class="dialog"><div class="row between"><strong>⌘ Player command palette</strong>${button('✕','closePalette')}</div><input id="rbe-palette-input" placeholder="Find a macro, spell, skill, or panel…" value="${html(RB.paletteQuery||'')}"><div id="rbe-palette-results">${choices.map((x,i)=>`<button class="palette-choice ${i===RB.paletteSelection?'on':''}" data-action="paletteGo" data-value="${html(x.kind)}" data-id="${html(x.value)}">${html(x.name)}</button>`).join('')||'<p class="hint">Nothing found.</p>'}</div><p class="hint">↑ ↓ to choose • Enter to execute • Escape to close</p></div></div>`;
}
function modalUI() {
  if (RB.modal!=='copy') return '';
  return `<div id="rbe-copy-modal"><div class="dialog"><div class="row between"><h3>Paste into Roll20 chat</h3>${button('✕','closeModal')}</div><p>Roll20's chat input was not found, so the command was not sent.</p><textarea id="rbe-fallback-command" rows="4" readonly>${html(RB.pendingCommand||'')}</textarea><div class="row">${button('Copy command','copyCommand','', 'primary')}${button('Close','closeModal')}</div></div></div>`;
}

function barUI() {
  const p=profile(), fantasy=RB.state.settings.theme==='bg3';
  if (!RB.state.settings.showBar) return '';
  return `<div id="rbe-bar" aria-label="Quick action bar" title="Click to use a configured Roll20 macro, attack or spell">
    ${fantasy?'<div class="rbe-hotbar-label" aria-hidden="true"><span>⚔</span>Quick<br>Actions</div>':''}
    ${p.macrosSlots.map((v,i)=>{
      const m=v.startsWith('macro:')?RB.state.macros.find(m=>m.id===v.slice(6)):null;
      const sp=v.startsWith('spell:')?p.spells.find(s=>s.id===v.slice(6)):null;
      const a=v.startsWith('attack:')?(p.attacks||[]).find(a=>a.id===v.slice(7)):null;
      const name=m?.name || sp?.name || a?.name || 'Empty';
      const glyph=sp?'✧':a?'⚔':m?'⚄':'◇';
      return `<button class="barslot ${v?'is-filled':'is-empty'}" data-action="slot" data-index="${i}" title="${html(name)}" aria-label="Quick slot ${i+1}: ${html(name)}">${fantasy?`<span class="rbe-slot-glyph" aria-hidden="true">${glyph}</span>`:''}<span class="rbe-slot-title">${html(short(name,15))}</span><span class="index">${i+1}</span></button>`;
    }).join('')}
  </div>`;
}
function hudUI() {
  const p=profile(),s=p.stats;
  if (!RB.state.settings.showHud) return '';
  return `<div id="rbe-hud" title="Personal stat tracker; values may be refreshed from an open character sheet" role="complementary" aria-label="Character status">
    <div class="row between"><strong class="rbe-hud-name">${html(short(p.name,25))}</strong><span class="pill">AC ${int(s.ac)}</span><span class="pill">Temp ${int(s.tempHp)}</span></div>
    ${progress(s.hp,s.maxHp)}
    <div class="row between"><strong>♥ ${int(s.hp)}/${int(s.maxHp)} HP</strong><span class="hint">${p.concentration?'◎ '+html(short(p.concentration,25)):'No concentration'}</span>${button('Open','open','', 'small')}</div>
  </div>`;
}
function themeHeading(tab) {
  const sections={
    Home:['The Adventurer','Character overview and combat resources','♜'],
    Sheet:['Character Archive','Read-only Roll20 sheet linking and import','✥'],
    Rolls:['Dice & Destiny','Ability checks, saving throws and skills','⚄'],
    Macros:['Combat Arsenal','Custom commands and quick action slots','⚔'],
    Spells:['The Spellbook','Prepared magic and spellcasting resources','✧'],
    Inventory:['The Traveller’s Pack','Equipment, coin and carried treasures','◆'],
    Journal:['Chronicle & Quests','Notes, objectives and session history','✎'],
    Chat:['Tavern Whispers','Conversation and rolls within the tabletop','☷'],
    Reference:['Adventurer’s Codex','Rules and battlefield reminders','❖'],
    Settings:['Companion Settings','Theme, profiles, accessibility and privacy','⚙']
  };
  const [title,description,glyph]=sections[tab]||sections.Home;
  return `<div class="rbe-section-heading"><div><h2>${html(title)}</h2><small>${html(description)}</small></div><span class="rbe-section-mark" aria-hidden="true">${glyph}</span></div>`;
}
const THEME_TAB_GLYPHS={Home:'♜',Sheet:'✥',Rolls:'⚄',Macros:'⚔',Spells:'✧',Inventory:'◆',Journal:'✎',Chat:'☷',Reference:'❖',Settings:'⚙'};
function render() {
  if (!RB.shadow || !RB.state) return;
  const s=RB.state.settings; RB.root.style.setProperty('--scale',s.scale); RB.root.setAttribute('data-theme',s.theme); RB.root.setAttribute('data-reduced-motion',String(!!s.reducedMotion));
  const tabs=['Home','Sheet','Rolls','Macros','Spells','Inventory','Journal','Chat','Reference','Settings'];
  const panels={Home:homeUI,Sheet:sheetUI,Rolls:rollsUI,Macros:macroUI,Spells:spellsUI,Inventory:inventoryUI,Journal:journalUI,Chat:chatUI,Reference:referenceUI,Settings:settingsUI};
  RB.shadow.innerHTML=`<style>${STYLE}${BG3_STYLE}${RADIAL_STYLE}</style>${s.showFab?`<button id="rbe-fab" data-action="toggle" title="roll20 Embetterment — Alt+Shift+E">⚔ R20E</button>`:''}${hudUI()}${barUI()}
  ${RB.visible?`<section id="rbe-panel" role="complementary" aria-label="roll20 Embetterment"><header id="rbe-header">${s.theme==='bg3'?'<span class="rbe-header-crest" aria-hidden="true">✥</span><span class="rbe-header-copy"><strong>roll20 <em>Embetterment</em></strong><span class="rbe-header-sub">Adventurer’s Companion</span></span>':'<strong>⚔ roll20 Embetterment</strong>'}<div class="row">${button('⌕','openPalette','title="Command palette"','small')}${button('—','close','title="Minimize"','small')}</div></header><nav id="rbe-tabs">${tabs.map(t=>`<button data-action="tab" data-value="${t}" class="${t===RB.tab?'active':''}" title="${html(t)}">${s.theme==='bg3'?`<span class="rbe-nav-glyph" aria-hidden="true">${THEME_TAB_GLYPHS[t]}</span><span class="rbe-nav-label">${html(t)}</span>`:html(t)}</button>`).join('')}</nav><div id="rbe-body" data-panel="${html(RB.tab)}">${s.theme==='bg3'?themeHeading(RB.tab):''}${(panels[RB.tab]||homeUI)()}</div></section>`:''}
  ${radialHTML()}${paletteUI()}${modalUI()}<div id="rbe-toast" role="status" hidden></div>`;
  RB.panel=RB.shadow.querySelector('#rbe-panel');
  const u=RB.state.ui;
  if (RB.panel) { RB.panel.style.setProperty('--panel-width',(clamp(u.panelWidth||520,360,920))+'px'); if (Number.isFinite(u.panelX)&&Number.isFinite(u.panelY)) {RB.panel.style.left=u.panelX+'px';RB.panel.style.top=u.panelY+'px';RB.panel.style.right='auto';RB.panel.style.bottom='auto';} }
  if (RB.tab==='Chat' && RB.visible) applyChatFilter();
}