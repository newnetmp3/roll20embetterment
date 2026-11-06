// Runs in Roll20's own page (MAIN world): reports which characters the
// selected tokens represent. Roll20 has no public "selected token" API, so
// this reads it from Roll20's own window.MeshManager global, read-only:
//   MeshManager.engine.tabletop.getSelection() -> nodes -> dataWrapper.model
//   -> model.get('represents') = character id.
// Mostly it only reads. It changes Roll20 only when the person asks from the
// bar: toggling a token marker, ending their turn in the turn order, or
// spending/restoring a Classic sheet's spell slot. Results go to the
// extension as a DOM event carrying a JSON string.
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

  // ---- sheet details, spell slots, token markers, end turn ----------------------
  // The bar asks with r20c-call { fn, req, args } and gets r20c-call-reply { req, result }.
  const norm = (n) => String(n || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const strip = (t) => String(t || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\[\[\s*([^\]]*?)\s*\]\]/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
  const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const LEVELS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH'];
  const charOf = (id) => { try { return window.Campaign.characters.get(id) || null; } catch { return null; } };
  const attrsOf = (c) => { try { return (c.attribs && c.attribs.models) || []; } catch { return []; } };
  const tokenModel = (id) => { const p = pageOf(); try { return (p && p.thegraphics && p.thegraphics.get(id)) || null; } catch { return null; } };

  // Long descriptions (and spell details) by name, and spell slots.
  function details(c) {
    const info = {};
    const put = (name, text) => { const k = norm(name); const t = strip(text); if (k && t && t.length > (info[k] || '').length) info[k] = t; };
    const attrs = attrsOf(c);
    const by = {};
    for (const a of attrs) by[String(g(a, 'name'))] = a;
    const slots = [];
    // 2024 sheet: everything is in one JSON attribute, "store".
    let store = by.store && g(by.store, 'current');
    if (typeof store === 'string') { try { store = JSON.parse(store); } catch { store = null; } }
    const ints = store && store.integrants && store.integrants.integrants;
    if (ints) {
      const maxBy = {};
      for (const x of Object.values(ints)) {
        if (!x || x._enabled === false) continue;
        if (x.type === 'Spell Slot') { const m = /level\s*(\d)/i.exec(x.name || ''); if (m) maxBy[m[1]] = (maxBy[m[1]] || 0) + (Number(x.valueFormula && x.valueFormula.flatValue) || 0); continue; }
        if (!x.description) continue;
        let text = x.description;
        if (x.type === 'Spell' || 'castingTime' in x) {
          const comp = x.components ? ['verbal', 'somatic', 'material'].filter((k) => x.components[k]).map((k) => k[0].toUpperCase()).join(', ') : '';
          const lvl = Number(x.level) || 0;
          const line = [lvl ? ORD(lvl) + '-level ' + (x.school || '') : (x.school ? x.school + ' cantrip' : 'Cantrip'), x.castingTime, x.range, comp, x.duration].filter(Boolean).join(' · ');
          text = line + '\n\n' + text;
        }
        put(x.name, text);
        if (x.label) put(x.label, text);
      }
      const cur = (store.spellSlots && store.spellSlots.currentByLevel) || {};
      for (let l = 1; l <= 9; l++) if (maxBy[l]) slots.push({ level: l, cur: Number(cur[LEVELS[l - 1]]) || 0, max: maxBy[l], editable: false });
    }
    // Classic sheet: repeating rows.
    const rows = {};
    for (const [name, a] of Object.entries(by)) {
      const m = /^repeating_(.+?)_(-[A-Za-z0-9_-]{19,})_(.+)$/.exec(name);
      if (!m) continue;
      const k = m[1] + '|' + m[2];
      (rows[k] ||= { sec: m[1].toLowerCase() })[m[3].toLowerCase()] = g(a, 'current');
    }
    for (const r of Object.values(rows)) {
      if (/^spell-/.test(r.sec) && r.spellname) {
        const lvl = r.sec === 'spell-cantrip' ? 0 : Number(r.sec.slice(6)) || 0;
        const comp = [r.spellcomp_v && r.spellcomp_v !== '0' ? 'V' : '', r.spellcomp_s && r.spellcomp_s !== '0' ? 'S' : '', r.spellcomp_m && r.spellcomp_m !== '0' ? 'M' : ''].filter(Boolean).join(', ');
        const line = [lvl ? ORD(lvl) + '-level ' + (r.spellschool || '') : 'Cantrip', r.spellcastingtime, r.spellrange, comp, r.spellduration].filter(Boolean).join(' · ');
        put(r.spellname, line + '\n\n' + (r.spelldescription || '') + (r.spellathigherlevels ? '\n\nAt Higher Levels. ' + r.spellathigherlevels : ''));
      }
      else if (r.sec === 'inventory' && r.itemname) put(r.itemname, r.itemcontent);
      else if (r.sec === 'traits' && r.name) put(r.name, r.description);
      else if (/^npc/.test(r.sec) && r.name) put(r.name, r.description || r.desc);
      else if (r.sec === 'attack' && r.atkname) put(r.atkname, r.atk_desc);
    }
    if (!ints) {
      for (let l = 1; l <= 9; l++) {
        const tot = Number(by['lvl' + l + '_slots_total'] && g(by['lvl' + l + '_slots_total'], 'current'));
        if (tot > 0) slots.push({ level: l, cur: Number(by['lvl' + l + '_slots_expended'] && g(by['lvl' + l + '_slots_expended'], 'current')) || 0, max: tot, editable: true });
      }
    }
    return { info, slots };
  }
  // Token markers: the campaign's set (plus Roll20's colour dots), and which
  // ones the token shows.
  const COLOURS = ['red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow', 'dead'];
  function markers(tokenId) {
    let set = [];
    try { const raw = window.Campaign.get('token_markers'); set = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []; } catch { set = []; }
    const list = COLOURS.map((t) => ({ tag: t, name: t })).concat(set.filter((m) => m && m.tag).map((m) => ({ tag: String(m.tag), name: String(m.name || m.tag) })));
    const t = tokenModel(tokenId);
    const on = t ? String(g(t, 'statusmarkers') || '').split(',').map((x) => x.split('@')[0]).filter(Boolean) : [];
    return { token: !!t, list, on };
  }
  const calls = {
    details: ({ id }) => { const c = charOf(id); return c ? details(c) : null; },
    markers: ({ token }) => markers(token),
    toggleMarker: ({ token, tag }) => {
      const t = tokenModel(token);
      if (!t) return { ok: false, msg: 'No token for this character on this page.' };
      const cur = String(g(t, 'statusmarkers') || '').split(',').filter(Boolean);
      const has = cur.some((x) => x.split('@')[0] === tag);
      const next = has ? cur.filter((x) => x.split('@')[0] !== tag) : cur.concat(tag);
      t.save({ statusmarkers: next.join(',') });
      return { ok: true, on: !has };
    },
    endTurn: ({ token }) => {
      const raw = window.Campaign.get('turnorder');
      const list = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : (raw || []).slice();
      if (!list.length || String(list[0].id) !== String(token)) return { ok: false, msg: 'It isn\'t this token\'s turn.' };
      list.push(list.shift());
      window.Campaign.save({ turnorder: JSON.stringify(list) });
      return { ok: true };
    },
    slot: ({ id, level, delta }) => {
      const c = charOf(id);
      const by = {};
      for (const a of attrsOf(c)) by[String(g(a, 'name'))] = a;
      const tot = by['lvl' + level + '_slots_total'];
      const left = by['lvl' + level + '_slots_expended'];
      if (!tot || !left) return { ok: false, msg: 'Change this spell slot on the sheet.' };
      const max = Number(g(tot, 'current')) || 0;
      const v = Math.max(0, Math.min(max, (Number(g(left, 'current')) || 0) + (Number(delta) || 0)));
      left.save({ current: String(v) });
      return { ok: true, cur: v, max };
    },
  };
  document.addEventListener('r20c-call', (e) => {
    let d;
    try { d = JSON.parse(e.detail); } catch { return; }
    let result;
    try { result = calls[d.fn] ? calls[d.fn](d.args || {}) : { ok: false, msg: 'Unknown request.' }; }
    catch (err) { result = { ok: false, msg: String((err && err.message) || err) }; }
    document.dispatchEvent(new CustomEvent('r20c-call-reply', { detail: JSON.stringify({ req: d.req, result }) }));
  });

  setInterval(tick, 300);
  document.addEventListener('r20c-selection-status', () => {
    document.dispatchEvent(new CustomEvent('r20c-selection-status-reply', { detail: JSON.stringify(state) }));
  });
})();
