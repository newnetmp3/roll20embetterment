// Sheet-frame entry point. Roll20 names each character sheet frame
// "iframe_<characterId>", so the frame knows which character it shows.
// Other sheet frames (settings, Roll20's hidden headless frame) are ignored.
//
// A popped-out sheet is different: Roll20 opens the sheet itself as a window
// of its own (no frame, no character id in its name), from the game page.
// It introduces itself by the character's name (its title); the game page
// matches that to the Journal and tells it which character it is.
(function (G) {
  'use strict';
  const C = G.R20C;
  if (G.R20C_SHEET_STARTED) return; // never twice in one frame
  G.R20C_SHEET_STARTED = true;
  const EDITOR = 'https://app.roll20.net';
  const m = /^iframe_(.+)$/.exec(window.name || '');
  const topLevel = window.parent === window;
  // The game page that opened this window (a popped-out sheet), or that
  // opened the window this frame sits in.
  const opener = (() => {
    try { const o = window.top.opener; return o && o !== window.parent ? o : null; } catch { return null; }
  })();
  if (m ? topLevel : !(topLevel && opener)) return;
  let charId = m ? m[1] : ''; // a pop-out learns its id from the game page

  const send = (msg) => {
    const data = C.wire.encode({ ...msg, charId, ...(charId ? {} : { sheetName: document.title || '' }) });
    for (const w of [topLevel ? null : window.parent, opener]) if (w) try { w.postMessage(data, EDITOR); } catch { /* window gone */ }
  };

  let last = '';
  let timer = null;
  function publish(force) {
    timer = null;
    let snap;
    try { snap = C.parseSheet(document); } catch (e) { send({ type: 'error', msg: String(e && e.message || e) }); return; }
    // A sheet whose name we can't find still sends what it shows; the
    // editor knows the character's name.
    if (!snap) return;
    const key = JSON.stringify({ ...snap, at: 0 });
    if (!force && key === last) return;
    last = key;
    send({ type: 'snapshot', snap });
  }
  const schedule = () => { if (!timer) timer = setTimeout(publish, 350); };

  new MutationObserver(schedule).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['aria-valuenow', 'aria-checked', 'value', 'class', 'style'],
  });

  window.addEventListener('message', async (event) => {
    if (event.origin !== EDITOR || (event.source !== window.parent && event.source !== opener)) return;
    const msg = C.wire.decode(event.data);
    if (!msg) return;
    // A popped-out sheet: the game page names the character it found for us.
    if (!charId && event.source === opener && msg.type === 'hello' && typeof msg.charId === 'string' && msg.charId) charId = msg.charId;
    if (msg.charId !== charId) return;
    if (msg.type === 'hello') { send({ type: 'ready' }); publish(true); return; }
    if (msg.type === 'describe') { send({ type: 'description', info: describe() }); return; }
    if (msg.type === 'invoke') {
      let result;
      try { result = await C.perform(document, msg.ref, msg.op, msg.arg, msg.opts || {}); }
      catch (e) { result = { ok: false, msg: String(e && e.message || e) }; }
      send({ type: 'result', id: msg.id, ...result, gone: !!result.gone });
      schedule();
    }
  });

  // For diagnostics: what this frame shows when it can't be read.
  function describe() {
    const sheet = document.querySelector('.dnd-sheet');
    let parsed = null;
    try { const s = C.parseSheet(document); parsed = s && { type: s.type, name: s.name, errors: s.errors, counts: Object.fromEntries(['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks'].map((k) => [k, (s[k] || []).length])) }; } catch (e) { parsed = 'error: ' + (e && e.message || e); }
    return {
      path: location.pathname, title: document.title, sheet: !!sheet, sheetClass: sheet ? String(sheet.className).slice(0, 120) : '',
      roots: [...document.body.children].slice(0, 6).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(/\s+/).slice(0, 3).join('.') : '')),
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240), parsed,
    };
  }

  send({ type: 'ready' });
  schedule();
  // A popped-out sheet: the game page can't ask it to introduce itself (it
  // doesn't know the window), so say hello now and then in case it reloaded.
  if (opener) setInterval(() => { if (!opener.closed) send({ type: 'ready' }); }, 10000);
})(globalThis);
