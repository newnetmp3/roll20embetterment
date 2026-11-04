// The Foundry adapter against a stand-in dnd5e actor: what it reads, and
// which dnd5e methods each bar action calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const plain = (x) => JSON.parse(JSON.stringify(x));

function setup() {
  const ctx = vm.createContext({
    console,
    CONFIG: {
      DND5E: {
        skills: { ste: { label: 'Stealth' }, prc: { label: 'Perception' } },
        spellcasting: { spell: { prepares: true }, innate: {} },
        activityActivationTypes: { action: { label: 'Action' }, bonus: { label: 'Bonus Action' }, reaction: { label: 'Reaction' } },
      },
      specialStatusEffects: { CONCENTRATING: 'concentrating' },
    },
  });
  for (const f of ['src/editor/model.js', 'foundry/scripts/adapter.js']) vm.runInContext(readFileSync(root + f, 'utf8'), ctx, { filename: f });
  return ctx.R20C;
}

function mockActor() {
  const calls = [];
  const coll = (arr) => { const m = new Map(arr.map((x) => [x.id, x])); return m; };
  const activity = (id, type, o = {}) => ({
    id, type, name: o.name || '', activation: { type: o.act || 'action' }, labels: o.labels || {},
    rollAttack: async () => { calls.push(['rollAttack', id]); return [{}]; },
    rollDamage: async () => { calls.push(['rollDamage', id]); return [{}]; },
    use: async () => { calls.push(['use', id]); return {}; },
  });
  const item = (id, type, name, system, acts = []) => ({
    id, type, name, system: { ...system, activities: coll(acts) }, labels: {},
    use: async () => { calls.push(['item.use', id]); return {}; },
    displayCard: async () => { calls.push(['displayCard', id]); return {}; },
    update: async (u) => { calls.push(['update', id, u]); },
  });
  const items = coll([
    item('sw', 'weapon', 'Longsword', { quantity: 1, equipped: true, weight: { value: 3, units: 'lb' } },
      [activity('a1', 'attack', { labels: { toHit: '+5', damage: [{ formula: '1d8 + 3', damageType: 'slashing' }] } })]),
    item('bl', 'spell', 'Bless', { level: 1, method: 'spell', prepared: 1, properties: new Set(['concentration']), activation: { type: 'action' } }, [activity('b1', 'utility')]),
    item('sw2', 'feat', 'Second Wind', { type: { value: 'class' }, uses: { max: 2, value: 1, spent: 1 } }, [activity('h1', 'heal', { act: 'bonus' })]),
    item('pot', 'consumable', 'Potion of Healing', { quantity: 2 }, [activity('p1', 'heal', { act: 'bonus' })]),
    item('ftr', 'class', 'Fighter', { hd: { denomination: 'd10', value: 3 } }),
  ]);
  const actor = {
    uuid: 'Actor.abc', type: 'character', name: 'Nier', items,
    system: {
      attributes: {
        hp: { value: 0, max: 20, temp: 0 }, ac: { value: 16 }, init: { total: 2 },
        movement: { walk: 30, speeds: { walk: 30, fly: 60 }, units: 'ft' }, death: { success: 1, failure: 2 },
      },
      abilities: { str: { value: 16, mod: 3, save: { value: 5 } }, con: { value: 14, mod: 2, save: { value: 2 } } },
      skills: { ste: { ability: 'dex', total: 4, value: 1 } },
    },
    concentration: { effects: new Set(['e']), items: new Set([{ name: 'Bless' }]) },
  };
  for (const m of ['applyDamage', 'update', 'rollSavingThrow', 'rollAbilityCheck', 'rollSkill', 'rollDeathSave', 'rollHitDie', 'shortRest', 'longRest', 'rollConcentration', 'endConcentration', 'toggleStatusEffect']) {
    actor[m] = async (...args) => { calls.push([m, ...plain(args)]); return [{}]; };
  }
  return { actor, calls };
}

test('Foundry: a dnd5e character becomes the same menus as a Roll20 sheet', () => {
  const C = setup();
  const { actor } = mockActor();
  const snap = C.foundrySnap(actor);
  assert.deepEqual(plain(snap.errors), []);
  assert.deepEqual(plain(snap.stats.speeds), { walk: 30, fly: 60 });
  assert.equal(snap.attacks[0].hit, '+5 Attack');
  assert.equal(snap.attacks[0].dmg[0].text, '1d8 + 3');
  assert.deepEqual(plain(snap.spells[0].tags), ['C']);
  assert.equal(snap.actions[0].section, 'Bonus Actions');
  assert.equal(snap.items.find((i) => i.name === 'Potion of Healing').usable, true);
  assert.equal(snap.hitDice[0].label, 'd10 (Fighter) · 3 left');
  const cats = plain(C.buildMenus(snap, {}, { foundry: true, conc: C.foundryConcentration(actor, 13) }));
  assert.deepEqual(cats.map((c) => c.key), ['hp', 'attacks', 'actions', 'spells', 'items', 'features', 'resources', 'checks', 'settings']);
  const hp = cats[0].items;
  assert.ok(hp.some((n) => n.key === 'dmg'), 'damage input');
  assert.equal(hp.find((n) => n.key === 'death').run.ref, 'death');
  assert.equal(hp.find((n) => n.key === 'conc').label, 'Concentrating: Bless');
  assert.deepEqual([hp.find((n) => n.key === 'conc:save').run.clearsDc, hp.find((n) => n.key === 'conc:save').run.dc], [true, 13]);
  // Roll20-only settings are left out.
  assert.equal(cats.at(-1).items.some((n) => n.key === 'pref:background'), false);
  // Movement without a manual difficult-terrain switch: Foundry measures terrain.
  const turn = plain(C.turnMenu({ used: {}, inOrder: true, move: { feet: 10, speed: 30, speeds: snap.stats.speeds, mode: 'walk', units: 'ft', difficult: null } }));
  assert.equal(turn.items.some((n) => n.key === 'mv:difficult'), false);
  assert.ok(turn.items.some((n) => n.key === 'mv:mode:fly'));
});

test('Foundry: bar actions call the dnd5e API', async () => {
  const C = setup();
  const { actor, calls } = mockActor();
  const go = (act) => C.foundryPerform(actor, act);
  assert.equal((await go({ ref: 'act:sw:a1', op: 'hit' })).ok, true);
  await go({ ref: 'act:sw:a1', op: 'dmg', arg: 0 });
  await go({ ref: 'item:bl', op: 'chat' });
  await go({ ref: 'item:sw2', op: 'res', arg: { i: 0, delta: -1 } });
  await go({ ref: 'item:pot', op: 'qty', arg: -1 });
  await go({ op: 'damage', arg: 7 });
  await go({ op: 'heal', arg: 3 });
  await go({ ref: 'ability:con', op: 'save' });
  await go({ ref: 'ability:con', op: 'save', clearsDc: true, dc: 13 });
  await go({ ref: 'skill:ste', op: 'check' });
  await go({ ref: 'death', op: 'press' });
  await go({ ref: 'hd:d10', op: 'press' });
  await go({ ref: 'rest:long', op: 'press' });
  assert.deepEqual(plain(calls), [
    ['rollAttack', 'a1'], ['rollDamage', 'a1'], ['item.use', 'bl'],
    ['update', 'sw2', { 'system.uses.spent': 2 }], ['update', 'pot', { 'system.quantity': 1 }],
    ['applyDamage', 7], ['applyDamage', -3],
    ['rollSavingThrow', { ability: 'con' }], ['rollConcentration', { target: 13 }], ['rollSkill', { skill: 'ste' }],
    ['rollDeathSave'], ['rollHitDie', { denomination: 'd10' }], ['longRest'],
  ]);
  assert.equal((await go({ ref: 'item:gone', op: 'use' })).ok, false);
});

test('Foundry: module.json download link names its own version', () => {
  const mod = JSON.parse(readFileSync(root + 'foundry/module.json', 'utf8'));
  assert.ok(mod.download.endsWith('/foundryembetterment-v' + mod.version + '/foundryembetterment.zip'), mod.download);
  assert.deepEqual(mod.scripts, ['scripts/model.js', 'scripts/ui.js', 'scripts/adapter.js', 'scripts/main.js']);
});
