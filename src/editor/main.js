// Editor entry point: ties the sheet bridge, saved data and the sidebar UI.
(function (G) {
  'use strict';
  const C = G.R20C;
  if (window.top !== window || window.__r20Companion) return;
  window.__r20Companion = true;

  const store = (G.browser && browser.storage && browser.storage.local) || null;
  const get = async (k, d) => { try { const v = store ? (await store.get(k))[k] : undefined; return v === undefined ? d : v; } catch { return d; } };
  const set = (k, v) => { try { if (store) store.set({ [k]: v }); } catch { /* storage unavailable */ } };

  const snaps = new Map(); // charId -> snapshot (live or saved)
  // One failing step must never stop the bar from appearing.
  const errors = [];
  const guard = (label, fn) => (...args) => {
    try {
      const r = fn(...args);
      if (r && typeof r.catch === 'function') r.catch((e) => note(label, e));
      return r;
    } catch (e) { note(label, e); return undefined; }
  };
  function note(label, e) {
    const msg = label + ': ' + String((e && e.message) || e);
    errors.push(msg);
    if (errors.length > 10) errors.shift();
    console.error('[Roll20embetterment]', msg, e);
  }
  let prefs = { autoHide: true, spend: true, background: true, follow: true, turnCue: true };
  let active = null;
  let chosen = false; // the person picked or opened a character this session
  let firstScan = true;
  const conc = new Map(); // charId -> concentration { spell, dc? }
  let myTurn = false; // the bar glows while it's one of your characters' turns

  const ui = C.createUI({
    run: async (act) => {
      if (act.op === 'end-turn' || act.op === 'status' || /^slot:/.test(String(act.ref || ''))) return pageAction(act);
      if (LOCAL_OPS.has(act.op)) return localAction(act);
      if (!active) return { ok: false, msg: 'Choose a character first.' };
      const id = active;
      const res = await C.sheets.invoke(id, act, prefs);
      return res && res.ok ? afterAction(id, act, res) : res;
    },
    select: (id) => { chosen = true; return select(id, true); },
    pref: (k, v) => { prefs = { ...prefs, [k]: v }; set('prefs', prefs); if (k === 'turnCue') myTurn = myTurn && v; refresh(); },
    toggleHidden: (id) => { C.sheets.setHidden(id, !C.sheets.isHidden(id)); refresh(); },
    // Right-click an entry: pin it to (or unpin it from) Favorites.
    pin: (key, label) => {
      if (!active || !key) return;
      const pins = { ...(prefs.pins || {}) };
      // Pins remember the entry's name too, so they survive the sheet reordering.
      const list = (pins[active] || []).slice();
      const i = list.findIndex((p) => (typeof p === 'string' ? p : p.key) === key);
      if (i >= 0) list.splice(i, 1); else list.push({ key, label: String(label || '') });
      pins[active] = list;
      prefs = { ...prefs, pins };
      set('prefs', prefs);
      ui.toast(i >= 0 ? 'Removed from Favorites.' : 'Pinned to Favorites.');
      refresh();
    },
    savePos: (pos) => set('barPos', pos),
    diag: async () => {
      const snap = active ? snaps.get(active) : null;
      const count = (k) => (snap && snap[k] ? snap[k].length : 0);
      const info = {
        companion: (G.browser && browser.runtime && browser.runtime.getManifest().version) || 'dev',
        userAgent: navigator.userAgent,
        active, live: !!(active && C.sheets.isLive(active)), open: C.sheets.isOpen(active),
        dialogs: document.querySelectorAll('.characterdialog[data-characterid]').length,
        sheetFrames: document.querySelectorAll('iframe[name^="iframe_"]').length,
        classic: active ? C.sheets.classicInfo(active) : null,
        journal: C.sheets.journal().length,
        toolbar: !!document.getElementById('master-toolbar'),
        gm: isGM(), controlled: controlled(), background: keep, errors,
        selection: { script: await selectionStatus(), last: lastSelection, recent },
        bar: (() => { const h = document.getElementById('r20-companion'); const st = h && h.shadowRoot && h.shadowRoot.querySelector('.strip'); return st ? st.getBoundingClientRect().toJSON() : null; })(),
        window: { w: innerWidth, h: innerHeight },
        toolbarRect: document.getElementById('master-toolbar')?.getBoundingClientRect().toJSON() || null,
        sheet: snap ? {
          classic: !!snap.classic, type: snap.type, name: snap.name, stats: snap.stats,
          counts: Object.fromEntries(['attacks', 'actions', 'features', 'items', 'spells', 'abilities', 'checks', 'hitDice', 'rests'].map((k) => [k, count(k)])),
          privacy: snap.privacy, mode: snap.mode,
        } : null,
      };
      try { await navigator.clipboard.writeText(JSON.stringify(info, null, 2)); return true; } catch { return false; }
    },
  });

  function people() {
    const seen = new Set();
    const list = [];
    for (const j of C.sheets.journal()) {
      seen.add(j.id);
      list.push({ ...j, open: C.sheets.isOpen(j.id), hidden: C.sheets.isHidden(j.id), cached: snaps.has(j.id) });
    }
    // Open sheets the Journal does not list (rare) still appear.
    for (const [id, s] of snaps) {
      if (!seen.has(id) && C.sheets.isOpen(id)) list.push({ id, name: s.name, img: '', open: true, hidden: C.sheets.isHidden(id), cached: true });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  function refresh() {
    const snap = active ? snaps.get(active) : null;
    const j = active ? C.sheets.journal().find((x) => x.id === active) : null;
    ui.update({
      character: active ? { id: active, name: (snap && snap.name) || (j && j.name) || 'Character', img: (j && j.img) || '', stats: snap && snap.stats } : null,
      live: !!(active && C.sheets.isLive(active)),
      cats: (() => {
        let cats = [];
        try { cats = C.buildMenus(withDetails(snap), prefs, { conc: active ? conc.get(active) || null : null }); } catch (e) { note('menus', e); }
        try {
          if (snap) { const i = cats.findIndex((c) => c.key === 'hp'); cats.splice(i + 1, 0, C.turnMenu(turnFor(snap))); }
        } catch (e) { note('turn', e); }
        return cats;
      })(),
      myTurn,
      people: people(),
    });
  }

  async function select(id, openIfNeeded) {
    active = id;
    set('active', id);
    if (!snaps.has(id)) {
      const saved = await get('snap:' + id, null);
      if (saved) snaps.set(id, saved);
    }
    refresh();
    if (openIfNeeded && !snaps.has(id) && !C.sheets.isLive(id)) {
      ui.toast('Opening sheet…');
      const ok = await C.sheets.open(id, { hidden: !!prefs.autoHide });
      if (!ok) ui.toast('Could not open that sheet.', true);
      refresh();
    }
  }

  C.sheets.on('snapshot', guard('snapshot', (id, snap) => {
    snaps.set(id, snap);
    set('snap:' + id, snap);
    if (!active) select(id); else if (id === active) refresh();
  }));
  C.sheets.on('dialogs', guard('dialogs', (ids, opened) => {
    // A sheet the user just opened becomes the active character.
    const fresh = opened.filter((id) => !C.sheets.isHidden(id));
    // Sheets already open when the page loaded don't outrank the player's own
    // character; sheets opened afterwards do.
    if (fresh.length && !firstScan) chosen = true;
    firstScan = false;
    if (fresh.length) select(fresh[fresh.length - 1]); else refresh();
  }));

  // ---- background sheet for players -----------------------------------------
  // Keep the player's own character sheet loaded (hidden) so every action
  // works immediately. Roll20 data is read through Firefox's page-object
  // access; if that is unavailable we fall back to the last character used.
  const page = () => { try { return G.wrappedJSObject || null; } catch { return null; } };
  function isGM() {
    try {
      const W = page();
      if (W && typeof W.is_gm === 'boolean') return W.is_gm;
    } catch { /* fall through */ }
    return !!document.getElementById('layers-label'); // only GMs get the layer switcher
  }
  function controlled() {
    try {
      const W = page();
      const me = String(W.d20_player_id || (W.currentPlayer && W.currentPlayer.id) || '');
      const models = W.Campaign && W.Campaign.characters && W.Campaign.characters.models;
      if (!me || !models) return null;
      const mine = [];
      const shared = [];
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const by = String(m.get('controlledby') || '').split(',').map((x) => x.trim());
        if (by.includes(me)) mine.push(String(m.id));
        else if (by.includes('all')) shared.push(String(m.id));
      }
      return mine.length ? mine : shared;
    } catch { return null; }
  }
  let keep = null;
  let retryAt = 0;
  function backgroundTarget() {
    const inJournal = new Set(C.sheets.journal().map((j) => j.id));
    const mine = controlled();
    if (mine && mine.length) return mine.includes(active) ? active : mine.find((id) => inJournal.has(id)) || null;
    return active && inJournal.has(active) ? active : null;
  }
  async function keeper() {
    if (!prefs.background || isGM()) return;
    const id = backgroundTarget();
    if (!id) return;
    if (keep && keep !== id) C.sheets.closeOwned(keep); // only closes a hidden sheet we opened
    if (keep !== id) retryAt = 0;
    keep = id;
    if (!chosen && active !== id) select(id);
    if (C.sheets.isOpen(id) || Date.now() < retryAt) return;
    retryAt = Date.now() + 30000; // one attempt at a time
    const ok = await C.sheets.open(id, { hidden: true });
    retryAt = ok ? 0 : Date.now() + 20000; // back off only after a failure
    refresh();
  }
  setInterval(guard('keeper', keeper), 4000);

  // ---- follow the selected token -------------------------------------------
  // selection.js (in Roll20's page) reports the characters that the selected
  // tokens represent. The bar switches to the first one and loads its sheet
  // hidden so actions are instant. Players only follow characters they control.
  const recent = []; // background sheets opened for selected tokens, oldest first
  let followSeq = 0;
  let lastSelection = null;
  function remember(id) {
    const i = recent.indexOf(id);
    if (i >= 0) recent.splice(i, 1);
    recent.push(id);
    // Keep at most three; never close the active character or the player's own.
    for (let n = 0; recent.length > 3 && n < recent.length; n++) {
      const old = recent[0];
      if (old === active || old === keep) { recent.push(recent.shift()); continue; }
      recent.shift();
      C.sheets.closeOwned(old);
    }
  }
  document.addEventListener('r20c-selection', guard('selection', async (e) => {
    let sel;
    try { sel = JSON.parse(e.detail); } catch { return; }
    lastSelection = sel;
    if (!prefs.follow) return;
    const id = Array.isArray(sel.chars) ? String(sel.chars[0] || '') : '';
    const label = (sel.names && sel.names[0]) ? '“' + sel.names[0] + '”' : 'That token';
    if (!id) {
      // Say why nothing happened, so an unlinked token doesn't look like a bug.
      if (sel.tokens && sel.unlinked) ui.toast(label + ' isn’t linked to a character sheet. Link it in the token’s settings (“Represents Character”).', true);
      return;
    }
    if (id === active) return;
    const visible = C.sheets.journal().some((j) => j.id === id) || C.sheets.isOpen(id);
    if (!visible) { ui.toast(label + '’s character isn’t in your Journal, so it can’t be opened.', true); return; }
    if (!isGM()) {
      const mine = controlled();
      if (mine && !mine.includes(id)) return; // players only follow their own characters
    }
    const mySeq = ++followSeq;
    chosen = true;
    await select(id);
    if (C.sheets.isOpen(id) || mySeq !== followSeq) return;
    ui.toast('Loading ' + label.replace(/^That token$/, 'the selected character') + '…');
    const ok = await C.sheets.open(id, { hidden: true });
    if (ok && C.sheets.isOwned(id)) remember(id);
    if (!ok && mySeq === followSeq) ui.toast('Could not open that character’s sheet.', true);
    refresh();
  }));
  // ---- this turn: actions used and movement ---------------------------------
  // Movement is measured in selection.js. Everything here is keyed by the
  // token's turn count ("tokenId:seq"), so it all clears when its turn comes
  // up. A character with no token on the page gets a count of its own.
  let moveState = { tokens: {}, turn: '', units: 'ft' };
  const dashing = new Set(); // turn keys with Dash on
  const used = new Map(); // turn key -> { action, bonus, reaction }
  const ownSeq = new Map(); // charId -> turn count when there's no token
  const speedMode = new Map(); // charId -> 'walk' | 'fly' | ...
  const ECON_NAMES = { action: 'Action', bonus: 'Bonus action', reaction: 'Reaction' };
  const LOCAL_OPS = new Set(['move-dash', 'move-difficult', 'move-mode', 'turn-reset', 'econ', 'conc-start', 'conc-end', 'chat-roll']);

  let lastTurn = null;
  document.addEventListener('r20c-movement', guard('movement', (e) => {
    try { moveState = JSON.parse(e.detail); } catch { return; }
    if (moveState.turn !== lastTurn) { lastTurn = moveState.turn; turnCue(); }
    if (active) refresh();
  }));
  // The active character's token: the selected one, else one on the turn, else the first.
  function moveToken() {
    if (!active) return null;
    const tokens = moveState.tokens || {};
    const sel = lastSelection && lastSelection.tokenOf && lastSelection.tokenOf[active];
    if (sel && tokens[sel]) return sel;
    const mine = Object.keys(tokens).filter((id) => tokens[id].char === active);
    return mine.find((id) => id === moveState.turn) || mine[0] || null;
  }
  function turnKey() {
    const id = moveToken();
    return id ? id + ':' + moveState.tokens[id].seq : 'c:' + active + ':' + (ownSeq.get(active) || 0);
  }
  function turnFor(snap) {
    const id = moveToken();
    const out = { used: used.get(turnKey()) || {}, inOrder: !!moveState.turn, canEnd: !!id && id === moveState.turn, move: null };
    if (!id) return out;
    const t = moveState.tokens[id];
    const stats = (snap && snap.stats) || {};
    const speeds = { ...(stats.speeds || {}) };
    if (!speeds.walk && Number(stats.speed) > 0) speeds.walk = Number(stats.speed);
    let mode = speedMode.get(active) || 'walk';
    if (!speeds[mode]) mode = 'walk';
    const speed = speeds[mode] || (Number(stats.speed) > 0 ? Number(stats.speed) : null);
    out.move = { feet: t.feet, speed, speeds, mode, units: moveState.units || 'ft', dash: dashing.has(turnKey()), difficult: !!t.difficult };
    return out;
  }
  function markUsed(key, kind, on = true) {
    const u = { ...(used.get(key) || {}) };
    u[kind] = on;
    used.set(key, u);
  }

  // ---- details from Roll20's page: descriptions, spell slots, token markers ----
  let reqN = 0;
  function pageCall(fn, args, ms = 3000) {
    return new Promise((resolve) => {
      const req = ++reqN;
      const on = (e) => { let d; try { d = JSON.parse(e.detail); } catch { return; } if (d.req !== req) return; document.removeEventListener('r20c-call-reply', on); resolve(d.result); };
      document.addEventListener('r20c-call-reply', on);
      document.dispatchEvent(new CustomEvent('r20c-call', { detail: JSON.stringify({ fn, req, args }) }));
      setTimeout(() => { document.removeEventListener('r20c-call-reply', on); resolve(null); }, ms);
    });
  }
  const details = new Map(); // charId -> { info, slots, at }
  const markerState = new Map(); // tokenId -> { list, on, at }
  const fetching = new Set();
  // stamp: re-read when it changes (the sheet's reading time), else after maxAge.
  function freshen(key, map, fn, args, stamp = null, maxAge = 4000) {
    const have = map.get(key);
    const fresh = have && (stamp !== null ? have.stamp === stamp && Date.now() - have.at < maxAge : Date.now() - have.at < maxAge);
    if (fresh || fetching.has(key)) return;
    fetching.add(key);
    pageCall(fn, args).then((r) => {
      fetching.delete(key);
      // Remember failures too, so a character Roll20 can't describe isn't asked about on every redraw.
      map.set(key, { ...(r || { info: {}, slots: [], list: [], on: [], token: false }), at: Date.now(), stamp });
      if (r) refresh();
    });
  }
  const nname = (n) => String(n || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const pretty = (t) => String(t).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  // The sheet reading plus what only Roll20's page knows.
  function withDetails(snap) {
    if (!snap || !active) return snap;
    // Descriptions change only when the sheet does: re-read with a new sheet
    // reading (or once a minute); markers can change any time (every 4 s).
    freshen(active, details, 'details', { id: active }, snap.at || null, 60000);
    const d = details.get(active);
    const out = { ...snap };
    if (d) {
      // Each list looks in its own kind first (a Shield item and the Shield
      // spell have different texts), then in the others.
      const ORDER = { attacks: ['attack', 'item', 'spell', 'feature'], actions: ['feature', 'attack', 'item', 'spell'],
        features: ['feature', 'spell', 'item'], items: ['item', 'attack', 'feature'], spells: ['spell', 'attack', 'feature'] };
      const bags = d.info && !d.info.spell && typeof d.info === 'object' ? { feature: d.info } : d.info || {};
      const info = (x, list) => {
        const names = [nname(x.name), nname(String(x.name).replace(/\s*\(.*\)\s*$/, '').replace(/^throw\s+/i, ''))];
        for (const kind of ORDER[list]) for (const n of names) if (bags[kind] && bags[kind][n]) return bags[kind][n];
        return '';
      };
      for (const k of Object.keys(ORDER)) out[k] = (snap[k] || []).map((x) => ({ ...x, info: info(x, k) }));
      out.slots = (d.slots || []).map((x) => ({
        ref: (x.pact ? 'pact:' : 'slot:') + x.level, label: x.pact ? 'Pact (' + ORD(x.level) + ')' : ORD(x.level) + ' level',
        cur: x.cur, max: x.max || null, readOnly: !x.editable,
      }));
    }
    const tok = moveToken();
    if (tok) {
      freshen(tok, markerState, 'markers', { token: tok });
      const m = markerState.get(tok);
      if (m && m.token) {
        const COLOURS = new Set(['red', 'blue', 'green', 'brown', 'purple', 'pink', 'yellow']);
        out.conditions = m.list.map((x) => ({ ref: 'marker:' + x.tag, name: pretty(x.name), active: m.on.includes(x.tag), group: COLOURS.has(x.tag) ? 'Colour dots' : 'Markers' }));
        out.effectsLabel = 'Token markers';
        out.conditionsLabel = 'Markers on the token';
      }
    }
    out.favorites = (prefs.pins && prefs.pins[active]) || [];
    return out;
  }
  const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  // Bar actions that Roll20's page carries out.
  async function pageAction(act) {
    const ref = String(act.ref || '');
    if (act.op === 'end-turn') {
      const tok = moveToken();
      const r = tok ? await pageCall('endTurn', { token: tok }) : { ok: false, msg: 'No token for this character on this page.' };
      return r && r.ok ? { ok: true, msg: 'Turn ended.' } : r || { ok: false, msg: 'Roll20 didn’t answer.' };
    }
    if (act.op === 'status' && ref.startsWith('marker:')) {
      const tok = moveToken();
      const tag = ref.slice(7);
      const r = tok ? await pageCall('toggleMarker', { token: tok, tag }) : { ok: false, msg: 'No token for this character on this page.' };
      markerState.delete(tok);
      refresh();
      return r && r.ok ? { ok: true, msg: pretty(tag) + (r.on ? ' on.' : ' off.') } : r || { ok: false, msg: 'Roll20 didn’t answer.' };
    }
    if (ref.startsWith('slot:')) {
      const r = await pageCall('slot', { id: active, level: Number(ref.slice(5)), delta: Number(act.arg && act.arg.delta) || 0 });
      details.delete(active);
      refresh();
      return r && r.ok ? { ok: true, msg: r.cur + '/' + r.max } : r || { ok: false, msg: 'Roll20 didn’t answer.' };
    }
    return { ok: false, msg: 'Unknown action.' };
  }

  // Anything the bar does that changes no sheet.
  function localAction(act) {
    const ok = (msg) => { refresh(); return { ok: true, msg }; };
    if (act.op === 'chat-roll') {
      const snap = active ? snaps.get(active) : null;
      const who = String((snap && snap.name) || '').replace(/[{}]/g, '');
      const a = act.arg || {};
      const msg = '&{template:default} {{name=' + (who ? who + ': ' : '') + a.title + '}} {{Roll=[[' + a.expr + ']]}}';
      if (!sendChat(msg)) return { ok: false, msg: 'Roll20’s chat box isn’t available.' };
      return afterAction(active, act, { ok: true, msg: 'Rolled in chat.' });
    }
    if (!active) return { ok: false, msg: 'Choose a character first.' };
    if (act.op === 'econ') {
      const k = turnKey();
      const now = !(used.get(k) || {})[act.arg];
      markUsed(k, act.arg, now);
      return ok(ECON_NAMES[act.arg] + (now ? ' used.' : ' available.'));
    }
    if (act.op === 'conc-start') { conc.set(active, { spell: '' }); saveConc(); return ok('Tracking concentration.'); }
    if (act.op === 'conc-end') { conc.delete(active); saveConc(); return ok('Done.'); }
    if (act.op === 'turn-reset') {
      const id = moveToken();
      if (id) document.dispatchEvent(new CustomEvent('r20c-movement-reset', { detail: JSON.stringify({ token: id }) }));
      else ownSeq.set(active, (ownSeq.get(active) || 0) + 1);
      return ok('Actions and movement cleared.');
    }
    const id = moveToken();
    if (!id) return { ok: false, msg: 'No token for this character on the current page.' };
    const t = moveState.tokens[id];
    if (act.op === 'move-dash') {
      const k = turnKey();
      if (dashing.has(k)) dashing.delete(k); else { dashing.add(k); markUsed(k, 'action'); }
      return ok(dashing.has(k) ? 'Action used.' : '');
    }
    if (act.op === 'move-difficult') {
      t.difficult = !t.difficult; // shown at once; selection.js confirms
      document.dispatchEvent(new CustomEvent('r20c-movement-mode', { detail: JSON.stringify({ token: id, difficult: t.difficult }) }));
      return ok(t.difficult ? 'Moves now count double.' : 'Moves count normally.');
    }
    if (act.op === 'move-mode') { speedMode.set(active, act.arg); return ok(''); }
    return { ok: false, msg: 'Unknown action.' };
  }

  // After a sheet action works: note what it used this turn and concentration.
  function afterAction(id, act, res) {
    const extra = [];
    if (id === active && act.econ) {
      const k = turnKey();
      const was = (used.get(k) || {})[act.econ];
      markUsed(k, act.econ);
      if (!was) extra.push(ECON_NAMES[act.econ] + ' used.');
    }
    if (act.conc) {
      const prev = conc.get(id);
      conc.set(id, { spell: act.conc });
      extra.push('Concentrating on ' + act.conc + (prev && prev.spell && prev.spell !== act.conc ? ' (' + prev.spell + ' ended)' : '') + '.');
      saveConc();
    }
    if (act.op === 'damage' && conc.has(id) && Number(act.arg) > 0) {
      const dc = C.concentrationDC(act.arg);
      conc.set(id, { ...conc.get(id), dc });
      extra.push('Concentration save: DC ' + dc + ' (in Hit points).');
      saveConc();
    }
    if (act.clearsDc && conc.has(id)) { const c = { ...conc.get(id) }; delete c.dc; conc.set(id, c); saveConc(); }
    if (act.op === 'longrest' && conc.has(id)) { conc.delete(id); saveConc(); }
    refresh();
    return extra.length ? { ...res, msg: [res.msg, ...extra].filter(Boolean).join(' ') } : res;
  }
  const saveConc = () => set('conc', Object.fromEntries(conc));

  // Post a roll to Roll20's chat, as if typed and sent.
  function sendChat(msg) {
    const box = document.querySelector('#textchat-input textarea');
    const send = document.querySelector('#textchat-input .btn, #textchat-input button');
    if (!box || !send) return false;
    const draft = box.value;
    box.value = msg;
    send.click();
    if (draft) setTimeout(() => { if (!box.value) box.value = draft; }, 0);
    return true;
  }

  // Your turn: glow the bar, say so once, and switch to that character.
  function turnCue() {
    const tok = moveState.tokens && moveState.tokens[moveState.turn];
    const mineList = isGM() ? (active ? [active] : []) : controlled() || (active ? [active] : []);
    const mine = !!(tok && tok.char && mineList.includes(tok.char));
    myTurn = mine && prefs.turnCue !== false;
    if (!myTurn) { refresh(); return; }
    const snap = snaps.get(tok.char);
    ui.toast('Your turn' + ((snap && snap.name) || tok.name ? ': ' + ((snap && snap.name) || tok.name) : '') + '.');
    if (tok.char !== active && prefs.follow) select(tok.char); else refresh();
  }

  function selectionStatus() {
    return new Promise((resolve) => {
      const done = (e) => { document.removeEventListener('r20c-selection-status-reply', done); try { resolve(JSON.parse(e.detail)); } catch { resolve(null); } };
      document.addEventListener('r20c-selection-status-reply', done);
      document.dispatchEvent(new CustomEvent('r20c-selection-status'));
      setTimeout(() => { document.removeEventListener('r20c-selection-status-reply', done); resolve('no reply from selection script'); }, 400);
    });
  }

  (async () => {
    prefs = { ...prefs, ...(await get('prefs', {})) };
    for (const [k, v] of Object.entries((await get('conc', {})) || {})) if (v) conc.set(k, v);
    ui.update({ pos: await get('barPos', null) });
    setTimeout(guard('keeper', keeper), 2500);
    const last = await get('active', null);
    try { if (last) await select(last); else refresh(); } catch (e) { note('start', e); refresh(); }
    guard('greet', C.sheets.greetAll)();
    ui.place();
  })().catch((e) => note('boot', e));
})(globalThis);
