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
    console.error('[R20 Companion]', msg, e);
  }
  let prefs = { autoHide: true, spend: true, background: true, follow: true };
  let active = null;
  let chosen = false; // the person picked or opened a character this session
  let firstScan = true;

  const ui = C.createUI({
    run: (act) => (active ? C.sheets.invoke(active, act, prefs) : { ok: false, msg: 'Choose a character first.' }),
    select: (id) => { chosen = true; return select(id, true); },
    pref: (k, v) => { prefs = { ...prefs, [k]: v }; set('prefs', prefs); refresh(); },
    toggleHidden: (id) => { C.sheets.setHidden(id, !C.sheets.isHidden(id)); refresh(); },
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
        journal: C.sheets.journal().length,
        toolbar: !!document.getElementById('master-toolbar'),
        gm: isGM(), controlled: controlled(), background: keep, errors,
        selection: { script: await selectionStatus(), last: lastSelection, recent },
        bar: (() => { const h = document.getElementById('r20-companion'); const st = h && h.shadowRoot && h.shadowRoot.querySelector('.strip'); return st ? st.getBoundingClientRect().toJSON() : null; })(),
        window: { w: innerWidth, h: innerHeight },
        toolbarRect: document.getElementById('master-toolbar')?.getBoundingClientRect().toJSON() || null,
        sheet: snap ? {
          type: snap.type, name: snap.name, stats: snap.stats,
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
      cats: (() => { try { return C.buildMenus(snap, prefs); } catch (e) { note('menus', e); return []; } })(),
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
    const id = Array.isArray(sel.chars) ? String(sel.chars[0] || '') : '';
    if (!id || !prefs.follow || id === active) return;
    const visible = C.sheets.journal().some((j) => j.id === id) || C.sheets.isOpen(id);
    if (!visible) return; // not a character this user can open
    if (!isGM()) {
      const mine = controlled();
      if (mine && !mine.includes(id)) return;
    }
    const mySeq = ++followSeq;
    chosen = true;
    await select(id);
    if (C.sheets.isOpen(id) || mySeq !== followSeq) return;
    const ok = await C.sheets.open(id, { hidden: true });
    if (ok && C.sheets.isOwned(id)) remember(id);
    refresh();
  }));
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
    ui.update({ pos: await get('barPos', null) });
    setTimeout(guard('keeper', keeper), 2500);
    const last = await get('active', null);
    try { if (last) await select(last); else refresh(); } catch (e) { note('start', e); refresh(); }
    guard('greet', C.sheets.greetAll)();
    ui.place();
  })().catch((e) => note('boot', e));
})(globalThis);
