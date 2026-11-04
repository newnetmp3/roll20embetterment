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

test('speeds: walk from the sheet; Classic speed text lists every mode', () => {
  const pc = load(fixture('pc-sheet.html'), SHEET);
  assert.deepEqual({ ...pc.C.parseSheet(pc.document).stats.speeds }, { walk: 30 });
  const { C } = load('<html><body></body></html>', ['src/shared/wire.js', 'src/editor/classic.js']);
  assert.deepEqual({ ...C.speedsFrom('30 ft., fly 60 ft. (hover), swim 30 ft.') }, { walk: 30, fly: 60, swim: 30 });
  assert.deepEqual({ ...C.speedsFrom('') }, {});
});

test('Classic Long Rest: HP, temp HP, death saves, spell slots, half the hit dice', () => {
  const html = `<html><body>
    <input name="attr_hp" value="3"><input name="attr_hp_max" value="40"><input name="attr_hp_temp" value="5">
    <input type="checkbox" name="attr_deathsave_fail1" checked><input type="checkbox" name="attr_deathsave_succ1">
    <input name="attr_lvl1_slots_expended" value="0"><input name="attr_lvl1_slots_total" value="4">
    <input name="attr_hit_dice" value="1"><input name="attr_hit_dice_max" value="6">
    <button type="roll" name="roll_death_save">Death save</button>
  </body></html>`;
  const { C, document } = load(html, ['src/shared/wire.js', 'src/editor/classic.js']);
  document.querySelector('[name="attr_deathsave_fail1"]').checked = true; // the test DOM doesn't map the attribute
  const snap = C.classic.parse(document, 'Salven');
  assert.equal(snap.type, 'pc');
  assert.deepEqual({ ...snap.stats.deathSaves }, { ok: 0, fail: 1 });
  assert.equal(snap.deathSave.ref, 'btn:0:roll_death_save');
  const rest = snap.rests.find((r) => r.op === 'longrest');
  const res = C.classic.perform(document, rest.ref, rest.op);
  assert.equal(res.ok, true, res.msg);
  const v = (n) => document.querySelector('[name="attr_' + n + '"]');
  assert.deepEqual([v('hp').value, v('hp_temp').value, v('lvl1_slots_expended').value, v('hit_dice').value, v('deathsave_fail1').checked], ['40', '0', '4', '4', false]);
});
