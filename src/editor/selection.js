// Runs in Roll20's own page (MAIN world): reports which characters the
// selected tokens represent. Roll20 has no public "selected token" API, so
// this asks the Jumpgate engine the same way the v3 extension did, read-only:
//   VTTEngine.instance.tabletop.getSelection() -> nodes -> dataWrapper.model
//   -> model.get('represents') = character id.
// It only reads. Results go to the extension as a DOM event with a JSON string.
(function () {
  'use strict';
  if (window.top !== window || window.__r20cSelection) return;
  const state = (window.__r20cSelection = { status: 'waiting for first map render', module: null, tries: 0 });
  let engine = null;
  let rendered = false;
  let lastTry = 0;
  let last = '';

  // Importing the engine before Roll20 finishes its first render can break
  // startup, so wait for Roll20's own "jumpgate-render-end" mark.
  try {
    const seen = (list) => { for (const e of list) if (e.name === 'jumpgate-render-end') rendered = true; };
    seen(performance.getEntriesByName('jumpgate-render-end', 'mark'));
    new PerformanceObserver((l) => seen(l.getEntries())).observe({ type: 'mark', buffered: true });
  } catch { /* fall back to the canvas check below */ }

  // Read-only check of a module's source: it must export VTTEngine and have
  // the selection reader and the token-model link. Nothing is executed here.
  function looksLikeEngine(factory) {
    try {
      const src = Function.prototype.toString.call(factory);
      return src.length > 50000 && src.length < 3000000 && src.slice(0, 2048).includes('VTTEngine') &&
        src.includes('getSelection') && src.includes('dataWrapper.model');
    } catch { return false; }
  }

  function findEngine() {
    const chunks = window.webpackChunkvtt;
    if (!Array.isArray(chunks) || typeof chunks.push !== 'function') { state.status = 'Roll20 engine not loaded yet'; return; }
    state.tries++;
    chunks.push([['r20c-selection-' + state.tries], {}, (require) => {
      const reg = require && require.m;
      if (!reg) { state.status = 'engine registry unavailable'; return; }
      const ids = [];
      const keys = Object.keys(reg);
      if (keys.length > 20000) { state.status = 'engine registry too large to inspect'; return; }
      for (const id of keys) if (typeof reg[id] === 'function' && looksLikeEngine(reg[id])) ids.push(id);
      if (ids.length !== 1) { state.status = ids.length ? 'several engine candidates; not guessing' : 'engine module not found'; return; }
      try {
        const E = require(ids[0]) && require(ids[0]).VTTEngine;
        if (typeof E === 'function') { engine = E; state.module = ids[0]; state.status = 'engine found'; }
        else state.status = 'engine export missing';
      } catch { state.status = 'engine module failed to load'; }
    }]);
  }

  // Characters represented by the selected tokens, in selection order.
  function selectedCharacters() {
    const tabletop = engine && engine.instance && engine.instance.tabletop;
    if (!tabletop || typeof tabletop.getSelection !== 'function' || tabletop.getSelection.length !== 0) return null;
    const items = tabletop.getSelection();
    if (!Array.isArray(items)) return null;
    const out = [];
    for (const item of items.slice(0, 50)) {
      const m = (item && item.dataWrapper && item.dataWrapper.model) || (item && item.model);
      let rep = '';
      try { rep = String((m && (typeof m.get === 'function' ? m.get('represents') : m.attributes && m.attributes.represents)) || ''); } catch { /* skip */ }
      if (rep && !out.includes(rep)) out.push(rep);
    }
    return { chars: out, tokens: items.length };
  }

  function tick() {
    if (!rendered && document.querySelector('#babylonCanvas, canvas')) {
      // No render mark seen (e.g. extension attached late): allow after the
      // map canvas exists and the page has settled.
      if (performance.now() > 15000) rendered = true;
    }
    if (!rendered) return;
    if (!engine) {
      if (state.tries >= 6 || Date.now() - lastTry < 3000) return;
      lastTry = Date.now();
      try { findEngine(); } catch { state.status = 'engine lookup failed'; }
      return;
    }
    let sel = null;
    try { sel = selectedCharacters(); } catch { sel = null; }
    if (!sel) { state.status = 'selection unavailable'; return; }
    state.status = 'ok';
    const key = sel.chars.join(',') + '|' + sel.tokens;
    if (key === last) return;
    last = key;
    document.dispatchEvent(new CustomEvent('r20c-selection', { detail: JSON.stringify(sel) }));
  }
  setInterval(tick, 300);
  document.addEventListener('r20c-selection-status', () => {
    document.dispatchEvent(new CustomEvent('r20c-selection-status-reply', { detail: JSON.stringify(state) }));
  });
})();
