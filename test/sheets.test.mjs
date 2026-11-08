// The editor's sheet bridge (sheets.js) against a stand-in Roll20 page:
// sheet windows that open from the Journal, answer actions, and get closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const root = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'https://advanced-sheets.production.roll20preflight.net';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function roll20() {
  const dom = parseHTML('<html><head></head><body><ul id="journalfolderroot"><li class="journalitem character" data-itemid="C1"><span class="namecontainer">Nier</span></li></ul></body></html>');
  const doc = dom.document;
  // Laid-out elements only (what the bridge counts as an open window).
  const proto = Object.getPrototypeOf(doc.createElement('div'));
  const base = Object.getPrototypeOf(proto);
  const inPage = (el) => { for (let n = el; n; n = n.parentNode) if (n.nodeType === 9) return true; return false; };
  for (const P of [proto, base]) {
    P.getClientRects = function () { return inPage(this) ? [{}] : []; };
    Object.defineProperty(P, 'isConnected', { get() { return inPage(this); }, configurable: true });
  }
  const listeners = [];
  const win = {
    document: doc, CSS: { escape: (s) => s },
    addEventListener: (t, fn) => { if (t === 'message') listeners.push(fn); },
    setTimeout, clearTimeout, console, clearInterval,
    // The bridge's own repeating checks mustn't keep the test running.
    setInterval: (fn, ms) => { const t = setInterval(fn, ms); t.unref(); return t; },
  };
  win.window = win;
  let clicks = 0;
  const answers = []; // invoke ids the sheet received
  let silent = 0; // how many sheet windows (from the first) never answer
  let opened = 0;
  // Clicking the Journal entry opens a sheet window after a moment; the sheet
  // inside then says it's ready and answers actions.
  doc.querySelector('.namecontainer').addEventListener('click', () => {
    clicks++;
    setTimeout(() => {
      const quiet = ++opened <= silent;
      const d = doc.createElement('div');
      d.className = 'characterdialog';
      d.setAttribute('data-characterid', 'C1');
      const f = doc.createElement('iframe');
      f.setAttribute('name', 'iframe_C1');
      Object.defineProperty(f, 'name', { value: 'iframe_C1' });
      const frameWin = {
        postMessage: (data) => {
          const msg = JSON.parse(String(data).slice(String(data).indexOf(':v5:') + 4));
          if (msg.type === 'invoke') { answers.push(msg.id); if (!quiet) setTimeout(() => send({ type: 'result', id: msg.id, ok: true, msg: 'Rolled.' }), 50); }
        },
      };
      Object.defineProperty(f, 'contentWindow', { value: frameWin });
      d.appendChild(f);
      doc.body.appendChild(d);
      const send = (m) => listeners.forEach((fn) => fn({ origin: ORIGIN, source: frameWin, data: 'r20-companion:v5:' + JSON.stringify({ ...m, charId: 'C1' }) }));
      setTimeout(() => send({ type: 'ready' }), 100);
    }, 150);
  });
  const ctx = vm.createContext({ ...win, globalThis: undefined });
  ctx.globalThis = ctx;
  ctx.G = ctx;
  for (const f of ['src/shared/wire.js', 'src/editor/sheets.js']) vm.runInContext(readFileSync(root + f, 'utf8'), ctx, { filename: f });
  const close = () => { const d = doc.querySelector('.characterdialog'); if (d) d.remove(); };
  return { C: ctx.R20C, clicks: () => clicks, close, doc, answers, silence: (n) => { silent = n; } };
}

test('sheets: an action and the background reload opening together click the Journal once', async () => {
  const r = roll20();
  const [a, b] = await Promise.all([r.C.sheets.open('C1', { hidden: true }), r.C.sheets.open('C1', { hidden: true })]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(r.clicks(), 1);
  const res = await r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' });
  assert.equal(res.ok, true);
});

test('sheets: closing the sheet mid-action retries on a fresh copy straight away', async () => {
  const r = roll20();
  r.silence(1); // the first window never answers: the player closes it first
  assert.equal(await r.C.sheets.open('C1', {}), true);
  const started = Date.now();
  const roll = r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' }, { autoHide: true });
  await wait(200);
  r.close();
  const res = await roll;
  assert.equal(res.ok, true, 'rolled on the reopened sheet');
  assert.ok(Date.now() - started < 5000, 'no 8-second wait: ' + (Date.now() - started) + ' ms');
  assert.equal(r.clicks(), 2, 'reopened from the Journal once');
});

test('sheets: a roll while the closed window is still going away waits for it, then reopens', async () => {
  const r = roll20();
  assert.equal(await r.C.sheets.open('C1', {}), true);
  // Roll20 is closing the window: still on screen for a moment, sheet gone.
  const d = r.doc.querySelector('.characterdialog');
  d.querySelector('iframe').remove();
  setTimeout(() => d.remove(), 400);
  const started = Date.now();
  const res = await r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' }, { autoHide: true });
  assert.equal(res.ok, true);
  assert.ok(Date.now() - started < 6000, 'took ' + (Date.now() - started) + ' ms');
  assert.equal(r.clicks(), 2);
});

// Closing a kept sheet (hide instead) relies on a capture-phase listener,
// which linkedom doesn't run first; that's checked in a real browser.
