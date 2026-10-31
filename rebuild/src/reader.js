/* Runs ONLY in an official Roll20 D&D 2024 character-sheet frame. */
(()=>{
if(location.origin!==R4.sheet||!/\/dnd2024byroll20(?:\/|$)/.test(location.pathname)||
   window.parent===window)return;
const session='r4-'+(crypto.randomUUID?.()||String(Date.now())+Math.random());
const actions=new Map();let working=false,epoch=0;
const message=(type,more={})=>window.parent.postMessage({protocol:R4.protocol,type,session,...more},R4.editor);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const shown=el=>!!el&&!el.closest('[hidden],[inert],[aria-hidden="true"]')&&
  el.getAttribute('aria-hidden')!=='true'&&el.getClientRects().length>0;
function sheetName(){
  return R4.text(document.querySelector('.asv__header__name')?.textContent||
    document.querySelector('[data-testid="character-name"]')?.textContent||'',120);
}
function activeTab(){return [...document.querySelectorAll('[role="tab"]')].filter(el=>
  shown(el)&&(el.getAttribute('aria-selected')==='true'||
    el.getAttribute('data-state')==='active'))[0]||null;}
function tabs(){return [...document.querySelectorAll('[role="tab"]')].filter(el=>shown(el)&&
   !el.disabled&&R4.text(el.getAttribute('aria-label')||el.textContent,65));}
function label(el){return R4.text(el.getAttribute('aria-label')||el.textContent,65);}
function capture(tab){
  const stats={},categories={},countMax=180;
  const fieldMap={
    'hp':'hp','current hp':'hp','hit points':'hp','max hp':'maxHp',
    'maximum hp':'maxHp','temporary hp':'tempHp','temp hp':'tempHp',
    'armor class':'ac','ac':'ac','walking speed':'speed','speed':'speed',
    'initiative':'initiative','proficiency bonus':'proficiency',
    'passive perception':'passivePerception','level':'level',
    'spell save dc':'spellSaveDc'
  };
  const inputs=[...document.querySelectorAll('input,select,[data-attribute]')].slice(0,1000);
  for(const el of inputs){
    if(!shown(el))continue;
    const descriptions=[el.getAttribute('aria-label'),el.getAttribute('data-attribute'),
      el.getAttribute('name'),el.getAttribute('title'),el.labels?.[0]?.textContent,
      el.closest('label')?.textContent].map(x=>R4.text(x,90).toLowerCase());
    const matched=descriptions.map(x=>x.replace(/^attr_/,'').replace(/[_-]/g,' ')).find(x=>fieldMap[x]);
    const raw=String(el.value??el.getAttribute('value')??'').trim();
    if(matched&&/^[+-]?\d{1,4}(?:\.\d+)?$/.test(raw)){
      const value=Number(raw);
      if(value>=-100&&value<=9999)stats[fieldMap[matched]]=value;
    }
  }
  const kinds={
    attacks:'.attack-item,[data-testid*="attack-item"],.sheet-attack',
    spells:'.spell-item,[data-testid*="spell-item"],.sheet-spell',
    features:'.feature-item,.trait-item,.action-item,[data-testid*="feature-item"],[data-testid*="trait-item"]',
    inventory:'.inventory-item,.equipment-item,[data-testid*="inventory-item"],[data-testid*="equipment-item"]',
    skills:'[data-testid*="skill-row"],.skill-item',
    saves:'[data-testid*="saving-throw"],.saving-throw-item',
    resources:'.resource-item,[data-testid*="resource-item"]'
  };
  for(const [kind,selector] of Object.entries(kinds)){
    const entries=[];let index=0;
    for(const row of [...document.querySelectorAll(selector)].slice(0,countMax)){
      if(!shown(row))continue;
      const nameEl=row.querySelector('[data-testid*="name"],[class*="__name"],[class*="__title"],.span--item-row-title');
      const name=R4.text(nameEl?.textContent||row.getAttribute('aria-label')||
        row.textContent,90);
      if(!name||name.length<2)continue;
      const details=R4.text(row.textContent,200);
      const buttons=[...row.querySelectorAll('button,[role="button"]')].filter(shown);
      // A generic single button might be Edit or Delete: never map it.
      const eligible=buttons.filter(b=>{
        const caption=R4.text(b.getAttribute('aria-label')||b.getAttribute('title')||
          b.textContent,60);
        const testid=R4.text(b.getAttribute('data-testid'),70);
        return /^(roll|attack|cast|use|save|check)$/i.test(caption)||
          /(?:^|[-_])(roll|attack|cast|use|check)(?:[-_]|$)/i.test(testid);
      });
      const control=eligible.length===1?eligible[0]:null;
      const actionId=control?session+':'+(++index)+':'+kind+':'+Math.random().toString(36).slice(2):'';
      if(actionId)actions.set(actionId,{control,kind,name,source:row,tab,created:Date.now()});
      entries.push({name,details,kind,actionId,tab});
    }
    categories[kind]=entries;
  }
  const recognized=Object.keys(stats).length||Object.values(categories).some(x=>x.length);
  return {stats,categories,recognized:!!recognized};
}
async function scan(data){
  const request=R4.text(data.request,90);
  if(working){message('error',{request,error:'Reader busy'});return;}
  working=true;const turn=++epoch;
  try{
    const expected=R4.text(data.expectedName,120);
    // Official Vue resources may mount after the ~10-second loading indicator.
    // Do not treat a blank first tab as a permanently empty character.
    const until=Date.now()+(data.all?26500:14000);
    let name='',hydrated=false,recognized=false;
    do{
      name=sheetName();
      const visible=tabs();
      const first=capture(label(activeTab()||{getAttribute:()=>'' ,textContent:''}));
      recognized=first.recognized;
      if(name&&(!expected||R4.same(name,expected))&&
        (recognized||data.all&&visible.length>1)&&
        (!data.all||Date.now()>=until-14500)){hydrated=true;break;}
      if(name&&expected&&!R4.same(name,expected))
        throw Error('Official sheet name mismatches the exact Journal character');
      await pause(500);
    }while(Date.now()<until&&turn===epoch);
    if(!hydrated)throw Error('Official sheet did not hydrate verified name/data or usable tabs');
    actions.clear();
    const names=[],parts=[];const all=!!data.all;
    const original=activeTab();const originalLabel=original?label(original):'Current view';
    const queue=all?[...new Set(tabs().map(label))].slice(0,32):[originalLabel];
    if(!queue.length)queue.push('Current view');
    message('progress',{request,completed:0,total:queue.length,phase:'reading'});
    for(const tabLabel of queue){
      if(turn!==epoch)throw Error('Reader scan cancelled');
      if(all){
        const candidate=tabs().find(t=>label(t)===tabLabel);
        if(!candidate)continue;
        if(candidate.getAttribute('aria-selected')!=='true'){
          candidate.click();await pause(330);
        }
      }
      const part=capture(tabLabel);
      parts.push(part);names.push(tabLabel);
      message('progress',{request,completed:names.length,total:queue.length,phase:'reading'});
    }
    if(all&&originalLabel){
      const back=tabs().find(t=>label(t)===originalLabel);
      if(back&&back.getAttribute('aria-selected')!=='true')back.click();
    }
    if(all&&names.length!==queue.length)
      throw Error('Some official tab views disappeared during traversal');
    // A new tab's controls can unmount. Only invoke controls still connected
    // to the DOM; a later refresh must rebind an action, never guess.
    let snapshot={name,stats:{},categories:{},tabs:names};
    for(const part of parts)snapshot=R4.merge(snapshot,part);
    if(!R4.hasData(snapshot))throw Error('No recognized official sheet values in visited tabs');
    message('result',{request,snapshot});
  }catch(e){
    message('error',{request,error:R4.text(e?.message||e,200)});
  }finally{working=false;}
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(event.origin!==R4.editor||event.source!==window.parent||
     !data||data.protocol!==R4.protocol)return;
  if(data.type==='hello'){message('ready',{name:sheetName()});return;}
  if(data.type==='scan'){void scan(data);return;}
  if(data.type==='invoke'){
    const request=R4.text(data.request,90);
    const current=actions.get(data.actionId);
    if(!current||!R4.same(data.expectedName,sheetName())||
       !R4.same(current.name,data.actionName)){
      message('error',{request,error:'Native sheet action identity is stale'});
      return;
    }
    // Vue unmounts previous tabs. Revisit only this known tab, then rebind
    // by an exact unique source-observed name + row fingerprint.
    actions.delete(data.actionId);
    void (async()=>{
      try{
        let control=current.control;
        if(!control.isConnected||!current.source.isConnected||!shown(control)){
          const tabsNow=tabs();
          const tab=tabsNow.find(t=>label(t)===current.tab);
          if(!tab)throw Error('Source tab no longer exists');
          if(tab.getAttribute('aria-selected')!=='true'){
            tab.click();await pause(350);
          }
          const selectors={
            attacks:'.attack-item,[data-testid*="attack-item"],.sheet-attack',
            spells:'.spell-item,[data-testid*="spell-item"],.sheet-spell',
            features:'.feature-item,.trait-item,.action-item,[data-testid*="feature-item"],[data-testid*="trait-item"]',
            inventory:'.inventory-item,.equipment-item,[data-testid*="inventory-item"],[data-testid*="equipment-item"]',
            skills:'[data-testid*="skill-row"],.skill-item',
            saves:'[data-testid*="saving-throw"],.saving-throw-item',
            resources:'.resource-item,[data-testid*="resource-item"]'
          };
          const fingerprint=R4.text(current.source.textContent,200);
          const candidates=[...document.querySelectorAll(selectors[current.kind]||'nosuchrow')].filter(row=>
            shown(row)&&R4.text(row.textContent,200)===fingerprint);
          if(candidates.length!==1)throw Error('Native action has no unique current source row');
          const found=[...candidates[0].querySelectorAll('button,[role="button"]')].filter(shown);
          const exact=found.filter(b=>/^(roll|attack|cast|use|save|check)$/i.test(
            R4.text(b.getAttribute('aria-label')||b.getAttribute('title')||b.textContent,60))||
            /(?:^|[-_])(roll|attack|cast|use|check)(?:[-_]|$)/i.test(
              R4.text(b.getAttribute('data-testid'),70)));
          if(exact.length===1)control=exact[0];
          else throw Error('Native action control ambiguous; never click Edit/Delete');
        }
        if(!R4.same(data.expectedName,sheetName())||!shown(control))
          throw Error('Native sheet identity/control changed');
        control.click();message('invoked',{request});
      }catch(e){message('error',{request,error:R4.text(e?.message||e,180)});}
    })();
  }
});
message('ready',{name:sheetName()});
})();
