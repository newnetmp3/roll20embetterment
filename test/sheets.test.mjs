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
  // A sheet popped out into its own window, which the game page opened: its
  // frame isn't in the page, so it can only be recognised through the window.
  function popOut() {
    const popWin = { opener: win, closed: false };
    popWin.top = popWin;
    const frameWin = {
      top: popWin, closed: false,
      postMessage: (data) => {
        const msg = JSON.parse(String(data).slice(String(data).indexOf(':v5:') + 4));
        if (msg.type === 'hello') sendPop({ type: 'snapshot', snap: { name: 'Nier' } });
        if (msg.type === 'invoke') { answers.push(msg.id); setTimeout(() => sendPop({ type: 'result', id: msg.id, ok: true, msg: 'Rolled from the pop-out.' }), 50); }
      },
    };
    const sendPop = (m) => listeners.forEach((fn) => fn({ origin: ORIGIN, source: frameWin, data: 'r20-companion:v5:' + JSON.stringify({ ...m, charId: 'C1' }) }));
    sendPop({ type: 'ready' });
    return { closeWindow: () => { popWin.closed = true; frameWin.closed = true; } };
  }
  const deliver = (source, m) => listeners.forEach((fn) => fn({ origin: ORIGIN, source, data: 'r20-companion:v5:' + JSON.stringify({ charId: 'C1', ...m }) }));
  return { C: ctx.R20C, clicks: () => clicks, close, doc, answers, silence: (n) => { silent = n; }, popOut, deliver, win };
}

test('sheets: a popped-out sheet is used for actions while its window is open', async () => {
  const r = roll20();
  const snaps = [];
  r.C.sheets.on('snapshot', (id, snap) => snaps.push([id, snap.name]));
  const pop = r.popOut();
  await wait(20);
  assert.equal(r.C.sheets.isLive('C1'), true);
  assert.equal(r.C.sheets.isOpen('C1'), true);
  assert.deepEqual(snaps, [['C1', 'Nier']], 'asked the new pop-out for what it shows');
  const res = await r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' }, { autoHide: true });
  assert.equal(res.ok, true);
  assert.equal(res.msg, 'Rolled from the pop-out.');
  assert.equal(r.clicks(), 0, 'no Journal click while the sheet is popped out');
  pop.closeWindow();
  assert.equal(r.C.sheets.isLive('C1'), false, 'gone once its window closes');
  const again = await r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' }, { autoHide: true });
  assert.equal(again.ok, true);
  assert.equal(r.clicks(), 1, 'reopened in the page from the Journal');
});

test('sheets: a popped-out sheet window (no id, just its name) is matched through the Journal', async () => {
  const r = roll20();
  // What Roll20 really does: the sheet page itself is the new window, opened by
  // the game page, on another site; it only knows its title.
  let charId = '';
  const popWin = {
    opener: null, closed: false,
    postMessage: (data) => {
      const msg = JSON.parse(String(data).slice(String(data).indexOf(':v5:') + 4));
      if (msg.type === 'hello' && !charId) charId = msg.charId; // learns who it is
      if (msg.charId !== charId) return;
      if (msg.type === 'hello') { say({ type: 'ready' }); say({ type: 'snapshot', snap: { name: 'Nier' } }); }
      if (msg.type === 'invoke') setTimeout(() => say({ type: 'result', id: msg.id, ok: true, msg: 'Rolled from the pop-out.' }), 30);
    },
  };
  popWin.top = popWin;
  const say = (m) => r.deliver(popWin, { ...m, charId, ...(charId ? {} : { sheetName: 'Nier' }) });
  // A window the game page didn't open is never matched.
  say({ type: 'ready' });
  assert.equal(charId, '', 'a window this page did not open gets no answer');
  popWin.opener = r.win;
  say({ type: 'ready' });
  await wait(20);
  assert.equal(charId, 'C1', 'told which character it is');
  assert.equal(r.C.sheets.isPopout('C1'), true);
  const res = await r.C.sheets.invoke('C1', { ref: 'x', op: 'hit' }, { autoHide: true });
  assert.equal(res.msg, 'Rolled from the pop-out.');
  assert.equal(r.clicks(), 0);
});

test('sheets: a sheet frame in some other window is ignored', async () => {
  const r = roll20();
  const stranger = { top: { opener: null, closed: false }, postMessage() {} };
  stranger.top.top = stranger.top;
  r.C.sheets.on('snapshot', () => assert.fail('took a snapshot from a stranger'));
  // A sheet frame in a window this page didn't open.
  r.deliver(stranger, { type: 'ready' });
  r.deliver(stranger, { type: 'snapshot', snap: { name: 'Nier' } });
  assert.equal(r.C.sheets.isLive('C1'), false);
});

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
