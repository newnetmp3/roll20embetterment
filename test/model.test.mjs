import test from 'node:test';
import assert from 'node:assert/strict';
import { load, fixture, SHEET, MODEL, plain } from './helpers.mjs';

const snapOf = (name) => plain(load(fixture(name), SHEET).C.parseSheet(load(fixture(name), SHEET).document));
const model = () => load('<html></html>', MODEL).C;
const cat = (cats, key) => cats.find((c) => c.key === key);

test('weapon names group into variants', () => {
  const C = model();
  assert.deepEqual(plain(C.weaponOf('Dagger (Off-Hand)')), { base: 'Dagger', variant: 'Off-Hand' });
  assert.deepEqual(plain(C.weaponOf('Throw Spear')), { base: 'Spear', variant: 'Thrown' });
  assert.deepEqual(plain(C.weaponOf('Longsword')), { base: 'Longsword', variant: 'Standard' });
});

test('Attacks menu: weapon -> attack, with attack/damage/chat buttons', () => {
  const cats = plain(model().buildMenus(snapOf('pc-sheet.html'), {}));
  const attacks = cat(cats, 'attacks').items;
  assert.deepEqual(attacks.map((n) => n.label), ['Dagger', 'Longbow']);
  assert.deepEqual(attacks[0].children.map((n) => n.label), ['Standard', 'Thrown']);
  assert.deepEqual(plain(attacks[0].children[1].run), { ref: 'attack:0:Dagger (Thrown)', op: 'hit', say: 'Dagger (Thrown) attack', econ: 'action' });
  assert.deepEqual(attacks[1].controls.map((c) => c.label), ['+5', '1d8+2', '💬']);
  assert.equal(attacks[1].children, undefined, 'a single attack is clickable directly');
});

test('Actions grouped by Actions / Bonus Actions with counters', () => {
  const actions = cat(plain(model().buildMenus(snapOf('pc-sheet.html'), {})), 'actions').items;
  assert.deepEqual(actions.map((s) => s.label), ['Actions', 'Bonus Actions']);
  const kit = actions[0].children[0];
  assert.equal(kit.hint, '7/10');
  assert.equal(kit.run.op, 'use');
});

test('Inventory: consumables first, linked to their actions', () => {
  const inv = cat(plain(model().buildMenus(snapOf('pc-sheet.html'), {})), 'items').items;
  assert.equal(inv[0].label, 'Consumables');
  assert.deepEqual(inv[0].children.map((n) => n.label), ['Potion of Healing', "Healer's Kit"]);
  const potion = inv[0].children[0].children;
  assert.equal(potion[0].label, 'Use: Drink Potion of Healing');
  assert.deepEqual(potion.map((n) => n.key), ['use:action:0:Drink Potion of Healing', 'qty', 'chat']);
});

test('Resources: each counter once; item quantities without a counter', () => {
  const res = cat(plain(model().buildMenus(snapOf('pc-sheet.html'), {})), 'resources').items;
  assert.deepEqual(res.map((r) => [r.label, r.hint]), [['Second Wind', '2/2'], ["Healer's Kit", '7/10'], ['Potion of Healing', '×3']]);
});

test('NPC menus', () => {
  const cats = plain(model().buildMenus(snapOf('npc-sheet.html'), {}));
  assert.deepEqual(cats.map((c) => c.key), ['hp', 'attacks', 'actions', 'features', 'checks', 'settings']);
  assert.deepEqual(cat(cats, 'actions').items.map((s) => s.label), ['Actions', 'Bonus Actions']);
  assert.match(cat(cats, 'hp').items[0].label, /HP 42/);
});

test('Roll settings reflect the sheet and companion prefs', () => {
  const items = cat(model().buildMenus(snapOf('pc-sheet.html'), { autoHide: true, spend: false }), 'settings').items;
  const byKey = Object.fromEntries(items.map((n) => [n.key, n]));
  assert.equal(byKey['privacy:Public'].checked, true);
  assert.deepEqual(plain(byKey['mode:Advantage'].run), { op: 'mode', arg: 'Advantage', say: 'Roll mode: Advantage' });
  assert.equal(byKey['pref:autoHide'].checked, true);
  assert.equal(byKey['pref:spend'].checked, false);
});

test('no snapshot: only the companion settings', () => {
  const cats = plain(model().buildMenus(null, { follow: true }));
  assert.deepEqual(cats.map((c) => c.key), ['settings']);
  const keys = cats[0].items.map((i) => i.key);
  assert.ok(keys.includes('pref:follow') && keys.includes('diag'));
  assert.ok(!keys.some((k) => k.startsWith('privacy:') || k.startsWith('mode:')));
});

test('healing rows drop the echoed "Healing" and roll healing', () => {
  const m = model();
  assert.equal(m.tidyName('Cure Wounds Healing'), 'Cure Wounds');
  assert.equal(m.tidyName('Mass Healing Word Healing'), 'Mass Healing Word');
  assert.equal(m.tidyName('Mass Healing'), 'Mass Healing');
  assert.equal(m.tidyName('Healing'), 'Healing');
  const snap = { type: 'pc', stats: {}, attacks: [{ ref: 'attack:0:Cure Wounds Healing', name: 'Cure Wounds Healing', range: 'Touch', hit: '', dmg: [{ text: '2d8+3', type: 'healing' }] }] };
  const atk = plain(m.buildMenus(snap)).find((c) => c.key === 'attacks').items[0];
  assert.equal(atk.label, 'Cure Wounds');
  assert.deepEqual(atk.run, { ref: 'attack:0:Cure Wounds Healing', op: 'dmg', arg: 0, say: 'Cure Wounds healing', econ: 'action' });
  assert.equal(atk.controls[0].title, 'Healing');
});

test('turn menu: moved vs speed, dash doubles, over turns red', () => {
  const m = model();
  const mv = (o) => ({ feet: 20, speed: 30, speeds: { walk: 30 }, mode: 'walk', units: 'ft', dash: false, difficult: false, ...o });
  const at = (menu, key) => menu.items.find((n) => n.key === key);
  const base = plain(m.turnMenu({ used: {}, inOrder: true, move: mv() }));
  assert.equal(base.key, 'turn');
  assert.equal(base.badge, '20');
  assert.equal(base.over, false);
  assert.deepEqual(at(base, 'mv').meter, { kind: 'move', cur: 20, max: 30, units: 'ft', left: 10, dash: false, difficult: false, mode: '' });
  const dash = plain(m.turnMenu({ used: {}, inOrder: true, move: mv({ feet: 45, dash: true }) }));
  assert.equal(at(dash, 'mv').meter.max, 60);
  assert.equal(at(dash, 'mv:dash').checked, true);
  const over = plain(m.turnMenu({ used: {}, inOrder: false, move: mv({ feet: 35 }) }));
  assert.equal(over.over, true);
  assert.equal(at(over, 'mv').meter.left, -5);
  assert.equal(at(over, 'turn:reset').hint, 'not in turn order');
  const unknown = plain(m.turnMenu({ used: {}, inOrder: false, move: mv({ feet: 10, speed: null, units: 'm' }) }));
  assert.equal(at(unknown, 'mv').meter.max, null);
});

test('turn menu: action pips, speed choices, no token', () => {
  const m = model();
  const t = plain(m.turnMenu({ used: { action: true }, inOrder: true, move: { feet: 0, speed: 60, speeds: { walk: 30, fly: 60 }, mode: 'fly', units: 'ft' } }));
  assert.deepEqual(t.items[0].econ.map((p) => p.used), [true, false, false]);
  assert.equal(t.items.find((n) => n.key === 'mv:mode:fly').checked, true);
  assert.equal(t.items.find((n) => n.key === 'mv').meter.mode, 'Fly');
  const none = plain(m.turnMenu({ used: { bonus: true }, inOrder: false, move: null }));
  assert.equal(none.badge, '2'); // two of three still available
  assert.deepEqual(none.items.map((n) => n.key), ['econ', 'turn:reset']);
});

test('actions are tagged with the part of the turn they use', () => {
  const m = model();
  assert.equal(m.econOf('Bonus Actions'), 'bonus');
  assert.equal(m.econOf('Reactions'), 'reaction');
  assert.equal(m.econOf('Actions'), 'action');
  assert.equal(m.econOf('Legendary Actions'), '');
  assert.equal(m.econOf('1 bonus action'), 'bonus');
  assert.equal(m.econOf('Other'), null);
  const snap = {
    type: 'pc', name: 'T', stats: {},
    attacks: [{ ref: 'a', name: 'Dagger', hit: '+5 Attack', dmg: [{ text: '1d4', type: '' }], range: '' }],
    actions: [{ ref: 'b', name: 'Cunning Action', section: 'Bonus Actions', res: [] }],
    spells: [{ ref: 's', name: 'Bless', level: '1ST', tags: ['C'], dmg: [], hit: '', range: '' }, { ref: 'h', name: 'Healing Word', level: '1ST', time: '1 bonus action', tags: [], dmg: [], hit: '', range: '' }],
  };
  const cats = plain(m.buildMenus(snap));
  const find = (key) => { let hit = null; const walk = (ns) => ns.forEach((n) => { if (n.key === key) hit = hit || n; if (n.children) walk(n.children); }); cats.forEach((c) => walk(c.items)); return hit; };
  assert.equal(find('a').run.econ, 'action');
  assert.equal(find('a').controls[1].run.econ, undefined); // damage after the attack roll uses nothing more
  assert.equal(find('b').run.econ, 'bonus');
  assert.equal(find('s').run.econ, 'action');
  assert.equal(find('s').run.conc, 'Bless');
  assert.equal(find('h').run.econ, 'bonus');
});

test('concentration and death saves in the hit point menu', () => {
  const m = model();
  assert.equal(m.concentrationDC(8), 10);
  assert.equal(m.concentrationDC(27), 13);
  assert.equal(m.concentrationDC(90), 30);
  const snap = { type: 'pc', name: 'T', stats: { hp: 0, maxHp: 20, deathSaves: { ok: 1, fail: 2 } }, abilities: [{ ref: 'ability:0:CON', name: 'CON' }] };
  const hp = plain(m.buildMenus(snap, {}, { conc: { spell: 'Bless', dc: 12 } })).find((c) => c.key === 'hp').items;
  const death = hp.find((n) => n.key === 'death');
  assert.equal(death.hint, '✓1 ✗2');
  assert.equal(death.run.op, 'chat-roll');
  assert.equal(hp.find((n) => n.key === 'conc').label, 'Concentrating: Bless');
  const save = hp.find((n) => n.key === 'conc:save');
  assert.equal(save.hint, 'DC 12');
  assert.deepEqual([save.run.ref, save.run.op, save.run.clearsDc, save.run.dc], ['ability:0:CON', 'save', true, 12]);
  const healthy = plain(m.buildMenus({ ...snap, stats: { hp: 5, maxHp: 20 } })).find((c) => c.key === 'hp').items;
  assert.equal(healthy.some((n) => n.key === 'death'), false);
  assert.equal(healthy.find((n) => n.key === 'conc').checked, false);
});
