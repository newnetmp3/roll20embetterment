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
    if (!snap || !snap.name) return;
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
    if (msg.type === 'invoke') {
      let result;
      try { result = await C.perform(document, msg.ref, msg.op, msg.arg, msg.opts || {}); }
      catch (e) { result = { ok: false, msg: String(e && e.message || e) }; }
      send({ type: 'result', id: msg.id, ...result, gone: !!result.gone });
      schedule();
    }
  });

  send({ type: 'ready' });
  schedule();
})(globalThis);
