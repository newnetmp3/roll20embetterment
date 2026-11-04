import test from 'node:test';
import assert from 'node:assert/strict';
import { load, fixture, SHEET, recordPresses, plain } from './helpers.mjs';

function sheet(name = 'pc-sheet.html') {
  const { C, document } = load(fixture(name), SHEET);
  return { C, document, presses: recordPresses(document) };
}

test('attack and damage press the matching row\'s own buttons', async () => {
  const { C, document, presses } = sheet();
  assert.equal((await C.perform(document, 'attack:0:Dagger (Thrown)', 'hit')).ok, true);
  assert.equal((await C.perform(document, 'attack:0:Longbow', 'dmg', 0)).ok, true);
  assert.deepEqual(presses, ['+6 Attack', '1d8+2']);
});

test('the hidden mobile copy is never pressed', async () => {
  const { C, document, presses } = sheet();
  await C.perform(document, 'attack:0:Dagger', 'hit');
  assert.deepEqual(presses, ['+6 Attack']);
});

test('checks, saves, skills, tools, initiative and rests', async () => {
  const { C, document, presses } = sheet();
  await C.perform(document, 'ability:0:STR', 'check');
  await C.perform(document, 'ability:0:STR', 'save');
  await C.perform(document, 'check:0:Stealth', 'check');
  await C.perform(document, "check:0:Thieves' Tools", 'check');
  await C.perform(document, 'initiative:0:Initiative', 'press');
  await C.perform(document, 'rest:0:Long Rest', 'press');
  assert.deepEqual(presses, ['+3', '+6', 'Roll a Stealth check', "Roll a Thieves' Tools check", 'Initiative +2', 'Long Rest']);
});

test('counters and quantities use the sheet\'s +/- controls', async () => {
  const { C, document, presses } = sheet();
  const r = await C.perform(document, "action:0:Use Healer's Kit", 'res', { i: 0, delta: -1 });
  // The static fixture has no Roll20 code to update the value, so the
  // companion reports that honestly instead of claiming success.
  assert.equal(r.ok, false);
  await C.perform(document, 'item:0:Potion of Healing', 'qty', -1);
  await C.perform(document, 'item:0:Dagger', 'equip');
  assert.deepEqual(presses, ['poly-button view-resource__decrement poly-button--resources', 'poly-incrementer item-item__quantity-incrementer', 'utility-switch item-item__equip-switch']);
});

test('use = roll, then spend a use', async () => {
  const { C, document, presses } = sheet();
  const r = plain(await C.perform(document, 'feature:0:Second Wind', 'use', null, { spend: true }));
  // The feature row has no roll; its action twin does.
  assert.equal(presses[0], '1d10+5');
  assert.match(r.msg, /Rolled/);
  const noSpend = sheet();
  await noSpend.C.perform(noSpend.document, 'feature:0:Extra Attack', 'use', null, { spend: true });
  assert.equal(noSpend.presses.length, 1, 'a feature without a roll is posted to chat once');
});

test('roll visibility and roll mode press the sheet radios', async () => {
  const { C, document, presses } = sheet();
  assert.equal((await C.perform(document, null, 'privacy', 'Whisper')).ok, true);
  assert.equal((await C.perform(document, null, 'mode', 'Advantage')).ok, true);
  assert.equal((await C.perform(document, null, 'mode', 'Sideways')).ok, false);
  assert.equal(presses.length, 2);
});

test('unknown rows fail without pressing anything', async () => {
  const { C, document, presses } = sheet();
  const r = await C.perform(document, 'attack:0:Greatsword', 'hit');
  assert.equal(r.ok, false);
  assert.match(r.msg, /Greatsword/);
  assert.deepEqual(presses, []);
});

test('NPC attacks, skills and features', async () => {
  const { C, document, presses } = sheet('npc-sheet.html');
  await C.perform(document, 'attack:0:Claw', 'hit');
  await C.perform(document, 'npcskill:0:Perception', 'press');
  await C.perform(document, 'npcfeature:0:Keen Smell', 'chat');
  assert.equal(presses.length, 3);
  assert.equal(presses[0], '+7 Attack');
});

test('damage lands in full even when the sheet\'s amount box sticks at 1', async () => {
  const { C, document } = sheet();
  const root = C.scopes(document).list[0];
  const hp = root.querySelector('input[title="Current Hitpoints"]');
  const box = root.querySelector('input[title="Heal or Damage"]');
  hp.setAttribute('aria-valuenow', '20'); hp.value = '20';
  // Simulate the live sheet: typed amounts are ignored, each press removes 1.
  box.addEventListener('input', () => { box.value = '1'; box.setAttribute('aria-valuenow', '1'); });
  box.value = '1'; box.setAttribute('aria-valuenow', '1');
  root.querySelector('.utility-button--harm').addEventListener('click', () => {
    const v = Number(hp.value) - 1; hp.value = String(v); hp.setAttribute('aria-valuenow', String(v));
  });
  const r = await C.perform(document, null, 'damage', 2);
  assert.equal(r.ok, true, r.msg);
  assert.equal(hp.value, '18');
});
