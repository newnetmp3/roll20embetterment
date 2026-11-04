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
    const byChar = {};
    for (const item of items.slice(0, 50)) {
      const m = (item && item.dataWrapper && item.dataWrapper.model) || (item && item.model);
      if (!m) continue;
      const read = (k) => { try { return String((typeof m.get === 'function' ? m.get(k) : m.attributes && m.attributes[k]) || ''); } catch { return ''; } };
      const rep = read('represents');
      if (rep) { if (!out.includes(rep)) out.push(rep); if (!byChar[rep]) byChar[rep] = String(m.id || ''); } else unlinked++;
      if (names.length < 5) names.push(read('name'));
    }
    return { chars: out, tokens: items.length, unlinked, names, tokenOf: byChar };
  }

  function tick() {
    const t = tabletop();
    if (!t) { state.status = 'waiting for the Roll20 map'; return; }
    let sel = null;
    try { sel = selectedCharacters(t); } catch { sel = null; }
    if (!sel) { state.status = 'selection unavailable'; return; }
    state.status = 'ok';
    const key = sel.chars.join(',') + '|' + sel.tokens + '|' + sel.unlinked + '|' + Object.values(sel.tokenOf).join(',');
    if (key === last) return;
    last = key;
    document.dispatchEvent(new CustomEvent('r20c-selection', { detail: JSON.stringify(sel) }));
  }

  // ---- movement per turn ------------------------------------------------------
  // Reads token positions and the turn order from Roll20's own models
  // (window.Campaign), read-only. Each token's distance resets when its turn
  // starts in the turn order, or when the person resets it from the bar.
  // A finished move carries Roll20's own "lastmove" (start point and waypoints),
  // so the path walked is measured, not just the straight line.
  const moves = new Map(); // tokenId -> { left, top, feet, seq, char, difficult }
  let turnId = '';
  let moveKey = '';
  const pageOf = () => { try { return window.Campaign && window.Campaign.activePage && window.Campaign.activePage(); } catch { return null; } };
  const g = (m, k) => { try { return m.get(k); } catch { return undefined; } };

  function metric(page) {
    const cellPx = 70 * (Number(g(page, 'snapping_increment')) || 1);
    const scale = Number(g(page, 'scale_number')) || 5;
    const units = String(g(page, 'scale_units') || 'ft');
    const diag = String(g(page, 'diagonaltype') || 'foure');
    return { cellPx, scale, units, diag };
  }
  // Distance of one straight segment in page units.
  function segment(mt, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) / mt.cellPx;
    const dy = Math.abs(y2 - y1) / mt.cellPx;
    const r = (n) => Math.round(n * 100) / 100;
    let cells;
    if (mt.diag === 'manhattan') cells = dx + dy;
    else if (mt.diag === 'pythagorean' || mt.diag === 'hex') cells = Math.hypot(dx, dy);
    else if (mt.diag === 'threefive') cells = Math.max(dx, dy) + Math.floor(Math.min(r(dx), r(dy)) / 2);
    else cells = Math.max(dx, dy); // 5e: every square counts as one
    return Math.round(r(cells) * mt.scale * 10) / 10;
  }
  function pathFeet(mt, prev, cur, lastmove) {
    const nums = String(lastmove || '').split(',').map(Number).filter((n) => Number.isFinite(n));
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    // Use Roll20's recorded path when it starts where we last saw the token.
    const path = pts.length && Math.hypot(pts[0][0] - prev.left, pts[0][1] - prev.top) < 2 ? pts : [[prev.left, prev.top]];
    path.push([cur.left, cur.top]);
    let feet = 0;
    for (let i = 1; i < path.length; i++) feet += segment(mt, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    return feet;
  }
  function currentTurn() {
    try {
      const raw = window.Campaign.get('turnorder');
      const list = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : raw || [];
      const top = list[0];
      return top && top.id && top.id !== '-1' ? String(top.id) : '';
    } catch { return ''; }
  }
  function trackMoves() {
    const page = pageOf();
    const graphics = page && page.thegraphics;
    const models = graphics && graphics.models;
    if (!models) return;
    const mt = metric(page);
    const turn = currentTurn();
    if (turn !== turnId) {
      turnId = turn;
      const m = moves.get(turn);
      if (m) { m.feet = 0; m.seq++; m.difficult = false; } // that token's turn starts: fresh movement
    }
    const seen = new Set();
    for (let i = 0; i < models.length && i < 400; i++) {
      const t = models[i];
      if (g(t, 'layer') !== 'objects') continue;
      const id = String(t.id);
      const left = Number(g(t, 'left'));
      const top = Number(g(t, 'top'));
      if (!Number.isFinite(left) || !Number.isFinite(top)) continue;
      seen.add(id);
      const char = String(g(t, 'represents') || '');
      const known = moves.get(id);
      if (!known) { moves.set(id, { left, top, feet: 0, seq: 0, char, name: String(g(t, 'name') || '') }); continue; }
      known.char = char;
      if (known.left !== left || known.top !== top) {
        // Difficult terrain: every foot moved while it is on costs two.
        const cost = pathFeet(mt, known, { left, top }, g(t, 'lastmove')) * (known.difficult ? 2 : 1);
        known.feet = Math.round((known.feet + cost) * 10) / 10;
        known.left = left; known.top = top;
      }
    }
    for (const id of moves.keys()) if (!seen.has(id)) moves.delete(id);
    const out = {};
    for (const [id, m] of moves) if (m.char || id === turnId) out[id] = { char: m.char, feet: m.feet, seq: m.seq, name: m.name, difficult: !!m.difficult };
    const detail = JSON.stringify({ tokens: out, turn: turnId, units: mt.units });
    if (detail === moveKey) return;
    moveKey = detail;
    document.dispatchEvent(new CustomEvent('r20c-movement', { detail }));
  }
  // The bar asks to start a token's count over (e.g. outside combat).
  document.addEventListener('r20c-movement-reset', (e) => {
    let id = '';
    try { id = String(JSON.parse(e.detail).token || ''); } catch { return; }
    const m = moves.get(id);
    if (m) { m.feet = 0; m.seq++; m.difficult = false; moveKey = ''; }
  });
  // The bar turns difficult terrain on or off for a token's next moves.
  document.addEventListener('r20c-movement-mode', (e) => {
    let d;
    try { d = JSON.parse(e.detail); } catch { return; }
    const m = moves.get(String(d.token || ''));
    if (m) { m.difficult = !!d.difficult; moveKey = ''; }
  });
  setInterval(() => { try { trackMoves(); } catch { /* Roll20 not ready */ } }, 250);

  setInterval(tick, 300);
  document.addEventListener('r20c-selection-status', () => {
    document.dispatchEvent(new CustomEvent('r20c-selection-status-reply', { detail: JSON.stringify(state) }));
  });
})();
