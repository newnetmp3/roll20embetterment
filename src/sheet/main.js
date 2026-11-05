// Sheet-frame entry point. Roll20 names each character sheet frame
// "iframe_<characterId>", so the frame knows which character it shows.
// Other sheet frames (settings, Roll20's hidden headless frame) are ignored.
(function (G) {
  'use strict';
  const C = G.R20C;
  const EDITOR = 'https://app.roll20.net';
  const m = /^iframe_(.+)$/.exec(window.name || '');
  if (!m || window.parent === window) return;
  const charId = m[1];

  const send = (msg) => window.parent.postMessage(C.wire.encode({ ...msg, charId }), EDITOR);

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
    if (event.origin !== EDITOR || event.source !== window.parent) return;
    const msg = C.wire.decode(event.data);
    if (!msg || msg.charId !== charId) return;
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
})(globalThis);
