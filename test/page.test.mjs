// selection.js (runs in Roll20's page) against a stand-in Roll20 Campaign:
// descriptions by kind, spell slots, token markers, end turn, and who may
// change what.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const root = fileURLToPath(new URL('..', import.meta.url));
const plain = (x) => JSON.parse(JSON.stringify(x));
const ROW = (n) => '-Mabcdefghijklmnopq' + n;

function page({ gm = false, player = 'P1' } = {}) {
  // Its own window object each time (linkedom's are shared between pages).
  const dom = parseHTML('<html><body></body></html>');
  const win = { document: dom.document, CustomEvent: dom.CustomEvent };
  const saved = [];
  const model = (o) => { const m = { ...o, get: (k) => m[k], save(u) { Object.assign(m, u); saved.push([o.id || o.name, u]); } }; return m; };
  const coll = (arr) => ({ models: arr, get: (id) => arr.find((x) => x.id === id) || null, length: arr.length });
  const attr = (name, current) => model({ name, current });
  const store = { integrants: { integrants: {
    a: { type: 'Item', name: 'Shield', description: 'A wooden shield. +2 AC.' },
    b: { type: 'Spell', name: 'Shield', description: 'An invisible barrier of force. +5 AC.', level: 1, school: 'Abjuration', castingTime: '1 reaction' },
    c: { type: 'Spell Slot', name: 'Cleric Level 1 Spell Slot 2', valueFormula: { flatValue: 2 } },
    d: { type: 'Spell Slot', name: 'Wizard Level 1 Spell Slot 2', valueFormula: { flatValue: 2 } },
    e: { type: 'Pact Slot', name: 'Warlock Level 2 Pact Slot', valueFormula: { flatValue: 2 } },
  } }, spellSlots: { currentByLevel: { FIRST: 3 }, currentPactByLevel: { SECOND: 1 } } };
  const chars = [
    model({ id: 'C1', controlledby: 'P1', attribs: coll([attr('store', JSON.stringify(store))]) }),
    model({ id: 'C2', controlledby: 'P2', attribs: coll([attr('lvl1_slots_total', '4'), attr('lvl1_slots_expended', '3'),
      attr(`repeating_inventory_${ROW(1)}_itemname`, 'Shield'), attr(`repeating_inventory_${ROW(1)}_itemcontent`, 'Item text.'),
      attr(`repeating_spell-1_${ROW(2)}_spellname`, 'Shield'), attr(`repeating_spell-1_${ROW(2)}_spelldescription`, 'Spell text.')]) }),
  ];
  const tokens = [model({ id: 'T1', layer: 'objects', left: 0, top: 0, represents: 'C1', statusmarkers: '' }),
    model({ id: 'T2', layer: 'objects', left: 0, top: 0, represents: 'C2', statusmarkers: '' })];
  const pg = model({ snapping_increment: 1, scale_number: 5, scale_units: 'ft' });
  pg.thegraphics = coll(tokens);
  const campaign = model({ turnorder: JSON.stringify([{ id: 'T1', pr: 15 }, { id: '-1', pr: 1, custom: 'Round', formula: '+1' }, { id: 'T2', pr: 10 }]), token_markers: '[]' });
  campaign.characters = coll(chars);
  campaign.activePage = () => pg;
  win.Campaign = campaign;
  win.currentPlayer = { id: player };
  win.is_gm = gm;
  win.top = win;
  const ctx = vm.createContext({ window: win, document: win.document, console, setTimeout, clearTimeout, setInterval: () => 0, CustomEvent: win.CustomEvent, JSON });
  vm.runInContext(readFileSync(root + 'src/editor/selection.js', 'utf8'), ctx, { filename: 'selection.js' });
  const call = (fn, args) => {
    let out;
    const on = (e) => { out = JSON.parse(e.detail).result; };
    win.document.addEventListener('r20c-call-reply', on);
    win.document.dispatchEvent(new win.CustomEvent('r20c-call', { detail: JSON.stringify({ fn, req: 1, args }) }));
    win.document.removeEventListener('r20c-call-reply', on);
    return out;
  };
  return { call, saved, campaign };
}

test('page: descriptions are kept by kind (a Shield item and the Shield spell)', () => {
  const { call } = page();
  const d24 = call('details', { id: 'C1' });
  assert.equal(d24.info.item.shield, 'A wooden shield. +2 AC.');
  assert.match(d24.info.spell.shield, /^1st-level Abjuration · 1 reaction\n\nAn invisible barrier/);
  const classic = call('details', { id: 'C2' });
  assert.equal(classic.info.item.shield, 'Item text.');
  assert.match(classic.info.spell.shield, /Spell text\./);
});

test('page: multiclass slots show what is left only; pact slots apart', () => {
  const { call } = page();
  const { slots } = call('details', { id: 'C1' });
  assert.deepEqual(plain(slots), [{ level: 1, cur: 3, max: null, editable: false }, { level: 2, pact: true, cur: 1, max: 2, editable: false }]);
});

test('page: a player may change only their own token and character', () => {
  const p1 = page({ player: 'P1' });
  assert.equal(p1.call('toggleMarker', { token: 'T1', tag: 'sleepy' }).ok, true);
  assert.equal(p1.call('toggleMarker', { token: 'T2', tag: 'sleepy' }).ok, false);
  assert.equal(p1.call('slot', { id: 'C2', level: 1, delta: -1 }).ok, false);
  const p2 = page({ player: 'P2' });
  assert.deepEqual(plain(p2.call('slot', { id: 'C2', level: 1, delta: -1 })), { ok: true, cur: 2, max: 4 });
  const gm = page({ gm: true, player: 'G' });
  assert.equal(gm.call('toggleMarker', { token: 'T2', tag: 'skull' }).ok, true);
});

test('page: end turn passes the turn and ticks a round counter that comes up', () => {
  const { call, campaign } = page({ player: 'P1' });
  assert.equal(call('endTurn', { token: 'T2' }).ok, false, 'not that token\'s turn');
  assert.equal(call('endTurn', { token: 'T1' }).ok, true);
  const order = JSON.parse(campaign.turnorder);
  assert.deepEqual(order.map((x) => x.id), ['-1', 'T2', 'T1']);
  assert.equal(order[0].pr, '2', 'Round 1 -> 2');
  const other = page({ player: 'P2' });
  assert.equal(other.call('endTurn', { token: 'T1' }).ok, false, 'another player can\'t end it');
});
