// The sheet-side entry (sheet/main.js) in a popped-out sheet: Roll20 opens
// the sheet page itself as a window from the game page, with no frame name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const root = fileURLToPath(new URL('..', import.meta.url));
const enc = (m) => 'r20-companion:v5:' + JSON.stringify(m);
const dec = (d) => JSON.parse(d.slice(d.indexOf(':v5:') + 4));

function sheetWindow({ name = '', opener = true } = {}) {
  const { document } = parseHTML('<html><head><title>Nier</title></head><body><div class="dnd-sheet"></div></body></html>');
  const sent = [];
  const listeners = [];
  const game = { closed: false, postMessage: (d, origin) => sent.push({ msg: dec(d), origin }) };
  const win = {
    name, document, opener: opener ? game : null, console, location: { pathname: '/x' },
    addEventListener: (t, fn) => { if (t === 'message') listeners.push(fn); },
    setTimeout, clearTimeout, setInterval: (f, ms) => { const t = setInterval(f, ms); t.unref(); return t; },
    MutationObserver: class { observe() {} },
  };
  win.parent = win;
  win.top = win;
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.globalThis = ctx;
  for (const f of ['src/shared/wire.js', 'src/sheet/parse.js', 'src/sheet/act.js', 'src/sheet/main.js']) vm.runInContext(readFileSync(root + f, 'utf8'), ctx, { filename: f });
  const from = async (source, m) => { for (const fn of listeners) await fn({ origin: 'https://app.roll20.net', source, data: enc(m) }); };
  return { ctx, sent, game, from };
}

test('popped-out sheet: introduces itself by name, then answers as the character it is told', async () => {
  const w = sheetWindow();
  assert.equal(w.sent[0].msg.type, 'ready');
  assert.equal(w.sent[0].msg.charId, '');
  assert.equal(w.sent[0].msg.sheetName, 'Nier');
  assert.equal(w.sent[0].origin, 'https://app.roll20.net');
  await w.from({}, { type: 'hello', charId: 'C1' }); // not the game page: ignored
  assert.equal(w.sent.length, 1);
  await w.from(w.game, { type: 'hello', charId: 'C1' });
  assert.ok(w.sent.length > 1);
  assert.ok(w.sent.slice(1).every((s) => s.msg.charId === 'C1' && !('sheetName' in s.msg)));
});

test('popped-out sheet: a stray sheet window nobody opened stays quiet', () => {
  const w = sheetWindow({ opener: false });
  assert.equal(w.sent.length, 0);
});

test('popped-out sheet: starting twice in one window sends nothing more', () => {
  const w = sheetWindow();
  const n = w.sent.length;
  vm.runInContext(readFileSync(root + 'src/sheet/main.js', 'utf8'), w.ctx);
  assert.equal(w.sent.length, n);
});
