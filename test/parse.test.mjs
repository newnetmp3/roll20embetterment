import test from 'node:test';
import assert from 'node:assert/strict';
import { load, fixture, SHEET, plain } from './helpers.mjs';

test('PC sheet: identity, stats and roll settings', () => {
  const { C, document } = load(fixture('pc-sheet.html'), SHEET);
  const s = plain(C.parseSheet(document));
  assert.equal(s.type, 'pc');
  assert.equal(s.name, 'Test Hero');
  assert.deepEqual(
    { hp: s.stats.hp, maxHp: s.stats.maxHp, tempHp: s.stats.tempHp, ac: s.stats.ac, speed: s.stats.speed, level: s.stats.level },
    { hp: 30, maxHp: 44, tempHp: 0, ac: 16, speed: 30, level: 5 });
  assert.equal(s.stats.initiative, '+2');
  assert.deepEqual(s.privacy, { value: 'Public', options: ['Public', 'Whisper'] });
  assert.equal(s.mode.value, 'Automatic');
});

test('PC sheet: reads the desktop layout only, across all tabs', () => {
  const { C, document } = load(fixture('pc-sheet.html'), SHEET);
  const s = plain(C.parseSheet(document));
  // The mobile copy says +9; the desktop copy (the one we read) says +6.
  assert.deepEqual(s.attacks.map((a) => [a.name, a.hit, a.section]),
    [['Dagger', '+6 Attack', 'Attacks'], ['Dagger (Thrown)', '+6 Attack', 'Attacks'], ['Longbow', '+5 Attack', 'Attacks']]);
  assert.equal(s.attacks[0].dmg[0].type, 'piercing');
  assert.equal(s.attacks[1].range, '20/60 ft.');
  // Hidden tabs (display:none) are still read.
  assert.deepEqual(s.spells.map((x) => [x.name, x.level, x.prepared]), [['Magic Missile', '1ST', true]]);
  assert.deepEqual(s.checks.map((c) => [c.name, c.bonus]), [['Stealth', '+5'], ["Thieves' Tools", '']]);
});

test('PC sheet: actions, counters, features and items', () => {
  const { C, document } = load(fixture('pc-sheet.html'), SHEET);
  const s = plain(C.parseSheet(document));
  assert.deepEqual(s.actions.map((a) => [a.name, a.section, a.roll]),
    [["Use Healer's Kit", 'Actions', ''], ['Drink Potion of Healing', 'Actions', '2d4+2'], ['Second Wind', 'Bonus Actions', '1d10+5']]);
  assert.deepEqual(s.actions[0].res, [{ i: 0, name: "Healer's Kit", kind: 'count', cur: 7, max: 10 }]);
  assert.deepEqual(s.actions[2].res, [{ i: 0, name: 'Second Wind', kind: 'range', cur: 2, max: 2 }]);
  assert.deepEqual(s.features.map((f) => [f.name, f.section, f.source, f.timing]),
    [['Second Wind', 'Class Features', 'Fighter', 'Bonus Action'], ['Extra Attack', 'Class Features', 'Fighter', '']]);
  assert.deepEqual(s.items.map((i) => [i.name, i.section, i.qty, i.equipped]),
    [['Dagger', 'Equipment', 2, true], ['Potion of Healing', 'Equipment', 3, null], ["Healer's Kit", 'Equipment', 1, null]]);
  assert.deepEqual(s.abilities, [{ ref: 'ability:0:STR', name: 'STR', score: 16, mod: '+3', save: '+6' }]);
  assert.deepEqual(s.rests.map((r) => r.name), ['Short Rest', 'Long Rest']);
  assert.equal(s.hitDice[0].label, 'D10 (Fighter)');
});

test('NPC sheet: one layout, sections from headings', () => {
  const { C, document } = load(fixture('npc-sheet.html'), SHEET);
  const s = plain(C.parseSheet(document));
  assert.equal(s.type, 'npc');
  assert.equal(s.name, 'Cave Bear');
  assert.deepEqual({ maxHp: s.stats.maxHp, ac: s.stats.ac, speed: s.stats.speed, cr: s.stats.cr, initiative: s.stats.initiative },
    { maxHp: 42, ac: 12, speed: 40, cr: '2', initiative: '+1' });
  assert.deepEqual(s.attacks.map((a) => [a.name, a.section, a.hit]), [['Bite', 'Actions', '+7 Attack'], ['Claw', 'Bonus Actions', '+7 Attack']]);
  assert.deepEqual(s.features.map((f) => [f.name, f.desc]), [['Keen Smell', 'Smells prey from far away.']]);
  assert.deepEqual(s.checks.map((c) => [c.name, c.bonus]), [['Perception', '+3']]);
  assert.equal(s.initiative.ref, 'initiative:0:Initiative');
});

test('No sheet in the page: nothing parsed', () => {
  const { C, document } = load('<html><body><p>loading</p></body></html>', SHEET);
  assert.equal(C.parseSheet(document), null);
});
