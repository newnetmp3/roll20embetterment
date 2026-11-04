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
  let prefs = { autoHide: true, spend: true, background: true };
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
        gm: isGM(), controlled: controlled(), background: keep,
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
      cats: C.buildMenus(snap, prefs),
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

  C.sheets.on('snapshot', (id, snap) => {
    snaps.set(id, snap);
    set('snap:' + id, snap);
    if (!active) select(id); else if (id === active) refresh();
  });
  C.sheets.on('dialogs', (ids, opened) => {
    // A sheet the user just opened becomes the active character.
    const fresh = opened.filter((id) => !C.sheets.isHidden(id));
    // Sheets already open when the page loaded don't outrank the player's own
    // character; sheets opened afterwards do.
    if (fresh.length && !firstScan) chosen = true;
    firstScan = false;
    if (fresh.length) select(fresh[fresh.length - 1]); else refresh();
  });

  // ---- background sheet for players -----------------------------------------
  // Keep the player's own character sheet loaded (hidden) so every action
  // works immediately. Roll20 data is read through Firefox's page-object
  // access; if that is unavailable we fall back to the last character used.
  const page = () => { try { return G.wrappedJSObject || null; } catch { return null; } };
  function isGM() {
    const W = page();
    try { if (W && typeof W.is_gm === 'boolean') return W.is_gm; } catch { /* ignore */ }
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
  setInterval(keeper, 4000);

  (async () => {
    prefs = { ...prefs, ...(await get('prefs', {})) };
    ui.update({ pos: await get('barPos', null) });
    setTimeout(keeper, 2500);
    const last = await get('active', null);
    if (last) await select(last); else refresh();
    C.sheets.greetAll();
    ui.place();
  })();
})(globalThis);
