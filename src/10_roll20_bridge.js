// Roll20 integration: use supported chat commands, never private page globals.
function chatForm() {
  const field = document.querySelector('#textchat-input textarea, #textchat-input input[type="text"], [data-testid="textchat-input"] textarea');
  const submit = document.querySelector('#textchat-input button.btn, #textchat-input button[type="submit"], #textchat-input .btn, [data-testid="textchat-input"] button');
  return field && submit && !submit.disabled ? {field,submit} : null;
}
function setNativeInput(element, value) {
  const own = Object.getOwnPropertyDescriptor(element, 'value');
  const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
  const setter = proto?.set || own?.set;
  if (setter) setter.call(element,value); else element.value=value;
  element.dispatchEvent(new Event('input', {bubbles:true}));
  element.dispatchEvent(new Event('change', {bubbles:true}));
}
function sendToRoll20(command) {
  const cmd=String(command||'').trim();
  if (!cmd) {toast('This action needs a Roll20 macro command.'); return false;}
  const form=chatForm();
  if (form && String(form.field.value||'').trim()) {RB.pendingCommand=cmd;RB.modal='copy';render();toast('Your unsent chat draft was preserved. Copy this command when ready.');return false;}
  if (!form) {RB.pendingCommand=cmd; RB.modal='copy'; render(); toast('Roll20 chat not found. Copy this command into chat.'); return false;}
  try {
    setNativeInput(form.field,cmd);
    form.submit.click();
    RB.lastCommand=cmd;
    return true;
  } catch (err) {
    console.warn('[roll20 Embetterment] Chat send failed',err);
    RB.pendingCommand=cmd; RB.modal='copy'; render(); toast('Roll20 rejected the action; copy the command manually.');
    return false;
  }
}
function makeRoll(bonus=0, mode=RB.selectedAdv, tracker=false) {
  const dice = mode==='adv' ? '2d20kh1' : mode==='dis' ? '2d20kl1' : '1d20';
  return '/roll '+dice+(int(bonus)<0 ? int(bonus) : '+'+int(bonus))+(tracker ? ' &{tracker}' : '');
}
function quickRoll(kind,name) {
  const p=profile(); let bonus=0;
  if (kind==='ability') bonus=p.abilityMods[name]||0;
  if (kind==='save') bonus=p.saveBonuses[name] ?? p.abilityMods[name] ?? 0;
  if (kind==='skill') bonus=p.skillBonuses[name] ?? p.abilityMods[skillsByAbility[name]] ?? 0;
  if (kind==='initiative') bonus=p.stats.init;
  const sent=sendToRoll20(makeRoll(bonus, RB.selectedAdv, kind==='initiative'));
  if (sent) record('Rolled '+(kind==='initiative'?'Initiative':kind+' '+name)+' ('+signed(bonus)+', '+RB.selectedAdv+')');
}
function executeSlot(slot) {
  const p=profile(); const v=p.macrosSlots[slot];
  if (!v) return toast('Configure this slot under Macros.');
  if (v.startsWith('macro:')) {
    const m=RB.state.macros.find(m=>m.id===v.slice(6));
    if (!m) return toast('Macro no longer exists; edit this slot.');
    if (sendToRoll20(m.command)) record('Used macro: '+m.name);
  } else if (v.startsWith('spell:')) {
    const s=p.spells.find(s=>s.id===v.slice(6));
    if (!s) return toast('Spell no longer exists.');
    useSpell(s.id);
  }
}
function useSpell(id) {
  const p=profile(), spell=p.spells.find(s=>s.id===id);
  if (!spell) return;
  // No automatic slot expenditure: cantrips/rituals/free casts complicate this.
  if (spell.command) {if (sendToRoll20(spell.command)) record('Cast/used '+spell.name);}
  else {toast('No Roll20 command set for '+spell.name+'. Add one using Edit.');}
  if (spell.concentration && spell.command) {
    p.concentration=spell.name; save();
    toast('Concentrating on '+spell.name+' (local reminder).');
  }
  render();
}
function applyDamage(dmg) {
  const p=profile(); let n=clamp(dmg,0,100000); if (!n) return;
  const initial=n, absorbed=Math.min(p.stats.tempHp,n);
  p.stats.tempHp-=absorbed; n-=absorbed; p.stats.hp=Math.max(0,p.stats.hp-n);
  record('Local damage '+initial+(absorbed?' ('+absorbed+' temp HP absorbed)':''));
  if (p.concentration) toast('Concentration check: CON save DC '+Math.max(10,Math.floor(initial/2))+' for '+p.concentration+'.');
  save(); render();
}
function rest(type) {
  const p=profile();
  p.resources.forEach(r=>{if (r.reset===type || (type==='long' && r.reset==='short')) r.current=int(r.max);});
  if (type==='long') {
    p.usedSlots=p.usedSlots.map(()=>0);
    p.actionUsed=p.bonusUsed=p.reactionUsed=false;
    p.movementUsed=0; p.death={success:0,fail:0};
  }
  record(type==='long'?'Long rest: local resources/slots reset':'Short rest: local short-rest resources reset');
  save(); render();
}
function downloadText(filename,content,type='text/plain;charset=utf-8') {
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function exportBackup() {
  downloadText('roll20-embetterment-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(RB.state,null,2),'application/json');
}
function importBackup(file) {
  if (!file || file.size > 2*1024*1024) return toast('Choose a JSON backup smaller than 2 MB.');
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const raw=JSON.parse(reader.result);
      if (!raw || raw.schema!==1 || !Array.isArray(raw.profiles)) throw new Error('Not an Embetterment v1 backup');
      if (!confirm('Replace all Embetterment settings and character profiles for this campaign?')) return;
      localStorage.setItem(RB.key,JSON.stringify(raw)); load(); RB.visible=true; render(); toast('Backup imported.');
    } catch(err){toast('Import failed: '+err.message);}
  }; reader.readAsText(file);
}
function notesMarkdown() {
  const p=profile();
  const quests=p.quests.map(q=>'- ['+(q.done?'x':' ')+'] '+q.text).join('\n');
  const log=p.sessionLog.map(x=>'- '+new Date(x.at).toLocaleString()+': '+x.text).join('\n');
  return '# '+p.name+' — Session Journal\n\n## Notes\n'+p.notes+'\n\n## Quests\n'+quests+'\n\n## Session Log\n'+log+'\n';
}
function toast(message) {
  RB.toastText=String(message);
  const n=RB.shadow?.querySelector('#rbe-toast');
  if (n) {n.textContent=RB.toastText;n.hidden=false;}
  clearTimeout(RB.toastTimer);
  RB.toastTimer=setTimeout(()=>{const el=RB.shadow?.querySelector('#rbe-toast');if (el) el.hidden=true;},4400);
}
function copyText(text) {
  const copied=()=>toast('Copied to clipboard.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(copied,()=>fallbackCopy(text));
  else fallbackCopy(text);
}
function fallbackCopy(text) {
  const el=document.createElement('textarea'); el.value=text;
  el.style.cssText='position:fixed;left:-10000px;'; document.body.append(el); el.select();
  try {document.execCommand('copy');toast('Copied to clipboard.');}
  catch {toast('Select and copy the displayed command manually.');}
  el.remove();
}
function applyChatFilter() {
  const settings=RB.state.settings;
  const node=document.querySelector('#textchat .content, #textchat .message-list, #textchat [data-testid="chat-messages"]');
  if (!node) { if (RB.tab==='Chat') toast('Chat history container unavailable in this Roll20 layout.'); return; }
  if (RB.chatNode!==node) {
    RB.chatObserver?.disconnect();RB.chatNode=node;
    RB.chatObserver=new MutationObserver(()=>{clearTimeout(RB.chatTimer);RB.chatTimer=setTimeout(()=>filterChatMessages(node),120);});
    RB.chatObserver.observe(node,{childList:true,subtree:true});
  }
  filterChatMessages(node);
}
function filterChatMessages(node) {
  const search=(RB.state.settings.chatSearch||'').toLowerCase().trim();
  const kind=RB.state.settings.chatKind||'all';
  const messages=node.querySelectorAll('.message, .chatmessage, [data-testid="chat-message"]');
  for (const msg of messages) {
    const t=(msg.textContent||'').toLowerCase();
    const roll=!!msg.querySelector('.inlinerollresult,.rollresult,.sheet-rolltemplate-default,[class*="rolltemplate-"]') || /\brolled\b|\brolling\b/.test(t);
    const whisper=msg.classList.contains('whisper') || !!msg.querySelector('.whisper') || /\(to gm\)|\(whisper\)/.test(t);
    const match=(!search || t.includes(search)) && (kind==='all' || (kind==='rolls' && roll) || (kind==='chat' && !roll) || (kind==='whispers' && whisper));
    if (match) msg.removeAttribute('data-rbe-hidden'); else msg.setAttribute('data-rbe-hidden','1');
  }
}
function clearChatFilter() {
  RB.state.settings.chatSearch='';RB.state.settings.chatKind='all';save();
  if (RB.chatNode) RB.chatNode.querySelectorAll('[data-rbe-hidden]').forEach(n=>n.removeAttribute('data-rbe-hidden'));
}