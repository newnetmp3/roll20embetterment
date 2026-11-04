// Editor-side bridge to the official sheet frames: knows which character
// sheets are open, opens one from the Journal when an action needs it,
// hides/shows sheet windows, and sends actions to the right frame.
(function (G) {
  'use strict';
  const C = G.R20C;
  const SHEET_ORIGIN = 'https://advanced-sheets.production.roll20preflight.net';
  const frames = new Map(); // charId -> { win, iframe }
  const pending = new Map(); // request id -> { resolve, timer }
  const handlers = { snapshot: [], ready: [], dialogs: [] };
  let seq = 0;

  const emit = (type, ...args) => handlers[type].forEach((fn) => { try { fn(...args); } catch (e) { console.error('[Roll20embetterment]', e); } });
  const esc = (s) => (G.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
  // Roll20 can keep a closed sheet window in the page, just not displayed.
  // Only a window that is laid out counts (our hidden ones are only
  // visibility:hidden, so they still count).
  const shown = (d) => { try { return !!d && d.getClientRects().length > 0; } catch { return false; } };
  const dialogFor = (id) => [...document.querySelectorAll('.characterdialog[data-characterid="' + esc(id) + '"]')].find(shown) || null;

  function iframeFor(win) {
    for (const f of document.querySelectorAll('iframe[name^="iframe_"]')) if (f.contentWindow === win) return f;
    return null;
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== SHEET_ORIGIN) return;
    const msg = C.wire.decode(event.data);
    if (!msg || typeof msg.charId !== 'string') return;
    // Only frames inside a real character dialog, named for that character.
    const iframe = iframeFor(event.source);
    if (!iframe || iframe.name !== 'iframe_' + msg.charId) return;
    frames.set(msg.charId, { win: event.source, iframe });
    if (msg.type === 'snapshot' && msg.snap) emit('snapshot', msg.charId, msg.snap);
    else if (msg.type === 'ready') emit('ready', msg.charId);
    else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      if (p) { clearTimeout(p.timer); pending.delete(msg.id); p.resolve({ ok: !!msg.ok, msg: String(msg.msg || ''), gone: !!msg.gone }); }
    }
  });

  function live(id) {
    const f = frames.get(id);
    if (f && !dialogFor(id)) { frames.delete(id); return null; } // window closed
    if (f && f.classic) {
      if (f.iframe.isConnected && C.classic.docOf(f.iframe)) return f;
    } else if (f && f.iframe.isConnected) return f;
    frames.delete(id);
    return null;
  }
  function post(id, msg) {
    const f = live(id);
    if (!f) return false;
    f.win.postMessage(C.wire.encode({ ...msg, charId: id }), SHEET_ORIGIN);
    return true;
  }

  // Ask any sheet frames that loaded before us to introduce themselves.
  function greetAll() {
    for (const f of document.querySelectorAll('.characterdialog iframe[name^="iframe_"]')) {
      const id = f.name.slice('iframe_'.length);
      try { f.contentWindow.postMessage(C.wire.encode({ type: 'hello', charId: id }), SHEET_ORIGIN); } catch { /* frame not ready */ }
    }
  }

  // Characters listed in the Journal (what this user can open).
  function journal() {
    return [...document.querySelectorAll('#journalfolderroot li.journalitem.character[data-itemid]')].map((li) => ({
      id: li.getAttribute('data-itemid'),
      name: (li.querySelector('.namecontainer')?.textContent || '').trim(),
      img: li.querySelector('.token img')?.getAttribute('src') || '',
    })).filter((c) => c.id && c.name);
  }

  function waitReady(id, ms) {
    return new Promise((resolve) => {
      if (live(id)) { resolve(true); return; }
      const done = (ok) => { clearTimeout(timer); handlers.ready = handlers.ready.filter((h) => h !== onReady); resolve(ok); };
      const onReady = (cid) => { if (cid === id) done(true); };
      const timer = setTimeout(() => done(!!live(id)), ms);
      handlers.ready.push(onReady);
    });
  }

  // Sheets the companion hides. The rule is written *before* a background
  // sheet opens, so its window never flashes on screen.
  const hidden = new Set();
  const owned = new Set(); // sheets the companion opened itself
  const quietUntil = new Map(); // ignore Roll20's own setup changes right after opening
  const style = document.createElement('style');
  (document.head || document.documentElement).appendChild(style);
  function writeStyle() {
    // Classic sheets sit in a jQuery dialog window around .characterdialog.
    style.textContent = [...hidden].map((id) => {
      const d = '.characterdialog[data-characterid="' + esc(id) + '"]';
      return d + ',.ui-dialog:has(> ' + d + '){visibility:hidden!important;pointer-events:none!important}';
    }).join('\n');
  }
  function setHidden(id, on) {
    if (on) hidden.add(id); else hidden.delete(id);
    writeStyle();
  }
  const isHidden = (id) => hidden.has(id) && !!dialogFor(id);

  // The person opened a sheet the companion was keeping hidden: show it and
  // hand it over. Covers Journal clicks and anything that brings the window
  // to the front (Roll20 raises its z-index), such as double-clicking a token.
  function handOver(id) {
    if (!hidden.has(id)) return;
    setHidden(id, false);
    owned.delete(id);
    emit('dialogs', openIds(), []);
  }
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const li = e.target.closest && e.target.closest('#journalfolderroot li.journalitem[data-itemid]');
    if (li && hidden.has(li.getAttribute('data-itemid'))) setTimeout(() => handOver(li.getAttribute('data-itemid')), 50);
  }, true);
  const zSeen = new Map();
  function watchRaised() {
    for (const id of hidden) {
      const d = dialogFor(id);
      if (!d) continue;
      const z = Number((d.closest('.ui-dialog') || d).style.zIndex) || 0;
      const before = zSeen.get(id);
      zSeen.set(id, z);
      if (before !== undefined && z > before && Date.now() > (quietUntil.get(id) || 0)) handOver(id);
    }
  }

  // Open a character's sheet the way a person would: click its Journal entry.
  // With { hidden: true } it loads in the background and is never shown.
  async function open(id, opts = {}) {
    if (live(id)) return true;
    if (!dialogFor(id)) {
      if (opts.hidden) { setHidden(id, true); owned.add(id); quietUntil.set(id, Date.now() + 5000); }
      const entry = document.querySelector('#journalfolderroot li.journalitem[data-itemid="' + esc(id) + '"]');
      const target = entry && (entry.querySelector('.namecontainer') || entry.querySelector('.dd-content') || entry);
      if (target) target.click();
      else {
        // Fallback: Roll20's own "show sheet" for this character, if exposed.
        try { G.wrappedJSObject?.Campaign?.characters?.get(id)?.view?.showDialog(); } catch { /* not available */ }
      }
    }
    setTimeout(greetAll, 1500);
    const ok = await waitReady(id, 25000);
    if (!ok && opts.hidden && owned.has(id) && !dialogFor(id)) { setHidden(id, false); owned.delete(id); }
    return ok;
  }

  // Close a sheet, but only one the companion opened and is still hiding.
  function closeOwned(id) {
    const d = dialogFor(id);
    if (!d || !owned.has(id) || !hidden.has(id)) return false;
    const btn = d.querySelector('.asv__close') || d.closest('.ui-dialog')?.querySelector('.ui-dialog-titlebar-close');
    if (btn) btn.click();
    return !!btn;
  }

  // Run an action; if the sheet turned out to be closed or empty, load the
  // companion's own hidden copy and try once more.
  async function invoke(id, act, opts = {}) {
    const r = await invokeOnce(id, act, opts);
    if (r.ok || !(r.gone || r.noAnswer)) return r;
    frames.delete(id);
    return invokeOnce(id, act, { ...opts, autoHide: true });
  }
  async function invokeOnce(id, act, opts = {}) {
    let opened = false;
    if (!live(id)) {
      if (!(await open(id, { hidden: !!opts.autoHide && !act.reveal }))) {
        return { ok: false, msg: 'Could not open the sheet. Open it from the Journal and try again.' };
      }
      opened = true;
    }
    if (act.reveal) handOver(id);
    const f = live(id);
    if (f && f.classic) {
      try { const r = C.classic.perform(f.doc, act.ref, act.op, act.arg); setTimeout(() => readClassic(id, f, true), 400); return r; }
      catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }
    const reqId = 'r' + ++seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { pending.delete(reqId); resolve({ ok: false, noAnswer: true, msg: 'The sheet did not answer.' }); }, opened ? 15000 : 8000);
      pending.set(reqId, { resolve, timer });
      if (!post(id, { type: 'invoke', id: reqId, ref: act.ref, op: act.op, arg: act.arg, opts: { spend: opts.spend } })) {
        clearTimeout(timer); pending.delete(reqId); resolve({ ok: false, noAnswer: true, msg: 'Sheet is not connected.' });
      }
    });
  }

  // Classic sheets: the editor reads them itself (see classic.js).
  const classicKeys = new Map();
  function readClassic(id, f, force) {
    let snap;
    try { snap = C.classic.parse(f.doc, (f.iframe.getAttribute('title') || '').replace(/^Character sheet for\s*/i, '')); }
    catch (e) { console.error('[Roll20embetterment] classic sheet', e); return; }
    if (!snap || !snap.name) return;
    const key = JSON.stringify({ ...snap, at: 0 });
    if (!force && classicKeys.get(id) === key) return;
    classicKeys.set(id, key);
    emit('snapshot', id, snap);
  }
  let classicTick = 0;
  function scanClassic() {
    classicTick++;
    for (const d of document.querySelectorAll('.characterdialog[data-characterid]')) {
      if (!shown(d)) continue;
      const id = d.getAttribute('data-characterid');
      const iframe = d.querySelector('iframe[name="iframe_' + esc(id) + '"]') || d.querySelector('iframe');
      const doc = C.classic.docOf(iframe);
      if (!doc) continue;
      const known = frames.get(id);
      const fresh = !known || !known.classic || known.doc !== doc;
      if (fresh) frames.set(id, { classic: true, iframe, doc });
      if (fresh || classicTick % 2 === 0) readClassic(id, frames.get(id), fresh);
      if (fresh) emit('ready', id);
    }
  }

  // Report sheet windows opening and closing.
  const openIds = () => [...new Set([...document.querySelectorAll('.characterdialog[data-characterid]')].filter(shown).map((d) => d.getAttribute('data-characterid')))];
  let lastDialogs = '';
  setInterval(() => {
    watchRaised();
    try { scanClassic(); } catch (e) { console.error('[Roll20embetterment]', e); }
    const ids = openIds();
    const key = ids.join(',');
    if (key !== lastDialogs) {
      const before = new Set(lastDialogs ? lastDialogs.split(',') : []);
      lastDialogs = key;
      // A closed sheet is no longer ours to hide.
      for (const id of [...hidden]) if (!ids.includes(id) && Date.now() > (quietUntil.get(id) || 0)) { hidden.delete(id); owned.delete(id); zSeen.delete(id); }
      writeStyle();
      emit('dialogs', ids, ids.filter((x) => !before.has(x) && !hidden.has(x)));
      setTimeout(greetAll, 800);
    }
  }, 700);

  C.sheets = {
    on: (type, fn) => handlers[type].push(fn),
    journal, open, invoke, setHidden, isHidden, greetAll, closeOwned,
    isOwned: (id) => owned.has(id),
    isLive: (id) => !!live(id),
    isOpen: (id) => !!dialogFor(id),
    refresh: (id) => { const f = live(id); if (f && f.classic) readClassic(id, f, true); else post(id, { type: 'hello' }); },
    classicInfo: (id) => { const f = live(id); return f && f.classic ? C.classic.describe(f.doc) : null; },
  };
})(globalThis);
