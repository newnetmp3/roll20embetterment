// Runs in Roll20's own page (MAIN world): reports which characters the
// selected tokens represent. Roll20 has no public "selected token" API, so
// this reads it from Roll20's own window.MeshManager global, read-only:
//   MeshManager.engine.tabletop.getSelection() -> nodes -> dataWrapper.model
//   -> model.get('represents') = character id.
// It only reads; it never calls into Roll20 to change anything. Results go to
// the extension as a DOM event carrying a JSON string.
(function () {
  'use strict';
  if (window.top !== window || window.__r20cSelection) return;
  const state = (window.__r20cSelection = { status: 'waiting for the Roll20 map', via: null });
  let last = '';

  function tabletop() {
    try {
      const mm = window.MeshManager;
      const t = mm && mm.engine && mm.engine.tabletop;
      if (t && typeof t.getSelection === 'function') { state.via = 'MeshManager'; return t; }
    } catch { /* not ready */ }
    return null;
  }

  // Characters represented by the selected tokens, in selection order.
  function selectedCharacters(t) {
    if (t.getSelection.length !== 0) return null;
    const raw = t.getSelection();
    const items = Array.isArray(raw) ? raw : raw && typeof raw[Symbol.iterator] === 'function' ? Array.from(raw) : null;
    if (!items) return null;
    const out = [];
    const names = [];
    let unlinked = 0;
    for (const item of items.slice(0, 50)) {
      const m = (item && item.dataWrapper && item.dataWrapper.model) || (item && item.model);
      if (!m) continue;
      const read = (k) => { try { return String((typeof m.get === 'function' ? m.get(k) : m.attributes && m.attributes[k]) || ''); } catch { return ''; } };
      const rep = read('represents');
      if (rep) { if (!out.includes(rep)) out.push(rep); } else unlinked++;
      if (names.length < 5) names.push(read('name'));
    }
    return { chars: out, tokens: items.length, unlinked, names };
  }

  function tick() {
    const t = tabletop();
    if (!t) { state.status = 'waiting for the Roll20 map'; return; }
    let sel = null;
    try { sel = selectedCharacters(t); } catch { sel = null; }
    if (!sel) { state.status = 'selection unavailable'; return; }
    state.status = 'ok';
    const key = sel.chars.join(',') + '|' + sel.tokens + '|' + sel.unlinked;
    if (key === last) return;
    last = key;
    document.dispatchEvent(new CustomEvent('r20c-selection', { detail: JSON.stringify(sel) }));
  }
  setInterval(tick, 300);
  document.addEventListener('r20c-selection-status', () => {
    document.dispatchEvent(new CustomEvent('r20c-selection-status-reply', { detail: JSON.stringify(state) }));
  });
})();
