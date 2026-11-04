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
  assert.deepEqual(plain(attacks[0].children[1].run), { ref: 'attack:0:Dagger (Thrown)', op: 'hit', say: 'Dagger (Thrown) attack' });
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
  assert.deepEqual(atk.run, { ref: 'attack:0:Cure Wounds Healing', op: 'dmg', arg: 0, say: 'Cure Wounds healing' });
  assert.equal(atk.controls[0].title, 'Healing');
});

test('movement menu: moved vs speed, dash doubles, over turns red', () => {
  const m = model();
  const base = plain(m.movementMenu({ feet: 20, speed: 30, units: 'ft', dash: false, inOrder: true }));
  assert.equal(base.key, 'move');
  assert.equal(base.badge, '20');
  assert.equal(base.over, false);
  assert.deepEqual(base.items[0].meter, { kind: 'move', cur: 20, max: 30, units: 'ft', left: 10, dash: false });
  const dash = plain(m.movementMenu({ feet: 45, speed: 30, units: 'ft', dash: true, inOrder: true }));
  assert.equal(dash.items[0].meter.max, 60);
  assert.equal(dash.items[1].checked, true);
  const over = plain(m.movementMenu({ feet: 35, speed: 30, units: 'ft', dash: false, inOrder: false }));
  assert.equal(over.over, true);
  assert.equal(over.items[0].meter.left, -5);
  assert.equal(over.items[2].hint, 'not in turn order');
  const unknown = plain(m.movementMenu({ feet: 10, speed: null, units: 'm', dash: false, inOrder: false }));
  assert.equal(unknown.items[0].meter.max, null);
});
