import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const source=readFileSync(join(root,'extension/firefox/turn-economy.js'),'utf8');
function rig(){
  const storage=new Map(),rendered={count:0};
  const context={
    window:{d20:{Campaign:{get(){return '[]';}}}},
    R3_HUD:{used:{}},R3_UI:{snapshot:{stats:{speed:30},features:[]}},
    R3_TOKEN:{active:{tokenId:'token-elf',characterId:'char-elf',name:'Elowen'}},
    r3TokenSettingsKey(){return 'game123:char:'+context.R3_TOKEN.active.characterId;},
    r3HudRender(){rendered.count++;},
    r3String(value,max=150){return String(value??'').slice(0,max);},
    r3Escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
    localStorage:{getItem(key){return storage.get(key)||null;},
      setItem(key,value){storage.set(key,value);}}
  };
  vm.createContext(context);
  vm.runInContext(source+'\nglobalThis.api={R3_TURN,r3TurnStart,r3TurnClick,r3TurnApply,r3TurnLoad,r3TurnSpeed,r3TurnMarkup,r3TurnCost,r3TurnObserveInitiative,r3TurnHint,r3TurnStyles};',context);
  context.api.r3TurnLoad();
  return {api:context.api,context,storage,rendered};
}
test('begin turn shows action, bonus, reaction, movement without asking questions',()=>{
  const h=rig();
  const html=h.api.r3TurnMarkup(h.context.R3_UI.snapshot);
  for(const title of ['Action','Bonus','Reaction','Movement','Concentration','Attacks','Free interaction'])
    assert.ok(html.includes(title),title);
  assert.match(html,/TURN NOT STARTED/);
  assert.match(html,/data-turn-action="start"/);
  assert.doesNotMatch(source,/\b(?:alert|confirm|prompt)\s*\(/);
  assert.equal(h.api.R3_TURN.phase,'unknown');
  assert.equal(h.api.R3_TURN.actionSpent,0);
  assert.equal(h.api.R3_TURN.reactionSpent,false);
});
test('Dash increases speed allowance; partial movement is independent from action use',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnStart();
  h.api.r3TurnApply('move-plus');h.api.r3TurnApply('move-plus');
  assert.equal(t.movementUsed,10);
  assert.equal(t.actionSpent,0);
  h.api.r3TurnApply('dash-action');
  assert.equal(t.actionSpent,1);
  assert.equal(t.dashes,1);
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/50 ft/);
  h.api.r3TurnApply('dash-undo');
  assert.equal(t.dashes,0);
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/20 ft/);
  h.api.r3TurnApply('move-minus');
  assert.equal(t.movementUsed,5);
});
test('unknown movement speed stays unknown; no invented speed or roll execution',()=>{
  const h=rig();
  h.context.R3_UI.snapshot.stats.speed=null;
  assert.equal(h.api.r3TurnSpeed(),null);
  h.api.r3TurnApply('dash-bonus');
  assert.equal(h.api.R3_TURN.bonusSpent,true);
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/Unknown/);
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/\/ \? ft/);
  assert.equal(h.api.R3_TURN.actionSpent,0);
});
test('manual extra-attack count and extra action are separate from roll execution',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.context.R3_UI.snapshot.features=[{name:'Extra Attack'}];
  assert.equal(t.attackAllowance,1,'feature title alone cannot prove exact attack count');
  h.api.r3TurnApply('attacks-plus');
  h.api.r3TurnApply('attack-used');
  h.api.r3TurnApply('attack-used');
  assert.equal(t.attackAllowance,2);
  assert.equal(t.attackUsed,2);
  assert.equal(t.actionSpent,1);
  h.api.r3TurnApply('extra-plus');
  assert.equal(t.extraActions,1);
  assert.equal(h.context.R3_HUD.used.action,false,'one action remains');
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/Extra Attack on sheet/);
});
test('reaction stays spent outside turn, returns next turn; concentration persists',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnStart();
  h.api.r3TurnApply('reaction');
  h.api.r3TurnApply('focus');
  h.api.r3TurnApply('end');
  assert.equal(t.phase,'ended');
  assert.equal(t.reactionSpent,true);
  assert.equal(t.concentration,true);
  h.api.r3TurnStart();
  assert.equal(t.reactionSpent,false);
  assert.equal(t.concentration,true);
  assert.equal(t.phase,'active');
});
test('turn data persists strictly per controlled character and sanitizes corrupt values',()=>{
  const h=rig();
  h.api.r3TurnApply('move-plus');
  h.api.r3TurnApply('reaction');
  h.api.r3TurnApply('focus');
  const first='game123:char:char-elf:turn-economy';
  assert.ok(h.storage.has(first));
  h.context.R3_TOKEN.active={tokenId:'token-brom',characterId:'char-brom',name:'Brom'};
  h.api.r3TurnLoad();
  assert.equal(h.api.R3_TURN.movementUsed,0);
  assert.equal(h.api.R3_TURN.reactionSpent,false);
  h.api.r3TurnApply('move-plus');h.api.r3TurnApply('move-plus');
  h.context.R3_TOKEN.active={tokenId:'token-elf',characterId:'char-elf',name:'Elowen'};
  h.api.r3TurnLoad();
  assert.equal(h.api.R3_TURN.movementUsed,5);
  assert.equal(h.api.R3_TURN.reactionSpent,true);
  assert.equal(h.api.R3_TURN.concentration,true);
  h.storage.set(first,JSON.stringify({schema:1,state:{
    actionSpent:900000,extraActions:-5,movementUsed:-1,attackAllowance:500,concentration:'false'
  }}));
  h.api.r3TurnLoad();
  assert.equal(h.api.R3_TURN.actionSpent,0);
  assert.equal(h.api.R3_TURN.attackAllowance,1);
  assert.equal(h.api.R3_TURN.concentration,null);
});
test('initiative tracker resets only on observed transition to the selected token',()=>{
  const h=rig(),t=h.api.R3_TURN;
  let order=JSON.stringify([{id:'token-elf'}]);
  h.context.window.d20.Campaign.get=()=>order;
  h.api.r3TurnLoad();
  h.api.r3TurnApply('reaction');
  h.api.r3TurnObserveInitiative();
  assert.equal(t.reactionSpent,true,'initial observation never fabricates a turn start');
  order=JSON.stringify([{id:'token-brom'}]);
  h.api.r3TurnObserveInitiative();
  order=JSON.stringify([{id:'token-elf'}]);
  h.api.r3TurnObserveInitiative();
  assert.equal(t.reactionSpent,false);
  assert.equal(t.phase,'active');
  assert.equal(t.noteSource,'observed');
  h.api.r3TurnApply('reaction');
  h.api.r3TurnObserveInitiative();
  assert.equal(t.reactionSpent,true,'same initiative leader cannot reset again');
});
test('direct Jumpgate Campaign detects initiative transitions without legacy window.d20',()=>{
  const h=rig(),t=h.api.R3_TURN;
  let order=JSON.stringify([{id:'token-elf'}]);
  h.context.window.Campaign={get(key){return key==='turnorder'?order:null;}};
  h.context.window.d20=undefined;
  h.api.r3TurnLoad();
  h.api.r3TurnApply('reaction');
  h.api.r3TurnObserveInitiative();
  assert.equal(t.phase,'unknown','Already-leading on attachment must not fabricate a new turn');
  assert.equal(t.reactionSpent,true);
  order=JSON.stringify([{id:'token-brom'}]);
  h.api.r3TurnObserveInitiative();
  order=JSON.stringify([{id:'token-elf'}]);
  h.api.r3TurnObserveInitiative();
  assert.equal(t.phase,'active');
  assert.equal(t.noteSource,'observed');
  assert.equal(t.reactionSpent,false);
  h.api.r3TurnApply('reaction');
  h.api.r3TurnObserveInitiative();
  assert.equal(t.reactionSpent,true,'Same leader cannot reset spent resources');
});
test('unsupported or custom Roll20 turn-order entry does not trigger a turn',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.context.window.d20=undefined;
  let order='[{"id":"-1"}]';
  h.context.window.Campaign={get(){return order;}};
  h.api.r3TurnLoad();
  assert.equal(t.lastTop,null);
  order=JSON.stringify([{id:'token-brom'}]);
  h.api.r3TurnObserveInitiative();
  assert.equal(t.phase,'unknown');
  order='not valid JSON';
  h.api.r3TurnObserveInitiative();
  assert.equal(t.phase,'unknown');
});
test('only exact official casting-time labels assign action costs, never names',()=>{
  const h=rig(),cost=h.api.r3TurnCost;
  for(const [castingTime,expected] of [
    ['1 Action','Action'],['Bonus Action','Bonus action'],
    ['1 Reaction','Reaction'],['1 minute','1 minute']
  ])assert.equal(cost({_hudSource:'Spell',castingTime}),expected);
  assert.equal(cost({_hudSource:'Spell',name:'Bonus action magic',castingTime:'see description'}),'');
  assert.equal(cost({_hudSource:'Feature',actionType:'1 Bonus Action'}),'Bonus action');
  assert.equal(cost({_hudSource:'Attack',name:'Dagger'}),'');
});
test('native click acknowledgement is not enough to spend action automatically',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnHint('Roll20 attack button clicked; chat roll unverified.');
  assert.equal(t.actionSpent,0);
  assert.match(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/chat roll unverified/);
  h.api.r3TurnClick({dataset:{turnAction:'action'}});
  assert.equal(t.actionSpent,1);
  assert.equal(h.context.R3_HUD.used.action,true);
  assert.equal(h.api.r3TurnClick({dataset:{turnAction:'fake-action'}}),false);
});

test('non-popup advanced options remain tucked away until requested',()=>{
  const h=rig(),t=h.api.R3_TURN;
  let markup=h.api.r3TurnMarkup(h.context.R3_UI.snapshot);
  assert.match(markup,/More options/);
  assert.doesNotMatch(markup,/Mark bonus attack/);
  h.api.r3TurnApply('advanced');
  assert.equal(t.advanced,true);
  markup=h.api.r3TurnMarkup(h.context.R3_UI.snapshot);
  assert.match(markup,/Mark bonus attack/);
  assert.match(markup,/Attack allowance/);
  h.api.r3TurnApply('bonus-attack');
  assert.equal(t.bonusSpent,true);
  assert.equal(t.bonusAttackUsed,1);
  assert.equal(t.actionSpent,0,'offhand/bonus attack never spends main action');
  assert.equal(t.attackUsed,0,'bonus attack is separate from main Attack action allowance');
  h.api.r3TurnApply('bonus-attack-undo');
  assert.equal(t.bonusAttackUsed,0);
  // A count correction must not automatically restore a potentially spent
  // bonus action; user can manually re-enable it as a separate state.
  assert.equal(t.bonusSpent,true);
  h.api.r3TurnApply('advanced');
  assert.equal(t.advanced,false);
  assert.doesNotMatch(h.api.r3TurnMarkup(h.context.R3_UI.snapshot),/Mark bonus attack/);
});
test('undoing attack count preserves action spending pending explicit correction',()=>{
  const h=rig(),t=h.api.R3_TURN;
  h.api.r3TurnApply('attack-used');
  h.api.r3TurnApply('attack-undo');
  assert.equal(t.attackUsed,0);
  assert.equal(t.actionSpent,1,'could have been used on another action');
  h.api.r3TurnApply('action');
  assert.equal(t.actionSpent,0,'main action can still be restored manually');
});
